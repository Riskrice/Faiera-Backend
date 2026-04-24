import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { SubscriptionPlan, PlanStatus } from '../entities/subscription-plan.entity';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import {
  CreatePlanDto,
  UpdatePlanDto,
  PlanQueryDto,
  CreateSubscriptionDto,
  CancelSubscriptionDto,
  AccessCheckResult,
} from '../dto';
import { CacheService } from '../../../redis';
import { PaginationQueryDto } from '../../../common/dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly cacheService: CacheService,
  ) {}

  // ==================== Plans ====================

  async createPlan(dto: CreatePlanDto): Promise<SubscriptionPlan> {
    const plan = this.planRepository.create({
      ...dto,
      currency: dto.currency || 'EGP',
      features: dto.features || [],
    });
    await this.planRepository.save(plan);
    this.logger.log(`Plan created: ${plan.nameEn}`);
    return plan;
  }

  async findAllPlans(
    query: PlanQueryDto,
    pagination?: PaginationQueryDto,
  ): Promise<{ plans: SubscriptionPlan[]; total: number }> {
    const where: FindOptionsWhere<SubscriptionPlan> = {};

    if (query.grade) where.grade = query.grade;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [plans, total] = await this.planRepository.findAndCount({
      where,
      skip: pagination?.skip || 0,
      take: pagination?.take || 50,
      order: { sortOrder: 'ASC', price: 'ASC' },
    });

    return { plans, total };
  }

  async findActivePlans(grade?: string): Promise<SubscriptionPlan[]> {
    const where: FindOptionsWhere<SubscriptionPlan> = {
      status: PlanStatus.ACTIVE,
    };

    if (grade) where.grade = grade;

    return this.planRepository.find({
      where,
      order: { sortOrder: 'ASC', price: 'ASC' },
    });
  }

  async findPlanById(id: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<SubscriptionPlan> {
    const plan = await this.findPlanById(id);
    Object.assign(plan, dto);
    await this.planRepository.save(plan);
    this.logger.log(`Plan updated: ${plan.nameEn}`);
    return plan;
  }

  async deletePlan(id: string): Promise<void> {
    const plan = await this.findPlanById(id);

    // Check if plan has active subscriptions
    const activeCount = await this.subscriptionRepository.count({
      where: { planId: id, status: SubscriptionStatus.ACTIVE },
    });

    if (activeCount > 0) {
      throw new BadRequestException(
        'Cannot delete plan with active subscriptions. Deactivate it instead.',
      );
    }

    await this.planRepository.remove(plan);
    this.logger.log(`Plan deleted: ${plan.nameEn}`);
  }

  // ==================== Subscriptions ====================

  async createSubscriptionFromPayment(
    userId: string,
    planId: string,
    transactionId: string,
  ): Promise<Subscription> {
    return this.createSubscription({
      userId,
      planId,
      paymentId: transactionId,
      autoRenew: false, // Default to manual renewal for now
    });
  }

  async createSubscription(dto: CreateSubscriptionDto): Promise<Subscription> {
    const plan = await this.findPlanById(dto.planId);

    // Guard: prevent duplicate subscription by paymentId
    if (dto.paymentId) {
      const duplicatePayment = await this.subscriptionRepository.findOne({
        where: { paymentId: dto.paymentId },
      });
      if (duplicatePayment) {
        this.logger.warn(`Duplicate paymentId ${dto.paymentId} — returning existing subscription`);
        return duplicatePayment;
      }
    }

    // Check if user already has active subscription for same grade
    const existingActive = await this.subscriptionRepository.findOne({
      where: {
        userId: dto.userId,
        grade: plan.grade,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existingActive && !existingActive.isExpired()) {
      throw new BadRequestException('User already has an active subscription for this grade');
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const subscription = this.subscriptionRepository.create({
      userId: dto.userId,
      planId: dto.planId,
      status: dto.paymentId ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING,
      startDate,
      endDate,
      paidAmount: plan.price,
      currency: plan.currency,
      paymentId: dto.paymentId,
      subjects: plan.subjects, // Cache subjects from plan
      grade: plan.grade,
      autoRenew: dto.autoRenew || false,
    });

    await this.subscriptionRepository.save(subscription);

    // Invalidate user's subscription cache (both old and grade-specific keys)
    await this.cacheService.del(`sub:${dto.userId}`);
    await this.cacheService.del(`sub:${dto.userId}:${plan.grade}`);

    this.logger.log(`Subscription created for user ${dto.userId}`);
    return subscription;
  }

  async activateSubscription(id: string, paymentId: string): Promise<Subscription> {
    const subscription = await this.findSubscriptionById(id);

    if (subscription.status !== SubscriptionStatus.PENDING) {
      throw new BadRequestException('Subscription is not pending');
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.paymentId = paymentId;
    await this.subscriptionRepository.save(subscription);

    // Invalidate cache
    await this.cacheService.del(`sub:${subscription.userId}`);
    await this.cacheService.del(`sub:${subscription.userId}:${subscription.grade}`);

    this.logger.log(`Subscription activated: ${id}`);
    return subscription;
  }

  async findSubscriptionById(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async findUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveSubscription(userId: string, grade: string): Promise<Subscription | null> {
    // Try cache first (keyed by user + grade)
    const cacheKey = `sub:${userId}:${grade}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached as unknown as Subscription;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: {
        userId,
        grade,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['plan'],
    });

    if (subscription && subscription.isActive()) {
      // Cache the subscription (keyed by grade)
      await this.cacheService.set(
        cacheKey,
        {
          id: subscription.id,
          grade: subscription.grade,
          subjects: subscription.subjects,
          endDate: subscription.endDate.toISOString(),
          planName: subscription.plan.nameEn,
        },
        300,
      );
      return subscription;
    }

    return null;
  }

  async cancelSubscription(id: string, dto: CancelSubscriptionDto): Promise<Subscription> {
    const subscription = await this.findSubscriptionById(id);

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Subscription is not active');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = dto.reason;
    subscription.autoRenew = false;

    await this.subscriptionRepository.save(subscription);

    // Invalidate cache
    await this.cacheService.del(`sub:${subscription.userId}`);
    await this.cacheService.del(`sub:${subscription.userId}:${subscription.grade}`);

    this.logger.log(`Subscription cancelled: ${id}`);
    return subscription;
  }

  // ==================== Access Control ====================

  async checkAccess(userId: string, grade: string, subject: string): Promise<AccessCheckResult> {
    const subscription = await this.findActiveSubscription(userId, grade);

    if (!subscription) {
      return {
        hasAccess: false,
        reason: 'No active subscription for this grade',
      };
    }

    if (!subscription.hasSubject(subject)) {
      return {
        hasAccess: false,
        reason: 'Subject not included in subscription',
      };
    }

    return {
      hasAccess: true,
      subscription: {
        id: subscription.id,
        planName: subscription.plan.nameEn,
        expiresAt: subscription.endDate,
        daysRemaining: subscription.daysRemaining(),
      },
    };
  }

  // ==================== Background Jobs ====================

  async processExpiredSubscriptions(): Promise<number> {
    const result = await this.subscriptionRepository
      .createQueryBuilder()
      .update(Subscription)
      .set({ status: SubscriptionStatus.EXPIRED })
      .where('status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('endDate < :now', { now: new Date() })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Marked ${result.affected} subscriptions as expired`);
    }

    return result.affected || 0;
  }
}
