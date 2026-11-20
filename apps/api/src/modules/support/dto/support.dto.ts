import {
  TICKET_PRIORITIES,
  TICKET_SENDER_ROLES,
  TICKET_STATUSES,
  type SupportTicketView,
  type TicketMessageView,
  type TicketPriority,
  type TicketSenderRole,
  type TicketStatus,
} from '@aashvo/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSupportTicketDto {
  @ApiProperty({ example: 'payment_issue' })
  @IsString()
  category!: string;

  @ApiProperty({ example: 'Payment receipt not confirmed by landlord' })
  @IsString()
  subject!: string;

  @ApiProperty({ example: 'I transferred rent via UPI yesterday but landlord has not confirmed it.' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ enum: TICKET_PRIORITIES, example: 'medium' })
  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;

  @ApiPropertyOptional({ example: 'b0f443b2-70b8-4e31-8f92-9111812837f4' })
  @IsOptional()
  @IsUUID('4')
  referenceListingId?: string;

  @ApiPropertyOptional({ example: '85e0bf54-8c08-4177-bb89-53b0a2bfce70' })
  @IsOptional()
  @IsUUID('4')
  referenceUserId?: string;

  @ApiPropertyOptional({ type: [String], example: ['https://storage.aashvo.com/support/txn.pdf'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class GuestSupportTicketDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  userName!: string;

  @ApiProperty({ example: 'rahul.sharma@example.com' })
  @IsEmail()
  userEmail!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  userPhone?: string;

  @ApiProperty({ example: 'general_inquiry' })
  @IsString()
  category!: string;

  @ApiProperty({ example: 'Inquiry regarding student booking verification' })
  @IsString()
  subject!: string;

  @ApiProperty({ example: 'Hello, what documents are needed to verify student eligibility?' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: 'b0f443b2-70b8-4e31-8f92-9111812837f4' })
  @IsOptional()
  @IsUUID('4')
  referenceListingId?: string;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class CreateTicketMessageDto {
  @ApiProperty({ example: 'Thank you for looking into this, here is the updated receipt.' })
  @IsString()
  message!: string;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: TICKET_STATUSES, example: 'resolved' })
  @IsIn(TICKET_STATUSES)
  status!: TicketStatus;

  @ApiPropertyOptional({ example: '85e0bf54-8c08-4177-bb89-53b0a2bfce70' })
  @IsOptional()
  @IsUUID('4')
  assignedTo?: string;
}

export class TicketMessageResponseDto implements TicketMessageView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ticketId!: string;

  @ApiProperty({ nullable: true })
  senderId!: string | null;

  @ApiProperty()
  senderName!: string;

  @ApiProperty({ enum: TICKET_SENDER_ROLES })
  senderRole!: TicketSenderRole;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: [String] })
  attachments!: string[];

  @ApiProperty()
  createdAt!: string;
}

export class SupportTicketResponseDto implements SupportTicketView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ticketNumber!: string;

  @ApiProperty({ nullable: true })
  userId!: string | null;

  @ApiProperty()
  userEmail!: string;

  @ApiProperty()
  userName!: string;

  @ApiProperty({ nullable: true })
  userPhone!: string | null;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ nullable: true })
  referenceListingId!: string | null;

  @ApiProperty({ nullable: true })
  referenceUserId!: string | null;

  @ApiProperty({ enum: TICKET_PRIORITIES })
  priority!: TicketPriority;

  @ApiProperty({ enum: TICKET_STATUSES })
  status!: TicketStatus;

  @ApiProperty({ nullable: true })
  assignedTo!: string | null;

  @ApiProperty({ type: [String] })
  attachments!: string[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ nullable: true })
  resolvedAt!: string | null;

  @ApiPropertyOptional({ type: [TicketMessageResponseDto] })
  messages?: TicketMessageResponseDto[];
}

export class CreateSafetyReportDto {
  @ApiProperty({ enum: ['listing', 'flatmate', 'user'], example: 'listing' })
  @IsIn(['listing', 'flatmate', 'user'])
  targetType!: 'listing' | 'flatmate' | 'user';

  @ApiProperty({ example: 'b0f443b2-70b8-4e31-8f92-9111812837f4' })
  @IsUUID('4')
  targetId!: string;

  @ApiPropertyOptional({ example: 'Bright 2BHK in Indiranagar' })
  @IsOptional()
  @IsString()
  targetTitle?: string;

  @ApiProperty({ example: 'scam_fraud' })
  @IsString()
  reasonCode!: string;

  @ApiProperty({ example: 'Host demanded advance payment before viewing.' })
  @IsString()
  details!: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  reporterEmail?: string;

  @ApiPropertyOptional({ example: 'Rahul S.' })
  @IsOptional()
  @IsString()
  reporterName?: string;
}

export class SafetyReportResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  targetType!: string;

  @ApiProperty()
  targetTitle!: string;

  @ApiProperty()
  reasonCode!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  priority!: string;

  @ApiProperty()
  createdAt!: string;
}


