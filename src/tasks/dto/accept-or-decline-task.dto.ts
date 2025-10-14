import { IsString } from 'class-validator';

export class AcceptOrDeclineTaskDto {
  @IsString()
  taskId: string;
}


export class TaskIDDto {
  @IsString()
  taskId: string;
}
