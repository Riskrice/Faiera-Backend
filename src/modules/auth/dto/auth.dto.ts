import {
    IsEmail,
    IsString,
    IsOptional,
    MinLength,
    MaxLength,
    Matches,
} from 'class-validator';

export class RegisterDto {
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
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
        message:
            'Password must contain at least one uppercase, one lowercase, one number and one special character',
    })
    password!: string;

    @IsOptional()
    @IsString()
    @Matches(/^(\+20|0)?1[0125]\d{8}$/, {
        message: 'Phone must be a valid Egyptian phone number',
    })
    phone?: string;

    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsString()
    @MaxLength(5)
    preferredLanguage?: string;
}

export class LoginDto {
    @IsEmail()
    email!: string;

    @IsString()
    password!: string;
}

export class RefreshTokenDto {
    @IsString()
    refreshToken!: string;
}

export class ChangePasswordDto {
    @IsString()
    currentPassword!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(100)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
        message:
            'Password must contain at least one uppercase, one lowercase, one number and one special character',
    })
    newPassword!: string;
}

export class ForgotPasswordDto {
    @IsEmail()
    email!: string;
}

export class ResetPasswordDto {
    @IsString()
    token!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(100)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
        message:
            'Password must contain at least one uppercase, one lowercase, one number and one special character',
    })
    newPassword!: string;
}
