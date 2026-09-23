// .env ni modullar dekoratorlari baholanishidan OLDIN yuklash shart (BullModule/JwtModule/SmsModule import vaqtida env o'qiydi)
import 'dotenv/config';
/**
 * Fon ishlari prosessi. Hozircha SlaProcessor API bilan bir prosessda ham ishlaydi (BullModule).
 * Yuk oshganda: bu faylni alohida `node dist/worker.js` sifatida ishga tushiring va API dan processorlarni olib tashlang.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  console.log('Worker started');
}
void bootstrap();
