import {
  type MarketplaceProfileType,
} from '@aashvo/contracts';
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
  CreateMarketplaceProfileDto,
  MarketplaceProfileResponseDto,
  PersonalOnboardingDto,
  ProfileCompletionBreakdownDto,
  SwitchMarketplaceProfileDto,
  UpdateMarketplaceProfileDto,
} from './dto/marketplace-profile.dto';
import {
  PublicProfileResponseDto,
  UpdateProfileDto,
  UserProfileResponseDto,
} from './dto/profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('Profiles & Personas')
@Controller('api/v1/profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Get authoritative profile for currently authenticated user' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileResponseDto> {
    return this.profilesService.getMyProfile(user.id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Update profile details (name, phone, bio, avatar) for authenticated user' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  @ApiResponse({ status: 409, description: 'Phone number already registered to another account' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: RequestWithId,
  ): Promise<UserProfileResponseDto> {
    return this.profilesService.updateMyProfile(user.id, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  // ==================== MARKETPLACE PROFILES ====================

  @Get('marketplace')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Get all marketplace profiles (personas) for current user' })
  @ApiResponse({ status: 200, type: [MarketplaceProfileResponseDto] })
  async getMyMarketplaceProfiles(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MarketplaceProfileResponseDto[]> {
    return this.profilesService.getMyMarketplaceProfiles(user.id);
  }

  @Post('marketplace')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Create or activate a new marketplace profile persona' })
  @ApiResponse({ status: 201, type: MarketplaceProfileResponseDto })
  async createMarketplaceProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMarketplaceProfileDto,
  ): Promise<MarketplaceProfileResponseDto> {
    return this.profilesService.createMarketplaceProfile(user.id, dto);
  }

  @Patch('marketplace/:type')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Update a specific marketplace profile persona' })
  @ApiResponse({ status: 200, type: MarketplaceProfileResponseDto })
  async updateMarketplaceProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: MarketplaceProfileType,
    @Body() dto: UpdateMarketplaceProfileDto,
  ): Promise<MarketplaceProfileResponseDto> {
    return this.profilesService.updateMarketplaceProfile(user.id, type, dto);
  }

  @Post('marketplace/switch')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Switch current active marketplace profile without logging out' })
  @ApiResponse({ status: 200, type: MarketplaceProfileResponseDto })
  async switchActiveProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SwitchMarketplaceProfileDto,
  ): Promise<MarketplaceProfileResponseDto> {
    return this.profilesService.switchActiveProfile(user.id, dto.profileType);
  }

  // ==================== ONBOARDING & COMPLETION ====================

  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Save multi-step progressive onboarding profile as draft or publish' })
  @ApiResponse({ status: 200, description: 'Onboarding data saved successfully' })
  async saveOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PersonalOnboardingDto,
  ) {
    return this.profilesService.saveOnboardingProfile(user.id, dto);
  }

  @Get('completion')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Get profile completion breakdown, percentage, and missing fields' })
  @ApiResponse({ status: 200, type: ProfileCompletionBreakdownDto })
  async getCompletion(@CurrentUser() user: AuthenticatedUser): Promise<ProfileCompletionBreakdownDto> {
    return this.profilesService.getProfileCompletionStatus(user.id);
  }

  @Post('publish')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Publish completed flatmate profile to Aashvo Connect discovery' })
  @ApiResponse({ status: 200, type: ProfileCompletionBreakdownDto })
  async publishProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileCompletionBreakdownDto> {
    return this.profilesService.publishProfile(user.id);
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Pause flatmate profile from Aashvo Connect discovery' })
  @ApiResponse({ status: 200, type: ProfileCompletionBreakdownDto })
  async pauseProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileCompletionBreakdownDto> {
    return this.profilesService.pauseProfile(user.id);
  }

  // ==================== PUBLIC VIEW ====================

  @Get(':userId')
  @Public()
  @ApiOperation({ summary: 'Get sanitized public profile view for any user' })
  @ApiResponse({ status: 200, type: PublicProfileResponseDto })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getPublicProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<PublicProfileResponseDto> {
    return this.profilesService.getPublicProfile(userId);
  }
}
