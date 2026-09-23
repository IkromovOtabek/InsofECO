import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { DomainError } from '../errors/domain.error';

/**
 * Zod validatsiya pipe'i. Ishlatilishi: @Body(Zod(Schema)) / @Query(Zod(Schema)).
 * Nest: @Body() ning birinchi argumenti string bo'lmasa — pipe sifatida qabul qilinadi.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (!this.schema) return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new DomainError('VALIDATION', 'Ma\'lumot noto\'g\'ri', result.error.flatten());
    }
    return result.data;
  }
}

export const Zod = (schema: ZodSchema) => new ZodValidationPipe(schema);
