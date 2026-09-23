import { Injectable, Logger } from '@nestjs/common';
import { SmsPort } from './sms.port';

@Injectable()
export class FakeSmsAdapter extends SmsPort {
  private readonly logger = new Logger('FakeSms');
  async send(phone: string, text: string) {
    this.logger.log(`SMS → ${phone.slice(0, 7)}***: ${text}`);
  }
}
