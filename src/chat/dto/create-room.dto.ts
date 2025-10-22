// chat/dto/create-room.dto.ts
import { IsArray, ArrayMinSize, IsMongoId, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @IsMongoId()
  taskId: string;

  // participants other than the creator. Minimum 1 (so at least two participants)
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  participants: string[]; // will be merged with current user in service



  @IsOptional()
  extra?: any;
}
