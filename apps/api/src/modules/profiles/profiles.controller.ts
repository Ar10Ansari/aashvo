import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
  PublicProfileResponseDto,
  UpdateProfileDto,
  UserProfileResponseDto,
} from './dto/profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('Profiles')
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

