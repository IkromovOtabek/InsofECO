// .env ni modullar dekoratorlari baholanishidan OLDIN yuklash shart (BullModule/JwtModule import vaqtida env o'qiydi)
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/errors/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // API nginx ortida (127.0.0.1). Proksiga ishonilmasa `req.ip` hammada 127.0.0.1 bo'ladi: IP bo'yicha
  // cheklovlar (OTP 10/soat, throttler) BUTUN foydalanuvchilar uchun bitta hisoblagichga tushadi.
  // Faqat loopback'dagi proksi ishonchli — tashqaridan yuborilgan soxta X-Forwarded-For hisobga olinmaydi.
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback');
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();

  if (process.env.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Insof ECO API').setVersion('1').addBearerAuth().build(),
    );
    SwaggerModule.setup('docs', app, doc);
  }

  await app.listen(Number(process.env.PORT ?? 3000));
}
void bootstrap();
