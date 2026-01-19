import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SUCCESS } from 'constants/CustomResponses';
import { sendOTPDTO, verifyOTPDTO } from './dto/send-otp.dto';
import { REGSTATUS } from 'src/users/types';
import { UpdateUserDto } from 'src/users/dto/update-auth.dto';
import { User } from 'src/users/user.schema';
import { WalletService } from '../wallet/wallet.service';
import { OtpService } from 'src/otp/otp.service';
import { SignUpDTO } from './dto/sign-up.dto';
import { PureComponent } from 'react';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly walletService: WalletService,
    private readonly otpService: OtpService,
  ) {}

  async register(payload: UpdateUserDto) {
    const isUser = await this.userService.getUserByRegNo(payload.reg_no);
    if (isUser && isUser.status === REGSTATUS.COMPLETED) {
      throw new BadRequestException('User already exists');
    }
    try {
      const hashedPassword = await bcrypt.hash(payload.password, 10);
      await this.userService.updateUser(
        {
          password: hashedPassword,
        },
        isUser.id,
      );
      try {
        await this.walletService.createWalletForUser(isUser.id);
      } catch (err) {
        // don't fail user creation for wallet errors; log and proceed
        console.error('create wallet failed', err);
      }
      return SUCCESS;
    } catch (err) {
      throw new NotFoundException(err);
    }
  }

  // async registerStudent(payload: CreateUserDto) {
  //   const isUser = await this.userService.getUserByRegNoInstitution(
  //     payload.reg_no,
  //     payload.institution,
  //   );
  //   if (
  //     isUser &&
  //     isUser.status === REGSTATUS.COMPLETED &&
  //     isUser.isAuthVerified
  //   ) {
  //     throw new BadRequestException('User already exists');
  //   }
  //   const hashedPassword = await bcrypt.hash(payload.password, 10);

  //   if (isUser.isAuthVerified && !isUser.isAuthVerified) {
  //     await this.userService.updateUser(
  //       {
  //         ...payload,
  //         password: hashedPassword,
  //       },
  //       isUser.id,
  //     );
  //     try {
  //       await this.otpService.sendEmailOtp(payload.email);
  //     } catch (err) {
  //       // don't fail user creation for wallet errors; log and proceed
  //       console.error('sending otp failed', err);
  //     }
  //     return {
  //       userId: isUser.id,
  //       status: 200,
  //       message: 'Otp sent successfully',
  //     };
  //   }

  //   try {
  //     const user = await this.userService.createUser({
  //       ...payload,
  //       password: hashedPassword,
  //     });
  //     try {
  //       await this.walletService.createWalletForUser(user.id);
  //     } catch (err) {
  //       // don't fail user creation for wallet errors; log and proceed
  //       console.error('create wallet failed', err);
  //     }
  //     // await this.userService.updateUser(
  //     //   {
  //     //     status: REGSTATUS.COMPLETED,
  //     //   },
  //     //   user.id,
  //     // );
  //     try {
  //       await this.otpService.sendEmailOtp(payload.email);
  //     } catch (err) {
  //       // don't fail user creation for wallet errors; log and proceed
  //       console.error('sending otp failed', err);
  //     }
  //     return {
  //       userId: user.id,
  //       status: 200,
  //       message: 'Otp sent successfully',
  //     };
  //   } catch (err) {
  //     throw new NotFoundException(err);
  //   }
  // }
  async registerStudent(payload: CreateUserDto) {
    const isUser = await this.userService.getUserByRegNoInstitution(
      payload.reg_no,
      payload.institution,
    );

    // 1️⃣ User already completed & verified
    if (
      isUser &&
      isUser.status === REGSTATUS.COMPLETED &&
      isUser.isAuthVerified
    ) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);

    // 2️⃣ User exists but NOT verified → update & resend OTP
    if (isUser && !isUser.isAuthVerified) {
      await this.userService.updateUser(
        {
          ...payload,
          password: hashedPassword,
        },
        isUser.id,
      );

      try {
        await this.otpService.sendEmailOtp(payload.email);
      } catch (err) {
        console.error('sending otp failed', err);
      }

      return {
        userId: isUser.id,
        status: 200,
        message: 'Otp sent successfully',
      };
    }

    // 3️⃣ User does NOT exist → create new
    try {
      const user = await this.userService.createUser({
        ...payload,
        password: hashedPassword,
      });

      try {
        await this.walletService.createWalletForUser(user.id);
      } catch (err) {
        console.error('create wallet failed', err);
      }

      try {
        await this.otpService.sendEmailOtp(payload.email);
      } catch (err) {
        console.error('sending otp failed', err);
      }

      return {
        userId: user.id,
        status: 200,
        message: 'Otp sent successfully',
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async validateUser(reg_no: string, password: string) {
    const user = await this.userService.findUserByRegNo(reg_no.toLowerCase());

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isPassword = await bcrypt.compare(password, user.password);

    if (!isPassword) {
      throw new UnauthorizedException('Invalid Credentials');
    }
    return user;
  }
  async login(user: User) {
    const payload = {
      reg_no: user.reg_no,
      userId: user.id,
      first_name: user.first_name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture: user.profile_picture,
        phone_no: user.phone_no,
        email: user.email,
        _id: user.id,
      },
    };
  }

  async requestForgot(email: string) {
    const user = await this.userService.findUserByEmail(email);
    if (!user) throw new BadRequestException('No User found with this email');
    // await this.sendOtp(email, 'forgot_password');
    try {
      await this.otpService.sendEmailOtp(email);
    } catch (err) {
      throw new BadRequestException(err);
    }
    return true;
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.userService.findUserByEmail(email);
    if (!user) throw new BadRequestException('No User found with this email');
    const otp = code;
    const purpose = 'reset_password';
    try {
      await this.verifyOTP({ email, otp, purpose });
    } catch (err) {
      throw new BadRequestException(err);
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.userService.updateUser(
      {
        password: hash,
      },
      user.id,
    );
    return true;
  }

  async run() {
    // const user= this.userService.findUserByEmail('Jamils@gmail.com');
    const user = await this.userService.getUserByRegNo('1711402030');
    const hashedPassword = await bcrypt.hash('1234', 10);
    await this.userService.updateUser(
      {
        password: hashedPassword,
      },
      user.id,
    );
    return user;
  }
  async sendOTP(payload: sendOTPDTO) {
    const otp = Math.floor(100000 + Math.random() * 900000);

    const user = await this.userService.findUserByEmail(payload.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    try {
      const updateUser = await this.userService.updateUser(
        {
          otp: otp.toString(),
        },
        user.id,
      );
      return { status: 200, otp };
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  async verifyOTP(payload: verifyOTPDTO) {
    try {
      const user = await this.userService.findUserByEmail(payload.email);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      try {
        await this.otpService.verifyEmailOtp(payload.email, payload.otp);
      } catch (err) {
        throw new BadRequestException('Unable to verify OTP');
      }

      if (payload.purpose && payload.purpose == 'auth_account') {
        await this.userService.updateUserVerification(true, user.id);
      }
      return SUCCESS;

      // if (user.otp === payload.otp) {
      //   await this.userService.updateUser(
      //     {
      //       status: 'otp_verified',
      //     },
      //     user.id,
      //   );
      //   return SUCCESS;
      // } else {
      //   throw new BadRequestException('Unable to verify OTP');
      // }
    } catch (err) {
      throw new InternalServerErrorException();
    }
  }
}
