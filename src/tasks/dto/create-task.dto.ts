import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { AssetDTO } from 'src/commons/dto/asset.dto';
import { PaymentMethod } from '../task.schema';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  task: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsString()
  @IsNotEmpty()
  incentive: string;

  @IsNotEmpty()
  expires: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  payment_method: PaymentMethod;

  @IsString()
  @IsOptional()
  timeline: string;

  @IsArray()
  @IsOptional()
  assets: AssetDTO;
}
