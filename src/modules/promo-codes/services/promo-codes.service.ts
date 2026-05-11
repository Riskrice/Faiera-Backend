import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike, FindOptionsWhere } from 'typeorm';
import { PromoCode, DiscountType, PromoCodeScope } from '../entities/promo-code.entity';
import { PromoCodeRedemption, RedemptionStatus } from '../entities/promo-code-redemption.entity';
import { CreatePromoCodeDto, GeneratePromoCodesDto, UpdatePromoCodeDto, QueryPromoCodesDto, ValidatePromoCodeDto } from '../dto/promo-code.dto';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PromoCodesService {
  private readonly logger = new Logger(PromoCodesService.name);

  constructor(
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(PromoCodeRedemption)
    private readonly redemptionRepository: Repository<PromoCodeRedemption>,
    private readonly dataSource: DataSource,
  ) {}

  /* ============================================================== */
  /*  Admin / Management Methods                                    */
  /* ============================================================== */

  async create(createDto: CreatePromoCodeDto, adminId: string): Promise<PromoCode> {
    const existing = await this.promoCodeRepository.findOne({ where: { code: createDto.code.toUpperCase() } });
    if (existing) {
      throw new ConflictException('Promo code already exists');
    }

    const promoCode = this.promoCodeRepository.create({
      ...createDto,
      code: createDto.code.toUpperCase(),
      createdBy: adminId,
    });

    return this.promoCodeRepository.save(promoCode);
  }

  async generateBatch(dto: GeneratePromoCodesDto, adminId: string): Promise<PromoCode[]> {
    const generatedCodes: PromoCode[] = [];
    const prefix = dto.prefix ? `${dto.prefix.toUpperCase()}-` : '';
    const length = dto.codeLength || 8;

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
        scopeReferenceId: dto.scopeReferenceId,
        maxTotalUses: dto.maxTotalUses,
        maxUsesPerUser: dto.maxUsesPerUser || 1,
        startsAt: dto.startsAt,
        expiresAt: dto.expiresAt,
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
    Object.assign(promoCode, updateDto);
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
    promoCode.deactivatedAt = null as any;
    promoCode.deactivatedBy = null as any;
    return this.promoCodeRepository.save(promoCode);
  }

  /* ============================================================== */
  /*  Student / Core Methods                                        */
  /* ============================================================== */

  async validate(dto: ValidatePromoCodeDto, userId: string) {
    const code = dto.code.toUpperCase();
    const promoCode = await this.promoCodeRepository.findOne({ where: { code } });

    if (!promoCode) {
      throw new NotFoundException('Promo code not found or invalid');
    }

    return this.checkEligibilityAndCalculateDiscount(promoCode, userId, dto.amount, dto.courseId, dto.planId);
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
    planId?: string
  ) {
    const now = new Date();

    // 1. Basic Validity Checks
    if (!promoCode.isActive) throw new BadRequestException('This promo code is no longer active');
    if (promoCode.startsAt > now) throw new BadRequestException('This promo code is not yet valid');
    if (promoCode.expiresAt && promoCode.expiresAt < now) throw new BadRequestException('This promo code has expired');

    // 2. Minimum Order Amount Check
    if (promoCode.minOrderAmount && amount < promoCode.minOrderAmount) {
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
    if (promoCode.maxTotalUses !== null && promoCode.maxTotalUses !== undefined && promoCode.currentUses >= promoCode.maxTotalUses) {
      throw new BadRequestException('This promo code has reached its maximum number of uses');
    }

    const userUses = await this.redemptionRepository.count({
      where: { promoCodeId: promoCode.id, userId, status: RedemptionStatus.COMPLETED },
    });

    if (userUses >= promoCode.maxUsesPerUser) {
      throw new BadRequestException('You have reached the maximum number of uses for this promo code');
    }

    // 5. Calculate Discount
    let discountAmount = 0;
    if (promoCode.discountType === DiscountType.FIXED_AMOUNT) {
      discountAmount = Number(promoCode.discountValue);
    } else if (promoCode.discountType === DiscountType.PERCENTAGE) {
      discountAmount = amount * (Number(promoCode.discountValue) / 100);
      if (promoCode.maxDiscountCap && discountAmount > promoCode.maxDiscountCap) {
        discountAmount = Number(promoCode.maxDiscountCap);
      }
    }

    // Ensure discount doesn't exceed the total amount
    discountAmount = Math.min(discountAmount, amount);
    const finalAmount = amount - discountAmount;

    return {
      promoCodeId: promoCode.id,
      code: promoCode.code,
      discountAmount: Number(discountAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2)),
      originalAmount: amount,
    };
  }

  /**
   * Atomically redeems a promo code. Called ONLY after a successful payment transaction.
   * Prevents race conditions and double spending.
   */
  async redeem(
    code: string,
    userId: string,
    originalAmount: number,
    transactionId?: string,
    courseId?: string,
    planId?: string
  ) {
    // Stacking Policy: Enforced naturally since the checkout API only accepts one promoCode
    
    return this.dataSource.transaction(async (manager) => {
      // 1. SELECT FOR UPDATE to lock the row
      const promoCode = await manager.findOne(PromoCode, {
        where: { code: code.toUpperCase() },
        lock: { mode: 'pessimistic_write' },
      });

      if (!promoCode) {
        throw new NotFoundException('Promo code not found');
      }

      // 2. Re-evaluate eligibility strictly inside the transaction
      const evaluation = await this.checkEligibilityAndCalculateDiscount(promoCode, userId, originalAmount, courseId, planId);

      // 3. Create Redemption Record
      const redemption = manager.create(PromoCodeRedemption, {
        promoCodeId: promoCode.id,
        userId,
        transactionId,
        courseId,
        planId,
        originalAmount,
        discountAmount: evaluation.discountAmount,
        finalAmount: evaluation.finalAmount,
        redeemedAt: new Date(),
        status: RedemptionStatus.COMPLETED,
      });

      await manager.save(redemption);

      // 4. Update Uses Counter
      promoCode.currentUses += 1;
      await manager.save(promoCode);

      this.logger.log(`Promo code ${code} redeemed by user ${userId} for transaction ${transactionId || 'FREE'}`);
      
      return redemption;
    });
  }

  /**
   * Reverses a redemption (e.g., when a payment is refunded)
   */
  async reverseRedemption(transactionId: string) {
    return this.dataSource.transaction(async (manager) => {
      const redemptions = await manager.find(PromoCodeRedemption, {
        where: { transactionId, status: RedemptionStatus.COMPLETED },
      });

      for (const redemption of redemptions) {
        // Mark as reversed
        redemption.status = RedemptionStatus.REVERSED;
        redemption.reversedAt = new Date();
        await manager.save(redemption);

        // Decrease current uses
        await manager.decrement(PromoCode, { id: redemption.promoCodeId }, 'currentUses', 1);
        
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

  async getRedemptions(promoCodeId: string, page = 1, limit = 10) {
    const [data, total] = await this.redemptionRepository.findAndCount({
      where: { promoCodeId },
      relations: ['user'], // Ensure user is loaded
      order: { redeemedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
