import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthContext, CurrentUser } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { StorageService, UPLOAD_CONTENT_TYPES, UPLOAD_PURPOSES } from './storage.service';

const PresignSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  purpose: z.enum(UPLOAD_PURPOSES),
});

/**
 * Presigned PUT URL (haqiqiy S3 SigV4, 5 daqiqa, content-type imzolangan). Mobil faylni to'g'ridan-to'g'ri
 * S3/MinIO ga yuklaydi; kalit `u/<userId>/...` — keyin faqat egasi uni signatureKey/photoKey sifatida bera oladi.
 */
@Controller({ path: 'files', version: '1' })
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  presign(@CurrentUser() a: AuthContext, @Body(Zod(PresignSchema)) b: z.infer<typeof PresignSchema>) {
    return this.storage.presignPut(a.userId, b.purpose, b.contentType);
  }
}
