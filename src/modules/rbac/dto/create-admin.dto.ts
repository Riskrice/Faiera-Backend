import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
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

  @IsOptional()
  @IsString()
  @MaxLength(5)
  preferredLanguage?: string;

  @IsUUID('all', { message: 'معرف الدور غير صحيح' })
  roleId!: string;
}
