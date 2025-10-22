// chat/dto/send-message.dto.ts
import { IsMongoId, IsOptional, IsString, IsEnum, IsArray } from 'class-validator';
import { MessageType } from '../schemas/message.schema';

export class SendMessageDto {
  @IsMongoId()
  roomId: string;

  @IsEnum(MessageType)
  type: MessageType;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsMongoId()
  replyTo?: string; // 🔥 message being replied to

  // attachments are normally uploaded via UploadController and then client sends attachment metadata
  @IsOptional()
  @IsArray()
  attachments?: { url: string; key?: string; kind?: string }[];
}
