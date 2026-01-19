import { IsDate, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  @IsOptional()
  profile_picture: string;

  @IsString()
  reg_no: string;

  @IsString()
  @IsOptional()
  phone_no: string;

  @IsString()
  email: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsString()
  @IsOptional()
  otp: string;

  @IsString()
  // @IsOptional()
  department: string;

  @IsString()
  // @IsOptional()
  level: string;

  @IsString()
  gender: string;
  @IsString()
  state: string;

  @IsMongoId()
  institution: string;

  @IsString()
  @IsOptional()
  bio: string;

  @IsString()
  @IsOptional()
  status: string;

  @IsDate()
  @IsOptional()
  created_at: Date;

  @IsDate()
  @IsOptional()
  updated_at: Date;
  @IsString()
  username: string;
}
