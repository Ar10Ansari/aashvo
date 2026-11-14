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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/users.types';
import { ConnectService } from './connect.service';
import {
  BlockUserDto,
  ConnectDiscoverQueryDto,
  ConnectPassDto,
  ConnectSwipeDto,
  ReportUserDto,
  SendConnectMessageDto,
  UpdateIntentionsDto,
  UpdateVisibilityDto,
} from './dto/connect.dto';

@ApiTags('Aashvo Connect (Flatmate Matching)')
@ApiBearerAuth()
@Controller('api/v1/connect')
export class ConnectController {
  constructor(private readonly connectService: ConnectService) {}

  @Get('discover')
  @ApiOperation({ summary: 'Discover compatible flatmate profiles for swipe discovery' })
  @ApiResponse({ status: 200, description: 'List of compatible candidate flatmate profiles' })
  async discover(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ConnectDiscoverQueryDto,
  ) {
    return this.connectService.discoverCandidates(user.id, query);
  }

  @Post('interests')
  @ApiOperation({ summary: 'Express interest (swipe right) or pass on a candidate profile' })
  @ApiResponse({ status: 201, description: 'Swipe recorded; returns mutual match if reciprocal like exists' })
  async swipe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectSwipeDto,
  ) {
    return this.connectService.swipe(user.id, dto);
  }

  @Post('pass')
  @ApiOperation({ summary: 'Pass on a candidate profile (swipe left)' })
  @ApiResponse({ status: 201, description: 'Pass recorded successfully' })
  async pass(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectPassDto,
  ) {
    return this.connectService.swipe(user.id, { targetUserId: dto.targetUserId, action: 'pass' });
  }

  @Post('undo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo the most recent swipe action' })
  @ApiResponse({ status: 200, description: 'Previous action reverted successfully' })
  async undo(@CurrentUser() user: AuthenticatedUser) {
    return this.connectService.undo(user.id);
  }

  @Get('matches')
  @ApiOperation({ summary: 'Get all active mutual flatmate matches for current user' })
  @ApiResponse({ status: 200, description: 'List of mutual matches' })
  async getMatches(@CurrentUser() user: AuthenticatedUser) {
    return this.connectService.getMatches(user.id);
  }

  @Get('matches/:id')
  @ApiOperation({ summary: 'Get details of a specific mutual match' })
  @ApiResponse({ status: 200, description: 'Match details' })
  async getMatchById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.connectService.getMatchById(user.id, id);
  }

  @Get('matches/:id/messages')
  @ApiOperation({ summary: 'Get conversation message thread for a mutual match' })
  @ApiResponse({ status: 200, description: 'Messages list' })
  async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.connectService.getMessages(user.id, id);
  }

  @Post('matches/:id/messages')
  @ApiOperation({ summary: 'Send a message in a mutual match conversation thread' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendConnectMessageDto,
  ) {
    return this.connectService.sendMessage(user.id, id, dto);
  }

  @Post('users/:id/block')
  @ApiOperation({ summary: 'Block a user to prevent future discovery and communication' })
  @ApiResponse({ status: 201, description: 'User blocked' })
  async blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockUserDto,
  ) {
    return this.connectService.blockUser(user.id, id, dto);
  }

  @Post('users/:id/report')
  @ApiOperation({ summary: 'Report a user for safety/moderation review' })
  @ApiResponse({ status: 201, description: 'User reported' })
  async reportUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportUserDto,
  ) {
    return this.connectService.reportUser(user.id, id, dto);
  }

  @Patch('visibility')
  @ApiOperation({ summary: 'Toggle profile visibility in swipe discovery' })
  @ApiResponse({ status: 200, description: 'Visibility updated' })
  async updateVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.connectService.updateVisibility(user.id, dto.discoveryHidden);
  }

  @Patch('intentions')
  @ApiOperation({ summary: 'Update flatmate intentions (has_room, needs_room, team_up)' })
  @ApiResponse({ status: 200, description: 'Intentions updated successfully' })
  async updateIntentions(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateIntentionsDto,
  ) {
    return this.connectService.updateIntentions(user.id, dto.intentions);
  }
}
