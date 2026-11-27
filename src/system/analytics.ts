// The PostHog sink. It loads only on a funnel whose brand file sets `analytics`,
// and it only ever sends what track() hands it. See docs/measurement/README.md.
import type { BeforeSendFn, PostHogConfig, Properties } from 'posthog-js';
import { onEvent } from './events.ts';

export const analyticsRegions = ['eu', 'us'] as const;
export type AnalyticsRegion = (typeof analyticsRegions)[number];
export const isAnalyticsRegion = (value: unknown): value is AnalyticsRegion => analyticsRegions.some((r) => r === value);

const hosts: Record<AnalyticsRegion, string> = {
  eu: 'https://eu.i.posthog.com',
  us: 'https://us.i.posthog.com',
};

// A project key starts with phc_ and is public by design: it can send events, not read them.
// A personal key starts with phx_, can read everything, and must never go in a page.
export const posthogKey = /^phc_[A-Za-z0-9]{10,}$/;

const withoutQueries = (props: Properties | undefined) => {
  for (const [key, value] of Object.entries(props ?? {})) {
    const url = typeof value === 'string' && /^https?:\/\//.test(value) ? URL.parse(value) : null;
    if (url && props) props[key] = url.origin + url.pathname;
  }
};

// PostHog adds the page, entry and referrer URLs itself, query string included, and a link
// can carry anything in its query, such as an email. So every URL leaves without its query and hash.
export const stripUrlQueries: BeforeSendFn = (event) => {
  withoutQueries(event.properties);
  withoutQueries(event.$set);
  withoutQueries(event.$set_once);
  return event;
};

export const posthogOptions = (region: AnalyticsRegion) =>
  ({
    api_host: hosts[region],
    // No cookies and no local storage. Each page load is a new anonymous visitor.
    persistence: 'memory',
    person_profiles: 'identified_only', // and nothing ever identifies anyone
    autocapture: false, // it would record click and input text
    capture_pageview: false, // funnel_viewed does this job
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true, // no extra scripts from PostHog's servers
    advanced_disable_flags: true, // no feature flag request
    save_campaign_params: false, // track() sends the UTMs, capped. PostHog would add its own uncapped copies.
    before_send: stripUrlQueries,
  }) satisfies Partial<PostHogConfig>;

export async function startPostHog({ key, region }: { key: string; region: AnalyticsRegion }): Promise<void> {
  // A dynamic import, so PostHog's code is a separate file that only this call downloads.
  const { default: posthog } = await import('posthog-js');
  posthog.init(key, posthogOptions(region));
  onEvent((event) => posthog.capture(event.name, event.props));
}
