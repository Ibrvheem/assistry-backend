import { Injectable } from '@nestjs/common';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Twilio } from 'twilio';
import { ConfigService } from '@nestjs/config';


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
@Injectable()
export class OtpService {
  public constructor(
    private twilioClient: Twilio,
    private configService: ConfigService,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    this.twilioClient = new Twilio(accountSid, authToken);
  }
  async sendOtp(phoneNumber: string) {
    const serviceSid = this.configService.get<string>('TWILIO_SERVICE_SID');
    let msg = '';
    await this.twilioClient.verify.v2
      .services(serviceSid)
      .verifications.create({ to: normalizePhone(phoneNumber), channel: 'sms' })
      .then((verification) => (msg = verification.status));
    return { msg: msg };
  }

  async verifyOtp(data: VerifyOtpDto) {
    const serviceSid = this.configService.get('TWILIO_SERVICE_SID');
    let msg = '';
    await this.twilioClient.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to: normalizePhone(data.phone_no), code: data.code })
      .then((verification) => (msg = verification.status));
    return { msg: msg };
  }
}
