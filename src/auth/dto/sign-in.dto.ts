import { IsEmail, IsString } from 'class-validator';

export class SignInDTO {
  @IsString()
  reg_no: string;

  @IsString()
  password: string;

  @IsString()
  push_token: string;
}
