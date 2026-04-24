import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    return Math.min(Math.max(Math.trunc(numeric), 1), 100);
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.pageSize ?? 20);
  }

  get take(): number {
    return this.pageSize ?? 20;
  }
}
