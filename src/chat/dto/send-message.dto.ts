// // chat/dto/send-message.dto.ts
// import { IsMongoId, IsOptional, IsString, IsEnum, IsArray } from 'class-validator';
// import { MessageType } from '../schemas/message.schema';

// export class SendMessageDto {
//   @IsMongoId()
//   roomId: string;

//   @IsEnum(MessageType)
//   type: MessageType;

//   @IsOptional()
//   @IsString()
//   text?: string;

//   @IsOptional()
//   @IsMongoId()
//   replyTo?: string; // 🔥 message being replied to

//   // attachments are normally uploaded via UploadController and then client sends attachment metadata
//   @IsOptional()
//   @IsArray()
//   attachments?: { url: string; key?: string; kind?: string }[];
// }


import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  roomId: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsNotEmpty()
  @IsString()
  type: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsString()
  replyTo?: string;

  @IsOptional()
  @IsString()
  tempId?: string;
}
