import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from 'guards/ws-jwt.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from 'src/notifications/notifications.service';

@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: true },
  pingTimeout: 60000,
  pingInterval: 25000,
})
@UseGuards(WsJwtGuard)
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('ChatGateway');
  private redisPub;
  private redisSub;

  private readonly ONLINE_USERS_KEY = 'chat:online_users';
  private readonly CHANNEL = 'chat:messages';
  private readonly TYPING_CHANNEL = 'chat:typing';
  private readonly STATUS_CHANNEL = 'chat:status';

  constructor(
    private readonly chatService: ChatService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
    @InjectRedis() private readonly redisClient: Redis,
  ) {
    this.redisPub = this.redisClient;
    this.redisSub = this.redisClient.duplicate();

    // Subscribe to Redis channels
    this.redisSub.subscribe(
      this.CHANNEL,
      this.TYPING_CHANNEL,
      this.STATUS_CHANNEL,
    );

    this.redisSub.on('message', (channel: string, message: string) => {
      const parsed = JSON.parse(message);

      switch (channel) {
        case this.CHANNEL:
          this.server.to(parsed.roomId).emit('message', parsed);
          break;

        case this.TYPING_CHANNEL:
          this.server.to(parsed.roomId).emit('userTyping', parsed);
          break;

        case this.STATUS_CHANNEL:
          this.server.to(parsed.roomId).emit('messageStatus', parsed);
          break;
      }
    });
  }

  afterInit(server: Server) {
    this.logger.log('ChatGateway initialized ✅');

    server.use(async (socket: Socket, next) => {
      try {
        let token =
          socket.handshake?.auth?.token ||
          (socket.handshake?.query?.token as string) ||
          (socket.handshake?.headers?.authorization || '').replace(
            /^Bearer\s+/i,
            '',
          );

        if (!token) {
          this.logger.warn('No token on handshake');
          return next(new Error('Unauthorized'));
        }

        const payload = this.jwtService.verify(token, {
          secret: this.config.get<string>('JWT_SECRET'),
          ignoreExpiration: true,
        });

        socket.data.user = payload;
        return next();
      } catch (err) {
        this.logger.warn('Socket auth failed: ' + (err as Error).message);
        return next(new Error('Unauthorized: ' + (err as Error).message));
      }
    });
  }

  async handleConnection(client: Socket) {
    const user = client.data.user;
    if (!user) return client.disconnect(true);

    const userId = user.userId ?? user.sub;
    await this.redisPub.sadd(this.ONLINE_USERS_KEY, userId);
    client.join(`user_${userId}`);
    this.logger.log(`Client connected: ${userId} (${client.id})`);
    this.server.emit('userOnline', { userId });
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (!user) return;
    const userId = user.userId ?? user.sub;

    await this.redisPub.srem(this.ONLINE_USERS_KEY, userId);
    this.logger.log(`Client disconnected: ${userId} (${client.id})`);
    this.server.emit('userOffline', { userId });
  }

  /** Join a specific chat room */
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() payload: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    const { roomId } = payload;
    client.join(roomId);
    await this.chatService.markAsRead(roomId, user.userId);
    client.emit('joinedRoom', { roomId });
    await this.pushUnreadCount(user.userId);
  }

  /** Leave a specific chat room */
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() payload: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId } = payload;
    client.leave(roomId);
    client.emit('leftRoom', { roomId });
  }

  /** Send and broadcast a message */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() payload: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    console.log('Message comng in ', payload);
    const { message, participants, roomName } =
      await this.chatService.createMessage(user.userId, payload);
    console.log('Message Processed', message);

    const out = {
      _id: message._id,
      roomId: message.roomId,
      sender: message.sender,
      type: message.type,
      text: message.text,
      attachments: message.attachments,
      createdAt: message.createdAt,
      replyTo: message.replyTo,
      status: 'sent',
      tempId: payload.tempId,
    };

    await this.redisPub.publish(this.CHANNEL, JSON.stringify(out));

    // Push new unread counts and notifications
    const roomSockets = await this.server.in(payload.roomId).fetchSockets();
    const connectedUserIds = new Set(
      roomSockets.map((s) => s.data.user?.userId || s.data.user?.sub),
    );

    for (const pid of participants) {
      if (pid === user.userId) continue;

      // 1. Push unread count update
      await this.pushUnreadCount(pid);

      // 2. Send push notification if NOT connected to room
      if (!connectedUserIds.has(pid)) {
        const output =
          message.type === 'text'
            ? message.text
            : message.type === 'image'
              ? `📸`
              : message.type === 'audio'
                ? `🎤`
                : message.type === 'file'
                  ? `📁`
                  : `Sent a ${message.type}`;
        await this.notificationsService.sendPushNotification(
          pid,
          `${roomName.slice(0, 10)} -- ${user.first_name}`,
          output,
          {
            roomId: message.roomId,
            type: 'CHAT_MESSAGE',
          },
        );
      }
    }

    return {
      status: 'ok',
      data: {
        id: message._id.toString(),
        tempId: payload.tempId,
        serverCreatedAt: message.createdAt,
      },
    };
  }

  /** Broadcast typing or recording indicators */
  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody()
    payload: { roomId: string; isTyping: boolean; isRecording?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    const data = {
      roomId: payload.roomId,
      userId: user.userId ?? user.sub,
      first_name: user.first_name,
      isTyping: payload.isTyping,
      isRecording: payload.isRecording ?? false,
    };

    client.to(payload.roomId).emit('userTyping', data);
    await this.redisPub.publish(this.TYPING_CHANNEL, JSON.stringify(data));
  }

  /** Delivered message event */
  @SubscribeMessage('messageDelivered')
  async handleMessageDelivered(
    @MessageBody() payload: { messageId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    const update = await this.chatService.updateMessageStatus(
      payload.messageId,
      'delivered',
    );

    const data = {
      roomId: payload.roomId,
      messageId: payload.messageId,
      userId: user.userId,
      status: 'delivered',
      timestamp: new Date(),
    };

    this.server.to(payload.roomId).emit('messageStatus', data);
    await this.redisPub.publish(this.STATUS_CHANNEL, JSON.stringify(data));

    return { success: true, status: update };
  }

  /** Seen message event */
  @SubscribeMessage('messageSeen')
  async handleMessageSeen(
    @MessageBody() payload: { messageId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    const update = await this.chatService.updateMessageStatus(
      payload.messageId,
      'seen',
    );

    const data = {
      roomId: payload.roomId,
      messageId: payload.messageId,
      userId: user.userId,
      status: 'seen',
      timestamp: new Date(),
    };

    this.server.to(payload.roomId).emit('messageStatus', data);
    await this.redisPub.publish(this.STATUS_CHANNEL, JSON.stringify(data));

    return { success: true, status: update };
  }

  @SubscribeMessage('getOnlineUsers')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const users = await this.redisPub.smembers(this.ONLINE_USERS_KEY);
    client.emit('onlineUsers', users);
  }

  /** Get unread conversation count */
  @SubscribeMessage('getUnreadCount')
  async handleGetUnreadCount(@ConnectedSocket() client: Socket) {
    const user = client.data.user;
    const count = await this.chatService.getUnreadConversationCount(
      user.userId,
    );
    client.emit('unreadCountUpdate', { count });
  }

  /**
   * Helper to broadcast unread count update to a specific user
   * Since we don't track socketIds per user easily without an adapter,
   * we can emit to a room named `user_{userId}` which we joined on connection.
   */
  private async pushUnreadCount(userId: string) {
    const count = await this.chatService.getUnreadConversationCount(userId);
    this.server.to(`user_${userId}`).emit('unreadCountUpdate', { count });
  }
}
