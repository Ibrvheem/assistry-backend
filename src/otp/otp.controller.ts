import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { OtpService } from './otp.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { Public } from 'decorators/public.decorator';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Public()
@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}


   @Post('/send')
  async send(@Body('phone') phone_no: string) {
    // returns Termii response that includes pinId
    return this.otpService.sendOtp(phone_no);
  }

  @Post('/verify')
  async verify(@Body() body: VerifyOtpDto) {
    return this.otpService.verifyOtp(body);
  }

  // @Post('/send')
  // sendOTP(@Body() payload: SendOtpDto) {
  //   const p=this.otpService.sendOtp(payload.phone_no);
  //   return p;
  // }

  // @Post('/verify')
  // verifyOTP(@Body() payload: VerifyOtpDto) {
  //   console.log(payload);
  //   const p=this.otpService.verifyOtp(payload);
  //   console.log(p);
  //   return p; 
  // }
}
