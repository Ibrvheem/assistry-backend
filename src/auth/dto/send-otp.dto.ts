import { IsEmail, IsOptional, IsString } from 'class-validator';

export class sendOTPDTO {
  @IsEmail()
  email: string;

  @IsString()
  phone_no: string;
}

export class verifyOTPDTO {
  @IsString()
  otp: string;
  @IsString()
  email: string;

  @IsOptional()
  purpose: string;
}
