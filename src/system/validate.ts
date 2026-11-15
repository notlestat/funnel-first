// Validate a brand the way the system sees it: schema and contrast are errors,
// conversion risks and look-alike clients are warnings.
import { brandSchema, type Brand } from './schema.ts';
import { contrastErrors, conversionWarnings, distinctnessWarnings } from './rules.ts';

export const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type BrandCheck =
  | { ok: true; brand: Brand; errors: []; warnings: string[] }
  | { ok: false; brand?: Brand; errors: string[]; warnings: string[] };

export function validateBrand(input: unknown, others: { id: string; data: Brand }[]): BrandCheck {
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'brand'}: ${i.message}`), warnings: [] };
  }
  const brand = parsed.data;
  const warnings = [...conversionWarnings(brand), ...distinctnessWarnings(brand, others)];
  const errors = contrastErrors(brand.tokens);
  return errors.length ? { ok: false, brand, errors, warnings } : { ok: true, brand, errors: [], warnings };
}
