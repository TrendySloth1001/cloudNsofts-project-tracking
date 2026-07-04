import { z } from 'zod';
import { HttpError } from './http-error';

/**
 * Parse and validate a request payload against a Zod schema, throwing a 400
 * HttpError (with field-level details) when validation fails.
 */
export function validate<Schema extends z.ZodTypeAny>(
  schema: Schema,
  data: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw HttpError.badRequest('Validation failed', result.error.flatten());
  }
  return result.data;
}
