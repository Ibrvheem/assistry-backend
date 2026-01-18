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
  async send(@Body('phone_no') phone_no: string) {
    // returns Termii response that includes pinId
    console.log('Phone number received:', phone_no);
    return this.otpService.sendOtp(phone_no);
  }

  @Post('/verify')
  async verify(@Body() body: VerifyOtpDto) {
    return this.otpService.verifyOtp(body);
  }

  @Post('/email/send')
  async sendEmail(@Body('email') email: string) {
    return this.otpService.sendEmailOtp(email);
  }

  @Post('/email/verify')
  async verifyEmail(@Body('email') email: string, @Body('code') code: string) {
    return this.otpService.verifyEmailOtp(email, code);
  }
}
