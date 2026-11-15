// Where brands and references are kept. Today: JSON files in the repo.
// To move to a company database, write another object with these five methods.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface Store {
  list(kind: Kind): Promise<{ id: string; data: unknown }[]>;
  get(kind: Kind, id: string): Promise<unknown | undefined>;
  exists(kind: Kind, id: string): Promise<boolean>;
  put(kind: Kind, id: string, data: unknown): Promise<string>;
  location(kind: Kind, id: string): string;
}

export type Kind = 'brands' | 'references' | 'captures';

export function fileStore(dataDir: string): Store {
  const file = (kind: Kind, id: string) => path.join(dataDir, kind, `${id}.json`);
  return {
    async list(kind) {
      const dir = path.join(dataDir, kind);
      const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.json') && !n.startsWith('_'));
      return Promise.all(
        names.map(async (n) => ({ id: n.slice(0, -5), data: JSON.parse(await readFile(path.join(dir, n), 'utf8')) })),
      );
    },
    async get(kind, id) {
      try {
        return JSON.parse(await readFile(file(kind, id), 'utf8'));
      } catch {
        return undefined;
      }
    },
    async exists(kind, id) {
      return (await this.get(kind, id)) !== undefined;
    },
    async put(kind, id, data) {
      await mkdir(path.join(dataDir, kind), { recursive: true });
      await writeFile(file(kind, id), JSON.stringify(data, null, 2) + '\n');
      return file(kind, id);
    },
    location: file,
  };
}
