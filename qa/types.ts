export interface Rect { x: number; y: number; width: number; height: number }
export interface Finding {
  check: string;
  severity: 'error' | 'warning';
  section: string;
  selector: string;
  message: string;
  rect: Rect;
  screenshot?: string;
}
export interface SectionShot { section: string; screenshot: string }
export interface PageResult {
  brand: string;
  case: string;
  viewport: { width: number; height: number };
  url: string;
  findings: Finding[];
  sections: SectionShot[];
  metrics: { cls: number | null; lcpMs: number | null };
  limitations: string[];
}
export interface QaReport {
  schema: 'funnel-qa/1';
  generatedAt: string;
  brands: string[];
  stress: { brand: string; id: string; notes: string[]; skipped: boolean }[];
  pages: PageResult[];
}
export const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
