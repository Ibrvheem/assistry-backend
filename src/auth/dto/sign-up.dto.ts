import { IsEmail, IsString } from 'class-validator';

export class SignUpDTO {
  @IsString()
  reg_no: string;

  @IsString()
  password: string;

  @IsString()
  phone_number: string;

  @IsEmail()
  email: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  gender: string;

  @IsString()
  level: string;

  @IsString()
  institution: string;

  @IsString()
  department: string;

  @IsString()
  state: string;

  @IsString()
  username: string;
}
