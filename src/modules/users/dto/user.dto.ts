import {
    IsString,
    IsEmail,
    IsOptional,
    IsEnum,
    IsUUID,
    MinLength,
    MaxLength,
    Matches,
} from 'class-validator';
import { Role } from '../../auth/constants/roles.constant';
import { UserStatus } from '../../auth/entities/user.entity';

export class CreateUserDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    firstName!: string;

    @IsString()
    @MinLength(2)
    @MaxLength(50)
    lastName!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(100)
    password!: string;

    @IsOptional()
    @IsString()
    @Matches(/^(\+20|0)?1[0125]\d{8}$/, {
        message: 'Phone must be a valid Egyptian phone number',
    })
    phone?: string;

    @IsEnum(Role)
    role!: Role;

    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsString()
    @MaxLength(5)
    preferredLanguage?: string;

    @IsOptional()
    @IsString()
    parentId?: string;
}

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    lastName?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsString()
    @MaxLength(5)
    preferredLanguage?: string;

    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    bio?: string;

    @IsOptional()
    metadata?: Record<string, unknown>;
}

export class UpdateUserRoleDto {
    @IsEnum(Role)
    role!: Role;
}

export class LinkParentDto {
    @IsUUID()
    parentId!: string;
}

import { PaginationQueryDto } from '../../../common/dto';

export class UserQueryDto extends PaginationQueryDto {
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsString()
    search?: string;
}
