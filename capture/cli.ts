// Usage: npm run capture -- <client-id> <url> [url] [url]
// Writes src/data/captures/<client-id>.json and prints the token proposal.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture } from './index.ts';
import { fileStore } from '../mcp/store.ts';

const [id, ...urls] = process.argv.slice(2);
if (!id || !urls.length) {
  console.error('Usage: npm run capture -- <client-id> <url> [url] [url]');
  process.exit(1);
}
const store = fileStore(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data'));
const { file, record } = await capture(store, id, urls);
console.log(`Saved ${file}\n`);
for (const [name, t] of Object.entries(record.proposal.tokens)) console.log(`${name.padEnd(16)} ${t.value.padEnd(36)} ${t.confidence}`);
if (record.proposal.contrastErrors.length) console.log('\nContrast errors:\n  ' + record.proposal.contrastErrors.join('\n  '));
