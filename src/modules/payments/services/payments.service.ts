import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus, PaymentType } from '../entities/transaction.entity';
import { FawaterkService } from './fawaterk.service';
import { SessionsService } from '../../sessions/services/sessions.service';
import { UsersService } from '../../users/services/users.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { ContentService } from '../../content/services/content.service';
import { EnrollmentSource } from '../../content/entities/enrollment.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly fawaterkService: FawaterkService,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly contentService: ContentService,
    private readonly configService: ConfigService,
  ) {}

  async createSessionCheckout(sessionId: string, userId: string): Promise<any> {
    // 1. Validate Session
    const session = await this.sessionsService.findById(sessionId);
    if (!session.isPaid || !session.price || session.price <= 0) {
      throw new BadRequestException('This session is free or does not require payment');
    }

    // 2. Get User Details
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // 3. Create Pending Transaction
    const transaction = this.transactionRepository.create({
      amount: session.price,
      currency: session.currency,
      status: TransactionStatus.PENDING,
      type: PaymentType.SESSION_BOOKING,
      referenceId: sessionId,
      userId: userId,
      userEmail: user.email,
      userPhone: user.phone,
      provider: 'fawaterk',
    });

    await this.transactionRepository.save(transaction);

    return this.processFawaterkPayment(transaction, user, `Session: ${session.titleEn}`, {
      custom_field_1: userId,
      custom_field_2: sessionId,
      custom_field_3: PaymentType.SESSION_BOOKING,
    });
  }

  async createSubscriptionCheckout(planId: string, userId: string): Promise<any> {
    // 1. Validate Plan
    const plan = await this.subscriptionsService.findPlanById(planId);

    if (!plan) throw new NotFoundException('Subscription plan not found');

    // 2. Get User
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // 3. Create Pending Transaction
    const transaction = this.transactionRepository.create({
      amount: plan.price,
      currency: plan.currency,
      status: TransactionStatus.PENDING,
      type: PaymentType.SUBSCRIPTION,
      referenceId: planId,
      userId: userId,
      userEmail: user.email,
      userPhone: user.phone,
      provider: 'fawaterk',
    });

    await this.transactionRepository.save(transaction);

    return this.processFawaterkPayment(transaction, user, `Subscription: ${plan.nameEn}`, {
      custom_field_1: userId,
      custom_field_2: planId,
      custom_field_3: PaymentType.SUBSCRIPTION,
    });
  }

  async createCourseCheckout(courseId: string, userId: string): Promise<any> {
    // 1. Validate Course
    const course = await this.contentService.findCourseById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    if (!course.price || course.price <= 0) {
      throw new BadRequestException('This course is free and does not require payment');
    }

    // 2. Get User
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // 3. Create Pending Transaction
    const transaction = this.transactionRepository.create({
      amount: course.price,
      currency: course.currency || 'EGP',
      status: TransactionStatus.PENDING,
      type: PaymentType.COURSE_ENROLLMENT,
      referenceId: courseId,
      userId: userId,
      userEmail: user.email,
      userPhone: user.phone,
      provider: 'fawaterk',
    });

    await this.transactionRepository.save(transaction);

    return this.processFawaterkPayment(
      transaction,
      user,
      `Course: ${course.titleEn || course.titleAr}`,
      {
        custom_field_1: userId,
        custom_field_2: courseId,
        custom_field_3: PaymentType.COURSE_ENROLLMENT,
      },
    );
  }

  private async processFawaterkPayment(
    transaction: Transaction,
    user: any,
    itemName: string,
    payload: any,
  ) {
    // Initiate Fawaterk Payment
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const fawaterkResponse = await this.fawaterkService.initiatePayment({
      cartTotal: transaction.amount,
      currency: transaction.currency,
      customer: {
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        phone: user.phone || user.email, // Fawaterk requires phone; fallback to email if missing
        address: 'Online',
      },
      redirectionUrls: {
        successUrl: `${baseUrl}/payment/success?transactionId=${transaction.id}`,
        failUrl: `${baseUrl}/payment/failed?transactionId=${transaction.id}`,
        pendingUrl: `${baseUrl}/payment/pending?transactionId=${transaction.id}`,
      },
      cartItems: [
        {
          name: itemName,
          price: transaction.amount,
          quantity: 1,
        },
      ],
      payLoad: payload,
    });

    // Update Transaction with Fawaterk Data
    if (fawaterkResponse.status === 'success') {
      transaction.providerTransactionId = fawaterkResponse.data.invoiceId.toString();
      transaction.paymentLink = fawaterkResponse.data.url;
      transaction.providerResponse = fawaterkResponse.data;
      await this.transactionRepository.save(transaction);

      return {
        paymentUrl: transaction.paymentLink,
        invoiceId: transaction.providerTransactionId,
      };
    } else {
      transaction.status = TransactionStatus.FAILED;
      transaction.providerResponse = fawaterkResponse;
      await this.transactionRepository.save(transaction);
      throw new BadRequestException('Payment initiation failed');
    }
  }

  async handleCallback(invoiceId: string, status: string): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { providerTransactionId: invoiceId },
    });

    if (!transaction) {
      this.logger.error(`Transaction not found for invoice: ${invoiceId}`);
      return;
    }

    if (status === 'paid' && transaction.status !== TransactionStatus.SUCCESS) {
      // Atomic status update — only one concurrent call can succeed
      const updateResult = await this.transactionRepository
        .createQueryBuilder()
        .update()
        .set({ status: TransactionStatus.SUCCESS })
        .where('id = :id AND status != :successStatus', {
          id: transaction.id,
          successStatus: TransactionStatus.SUCCESS,
        })
        .execute();

      if (updateResult.affected === 0) {
        this.logger.log(`Transaction ${transaction.id} already succeeded — skipping`);
        return;
      }

      // Idempotency: check if already fulfilled via metadata flag
      if ((transaction.metadata as any)?.fulfilled) {
        this.logger.log(`Transaction ${transaction.id} already fulfilled — skipping`);
        return;
      }

      try {
        // Fulfill the order based on payment type
        if (transaction.type === PaymentType.SESSION_BOOKING) {
          await this.sessionsService.registerAttendee(transaction.referenceId, transaction.userId);
        } else if (transaction.type === PaymentType.SUBSCRIPTION) {
          await this.subscriptionsService.createSubscriptionFromPayment(
            transaction.userId,
            transaction.referenceId,
            transaction.id,
          );
        } else if (transaction.type === PaymentType.COURSE_ENROLLMENT) {
          await this.contentService.enrollUserInCourse(
            transaction.referenceId,
            transaction.userId,
            EnrollmentSource.PAYMENT,
            transaction.id,
          );
          this.logger.log(
            `Course enrollment fulfilled for user ${transaction.userId}, course ${transaction.referenceId}`,
          );
        }

        // Mark as fulfilled to prevent double-fulfillment on webhook replay
        await this.transactionRepository.update(transaction.id, {
          metadata: {
            ...((transaction.metadata as any) || {}),
            fulfilled: true,
            fulfilledAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        this.logger.error(`Failed to fulfill order for transaction ${transaction.id}`, error);
        await this.transactionRepository.update(transaction.id, {
          metadata: {
            ...((transaction.metadata as any) || {}),
            fulfillmentError: (error as Error).message,
            fulfillmentFailedAt: new Date().toISOString(),
          },
        });
      }
    } else if (status === 'failed') {
      transaction.status = TransactionStatus.FAILED;
      await this.transactionRepository.save(transaction);
    }
  }
}
