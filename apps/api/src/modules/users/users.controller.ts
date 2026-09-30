import { Body, Controller, Delete, Get, Param, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { join } from 'path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { PushTokenSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Public } from '../../common/auth/decorators';
import { DomainError } from '../../common/errors/domain.error';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AccountService } from '../auth/account.service';
import { AuthService } from '../auth/auth.service';
import { ORG_EVENTS, UserUpdatedEvent } from '../organizations/organizations.events';
import { AVATAR_DIR, AVATAR_FILE_RE, AVATAR_MAX_BYTES, AVATAR_MIME, avatarExt, removeAvatar, saveAvatar } from './avatar';

/** Multer fayli (dest berilmagan — xotirada, `buffer` bilan). @types/multer qo'shilmagan. */
interface UploadedPhoto { mimetype: string; size: number; buffer: Buffer }

const ProfileSchema = z.object({ fullName: z.string().min(2).max(80).optional(), locale: z.enum(['uz', 'uz-Cyrl', 'ru']).optional() });

@Controller({ path: 'me', version: '1' })
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly account: AccountService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  me(@CurrentUser() a: AuthContext) {
    return this.auth.profile(a.userId);
  }

  @Put()
  async update(@CurrentUser() a: AuthContext, @Body(Zod(ProfileSchema)) body: z.infer<typeof ProfileSchema>) {
    const before = await this.prisma.user.findUnique({ where: { id: a.userId }, select: { fullName: true } });
    await this.prisma.user.update({ where: { id: a.userId }, data: body });
    if (body.fullName && body.fullName !== before?.fullName) this.events.emit(ORG_EVENTS.userUpdated, { userId: a.userId, byUserId: a.userId } satisfies UserUpdatedEvent);
    return this.auth.profile(a.userId);
  }

  /**
   * Profil rasmi (multipart, maydon `photo`). Ro'yxatdan o'tgach darhol yuklanadi —
   * ro'yxat so'rovi JSON bo'lgani uchun rasm alohida ketadi. Eskisi diskdan o'chiriladi.
   */
  @Put('avatar')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } }))
  async avatar(@CurrentUser() a: AuthContext, @UploadedFile() file?: UploadedPhoto) {
    if (!file) throw new DomainError('VALIDATION', 'Rasm yuborilmadi');
    if (!avatarExt(file.mimetype)) throw new DomainError('VALIDATION', 'Rasm JPG, PNG yoki WEBP bo\'lishi kerak');
    const before = await this.prisma.user.findUnique({ where: { id: a.userId }, select: { avatarKey: true } });
    const avatarKey = await saveAvatar(a.userId, file.mimetype, file.buffer);
    await this.prisma.user.update({ where: { id: a.userId }, data: { avatarKey } });
    await removeAvatar(before?.avatarKey);
    return this.auth.profile(a.userId);
  }

  @Delete('avatar')
  async removeAvatar(@CurrentUser() a: AuthContext) {
    const before = await this.prisma.user.findUnique({ where: { id: a.userId }, select: { avatarKey: true } });
    await this.prisma.user.update({ where: { id: a.userId }, data: { avatarKey: null } });
    await removeAvatar(before?.avatarKey);
    return this.auth.profile(a.userId);
  }

  /** Hisobni o'chirish (do'kon talabi). Mijoz — darhol {status:'deleted'}; zavod haydovchisi — {status:'requested'}. */
  @Delete()
  deleteMe(@CurrentUser() a: AuthContext) {
    return this.account.deleteMe(a);
  }

  /** Haydovchi so'rovini qaytarib olish. */
  @Delete('deletion')
  cancelDeletion(@CurrentUser() a: AuthContext) {
    return this.account.cancelRequest(a);
  }

  @Put('devices')
  async pushToken(@CurrentUser() a: AuthContext, @Body(Zod(PushTokenSchema)) body: z.infer<typeof PushTokenSchema>) {
    await this.prisma.device.updateMany({
      where: { userId: a.userId, deviceId: body.deviceId },
      data: { expoPushToken: body.expoPushToken, lastSeenAt: new Date() },
    });
    return { ok: true };
  }
}

/** Profil rasmini berish — `<Image>` sarlavha yubora olmaydi, shuning uchun ochiq; nomi tasodifiy UUID. */
@Controller({ path: 'avatars', version: '1' })
export class AvatarsController {
  @Public()
  @Get(':file')
  file(@Param('file') file: string, @Res() res: Response) {
    if (!AVATAR_FILE_RE.test(file)) throw DomainError.notFound('Rasm');
    res.setHeader('Content-Type', AVATAR_MIME[file.split('.').pop()!]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(join(AVATAR_DIR, file), (err) => { if (err && !res.headersSent) res.status(404).json({ code: 'NOT_FOUND', message: 'Rasm topilmadi' }); });
  }
}
