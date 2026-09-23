import { ErrorCode } from '@insof/shared';

const STATUS: Partial<Record<ErrorCode, number>> = {
  AUTH_OTP_INVALID: 400,
  AUTH_OTP_EXPIRED: 400,
  AUTH_OTP_RATE_LIMIT: 429,
  AUTH_OTP_SEND_FAILED: 502,
  RATE_LIMIT: 429,
  AUTH_TOKEN_INVALID: 401,
  AUTH_REFRESH_REUSED: 401,
  AUTH_BAD_CREDENTIALS: 401,
  AUTH_PHONE_TAKEN: 409,
  FORBIDDEN: 403,
  NOT_MEMBER: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  ORDER_INVALID_TRANSITION: 409,
  ORDER_CREDIT_LIMIT: 409,
  DELIVERY_INVALID_TRANSITION: 409,
  DELIVERY_DRIVER_BUSY: 409,
  DELIVERY_SIGNATURE_REQUIRED: 422,
  DELIVERY_STALE: 409,
  IDEMPOTENCY_CONFLICT: 409,
};

/** Biznes xatosi. Har doim mashina o'qiydigan `code` bilan. */
export class DomainError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = STATUS[code] ?? 500;
  }
  static notFound(what: string) {
    return new DomainError('NOT_FOUND', `${what} topilmadi`);
  }
  static forbidden(msg = 'Ruxsat yo\'q') {
    return new DomainError('FORBIDDEN', msg);
  }
}
