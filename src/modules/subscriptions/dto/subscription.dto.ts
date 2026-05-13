import { Type } from 'class-transformer';
import { IsString, IsOptional, IsUUID, IsBoolean, MaxLength, IsNumber, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class CheckAccessDto {
  @IsUUID()
  userId!: string;

  @IsString()
  grade!: string;

  @IsString()
  subject!: string;
}

export interface AccessCheckResult {
  hasAccess: boolean;
  subscription?: {
    id: string;
    planName: string;
    expiresAt: Date;
    daysRemaining: number;
  };
  reason?: string;
}
