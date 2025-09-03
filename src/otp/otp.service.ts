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
// src/otp/otp.service.ts
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { VerifyOtpDto } from './dto/verify-otp.dto';

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
function normalizeForTermii(raw: string | null | undefined): string | undefined {
  const p = normalizePhone(raw);
  if (!p) return undefined;
  return p.startsWith('+') ? p.slice(1) : p; // Termii wants no leading '+'
}

@Injectable()
export class OtpService {
  private baseUrl: string;
  private apiKey: string;
  private senderId: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('TERMII_BASE_URL') || 'https://api.termii.com';
    this.apiKey = this.configService.get<string>('TERMII_API_KEY') || '';
    this.senderId = this.configService.get<string>('TERMII_SENDER_ID') || 'Termii';
    if (!this.apiKey) throw new Error('TERMII_API_KEY not configured');
  }

  async sendOtp(phoneNumber: string) {
    console.log('Original phone number:', phoneNumber);
    const to = normalizeForTermii(phoneNumber);
    console.log('Normalized phone for Termii:', to);
    if (!to) throw new InternalServerErrorException('Invalid phone number');
    console.log('Sending OTP to', to);

    const payload = {
      api_key: this.apiKey,
      message_type: 'NUMERIC',
      to, // e.g. 2348012345678
      from: this.senderId,
      channel: 'generic',
      pin_attempts: 3,
      pin_time_to_live: 5,
      pin_length: 6,
      pin_placeholder: '< 123456 >',
      message_text: 'Your verification code is < 123456 >',
      pin_type: 'NUMERIC',
    };

    // const payload = {
    //   api_key: this.apiKey,
    //   message_type: 'NUMERIC',
    //   to, // e.g. 2348012345678
    //   from: this.senderId,
    //   channel: 'dnd',
    //   type: 'plain',
    //   sms: 'Your verification code is ${code1}',
    // };

    try {
      const url = `${this.baseUrl}/api/sms/otp/send`;
      const resp = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
      });
      return resp.data;
    } catch (err: any) {
      const message = err?.response?.data || err?.message || err;
      throw new InternalServerErrorException(`Failed to send OTP: ${JSON.stringify(message)}`);
    }

    // try {
    //   const url = `${this.baseUrl}/api/sms/send`;
    //   const resp = await axios.post(url, payload, {
    //     headers: { 'Content-Type': 'application/json' },
    //     timeout: 10_000,
    //   });
    //   return resp.data;
    // } catch (err: any) {
    //   const message = err?.response?.data || err?.message || err;
    //   throw new InternalServerErrorException(`Failed to send Message: ${JSON.stringify(message)}`);
    // }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    if (!dto.pin_id) throw new InternalServerErrorException('pin_id is required from client');

    const payload = {
      api_key: this.apiKey,
      pin_id: dto.pin_id,
      pin: dto.code,
    };
    try {
  const url = `${this.baseUrl}/api/sms/otp/verify`;
  const resp = await axios.post(
    url,
    payload,
    { headers: { 'Content-Type': 'application/json' }, timeout: 10_000 }
  );
  const data = resp.data;

  if (data?.verified === true) {
    return { msg: 'OTP verified successfully' };
  } else {
    // Let NestJS handle this as 400
    throw new BadRequestException(
      `OTP verification failed: ${JSON.stringify(data)}`
    );
  }
} catch (err: any) {
  // If it's already a known Nest exception, rethrow
  if (err instanceof BadRequestException) {
    throw err;
  }

  // Otherwise, treat it as internal
  const message = err?.response?.data || err?.message || err;
  throw new InternalServerErrorException(
    `Failed to verify OTP: ${JSON.stringify(message)}`
  );
}


  //   try {
  //     const url = `${this.baseUrl}/api/sms/otp/verify`;
  //     const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 10_000 });
  //     const data=resp.data;
      
  //   } catch (err: any) {
  //     const message = err?.response?.data || err?.message || err;
  //     throw new InternalServerErrorException(`Failed to verify OTP: ${JSON.stringify(message)}`);
  //   }
  //   if(data?.verified===true){
  //       return { msg: 'OTP verified successfully' };
  //     }else{
  //       throw new BadRequestException(`OTP verification failed: ${JSON.stringify(data)}`);
  //     }
  }
}
