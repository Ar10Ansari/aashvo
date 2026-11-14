import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import type { RequestWithId } from '../../common/interceptors/request-id.interceptor';
import type { AuthenticatedUser } from '../users/users.types';
import {
  ConfirmUploadDto,
  MediaAssetResponseDto,
  PresignedDownloadResponseDto,
  PresignedUploadDto,
  PresignedUploadResponseDto,
} from './dto/media.dto';
import { MediaService } from './media.service';

@ApiTags('Media & Storage')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presigned-upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a presigned upload URL for media or private document' })
  @ApiResponse({ status: 200, type: PresignedUploadResponseDto })
  @ApiResponse({ status: 400, description: 'Unsupported MIME type or file too large' })
  async requestPresignedUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignedUploadDto,
    @Req() req: RequestWithId,
  ): Promise<PresignedUploadResponseDto> {
    return this.mediaService.requestPresignedUpload(user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm completed upload and transition asset to verified status' })
  @ApiResponse({ status: 200, type: MediaAssetResponseDto })
  @ApiResponse({ status: 404, description: 'Media asset not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to confirm this asset' })
  async confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmUploadDto,
    @Req() req: RequestWithId,
  ): Promise<MediaAssetResponseDto> {
    return this.mediaService.confirmUpload(user.id, user.role, dto, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Generate a short-lived presigned download URL for private document' })
  @ApiResponse({ status: 200, type: PresignedDownloadResponseDto })
  @ApiResponse({ status: 404, description: 'Media asset not found' })
  @ApiResponse({ status: 403, description: 'Forbidden: Access to private document denied' })
  async getPrivateDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithId,
  ): Promise<PresignedDownloadResponseDto> {
    return this.mediaService.getPrivateDownloadUrl(user.id, user.role, id, {
      ipAddress: req.ip,
      requestId: req.requestId,
    });
  }
}

