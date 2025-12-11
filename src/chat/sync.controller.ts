import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtGuard } from '../../guards/jwt.guard';

@Controller('sync')
@UseGuards(JwtGuard)
export class SyncController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async pullChanges(
    @Query('last_pulled_at') lastPulledAt: string,
    @Req() req,
  ) {
    const timestamp = lastPulledAt && lastPulledAt !== 'null' ? parseInt(lastPulledAt) : 0;
    const changes = await this.chatService.getChanges(req.user.userId, timestamp);
    return {
      changes,
      timestamp: Date.now(),
    };
  }

  @Post()
  async pushChanges(
    @Body() body: { changes: any; last_pulled_at: number },
    @Req() req,
  ) {
    await this.chatService.applyChanges(req.user.userId, body.changes);
    return { success: true };
  }
}
