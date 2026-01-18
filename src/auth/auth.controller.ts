import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { Public } from 'decorators/public.decorator';
import { sendOTPDTO, verifyOTPDTO } from './dto/send-otp.dto';
import { UpdateUserDto } from 'src/users/dto/update-auth.dto';
import { SignInDTO } from './dto/sign-in.dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  create(@Body() payload: UpdateUserDto) {
    return this.authService.register(payload);
  }

  @Get('/run')
  runn() {
    return this.authService.run();
  }

  // @UseGuards(AuthGuard('local'))
  // @Post('/signin')
  // async login(@Request() req) {
  //   return this.authService.login(req.user);
  // }
  // @UseGuards(AuthGuard('local'))
  @Post('/signin')
  async login(@Body() payload: SignInDTO) {
    const user = await this.authService.validateUser(
      payload.reg_no,
      payload.password,
    );
    return this.authService.login(user);
  }

  @Post('/send-otp')
  sendOTP(@Body() payload: sendOTPDTO) {
    return this.authService.sendOTP(payload);
  }
  @Post('/verify-otp')
  verifyOTP(@Body() payload: verifyOTPDTO) {
    return this.authService.verifyOTP(payload);
  }
}
