import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
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
