// chat/chat.controller.ts
import { Controller, Post, Body, Get, Query, Req, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // create or find existing room (prevents duplicates)
  @Post('rooms')
  async createRoom(@Req() req: any, @Body() dto: CreateRoomDto) {
    const userId = req.user.userId;
    const room = await this.chatService.findOrCreateRoom(userId, dto);
    return room;
  }

  // list rooms
  @Get('rooms')
  async getRooms(@Req() req: any, @Query('limit') limit = '20', @Query('skip') skip = '0') {
    const userId = req.user.userId;
    return this.chatService.getRoomsForUser(userId, Number(limit), Number(skip));
  }

  // list messages for a room
  @Get('rooms/:roomId/messages')
  async getMessages(@Req() req: any, @Param('roomId') roomId: string, @Query('limit') limit = '50', @Query('before') before?: string) {
    // TODO: validate user is participant — ChatService.getMessages could check but we leave it to caller or extend
    return this.chatService.getMessages(roomId, Number(limit), before);
  }

  // send message via REST (useful for mobile or when not using socket)
  @Post('messages')
  async sendMessage(@Req() req: any, @Body() dto: SendMessageDto) {
    const userId = req.user.userId;
    const message = await this.chatService.createMessage(userId, dto);
    return message;
  }

  // mark as read
  @Post('rooms/:roomId/read')
  async markRead(@Req() req: any, @Param('roomId') roomId: string) {
    const userId = req.user.userId;
    return this.chatService.markAsRead(roomId, userId);
  }
}
