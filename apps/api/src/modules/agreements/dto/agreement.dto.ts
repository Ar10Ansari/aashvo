import {
  AGREEMENT_STATUSES,
  PAYMENT_CATEGORIES,
  PAYMENT_VERIFICATION_STATUSES,
  type AgreementStatus,
  type AgreementView,
  type PaymentCategory,
  type PaymentVerificationStatus,
  type RentPaymentRecordView,
} from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAgreementDto {
  @ApiPropertyOptional({ example: 'b0f443b2-70b8-4e31-8f92-9111812837f4' })
  @IsOptional()
  @IsUUID('4')
  propertyId?: string;

  @ApiProperty({ example: '85e0bf54-8c08-4177-bb89-53b0a2bfce70' })
  @IsUUID('4')
  tenantId!: string;

  @ApiProperty({ example: 25000, minimum: 0 })
  @IsNumber()
  @Min(0)
  monthlyRent!: number;

  @ApiProperty({ example: 50000, minimum: 0 })
  @IsNumber()
  @Min(0)
  securityDeposit!: number;

  @ApiProperty({ example: '2026-12-01' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2027-11-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'https://storage.aashvo.com/agreements/sample-lease.pdf' })
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @ApiPropertyOptional({ example: 'Standard 11-month lease agreement with 2 months security deposit.' })
  @IsOptional()
  @IsString()
  termsSummary?: string;
}

export class UpdateAgreementStatusDto {
  @ApiProperty({ enum: AGREEMENT_STATUSES, example: 'active' })
  @IsIn(AGREEMENT_STATUSES)
  agreementStatus!: AgreementStatus;
}

export class CreatePaymentRecordDto {
  @ApiProperty({ example: '85e0bf54-8c08-4177-bb89-53b0a2bfce70' })
  @IsUUID('4')
  payerId!: string;

  @ApiProperty({ example: '12e0bf54-8c08-4177-bb89-53b0a2bfce70' })
  @IsUUID('4')
  recipientId!: string;

  @ApiProperty({ example: 25000, minimum: 1 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: PAYMENT_CATEGORIES, example: 'monthly_rent' })
  @IsIn(PAYMENT_CATEGORIES)
  paymentCategory!: PaymentCategory;

  @ApiProperty({ example: '2026-12-05' })
  @IsDateString()
  paymentDate!: string;

  @ApiPropertyOptional({ example: 'https://storage.aashvo.com/receipts/txn_12345.pdf' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional({ example: 'UPI-REF-20261205987654' })
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional({ example: 'Rent payment for December 2026' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AgreementResponseDto implements AgreementView {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  propertyId!: string | null;

  @ApiProperty()
  landlordId!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  monthlyRent!: number;

  @ApiProperty()
  securityDeposit!: number;

  @ApiProperty()
  startDate!: string;

  @ApiProperty({ nullable: true })
  endDate!: string | null;

  @ApiProperty({ enum: AGREEMENT_STATUSES })
  agreementStatus!: AgreementStatus;

  @ApiProperty({ nullable: true })
  documentUrl!: string | null;

  @ApiProperty({ nullable: true })
  termsSummary!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional()
  propertyTitle?: string;

  @ApiPropertyOptional()
  landlordName?: string;

  @ApiPropertyOptional()
  tenantName?: string;
}

export class RentPaymentRecordResponseDto implements RentPaymentRecordView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  agreementId!: string;

  @ApiProperty()
  payerId!: string;

  @ApiProperty()
  recipientId!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ enum: PAYMENT_CATEGORIES })
  paymentCategory!: PaymentCategory;

  @ApiProperty()
  paymentDate!: string;

  @ApiProperty({ nullable: true })
  receiptUrl!: string | null;

  @ApiProperty({ nullable: true })
  transactionReference!: string | null;

  @ApiProperty({ enum: PAYMENT_VERIFICATION_STATUSES })
  verificationStatus!: PaymentVerificationStatus;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  createdAt!: string;
}
