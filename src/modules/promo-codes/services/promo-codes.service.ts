import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike, FindOptionsWhere, EntityManager } from 'typeorm';
import { PromoCode, DiscountType, PromoCodeScope } from '../entities/promo-code.entity';
import { PromoCodeRedemption, RedemptionStatus } from '../entities/promo-code-redemption.entity';
import { CreatePromoCodeDto, GeneratePromoCodesDto, UpdatePromoCodeDto, QueryPromoCodesDto, ValidatePromoCodeDto } from '../dto/promo-code.dto';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface PromoCodeEvaluation {
  promoCodeId: string;
  code: string;
  discountAmount: number;
  finalAmount: number;
  originalAmount: number;
}

@Injectable()
export class PromoCodesService {
  private readonly logger = new Logger(PromoCodesService.name);
  private readonly reservationTtlMs = 30 * 60 * 1000;

  constructor(
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(PromoCodeRedemption)
    private readonly redemptionRepository: Repository<PromoCodeRedemption>,
    private readonly dataSource: DataSource,
  ) {}

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private parseDate(value: string | Date | null | undefined, field: string): Date | undefined {
    if (value === undefined || value === null) return undefined;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date`);
    }

    return date;
  }

  private toNumber(value: number | string | null | undefined, field: string): number | undefined {
    if (value === undefined || value === null) return undefined;

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new BadRequestException(`${field} must be a valid number`);
    }

    return numericValue;
  }

  private roundMoney(value: number): number {
    return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
  }

  private assertPromoCodeRules(input: {
    discountType: DiscountType;
    discountValue: number | string;
    maxDiscountCap?: number | string | null;
    minOrderAmount?: number | string | null;
    scope: PromoCodeScope;
    scopeReferenceId?: string | null;
    maxTotalUses?: number | null;
    maxUsesPerUser: number;
    startsAt: Date;
    expiresAt?: Date | null;
    currentUses?: number;
  }): void {
    const discountValue = this.toNumber(input.discountValue, 'discountValue') ?? 0;
    const maxDiscountCap = this.toNumber(input.maxDiscountCap, 'maxDiscountCap');
    const minOrderAmount = this.toNumber(input.minOrderAmount, 'minOrderAmount');

    if (input.discountType === DiscountType.PERCENTAGE && discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    if (input.discountType === DiscountType.FIXED_AMOUNT && maxDiscountCap !== undefined) {
      throw new BadRequestException('maxDiscountCap only applies to percentage promo codes');
    }

    if (minOrderAmount !== undefined && minOrderAmount < 0) {
      throw new BadRequestException('minOrderAmount cannot be negative');
    }

    if (input.scope === PromoCodeScope.GLOBAL && input.scopeReferenceId) {
      throw new BadRequestException('Global promo codes must not include a scopeReferenceId');
    }

    if (input.scope !== PromoCodeScope.GLOBAL && !input.scopeReferenceId) {
      throw new BadRequestException('Scoped promo codes require a scopeReferenceId');
    }

    if (input.expiresAt && input.expiresAt <= input.startsAt) {
      throw new BadRequestException('expiresAt must be after startsAt');
    }

    if (input.maxTotalUses !== undefined && input.maxTotalUses !== null) {
      if (input.maxTotalUses < input.maxUsesPerUser) {
        throw new BadRequestException('maxTotalUses cannot be less than maxUsesPerUser');
      }

      if ((input.currentUses ?? 0) > input.maxTotalUses) {
        throw new BadRequestException('maxTotalUses cannot be lower than currentUses');
      }
    }
  }

  private async countActiveUses(
    manager: EntityManager | undefined,
    promoCodeId: string,
    userId?: string,
  ): Promise<number> {
    const repository = manager
      ? manager.getRepository(PromoCodeRedemption)
      : this.redemptionRepository;
    const now = new Date();
    const query = repository
      .createQueryBuilder('redemption')
      .where('redemption.promoCodeId = :promoCodeId', { promoCodeId })
      .andWhere(
        '(redemption.status = :completed OR (redemption.status = :reserved AND redemption.reservationExpiresAt > :now))',
        {
          completed: RedemptionStatus.COMPLETED,
          reserved: RedemptionStatus.RESERVED,
          now,
        },
      );

    if (userId) {
      query.andWhere('redemption.userId = :userId', { userId });
    }

    return query.getCount();
  }

  private assertExpectedFinalAmount(evaluation: PromoCodeEvaluation, expectedFinalAmount?: number): void {
    if (expectedFinalAmount === undefined) return;

    const expected = this.roundMoney(expectedFinalAmount);
    if (Math.abs(evaluation.finalAmount - expected) > 0.01) {
      throw new BadRequestException('Promo code amount changed after checkout validation');
    }
  }

  /* ============================================================== */
  /*  Admin / Management Methods                                    */
  /* ============================================================== */

  async create(createDto: CreatePromoCodeDto, adminId: string): Promise<PromoCode> {
    const code = this.normalizeCode(createDto.code);
    const startsAt = this.parseDate(createDto.startsAt, 'startsAt');
    if (!startsAt) throw new BadRequestException('startsAt is required');
    const expiresAt = this.parseDate(createDto.expiresAt, 'expiresAt');
    const maxUsesPerUser = createDto.maxUsesPerUser ?? 1;

    this.assertPromoCodeRules({
      discountType: createDto.discountType,
      discountValue: createDto.discountValue,
      maxDiscountCap: createDto.maxDiscountCap,
      minOrderAmount: createDto.minOrderAmount,
      scope: createDto.scope,
      scopeReferenceId: createDto.scopeReferenceId,
      maxTotalUses: createDto.maxTotalUses,
      maxUsesPerUser,
      startsAt,
      expiresAt,
    });

    const existing = await this.promoCodeRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException('Promo code already exists');
    }

    const promoCode = this.promoCodeRepository.create({
      ...createDto,
      code,
      scopeReferenceId:
        createDto.scope === PromoCodeScope.GLOBAL ? undefined : createDto.scopeReferenceId,
      maxUsesPerUser,
      startsAt,
      expiresAt,
      createdBy: adminId,
    });

    return this.promoCodeRepository.save(promoCode);
  }

  async generateBatch(dto: GeneratePromoCodesDto, adminId: string): Promise<PromoCode[]> {
    const generatedCodes: PromoCode[] = [];
    const prefix = dto.prefix ? `${this.normalizeCode(dto.prefix)}-` : '';
    const length = dto.codeLength || 8;
    const startsAt = this.parseDate(dto.startsAt, 'startsAt');
    if (!startsAt) throw new BadRequestException('startsAt is required');
    const expiresAt = this.parseDate(dto.expiresAt, 'expiresAt');
    const maxUsesPerUser = dto.maxUsesPerUser ?? 1;

    this.assertPromoCodeRules({
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      maxDiscountCap: dto.maxDiscountCap,
      minOrderAmount: dto.minOrderAmount,
      scope: dto.scope,
      scopeReferenceId: dto.scopeReferenceId,
      maxTotalUses: dto.maxTotalUses,
      maxUsesPerUser,
      startsAt,
      expiresAt,
    });

    for (let i = 0; i < dto.count; i++) {
      let code = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        // Generate random alphanumeric string of requested length
        const randomStr = crypto.randomBytes(length).toString('hex').toUpperCase().substring(0, length);
        
        // Insert dashes every 4 characters for readability
        const chunks: string[] = [];
        for (let j = 0; j < randomStr.length; j += 4) {
          chunks.push(randomStr.substring(j, j + 4));
        }
        code = `${prefix}${chunks.join('-')}`;
        
        // Remove confusing characters (O/0, I/1, L)
        code = code.replace(/[O0I1L]/g, 'X');

        const existing = await this.promoCodeRepository.findOne({ where: { code } });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new ConflictException('Failed to generate unique codes. Try increasing the code length.');
      }

      const promoCode = this.promoCodeRepository.create({
        code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountCap: dto.maxDiscountCap,
        minOrderAmount: dto.minOrderAmount,
        scope: dto.scope,
        scopeReferenceId: dto.scope === PromoCodeScope.GLOBAL ? undefined : dto.scopeReferenceId,
        maxTotalUses: dto.maxTotalUses,
        maxUsesPerUser,
        startsAt,
        expiresAt,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        campaignTag: dto.campaignTag,
        descriptionInternal: dto.descriptionInternal,
        createdBy: adminId,
      });

      generatedCodes.push(promoCode);
    }

    // Save in batch for performance
    return this.promoCodeRepository.save(generatedCodes);
  }

  async findAll(queryDto: QueryPromoCodesDto) {
    const { search, scope, isActive, campaignTag, page = 1, limit = 10 } = queryDto;
    
    const where: FindOptionsWhere<PromoCode> = {};
    if (search) where.code = ILike(`%${search}%`);
    if (scope) where.scope = scope;
    if (isActive !== undefined) where.isActive = isActive;
    if (campaignTag) where.campaignTag = ILike(`%${campaignTag}%`);

    const [data, total] = await this.promoCodeRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<PromoCode> {
    const promoCode = await this.promoCodeRepository.findOne({ where: { id } });
    if (!promoCode) throw new NotFoundException('Promo code not found');
    return promoCode;
  }

  async update(id: string, updateDto: UpdatePromoCodeDto): Promise<PromoCode> {
    const promoCode = await this.findById(id);
    const expiresAt =
      updateDto.expiresAt !== undefined
        ? this.parseDate(updateDto.expiresAt, 'expiresAt')
        : promoCode.expiresAt;
    const discountType = updateDto.discountType ?? promoCode.discountType;
    const maxDiscountCap =
      discountType === DiscountType.FIXED_AMOUNT
        ? null
        : updateDto.maxDiscountCap ?? promoCode.maxDiscountCap;
    const maxTotalUses = updateDto.maxTotalUses ?? promoCode.maxTotalUses;
    const maxUsesPerUser = updateDto.maxUsesPerUser ?? promoCode.maxUsesPerUser;

    this.assertPromoCodeRules({
      discountType,
      discountValue: updateDto.discountValue ?? promoCode.discountValue,
      maxDiscountCap,
      minOrderAmount: updateDto.minOrderAmount ?? promoCode.minOrderAmount,
      scope: promoCode.scope,
      scopeReferenceId: promoCode.scopeReferenceId,
      maxTotalUses,
      maxUsesPerUser,
      startsAt: promoCode.startsAt,
      expiresAt,
      currentUses: promoCode.currentUses,
    });

    Object.assign(promoCode, updateDto, {
      expiresAt,
      maxDiscountCap,
    });
    return this.promoCodeRepository.save(promoCode);
  }

  async deactivate(id: string, adminId: string): Promise<PromoCode> {
    const promoCode = await this.findById(id);
    if (!promoCode.isActive) throw new BadRequestException('Promo code is already inactive');
    
    promoCode.isActive = false;
    promoCode.deactivatedAt = new Date();
    promoCode.deactivatedBy = adminId;
    return this.promoCodeRepository.save(promoCode);
  }

  async reactivate(id: string): Promise<PromoCode> {
    const promoCode = await this.findById(id);
    if (promoCode.isActive) throw new BadRequestException('Promo code is already active');
    
    if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
      throw new BadRequestException('Cannot reactivate an expired promo code. Please extend the expiration date first.');
    }

    promoCode.isActive = true;
    promoCode.deactivatedAt = null;
    promoCode.deactivatedBy = null;
    return this.promoCodeRepository.save(promoCode);
  }

  async remove(id: string): Promise<void> {
    const promoCode = await this.findById(id);
    
    // Check if it has been used
    const redemptionsCount = await this.redemptionRepository.count({
      where: { promoCodeId: id },
    });
    
    if (redemptionsCount > 0) {
      throw new BadRequestException('Cannot delete promo code that has been used. You can deactivate it instead.');
    }
    
    await this.promoCodeRepository.remove(promoCode);
  }

  /* ============================================================== */
  /*  Student / Core Methods                                        */
  /* ============================================================== */

  async validate(dto: ValidatePromoCodeDto, userId: string) {
    const code = this.normalizeCode(dto.code);
    const promoCode = await this.promoCodeRepository.findOne({ where: { code } });

    if (!promoCode) {
      throw new NotFoundException('Promo code not found or invalid');
    }

    return this.checkEligibilityAndCalculateDiscount(
      promoCode,
      userId,
      dto.amount,
      dto.courseId,
      dto.planId,
    );
  }

  /**
   * Evaluates eligibility and calculates the final amount.
   * Extracted to be used by both validate() and redeem()
   */
  private async checkEligibilityAndCalculateDiscount(
    promoCode: PromoCode, 
    userId: string, 
    amount: number, 
    courseId?: string, 
    planId?: string,
    manager?: EntityManager,
  ): Promise<PromoCodeEvaluation> {
    const now = new Date();
    const originalAmount = this.roundMoney(amount);

    // 1. Basic Validity Checks
    if (!promoCode.isActive) throw new BadRequestException('This promo code is no longer active');
    if (new Date(promoCode.startsAt) > now) {
      throw new BadRequestException('This promo code is not yet valid');
    }
    if (promoCode.expiresAt && new Date(promoCode.expiresAt) < now) {
      throw new BadRequestException('This promo code has expired');
    }

    // 2. Minimum Order Amount Check
    const minOrderAmount = this.toNumber(promoCode.minOrderAmount, 'minOrderAmount');
    if (minOrderAmount !== undefined && originalAmount < minOrderAmount) {
      throw new BadRequestException(`This code requires a minimum order amount of ${promoCode.minOrderAmount}`);
    }

    // 3. Scope Checks
    if (promoCode.scope === PromoCodeScope.COURSE) {
      if (!courseId) throw new BadRequestException('This promo code requires a course ID to be evaluated');
      if (promoCode.scopeReferenceId !== courseId) throw new BadRequestException('This promo code is not valid for this course');
    } else if (promoCode.scope === PromoCodeScope.PLAN) {
      if (!planId) throw new BadRequestException('This promo code requires a plan ID to be evaluated');
      if (promoCode.scopeReferenceId !== planId) throw new BadRequestException('This promo code is not valid for this subscription plan');
    }

    // 4. Usage Limits
    const activeUses = await this.countActiveUses(manager, promoCode.id);
    if (
      promoCode.maxTotalUses !== null &&
      promoCode.maxTotalUses !== undefined &&
      activeUses >= promoCode.maxTotalUses
    ) {
      throw new BadRequestException('This promo code has reached its maximum number of uses');
    }

    const userUses = await this.countActiveUses(manager, promoCode.id, userId);

    if (userUses >= promoCode.maxUsesPerUser) {
      throw new BadRequestException('You have reached the maximum number of uses for this promo code');
    }

    // 5. Calculate Discount
    let discountAmount = 0;
    if (promoCode.discountType === DiscountType.FIXED_AMOUNT) {
      discountAmount = Number(promoCode.discountValue);
    } else if (promoCode.discountType === DiscountType.PERCENTAGE) {
      discountAmount = originalAmount * (Number(promoCode.discountValue) / 100);
      if (promoCode.maxDiscountCap && discountAmount > Number(promoCode.maxDiscountCap)) {
        discountAmount = Number(promoCode.maxDiscountCap);
      }
    }

    // Ensure discount doesn't exceed the total amount
    discountAmount = this.roundMoney(Math.min(discountAmount, originalAmount));
    const finalAmount = this.roundMoney(originalAmount - discountAmount);

    return {
      promoCodeId: promoCode.id,
      code: promoCode.code,
      discountAmount,
      finalAmount,
      originalAmount,
    };
  }

  /**
   * Reserves a promo code for a pending checkout.
   * The reservation is finalized by redeem() after the payment provider confirms success.
   */
  async reserve(
    code: string,
    userId: string,
    originalAmount: number,
    transactionId: string,
    courseId?: string,
    planId?: string,
    expectedFinalAmount?: number,
  ) {
    return this.dataSource.transaction(async manager => {
      const existing = await manager.findOne(PromoCodeRedemption, {
        where: { transactionId },
      });
      if (existing) {
        if (
          existing.status === RedemptionStatus.RESERVED &&
          existing.reservationExpiresAt &&
          existing.reservationExpiresAt > new Date()
        ) {
          return existing;
        }

        if (existing.status === RedemptionStatus.COMPLETED) {
          return existing;
        }

        throw new ConflictException('Promo code reservation already exists for this transaction');
      }

      const promoCode = await manager.findOne(PromoCode, {
        where: { code: this.normalizeCode(code) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!promoCode) {
        throw new NotFoundException('Promo code not found');
      }

      const evaluation = await this.checkEligibilityAndCalculateDiscount(
        promoCode,
        userId,
        originalAmount,
        courseId,
        planId,
        manager,
      );
      this.assertExpectedFinalAmount(evaluation, expectedFinalAmount);

      const now = new Date();
      const reservation = manager.create(PromoCodeRedemption, {
        promoCodeId: promoCode.id,
        userId,
        transactionId,
        courseId,
        planId,
        originalAmount: evaluation.originalAmount,
        discountAmount: evaluation.discountAmount,
        finalAmount: evaluation.finalAmount,
        reservedAt: now,
        reservationExpiresAt: new Date(now.getTime() + this.reservationTtlMs),
        status: RedemptionStatus.RESERVED,
        metadata: {
          code: promoCode.code,
        },
      });

      await manager.save(reservation);

      this.logger.log(`Promo code ${promoCode.code} reserved by user ${userId} for transaction ${transactionId}`);

      return reservation;
    });
  }

  /**
   * Atomically finalizes a reserved promo code. If no reservation exists, it can still
   * redeem directly for legacy/internal callers.
   */
  async redeem(
    code: string,
    userId: string,
    originalAmount: number,
    transactionId?: string,
    courseId?: string,
    planId?: string,
    expectedFinalAmount?: number,
  ) {
    return this.dataSource.transaction(async manager => {
      if (transactionId) {
        const existing = await manager.findOne(PromoCodeRedemption, {
          where: { transactionId },
          lock: { mode: 'pessimistic_write' },
        });

        if (existing?.status === RedemptionStatus.COMPLETED) {
          return existing;
        }

        if (existing?.status === RedemptionStatus.RESERVED) {
          if (existing.reservationExpiresAt && existing.reservationExpiresAt < new Date()) {
            existing.status = RedemptionStatus.EXPIRED;
            existing.reversedAt = new Date();
            await manager.save(existing);
            throw new BadRequestException('Promo code reservation has expired');
          }

          const promoCode = await manager.findOne(PromoCode, {
            where: { id: existing.promoCodeId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!promoCode) {
            throw new NotFoundException('Promo code not found');
          }

          const expectedCode = this.normalizeCode(code);
          if (promoCode.code !== expectedCode || existing.userId !== userId) {
            throw new BadRequestException('Promo code reservation does not match this transaction');
          }

          if (expectedFinalAmount !== undefined) {
            const expected = this.roundMoney(expectedFinalAmount);
            if (Math.abs(Number(existing.finalAmount) - expected) > 0.01) {
              throw new BadRequestException('Promo code reservation amount does not match transaction amount');
            }
          }

          existing.status = RedemptionStatus.COMPLETED;
          existing.redeemedAt = new Date();
          existing.reservationExpiresAt = null;
          await manager.save(existing);

          promoCode.currentUses += 1;
          await manager.save(promoCode);

          this.logger.log(`Promo code ${promoCode.code} redeemed by user ${userId} for transaction ${transactionId}`);

          return existing;
        }

        if (existing) {
          throw new BadRequestException('Promo code reservation is not redeemable');
        }
      }

      const promoCode = await manager.findOne(PromoCode, {
        where: { code: this.normalizeCode(code) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!promoCode) {
        throw new NotFoundException('Promo code not found');
      }

      const evaluation = await this.checkEligibilityAndCalculateDiscount(
        promoCode,
        userId,
        originalAmount,
        courseId,
        planId,
        manager,
      );
      this.assertExpectedFinalAmount(evaluation, expectedFinalAmount);

      const redemption = manager.create(PromoCodeRedemption, {
        promoCodeId: promoCode.id,
        userId,
        transactionId,
        courseId,
        planId,
        originalAmount: evaluation.originalAmount,
        discountAmount: evaluation.discountAmount,
        finalAmount: evaluation.finalAmount,
        redeemedAt: new Date(),
        status: RedemptionStatus.COMPLETED,
        metadata: {
          code: promoCode.code,
        },
      });

      await manager.save(redemption);

      promoCode.currentUses += 1;
      await manager.save(promoCode);

      this.logger.log(`Promo code ${promoCode.code} redeemed by user ${userId} for transaction ${transactionId || 'DIRECT'}`);
      
      return redemption;
    });
  }

  async releaseReservation(transactionId: string, reason = 'released') {
    return this.dataSource.transaction(async manager => {
      const reservation = await manager.findOne(PromoCodeRedemption, {
        where: { transactionId, status: RedemptionStatus.RESERVED },
        lock: { mode: 'pessimistic_write' },
      });

      if (!reservation) return;

      reservation.status = RedemptionStatus.EXPIRED;
      reservation.reversedAt = new Date();
      reservation.metadata = {
        ...((reservation.metadata as Record<string, unknown> | null) ?? {}),
        releaseReason: reason,
      };
      await manager.save(reservation);

      this.logger.log(`Promo code reservation released for transaction ${transactionId}: ${reason}`);
    });
  }

  /**
   * Reverses a redemption (e.g., when a payment is refunded)
   */
  async reverseRedemption(transactionId: string) {
    return this.dataSource.transaction(async (manager) => {
      const redemptions = await manager.find(PromoCodeRedemption, {
        where: { transactionId },
      });

      for (const redemption of redemptions) {
        if (redemption.status === RedemptionStatus.REVERSED || redemption.status === RedemptionStatus.EXPIRED) {
          continue;
        }

        const wasCompleted = redemption.status === RedemptionStatus.COMPLETED;
        redemption.status = RedemptionStatus.REVERSED;
        redemption.reversedAt = new Date();
        await manager.save(redemption);

        if (wasCompleted) {
          await manager
            .createQueryBuilder()
            .update(PromoCode)
            .set({ currentUses: () => 'GREATEST("currentUses" - 1, 0)' })
            .where('id = :id', { id: redemption.promoCodeId })
            .execute();
        }
        
        this.logger.log(`Promo code redemption reversed for transaction ${transactionId}, codeId: ${redemption.promoCodeId}`);
      }
    });
  }

  /* ============================================================== */
  /*  Analytics & Automated Tasks                                   */
  /* ============================================================== */

  async getAnalytics() {
    const totalCodes = await this.promoCodeRepository.count();
    const activeCodes = await this.promoCodeRepository.count({ where: { isActive: true } });
    const activeReservations = await this.redemptionRepository
      .createQueryBuilder('redemption')
      .where('redemption.status = :status', { status: RedemptionStatus.RESERVED })
      .andWhere('redemption.reservationExpiresAt > :now', { now: new Date() })
      .getCount();
    
    // Total uses and total discount amount
    const redemptionsData = await this.redemptionRepository
      .createQueryBuilder('redemption')
      .select('COUNT(id)', 'totalUses')
      .addSelect('SUM(redemption.discountAmount)', 'totalDiscount')
      .where('redemption.status = :status', { status: RedemptionStatus.COMPLETED })
      .getRawOne();

    // Most used codes
    const topCodes = await this.promoCodeRepository.find({
      order: { currentUses: 'DESC' },
      take: 5,
    });

    return {
      totalCodes,
      activeCodes,
      activeReservations,
      totalUses: parseInt(redemptionsData.totalUses || '0'),
      totalDiscountAmount: parseFloat(redemptionsData.totalDiscount || '0'),
      topCodes,
    };
  }

  /**
   * Runs every hour to deactivate expired promo codes
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredCodes() {
    this.logger.log('Running scheduled task: Cleanup Expired Promo Codes');
    
    const result = await this.promoCodeRepository
      .createQueryBuilder()
      .update(PromoCode)
      .set({ isActive: false, deactivatedAt: new Date(), descriptionInternal: 'Auto-deactivated by cron (expired)' })
      .where('isActive = :isActive AND expiresAt < :now', { isActive: true, now: new Date() })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Deactivated ${result.affected} expired promo codes`);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async cleanupExpiredReservations() {
    const result = await this.redemptionRepository
      .createQueryBuilder()
      .update(PromoCodeRedemption)
      .set({ status: RedemptionStatus.EXPIRED, reversedAt: new Date() })
      .where('status = :status AND reservationExpiresAt < :now', {
        status: RedemptionStatus.RESERVED,
        now: new Date(),
      })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} promo code reservation(s)`);
    }
  }

  async getRedemptions(promoCodeId: string, page = 1, limit = 10) {
    await this.findById(promoCodeId);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const [data, total] = await this.redemptionRepository.findAndCount({
      where: { promoCodeId },
      relations: ['user'], // Ensure user is loaded
      order: { redeemedAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return { data, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
  }
}
