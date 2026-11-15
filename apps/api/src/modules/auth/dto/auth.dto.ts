import { type AccountStatus, type UserRole, USER_ROLES } from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const PUBLIC_REGISTER_ROLES = ['renter', 'owner', 'broker'] as const;

export class RegisterDto {
  @ApiProperty({ example: 'ananya.sharma@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Ananya Sharma', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({ enum: PUBLIC_REGISTER_ROLES, default: 'renter' })
  @IsOptional()
  @IsIn(PUBLIC_REGISTER_ROLES)
  accountType?: (typeof PUBLIC_REGISTER_ROLES)[number];
}

export class LoginDto {
  @ApiProperty({ example: 'ananya.sharma@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd!', maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Required for non-cookie native clients (X-Client-Platform: ios|android); web clients transmit the httpOnly cookie automatically.',
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  refreshToken?: string;
}

export class VerifyEmailDto {
  @ApiProperty({ minLength: 20, maxLength: 256 })
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'ananya.sharma@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ananya.sharma@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: 20, maxLength: 256 })
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ananya.sharma@example.com' })
  email!: string;

  @ApiProperty({ example: 'Ananya Sharma' })
  fullName!: string;

  @ApiProperty({ enum: USER_ROLES })
  role!: UserRole;

  @ApiProperty({ enum: ['active', 'suspended', 'deleted_pending'] })
  accountStatus!: AccountStatus;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  phoneVerified!: boolean;

  @ApiProperty()
  idVerified!: boolean;

  @ApiProperty({ nullable: true, example: null })
  avatarUrl!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class AuthSessionResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  @ApiPropertyOptional({
    description: 'Returned only for non-browser native mobile clients; omitted for web cookie flow.',
  })
  refreshToken?: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class MessageAcceptedDto {
  @ApiProperty()
  message!: string;
}

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Verified ID token issued by Google Identity Services',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1Ni...7g',
  })
  @IsString()
  @MinLength(16)
  idToken!: string;
}
