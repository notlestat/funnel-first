// What recurs across many funnels: the evidence for which blocks and tokens matter.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FunnelScan } from './run.ts';

type Ok = Extract<FunnelScan, { status: 'ok' }>;

export async function loadScans(dir: string): Promise<FunnelScan[]> {
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json') && f !== 'report.json');
  const scans = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8')) as FunnelScan));
  return scans.filter((s) => s && s.schema === 'funnel-scan/1');
}

const tally = (values: (string | number | null | undefined)[]) => {
  const m = new Map<string, number>();
  for (const v of values) if (v !== null && v !== undefined && v !== '') m.set(String(v), (m.get(String(v)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
};
const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const firstFamily = (stack: string) => stack.split(',')[0].replace(/['"]/g, '').trim();

export function report(scans: FunnelScan[]) {
  const ok = scans.filter((s): s is Ok => s.status === 'ok');
  const n = ok.length;
  const kinds = ['hero', 'question', 'capture', 'video', 'proof', 'logo-strip', 'faq', 'offer', 'agenda', 'story', 'benefits', 'cta'];
  return {
    generated_at: new Date().toISOString(),
    totals: {
      scanned: scans.length,
      ok: n,
      blocked: scans.filter((s) => s.status === 'blocked').length,
      error: scans.filter((s) => s.status === 'error').length,
      median_ms: median(scans.map((s) => s.ms)),
    },
    funnel: {
      first_ask: tally(ok.map((s) => s.funnel.first_ask.ask)),
      headline_type: tally(ok.map((s) => s.funnel.headline.type)),
      // Share of funnels that contain each block at least once.
      blocks: kinds.map((k) => ({ kind: k, funnels: ok.filter((s) => s.funnel.sequence.includes(k as never)).length, pct: pct(ok.filter((s) => s.funnel.sequence.includes(k as never)).length, n) })).sort((a, b) => b.funnels - a.funnels),
      sequences: tally(ok.map((s) => s.funnel.sequence.filter((k, i, a) => k !== a[i - 1]).join(' → '))).slice(0, 10),
      contact_fields: tally(ok.flatMap((s) => s.funnel.contact_fields)),
      fields_per_form: tally(ok.flatMap((s) => s.funnel.forms.map((f) => f.fields.length))),
      proof_near_ask_pct: pct(ok.filter((s) => s.funnel.proof.near_ask).length, n),
      video_pct: pct(ok.filter((s) => s.funnel.video.present).length, n),
      median_cta_repeats: median(ok.map((s) => s.funnel.cta_repeats)),
      median_page_height: median(ok.map((s) => s.funnel.page_height)),
    },
    tokens: {
      body_family: tally(ok.map((s) => firstFamily(s.tokens.page.family))).slice(0, 10),
      display_family: tally(ok.map((s) => (s.tokens.display ? firstFamily(s.tokens.display.family) : null))).slice(0, 10),
      body_size: tally(ok.map((s) => s.tokens.page.size)).slice(0, 8),
      display_size: tally(ok.map((s) => s.tokens.display?.size)).slice(0, 8),
      button_height_median: median(ok.map((s) => s.tokens.button.median_height ?? NaN)),
      radius: tally(ok.map((s) => s.tokens.radius[0]?.value)).slice(0, 8),
      declared_variables_pct: pct(ok.filter((s) => Object.keys(s.tokens.declared).length > 0).length, n),
    },
    stack: {
      builder: tally(ok.map((s) => s.stack.builder[0] ?? 'unknown')),
      tracking: tally(ok.flatMap((s) => s.stack.tracking)),
    },
    blocked: scans.filter((s) => s.status !== 'ok').map((s) => ({ url: s.url, status: s.status, reason: 'reason' in s ? s.reason : '' })),
  };
}

export function reportMarkdown(r: ReturnType<typeof report>) {
  const list = (rows: { value: string; count: number }[]) => rows.map((x) => `${x.value} (${x.count})`).join(', ') || 'none';
  return [
    `# Funnel scan report`,
    ``,
    `${r.totals.scanned} scanned, ${r.totals.ok} read, ${r.totals.blocked} blocked by a bot check, ${r.totals.error} failed. Median ${r.totals.median_ms ?? '-'} ms per page.`,
    ``,
    `## Funnel structure`,
    ``,
    `- First ask: ${list(r.funnel.first_ask)}`,
    `- Headline type: ${list(r.funnel.headline_type)}`,
    `- Blocks (share of funnels): ${r.funnel.blocks.map((b) => `${b.kind} ${b.pct}%`).join(', ')}`,
    `- Proof next to an ask: ${r.funnel.proof_near_ask_pct}%`,
    `- Video present: ${r.funnel.video_pct}%`,
    `- Median call-to-action repeats: ${r.funnel.median_cta_repeats ?? '-'}`,
    `- Contact fields: ${list(r.funnel.contact_fields)}`,
    `- Fields per form: ${list(r.funnel.fields_per_form)}`,
    ``,
    `### Most common sequences`,
    ``,
    ...r.funnel.sequences.map((s) => `- ${s.value || '(none)'}: ${s.count}`),
    ``,
    `## Tokens`,
    ``,
    `- Body font: ${list(r.tokens.body_family)}`,
    `- Display font: ${list(r.tokens.display_family)}`,
    `- Body size: ${list(r.tokens.body_size)}`,
    `- Display size: ${list(r.tokens.display_size)}`,
    `- Median button height: ${r.tokens.button_height_median ?? '-'}px`,
    `- Most common radius: ${list(r.tokens.radius)}`,
    `- Funnels that declare CSS variables: ${r.tokens.declared_variables_pct}%`,
    ``,
    `## Stack`,
    ``,
    `- Builder: ${list(r.stack.builder)}`,
    `- Tracking: ${list(r.stack.tracking)}`,
    ``,
    ...(r.blocked.length ? [`## Not read`, ``, ...r.blocked.map((b) => `- ${b.url}: ${b.status}, ${b.reason}`), ``] : []),
    `Labels are heuristics from one page load. Check a sample by eye before trusting a percentage.`,
  ].join('\n');
}
