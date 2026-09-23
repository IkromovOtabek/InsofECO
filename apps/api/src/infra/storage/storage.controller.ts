import { Body, Controller, Post } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { z } from 'zod';
import { AuthContext, CurrentUser } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';

const PresignSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  purpose: z.enum(['waybill', 'signature', 'dispute', 'report']),
});

/**
 * Presigned PUT URL (S3 SigV4, minimal). Mobil faylni to'g'ridan-to'g'ri S3/MinIO ga yuklaydi; backend orqali o'tmaydi.
 * Prod'da @aws-sdk/s3-request-presigner bilan almashtiring — bu yerda tashqi bog'liqliksiz variant.
 */
@Controller({ path: 'files', version: '1' })
export class StorageController {
  @Post('presign')
  presign(@CurrentUser() a: AuthContext, @Body(Zod(PresignSchema)) b: z.infer<typeof PresignSchema>) {
    const ext = b.contentType.split('/')[1] === 'jpeg' ? 'jpg' : b.contentType.split('/')[1];
    const key = `${b.purpose}/${new Date().toISOString().slice(0, 10)}/${a.userId}/${randomUUID()}.${ext}`;
    const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
    const bucket = process.env.S3_BUCKET ?? 'insof';
    const expires = Math.floor(Date.now() / 1000) + 600;
    // Soddalashtirilgan imzo: MinIO dev uchun public bucket + token; prod'da SigV4
    const token = createHmac('sha256', process.env.S3_SECRET_KEY ?? 'dev').update(`${key}:${expires}`).digest('hex');
    return { key, url: `${endpoint}/${bucket}/${key}?expires=${expires}&token=${token}`, method: 'PUT', headers: { 'content-type': b.contentType } };
  }
}
