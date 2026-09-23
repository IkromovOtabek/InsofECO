import { Global, Module } from '@nestjs/common';
import { SmsPort } from './sms.port';
import { EskizAdapter } from './eskiz.adapter';
import { FakeSmsAdapter } from './fake.adapter';

@Global()
@Module({
  providers: [{ provide: SmsPort, useClass: process.env.SMS_PROVIDER === 'ESKIZ' ? EskizAdapter : FakeSmsAdapter }],
  exports: [SmsPort],
})
export class SmsModule {}
