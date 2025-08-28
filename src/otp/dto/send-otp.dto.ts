import { IsPhoneNumber , IsArray, IsNumber, IsOptional, IsString} from 'class-validator';

export class SendOtpDto {
  // @IsPhoneNumber()
  @IsString()
  phone_no: string;

  @IsString()
  @IsOptional()
  email: string;
}
