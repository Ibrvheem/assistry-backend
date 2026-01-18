import { IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator';

// export class VerifyOtpDto {
//   @IsString()
//   // @IsPhoneNumber()
//   phone_no: string;

//   @IsString()
//   @Length(6, 6) // Adjust the length as needed
//   code: string;
// }

export class VerifyOtpDto {
  // client will send pin_id returned from send endpoint
  @IsOptional()
  @IsString()
  pin_id?: string;
  // user-entered code (OTP)
  @IsString()
  code: string;
}
