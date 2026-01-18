// import { Injectable } from '@nestjs/common';
// import { VerifyOtpDto } from './dto/verify-otp.dto';
// import { Twilio } from 'twilio';
// import { ConfigService } from '@nestjs/config';

// function normalizePhone(raw: string | null | undefined): string | undefined {
//   if (!raw) return raw;
//   let phone = raw.trim();
//   phone = phone.replace(/[\s\-()]/g, '');
//   if (phone.startsWith('+')) return phone;
//   if (phone.startsWith('0')) return '+234' + phone.slice(1);
//   if (phone.startsWith('234')) return '+' + phone;
//   if (/^[0-9]{10}$/.test(phone)) return '+234' + phone;
//   return phone;
// }
// @Injectable()
// export class OtpService {
//   public constructor(
//     private twilioClient: Twilio,
//     private configService: ConfigService,
//   ) {
//     const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
//     const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

//     this.twilioClient = new Twilio(accountSid, authToken);
//   }
//   async sendOtp(phoneNumber: string) {
//     const serviceSid = this.configService.get<string>('TWILIO_SERVICE_SID');
//     let msg = '';
//     await this.twilioClient.verify.v2
//       .services(serviceSid)
//       .verifications.create({ to: normalizePhone(phoneNumber), channel: 'sms' })
//       .then((verification) => (msg = verification.status));
//     return { msg: msg };
//   }

//   async verifyOtp(data: VerifyOtpDto) {
//     const serviceSid = this.configService.get('TWILIO_SERVICE_SID');
//     let msg = '';
//     await this.twilioClient.verify.v2
//       .services(serviceSid)
//       .verificationChecks.create({ to: normalizePhone(data.phone_no), code: data.code })
//       .then((verification) => (msg = verification.status));
//     return { msg: msg };
//   }
// }
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Otp, OtpDocument } from './otp.schema';
import { User } from '../users/user.schema';
import { REGSTATUS } from 'src/users/types';
import * as nodemailer from 'nodemailer';

function normalizePhone(raw: string | null | undefined): string | undefined {
  if (!raw) return raw;
  let phone = raw.trim();
  phone = phone.replace(/[\s\-()]/g, '');
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) return '+234' + phone.slice(1);
  if (phone.startsWith('234')) return '+' + phone;
  if (/^[0-9]{10}$/.test(phone)) return '+234' + phone;
  return phone;
}
function normalizeForTermii(
  raw: string | null | undefined,
): string | undefined {
  const p = normalizePhone(raw);
  if (!p) return undefined;
  return p.startsWith('+') ? p.slice(1) : p;
}

@Injectable()
export class OtpService {
  private baseUrl: string;
  private apiKey: string;
  private senderId: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
    @InjectModel('User') private readonly userModel: Model<User>,
  ) {
    this.baseUrl =
      this.configService.get<string>('TERMII_BASE_URL') ||
      'https://api.termii.com';
    this.apiKey = this.configService.get<string>('TERMII_API_KEY') || '';
    this.senderId =
      this.configService.get<string>('TERMII_SENDER_ID') || 'Termii';
    if (!this.apiKey) {
      console.warn('TERMII_API_KEY not configured, SMS OTP will fail');
    }
  }

  private generateNumericOtp(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }

  async sendEmailOtp(email: string) {
    const code = this.generateNumericOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    try {
      // Upsert OTP for this email
      await this.otpModel.findOneAndUpdate(
        { email },
        { code, expiresAt },
        { upsert: true, new: true },
      );

      // Check if SMTP is configured
      const smtpHost = this.configService.get('SMTP_HOST');

      // Production mode: send via SMTP
      const port = Number(this.configService.get('SMTP_PORT') || 587);
      const secure = port === 465; // true for 465, false for 587

      console.log(
        `[SMTP Debug] Host: ${smtpHost}, Port: ${port}, Secure: ${secure}, User: ${this.configService.get('SMTP_USER')}`,
      );

      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port,
          secure,
          auth: {
            user: this.configService.get('SMTP_USER'),
            pass: this.configService.get('SMTP_PASS'),
          },
        });

        console.log('Code', code);

        const from =
          this.configService.get('EMAIL_FROM') || 'no-reply@example.com';
        const sent = await transporter.sendMail({
          from,
          to: email,
          subject: `Your Verification Code`,
          // text: `Your verification code is ${code} and will expire in 15 minutes.`,
          html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h2 style="color: #333;">Verification Code</h2>
            <p>Your verification code is: <strong style="font-size: 24px; color: #007bff;">${code}</strong></p>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this code, please ignore this email.</p>
          </div>
        `,
        });
        console.log(sent);
      } catch (error) {
        console.error('Failed to send OTP email:', error.message);
        console.log(`\n📧 OTP CODE for ${email}: ${code}\n`);
      }

      return { message: 'OTP sent successfully' };
    } catch (err) {
      console.error('Error in sendEmailOtp:', err);
      throw new InternalServerErrorException(
        err.message || 'Error processing email OTP',
      );
    }
  }

  async verifyEmailOtp(email: string, code: string) {
    // const user = await this.userModel.findById(userId).exec();
    // if (!user) {
    //   throw new NotFoundException('User not found');
    // }

    const record = await this.otpModel.findOne({ email }).exec();

    if (!record) {
      throw new BadRequestException('No OTP record found for this email');
    }

    if (record.code !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    if (new Date() > record.expiresAt) {
      throw new BadRequestException('Verification code has expired');
    }

    // Optionally delete the OTP record after successful verification
    await this.otpModel.deleteOne({ _id: record._id }).exec();
    // await this.userModel.findOneAndUpdate(
    //   {
    //     isAuthVerified: true,
    //     status: REGSTATUS.COMPLETED,
    //   },
    //   user.id,
    // );

    return { message: 'OTP verified successfully' };
  }

  async sendOtp(phoneNumber: string) {
    // ... Termii implementation remains ...
    console.log('Original phone number:', phoneNumber);
    const to = normalizeForTermii(phoneNumber);
    console.log('Normalized phone for Termii:', to);
    if (!to) throw new InternalServerErrorException('Invalid phone number');

    const payload = {
      api_key: this.apiKey,
      message_type: 'NUMERIC',
      to,
      from: this.senderId,
      channel: 'generic',
      pin_attempts: 3,
      pin_time_to_live: 5,
      pin_length: 6,
      pin_placeholder: '< 123456 >',
      message_text: 'Your verification code is < 123456 >',
      pin_type: 'NUMERIC',
    };

    try {
      const url = `https://api.termii.com/api/sms/otp/send`;
      const resp = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
      });
      return resp.data;
    } catch (err: any) {
      const message = err?.response?.data || err?.message || err;
      throw new InternalServerErrorException(
        `Failed to send OTP: ${JSON.stringify(message)}`,
      );
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    // ... Termii implementation remains ...
    if (!dto.pin_id)
      throw new InternalServerErrorException('pin_id is required from client');

    const payload = {
      api_key: this.apiKey,
      pin_id: dto.pin_id,
      pin: dto.code,
    };
    try {
      const url = `${this.baseUrl}/api/sms/otp/verify`;
      const resp = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
      });
      const data = resp.data;

      if (data?.verified === true) {
        return { msg: 'OTP verified successfully' };
      } else {
        throw new BadRequestException(
          `OTP verification failed: ${JSON.stringify(data)}`,
        );
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      const message = err?.response?.data || err?.message || err;
      throw new InternalServerErrorException(
        `Failed to verify OTP: ${JSON.stringify(message)}`,
      );
    }
  }
}
