import { USER_ROLES, type UserRole } from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ananya Sharma', minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, {
    message: 'phoneNumber must be a valid international phone format (e.g. +919876543210)',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Master student at IIT Delhi looking for flatmate.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://assets.aashvo.in/user-avatars/user123.webp' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

export class UserProfileResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'ananya@example.com' })
  email!: string;

  @ApiProperty({ example: 'Ananya Sharma' })
  fullName!: string;

  @ApiProperty({ nullable: true, example: '+919876543210' })
  phoneNumber!: string | null;

  @ApiProperty({ enum: USER_ROLES, example: 'renter' })
  role!: UserRole;

  @ApiProperty({ nullable: true, example: 'Master student at IIT Delhi.' })
  bio!: string | null;

  @ApiProperty({ nullable: true, example: 'https://assets.aashvo.in/user-avatars/...' })
  avatarUrl!: string | null;

  @ApiProperty({ example: true })
  emailVerified!: boolean;

  @ApiProperty({ example: false })
  phoneVerified!: boolean;

  @ApiProperty({ example: false })
  idVerified!: boolean;

  @ApiProperty({ example: 85, description: 'Profile completion percentage (0-100%)' })
  profileCompletionPercent!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PublicProfileResponseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id!: string;

  @ApiProperty({ example: 'Ananya Sharma' })
  fullName!: string;

  @ApiProperty({ enum: USER_ROLES, example: 'renter' })
  role!: UserRole;

  @ApiProperty({ nullable: true })
  bio!: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ example: true })
  emailVerified!: boolean;

  @ApiProperty({ example: false })
  phoneVerified!: boolean;

  @ApiProperty({ example: false })
  idVerified!: boolean;

  @ApiProperty()
  createdAt!: string;
}

