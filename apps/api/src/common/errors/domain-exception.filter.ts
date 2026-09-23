import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiError } from '@insof/shared';
import { DomainError } from './domain.error';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      const body: ApiError = { code: exception.code, message: exception.message, details: exception.details };
      return res.status(exception.status).json(body);
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse() as { message?: string | string[] };
      const body: ApiError = {
        code: status === 429 ? 'RATE_LIMIT' : status === 401 ? 'AUTH_TOKEN_INVALID' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 422 || status === 400 ? 'VALIDATION' : 'INTERNAL',
        message: status === 429 ? 'Juda ko\'p so\'rov. Biroz kuting' : Array.isArray(r?.message) ? r.message.join(', ') : (r?.message ?? exception.message),
      };
      return res.status(status).json(body);
    }
    this.logger.error(exception);
    const body: ApiError = { code: 'INTERNAL', message: 'Ichki xato' };
    return res.status(500).json(body);
  }
}
