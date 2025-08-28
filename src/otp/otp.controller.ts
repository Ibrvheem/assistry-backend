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
  sendOTP(@Body() payload: SendOtpDto) {
    const p=this.otpService.sendOtp(payload.phone_no);
    return p;
  }

  @Post('/verify')
  verifyOTP(@Body() payload: VerifyOtpDto) {
    console.log(payload);
    const p=this.otpService.verifyOtp(payload);
    console.log(p);
    return p; 
  }
}
