import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

export enum PromoCodeScope {
  GLOBAL = 'global',
  COURSE = 'course',
  PLAN = 'plan',
}

@Entity('promo_codes')
@Index(['scope', 'scopeReferenceId'])
export class PromoCode extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({
    type: 'enum',
    enum: DiscountType,
  })
  discountType!: DiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxDiscountCap?: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minOrderAmount?: number | null;

  @Column({
    type: 'enum',
    enum: PromoCodeScope,
    default: PromoCodeScope.GLOBAL,
  })
  scope!: PromoCodeScope;

  @Column({ type: 'uuid', nullable: true })
  scopeReferenceId?: string | null;

  @Column({ type: 'int', nullable: true })
  maxTotalUses?: number | null;

  @Column({ type: 'int', default: 1 })
  maxUsesPerUser!: number;

  @Column({ type: 'int', default: 0 })
  currentUses!: number;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid' })
  createdBy!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  campaignTag?: string | null;

  @Column({ type: 'text', nullable: true })
  descriptionInternal?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deactivatedBy?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;
}
