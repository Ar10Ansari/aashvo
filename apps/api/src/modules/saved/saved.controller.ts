import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/users.types';
import {
  CreateSavedItemDto,
  GetSavedItemsQueryDto,
  SavedItemResponseDto,
} from './dto/saved.dto';
import { SavedService } from './saved.service';

@ApiTags('Saved Items & Shortlists')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/saved')
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Post()
  @ApiOperation({ summary: 'Save a property or flatmate profile to personal shortlist' })
  @ApiResponse({ status: 201, type: SavedItemResponseDto })
  @ApiResponse({ status: 400, description: 'Attempted to save own profile or invalid target' })
  @ApiResponse({ status: 403, description: 'Blocked user boundary' })
  @ApiResponse({ status: 404, description: 'Target entity not found' })
  async saveItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedItemDto,
  ): Promise<SavedItemResponseDto> {
    return this.savedService.saveItem(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all saved properties and flatmate profiles for caller' })
  @ApiResponse({ status: 200, type: [SavedItemResponseDto] })
  async getSavedItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetSavedItemsQueryDto,
  ): Promise<SavedItemResponseDto[]> {
    return this.savedService.getSavedItems(user.id, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an item from personal shortlist' })
  @ApiResponse({ status: 200, description: 'Item removed successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized to remove this saved item' })
  @ApiResponse({ status: 404, description: 'Saved item not found' })
  async deleteSavedItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.savedService.deleteSavedItem(user.id, id);
  }

  @Get('check/:itemType/:targetId')
  @ApiOperation({ summary: 'Check if a specific target item is already shortlisted' })
  @ApiResponse({ status: 200, description: 'Saved status checked' })
  async checkSaved(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemType') itemType: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ): Promise<{ isSaved: boolean; savedId?: string }> {
    return this.savedService.checkSaved(user.id, itemType, targetId);
  }
}
