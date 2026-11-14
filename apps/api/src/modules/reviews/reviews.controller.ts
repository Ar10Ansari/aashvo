import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestWithId } from '../../common/interceptors/request-id.interceptor';
import type { AuthenticatedUser } from '../users/users.types';
import {
  CreateTenancyReviewDto,
  ModerateReviewDto,
  TenancyReviewResponseDto,
} from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Tenancy Reviews & Trust Ratings')
@Controller('api/v1/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Submit a verified tenancy review after an active or completed tenancy' })
  @ApiResponse({ status: 201, type: TenancyReviewResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid review parameters or counterparty mismatch' })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not a party to the agreement' })
  @ApiResponse({ status: 409, description: 'Duplicate review for this agreement already exists' })
  async createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTenancyReviewDto,
    @Req() req: RequestWithId,
  ): Promise<TenancyReviewResponseDto> {
    return this.reviewsService.createReview(user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Public()
  @Get('property/:propertyId')
  @ApiOperation({ summary: 'List verified public reviews for a property' })
  @ApiResponse({ status: 200, type: [TenancyReviewResponseDto] })
  async getPropertyReviews(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<TenancyReviewResponseDto[]> {
    return this.reviewsService.getPropertyReviews(propertyId);
  }

  @Public()
  @Get('profile/:profileId')
  @ApiOperation({ summary: 'List verified public reviews received by a landlord or tenant profile' })
  @ApiResponse({ status: 200, type: [TenancyReviewResponseDto] })
  async getProfileReviews(
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ): Promise<TenancyReviewResponseDto[]> {
    return this.reviewsService.getProfileReviews(profileId);
  }

  @Patch(':id/moderate')
  @ApiBearerAuth('BearerAuth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Moderate or flag a review (Admin only)' })
  @ApiResponse({ status: 200, type: TenancyReviewResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden: admin role required' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async moderateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateReviewDto,
    @Req() req: RequestWithId,
  ): Promise<TenancyReviewResponseDto> {
    return this.reviewsService.moderateReview(id, user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }
}

