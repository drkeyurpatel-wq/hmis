// lib/validation/parse-body.ts
// Validates request body against a Zod schema.
// Returns typed data or a 400 error response — never throws.
//
// Usage:
//   import { parseBody } from '@/lib/validation/parse-body';
//   import { encounterCreateSchema } from '@/lib/validation/billing';
//
//   const parsed = await parseBody(request, encounterCreateSchema);
//   if (parsed.error) return parsed.error;
//   const data = parsed.data; // fully typed

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

interface ParseSuccess<T> {
  data: T;
  error: null;
}

interface ParseFailure {
  data: null;
  error: NextResponse;
}

type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ParseResult<T>> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));

    return {
      data: null,
      error: NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', issues },
        { status: 400 }
      ),
    };
  }

  return { data: result.data, error: null };
}
