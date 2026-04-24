import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsArray,
    IsUUID,
    MaxLength,
} from 'class-validator';

export class CreateRoleDto {
    @IsString()
    @IsNotEmpty({ message: 'اسم الدور مطلوب' })
    @MaxLength(100)
    name!: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;

    @IsArray()
    @IsUUID('all', { each: true, message: 'يجب أن تكون المعرفات من نوع UUID' })
    @IsOptional()
    permissionIds?: string[];
}

export class UpdateRoleDto {
    @IsString()
    @IsOptional()
    @MaxLength(100)
    name?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;

    @IsArray()
    @IsUUID('all', { each: true, message: 'يجب أن تكون المعرفات من نوع UUID' })
    @IsOptional()
    permissionIds?: string[];
}
