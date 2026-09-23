import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { ChangePasswordInput, LoginInput, OtpVerify, RegisterInput, ResetPasswordInput } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { OtpService } from './otp.service';
import { MembershipChangedEvent, ORG_EVENTS, UserUpdatedEvent } from '../organizations/organizations.events';

const REFRESH_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otp: OtpService,
    private readonly events: EventEmitter2,
  ) {}

  requestOtp(phone: string, ip: string) {
    return this.otp.request(phone, ip);
  }

  async verifyOtp(input: OtpVerify) {
    await this.otp.verify(input.phone, input.code);

    const user = await this.prisma.user.upsert({
      where: { phone: input.phone },
      create: { phone: input.phone },
      update: {},
    });
    await this.prisma.device.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId: input.device.deviceId } },
      create: { userId: user.id, ...input.device },
      update: { platform: input.device.platform, model: input.device.model, appVersion: input.device.appVersion, lastSeenAt: new Date() },
    });

    const tokens = await this.issueSession(user.id, input.device.deviceId, randomUUID());
    return { ...tokens, user: await this.profile(user.id) };
  }

  /** Parol bilan ro'yxatdan o'tish. Tashkilot/a'zolik rolga qarab yaratiladi. */
  async register(input: RegisterInput) {
    const exists = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (exists?.passwordHash) throw new DomainError('AUTH_PHONE_TAKEN', 'Bu raqam allaqachon ro\'yxatdan o\'tgan');
    const passwordHash = await argon2.hash(input.password);

    const pending: { registered: MembershipChangedEvent | null } = { registered: null }; // haydovchi zavodga o'zi yozildi — ERP'ga xabar (tranzaksiyadan keyin)
    const user = await this.prisma.$transaction(async (tx) => {
      // Taklif orqali oldindan yaratilgan (parolsiz) foydalanuvchi bo'lishi mumkin — uni to'ldiramiz
      const u = exists
        ? await tx.user.update({ where: { id: exists.id }, data: { fullName: input.fullName, passwordHash } })
        : await tx.user.create({ data: { phone: input.phone, fullName: input.fullName, passwordHash } });

      if (input.role === 'TADBIRKOR' && input.organization) {
        await tx.organization.create({ data: { ...input.organization, memberships: { create: { userId: u.id, role: 'TADBIRKOR' } } } });
      } else if (input.role === 'QURUVCHI') {
        const hasMembership = await tx.membership.count({ where: { userId: u.id, role: 'QURUVCHI' } });
        if (!hasMembership) {
          await tx.organization.create({
            data: { type: 'CONTRACTOR', name: input.organization?.name ?? `${input.fullName} (xususiy quruvchi)`, memberships: { create: { userId: u.id, role: 'QURUVCHI' } } },
          });
        }
      } else if (input.role === 'HAYDOVCHI' && input.plantOrgId) {
        const plant = await tx.organization.findFirst({ where: { id: input.plantOrgId, type: 'PLANT', deletedAt: null } });
        if (!plant) throw DomainError.notFound('Zavod');
        // Taklif bo'lsa — faol; bo'lmasa Tadbirkor tasdiqlaydi (isActive=false)
        const m = await tx.membership.upsert({
          where: { userId_organizationId_role: { userId: u.id, organizationId: plant.id, role: 'HAYDOVCHI' } },
          create: { userId: u.id, organizationId: plant.id, role: 'HAYDOVCHI', isActive: false },
          update: {},
        });
        await tx.driverProfile.upsert({ where: { userId: u.id }, create: { userId: u.id }, update: {} });
        pending.registered = { organizationId: m.organizationId, membershipId: m.id, userId: m.userId, role: m.role, isActive: m.isActive, reason: 'registered', byUserId: null };
      }
      return u;
    });
    if (pending.registered) this.events.emit(ORG_EVENTS.membershipChanged, pending.registered);
    else if (exists) this.events.emit(ORG_EVENTS.userUpdated, { userId: user.id, byUserId: null } satisfies UserUpdatedEvent); // taklif qilingan haydovchi ismini kiritdi

    await this.touchDevice(user.id, input.device);
    const tokens = await this.issueSession(user.id, input.device.deviceId, randomUUID());
    return { ...tokens, user: await this.profile(user.id) };
  }

  /** Telefon + parol. Xato xabari bir xil (raqam bor/yo'qligini oshkor qilmaydi). */
  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new DomainError('AUTH_BAD_CREDENTIALS', 'Telefon yoki parol noto\'g\'ri');
    }
    await this.touchDevice(user.id, input.device);
    const tokens = await this.issueSession(user.id, input.device.deviceId, randomUUID());
    return { ...tokens, user: await this.profile(user.id) };
  }

  // ───────────────────────── Parolni tiklash ─────────────────────────

  /** 1-qadam: raqamga kod yuborish. Raqam bor-yo'qligi oshkor qilinmaydi — javob bir xil. */
  async forgotPassword(phone: string, ip: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) return { retryAfter: 60 }; // hisob yo'q — baribir "yubordik" deymiz
    return this.otp.request(phone, ip);
  }

  /**
   * 2-qadam: kod + yangi parol. Parol almashgach barcha qurilmalardagi seanslar yopiladi
   * (o'g'irlangan telefon qo'lida qolgan sessiya ham) va shu qurilmaga yangi seans beriladi.
   */
  async resetPassword(input: ResetPasswordInput) {
    await this.otp.verify(input.phone, input.code);
    const user = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user) throw new DomainError('AUTH_USER_NOT_FOUND', 'Bu raqam bilan hisob topilmadi');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(input.password) } }),
      this.prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await this.touchDevice(user.id, input.device);
    const tokens = await this.issueSession(user.id, input.device.deviceId, randomUUID());
    return { ...tokens, user: await this.profile(user.id) };
  }

  /** Tizimga kirgan holda: eski parol tekshiriladi, boshqa qurilmalardagi seanslar yopiladi. */
  async changePassword(userId: string, sessionId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, input.current))) {
      throw new DomainError('AUTH_BAD_CREDENTIALS', 'Joriy parol noto\'g\'ri');
    }
    if (input.current === input.next) throw new DomainError('AUTH_SAME_PASSWORD', 'Yangi parol eskisidan farq qilsin');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(input.next) } }),
      // Shu qurilmadagi seans qoladi — foydalanuvchi qaytadan kirmaydi
      this.prisma.session.updateMany({ where: { userId: user.id, revokedAt: null, id: { not: sessionId } }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  private async touchDevice(userId: string, device: OtpVerify['device']) {
    await this.prisma.device.upsert({
      where: { userId_deviceId: { userId, deviceId: device.deviceId } },
      create: { userId, ...device },
      update: { platform: device.platform, model: device.model, appVersion: device.appVersion, lastSeenAt: new Date() },
    });
  }

  /** Refresh rotatsiya + reuse detection (ADR-0004). Token format: `${sessionId}.${secret}` */
  async refresh(refreshToken: string) {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret) throw new DomainError('AUTH_TOKEN_INVALID', 'Refresh yaroqsiz');
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new DomainError('AUTH_TOKEN_INVALID', 'Sessiya topilmadi');

    if (session.revokedAt) {
      // Eski (allaqachon almashtirilgan) token qayta ishlatildi → o'g'irlangan bo'lishi mumkin → butun oilani o'chiramiz
      await this.prisma.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new DomainError('AUTH_REFRESH_REUSED', 'Xavfsizlik: qayta kiring');
    }
    if (session.expiresAt < new Date()) throw new DomainError('AUTH_TOKEN_INVALID', 'Sessiya muddati tugagan');
    if (!(await argon2.verify(session.refreshTokenHash, secret))) throw new DomainError('AUTH_TOKEN_INVALID', 'Refresh yaroqsiz');

    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueSession(session.userId, session.deviceId, session.familyId);
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async issueSession(userId: string, deviceId: string, familyId: string) {
    const secret = randomBytes(32).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId,
        deviceId,
        familyId,
        refreshTokenHash: await argon2.hash(secret),
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 86_400_000),
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: session.id });
    return { accessToken, refreshToken: `${session.id}.${secret}` };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { organization: { select: { id: true, name: true, type: true } } } } },
    });
    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      locale: user.locale,
      memberships: user.memberships.map((m) => ({ role: m.role, isActive: m.isActive, organization: m.organization })),
    };
  }
}
