// The capture workflow in one call: collect evidence, propose tokens, store the record.
import { collect } from './collect.ts';
import { propose } from './propose.ts';
import type { Store } from '../mcp/store.ts';
import { slug } from '../src/system/validate.ts';

export async function capture(store: Store, id: string, urls: string[]) {
  if (!slug.test(id)) throw new Error('id must be a lowercase slug.');
  if (urls.length < 1 || urls.length > 3) throw new Error('Capture 1 to 3 pages: the main landing page plus up to two other templates.');
  const ledger = await collect(urls);
  if (!ledger.samples.length) throw new Error(`No pages could be read.\n${ledger.limitations.join('\n')}`);
  const proposal = propose(ledger);
  const record = { status: 'reconstructed-draft' as const, ...ledger, proposal };
  const file = await store.put('captures', id, record);
  return { file, record };
}
