import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus, PaymentType } from '../entities/transaction.entity';
import { FawaterkService } from './fawaterk.service';
import { PaymobService } from './paymob.service';
import { SessionsService } from '../../sessions/services/sessions.service';
import { UsersService } from '../../users/services/users.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { ContentService } from '../../content/services/content.service';
import { EnrollmentSource } from '../../content/entities/enrollment.entity';
import { ConfigService } from '@nestjs/config';
import { CheckoutResult } from '../interfaces/payment-provider.interface';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly fawaterkService: FawaterkService,
    private readonly paymobService: PaymobService,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly contentService: ContentService,
    private readonly configService: ConfigService,
  ) {}

  /* ============================================================== */
  /*  Provider Selection                                              */
  /* ============================================================== */

  private getActiveProvider(): 'paymob' | 'fawaterk' {
    const provider = this.configService.get<string>('ACTIVE_PAYMENT_PROVIDER') || 'paymob';
    return provider === 'fawaterk' ? 'fawaterk' : 'paymob';
  }

  /* ============================================================== */
  /*  Checkout Endpoints                                              */
  /* ============================================================== */

  async createSessionCheckout(sessionId: string, userId: string): Promise<CheckoutResult> {
    // 1. Validate Session
    const session = await this.sessionsService.findById(sessionId);
    if (!session.isPaid || !session.price || session.price <= 0) {
      throw new BadRequestException('This session is free or does not require payment');
    }

    // 2. Get User Details
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // 3. Prevent duplicate pending transactions for same user + resource
    await this.cancelStalePendingTransactions(userId, sessionId, PaymentType.SESSION_BOOKING);

    // 4. Create Pending Transaction
    const provider = this.getActiveProvider();
    const transaction = this.transactionRepository.create({
      amount: session.price,
      currency: session.currency,
      status: TransactionStatus.PENDING,
      type: PaymentType.SESSION_BOOKING,
      referenceId: sessionId,
      userId: userId,
      userEmail: user.email,
      userPhone: user.phone,
      provider,
    });

    await this.transactionRepository.save(transaction);

    return this.processPayment(transaction, user, `Session: ${session.titleEn}`, {
      custom_field_1: userId,
      custom_field_2: sessionId,
      custom_field_3: PaymentType.SESSION_BOOKING,
    });
  }

  async createSubscriptionCheckout(planId: string, userId: string): Promise<CheckoutResult> {
    // 1. Validate Plan
    const plan = await this.subscriptionsService.findPlanById(planId);
    if (!plan) throw new NotFoundException('Subscription plan not found');

    // 2. Get User
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // 3. Prevent duplicate pending transactions
    await this.cancelStalePendingTransactions(userId, planId, PaymentType.SUBSCRIPTION);

    // 4. Create Pending Transaction
    const provider = this.getActiveProvider();
    const transaction = this.transactionRepository.create({
      amount: plan.price,
      currency: plan.currency,
      status: TransactionStatus.PENDING,
      type: PaymentType.SUBSCRIPTION,
      referenceId: planId,
      userId: userId,
      userEmail: user.email,
      userPhone: user.phone,
      provider,
    });

    await this.transactionRepository.save(transaction);

    return this.processPayment(transaction, user, `Subscription: ${plan.nameEn}`, {
      custom_field_1: userId,
      custom_field_2: planId,
      custom_field_3: PaymentType.SUBSCRIPTION,
    });
  }

  async createCourseCheckout(courseId: string, userId: string): Promise<CheckoutResult> {
    // 1. Validate Course
    const course = await this.contentService.findCourseById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    if (!course.price || course.price <= 0) {
      throw new BadRequestException('This course is free and does not require payment');
    }

    // 2. Check if user is already enrolled
    const alreadyEnrolled = await this.contentService.isUserEnrolled(userId, courseId);
    if (alreadyEnrolled) {
      throw new BadRequestException('User is already enrolled in this course');
    }

    // 3. Get User
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // 4. Prevent duplicate pending transactions
    await this.cancelStalePendingTransactions(userId, courseId, PaymentType.COURSE_ENROLLMENT);

    // 5. Create Pending Transaction
    const provider = this.getActiveProvider();
    const transaction = this.transactionRepository.create({
      amount: course.price,
      currency: course.currency || 'EGP',
      status: TransactionStatus.PENDING,
      type: PaymentType.COURSE_ENROLLMENT,
      referenceId: courseId,
      userId: userId,
      userEmail: user.email,
      userPhone: user.phone,
      provider,
    });

    await this.transactionRepository.save(transaction);

    return this.processPayment(
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

  /* ============================================================== */
  /*  Payment Processing — Strategy Pattern                           */
  /* ============================================================== */

  private async processPayment(
    transaction: Transaction,
    user: any,
    itemName: string,
    metadata: Record<string, string>,
  ): Promise<CheckoutResult> {
    const provider = transaction.provider;

    if (provider === 'paymob') {
      return this.processPaymobPayment(transaction, user, itemName, metadata);
    } else {
      return this.processFawaterkPayment(transaction, user, itemName, metadata);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Paymob Payment Processing                                       */
  /* ---------------------------------------------------------------- */

  private async processPaymobPayment(
    transaction: Transaction,
    user: any,
    itemName: string,
    metadata: Record<string, string>,
  ): Promise<CheckoutResult> {
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const apiBaseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:4000';

    const result = await this.paymobService.initiatePayment(
      transaction,
      {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      },
      itemName,
      {
        ...metadata,
        notificationUrl: `${apiBaseUrl}/api/v1/payments/paymob/webhook`,
        redirectionUrl: `${baseUrl}/payment/result?transactionId=${transaction.id}&provider=paymob`,
      },
    );

    // Update transaction with provider response
    transaction.providerTransactionId = result.providerTransactionId || '';
    transaction.paymentLink = result.paymentUrl;
    transaction.providerResponse = {
      clientSecret: result.clientSecret,
      intentionId: result.providerTransactionId,
      iframeUrl: result.iframeUrl,
    };
    await this.transactionRepository.save(transaction);

    return result;
  }

  /* ---------------------------------------------------------------- */
  /*  Fawaterak Payment Processing (Legacy — preserved as-is)         */
  /* ---------------------------------------------------------------- */

  private async processFawaterkPayment(
    transaction: Transaction,
    user: any,
    itemName: string,
    payload: any,
  ): Promise<CheckoutResult> {
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const fawaterkResponse = await this.fawaterkService.initiatePayment({
      cartTotal: transaction.amount,
      currency: transaction.currency,
      customer: {
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        phone: user.phone || user.email,
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

    if (fawaterkResponse.status === 'success') {
      transaction.providerTransactionId = fawaterkResponse.data.invoiceId.toString();
      transaction.paymentLink = fawaterkResponse.data.url;
      transaction.providerResponse = fawaterkResponse.data;
      await this.transactionRepository.save(transaction);

      return {
        paymentUrl: transaction.paymentLink || '',
        provider: 'fawaterk',
        transactionId: transaction.id,
        providerTransactionId: transaction.providerTransactionId,
      };
    } else {
      transaction.status = TransactionStatus.FAILED;
      transaction.providerResponse = fawaterkResponse;
      await this.transactionRepository.save(transaction);
      throw new BadRequestException('Payment initiation failed');
    }
  }

  /* ============================================================== */
  /*  Webhook Callback Handlers                                       */
  /* ============================================================== */

  /**
   * Handle Paymob webhook callback.
   * Performs amount/currency verification before fulfillment.
   */
  async handlePaymobCallback(payload: any): Promise<void> {
    const webhookData = this.paymobService.extractWebhookData(payload);
    const internalId = this.paymobService.findInternalTransactionId(payload);

    this.logger.log(
      `Paymob webhook: providerTxn=${webhookData.providerTransactionId} ` +
        `success=${webhookData.success} pending=${webhookData.pending} ` +
        `amount=${webhookData.amountCents} refunded=${webhookData.isRefunded} ` +
        `internalRef=${internalId || 'unknown'}`,
    );

    // Find our transaction — by special_reference (our internal ID) or provider transaction ID
    let transaction: Transaction | null = null;

    if (internalId) {
      transaction = await this.transactionRepository.findOne({
        where: { id: internalId },
      });
    }

    if (!transaction) {
      // Fallback: search by provider transaction ID
      transaction = await this.transactionRepository.findOne({
        where: {
          providerTransactionId: webhookData.providerTransactionId,
          provider: 'paymob',
        },
      });
    }

    if (!transaction) {
      this.logger.error(
        `No transaction found for Paymob webhook: providerTxn=${webhookData.providerTransactionId} internalRef=${internalId}`,
      );
      return;
    }

    // Store the payment method used
    if (webhookData.paymentMethodType !== 'unknown') {
      transaction.paymentMethod = `${webhookData.paymentMethodSubType} (${webhookData.paymentMethodType})`;
    }

    // Store raw provider response for audit trail
    transaction.providerResponse = {
      ...((transaction.providerResponse as any) || {}),
      lastWebhook: webhookData.rawPayload,
      lastWebhookAt: new Date().toISOString(),
    };

    // Update provider transaction ID if not set yet
    if (!transaction.providerTransactionId) {
      transaction.providerTransactionId = webhookData.providerTransactionId;
    }

    await this.transactionRepository.save(transaction);

    // Handle refund
    if (webhookData.isRefunded) {
      await this.handleRefund(transaction);
      return;
    }

    // Handle void
    if (webhookData.isVoided) {
      await this.handleVoid(transaction);
      return;
    }

    // Handle successful payment
    if (webhookData.success && !webhookData.pending) {
      // ⚠️ SECURITY: Verify amount and currency match our stored values
      const expectedAmountCents = Math.round(transaction.amount * 100);
      if (webhookData.amountCents !== expectedAmountCents) {
        this.logger.error(
          `AMOUNT MISMATCH for transaction ${transaction.id}: ` +
            `expected=${expectedAmountCents} received=${webhookData.amountCents}`,
        );
        transaction.metadata = {
          ...((transaction.metadata as any) || {}),
          securityAlert: 'amount_mismatch',
          expectedAmount: expectedAmountCents,
          receivedAmount: webhookData.amountCents,
          alertAt: new Date().toISOString(),
        };
        await this.transactionRepository.save(transaction);
        return; // Do NOT fulfill — possible tampering
      }

      if (
        webhookData.currency.toUpperCase() !== (transaction.currency || 'EGP').toUpperCase()
      ) {
        this.logger.error(
          `CURRENCY MISMATCH for transaction ${transaction.id}: ` +
            `expected=${transaction.currency} received=${webhookData.currency}`,
        );
        transaction.metadata = {
          ...((transaction.metadata as any) || {}),
          securityAlert: 'currency_mismatch',
          expectedCurrency: transaction.currency,
          receivedCurrency: webhookData.currency,
          alertAt: new Date().toISOString(),
        };
        await this.transactionRepository.save(transaction);
        return; // Do NOT fulfill — possible tampering
      }

      await this.fulfillTransaction(transaction);
    } else if (webhookData.errorOccurred || (!webhookData.success && !webhookData.pending)) {
      // Handle failed payment — only if currently pending (state machine enforcement)
      if (transaction.status === TransactionStatus.PENDING) {
        transaction.status = TransactionStatus.FAILED;
        transaction.metadata = {
          ...((transaction.metadata as any) || {}),
          failedAt: new Date().toISOString(),
          failReason: webhookData.errorOccurred ? 'error_occurred' : 'payment_declined',
        };
        await this.transactionRepository.save(transaction);
        this.logger.log(`Transaction ${transaction.id} marked as FAILED`);
      }
    }
    // If pending, we just wait for the next webhook
  }

  /**
   * Handle Fawaterak webhook callback (preserved from original implementation).
   */
  async handleFawaterkCallback(invoiceId: string, status: string): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { providerTransactionId: invoiceId },
    });

    if (!transaction) {
      this.logger.error(`Transaction not found for invoice: ${invoiceId}`);
      return;
    }

    if (status === 'paid' && transaction.status !== TransactionStatus.SUCCESS) {
      await this.fulfillTransaction(transaction);
    } else if (status === 'failed') {
      if (transaction.status === TransactionStatus.PENDING) {
        transaction.status = TransactionStatus.FAILED;
        await this.transactionRepository.save(transaction);
      }
    }
  }

  /* ============================================================== */
  /*  Fulfillment — shared logic for all providers                    */
  /* ============================================================== */

  private async fulfillTransaction(transaction: Transaction): Promise<void> {
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
      this.logger.log(`Transaction ${transaction.id} already succeeded — skipping fulfillment`);
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

      this.logger.log(
        `Transaction ${transaction.id} fulfilled successfully (${transaction.type})`,
      );
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
  }

  /* ============================================================== */
  /*  Refund & Void Handling                                          */
  /* ============================================================== */

  private async handleRefund(transaction: Transaction): Promise<void> {
    // State machine: only SUCCESS transactions can be refunded
    if (transaction.status !== TransactionStatus.SUCCESS) {
      this.logger.warn(
        `Ignoring refund for transaction ${transaction.id} — current status is ${transaction.status}`,
      );
      return;
    }

    const updateResult = await this.transactionRepository
      .createQueryBuilder()
      .update()
      .set({ status: TransactionStatus.REFUNDED })
      .where('id = :id AND status = :currentStatus', {
        id: transaction.id,
        currentStatus: TransactionStatus.SUCCESS,
      })
      .execute();

    if (updateResult.affected === 0) {
      this.logger.log(`Transaction ${transaction.id} already refunded — skipping`);
      return;
    }

    // Reverse the fulfillment
    try {
      if (transaction.type === PaymentType.COURSE_ENROLLMENT) {
        await this.contentService.cancelEnrollment(transaction.userId, transaction.referenceId);
        this.logger.log(
          `Course enrollment reversed for user ${transaction.userId}, course ${transaction.referenceId}`,
        );
      } else if (transaction.type === PaymentType.SUBSCRIPTION) {
        // Find the subscription linked to this payment and cancel it
        const subscriptions = await this.subscriptionsService.findUserSubscriptions(
          transaction.userId,
        );
        const linkedSubscription = subscriptions.find(
          (s) => s.paymentId === transaction.id,
        );
        if (linkedSubscription) {
          await this.subscriptionsService.cancelSubscription(linkedSubscription.id, {
            reason: 'Payment refunded via Paymob',
          });
          this.logger.log(`Subscription ${linkedSubscription.id} cancelled for user ${transaction.userId}`);
        }
      }
      // Session bookings: we might not reverse them, depends on policy
    } catch (error) {
      this.logger.error(
        `Failed to reverse fulfillment for refunded transaction ${transaction.id}`,
        error,
      );
    }

    await this.transactionRepository.update(transaction.id, {
      metadata: {
        ...((transaction.metadata as any) || {}),
        refundedAt: new Date().toISOString(),
      },
    });
  }

  private async handleVoid(transaction: Transaction): Promise<void> {
    if (transaction.status === TransactionStatus.PENDING) {
      transaction.status = TransactionStatus.FAILED;
      transaction.metadata = {
        ...((transaction.metadata as any) || {}),
        voidedAt: new Date().toISOString(),
      };
      await this.transactionRepository.save(transaction);
      this.logger.log(`Transaction ${transaction.id} voided`);
    }
  }

  /* ============================================================== */
  /*  Duplicate / Stale Transaction Cleanup                           */
  /* ============================================================== */

  /**
   * Cancel any existing pending transactions for the same user + resource + type.
   * Prevents users from creating multiple payment intents for the same purchase.
   */
  private async cancelStalePendingTransactions(
    userId: string,
    referenceId: string,
    type: PaymentType,
  ): Promise<void> {
    const existingPending = await this.transactionRepository.find({
      where: {
        userId,
        referenceId,
        type,
        status: TransactionStatus.PENDING,
      },
    });

    if (existingPending.length > 0) {
      // Check if any are recent (< 30 minutes) — reuse is possible but risky
      // because the payment intention might have expired. Cancel all and create fresh.
      const ids = existingPending.map((t) => t.id);
      await this.transactionRepository
        .createQueryBuilder()
        .update()
        .set({
          status: TransactionStatus.FAILED,
          metadata: () =>
            `jsonb_set(COALESCE(metadata, '{}'), '{cancelledReason}', '"superseded_by_new_checkout"')`,
        })
        .whereInIds(ids)
        .execute();

      this.logger.log(
        `Cancelled ${ids.length} stale pending transaction(s) for user=${userId} ref=${referenceId}`,
      );
    }
  }
}
