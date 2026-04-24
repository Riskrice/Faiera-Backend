import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto';

export class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  resource?: string;

  @IsOptional()
  @IsUUID('all')
  actorId?: string;

  @IsOptional()
  @IsUUID('all')
  targetUserId?: string;
}
