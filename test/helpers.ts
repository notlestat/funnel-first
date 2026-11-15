import { readFileSync } from 'node:fs';
import type { Brand } from '../src/system/schema.ts';

export const load = (id: string): Brand =>
  JSON.parse(readFileSync(new URL(`../src/data/brands/${id}.json`, import.meta.url), 'utf8'));
