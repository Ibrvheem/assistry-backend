// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatRoomSchema } from './schemas/chat-room.schema';
import { MessageSchema } from './schemas/message.schema';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TasksModule } from 'src/tasks/tasks.module';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { WsJwtGuard } from 'guards/ws-jwt.guard';

import { SyncController } from './sync.controller';

@Module({
  imports: [
    // ✅ MongoDB Schemas
    MongooseModule.forFeature([
      { name: 'ChatRoom', schema: ChatRoomSchema },
      { name: 'Message', schema: MessageSchema },
    ]),

    // ✅ Redis Connection
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get<string>('REDIS_URL') || 'redis://localhost:6379',
        options: {
          maxRetriesPerRequest: null, // prevents blocking under heavy load
          enableReadyCheck: true,
        },
      }),
    }),
    AuthModule,
    TasksModule,
    UsersModule,
  ],

  controllers: [ChatController, SyncController],
  providers: [ChatService, ChatGateway, WsJwtGuard],
  exports: [ChatService],
})
export class ChatModule {}
