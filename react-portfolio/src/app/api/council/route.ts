import { after } from 'next/server';
import { SEAT_BRIEFS } from '@/data/council/briefs';
import { SEATS } from '@/data/council/seats';
import { STARTERS } from '@/data/council/starters';
import { CouncilConfig, readConfig } from '@/lib/council/config';
import { EngineDeps, handleGenerate, handleStatus } from '@/lib/council/engine';
import { NeonCouncilStore } from '@/lib/council/neonStore';
import { createOpenRouterProvider } from '@/lib/council/openrouter';
import { CouncilStore } from '@/lib/council/store';

// POST streams one exchange as NDJSON (one CouncilEvent per line).
// GET reports whether live replies are on and how many this visitor has left.

export const runtime = 'nodejs';
// The upstream deadline is 16s; the rest is headroom for the quota round trips.
export const maxDuration = 30;

// One store per server instance and database, so its "schema is ready" memo
// survives across requests. Created lazily: no DATABASE_URL at build time.
let cachedStore: { key: string; store: CouncilStore } | null = null;

function storeFor(config: CouncilConfig): CouncilStore | null {
  if (!config.databaseUrl) return null;
  const key = `${config.databaseUrl}|${config.model}`;
  if (cachedStore?.key !== key) cachedStore = { key, store: new NeonCouncilStore(config.databaseUrl, config.model) };
  return cachedStore.store;
}

function deps(): EngineDeps {
  const config = readConfig();
  return {
    config,
    store: storeFor(config),
    provider: config.apiKey
      ? createOpenRouterProvider({
          apiKey: config.apiKey,
          model: config.model,
          reasoningEffort: config.reasoningEffort,
          siteUrl: config.siteUrl,
        })
      : null,
    content: { seats: SEATS, briefs: SEAT_BRIEFS },
    starterIds: STARTERS.map((starter) => starter.id),
  };
}

export async function GET(request: Request) {
  return handleStatus(request, deps());
}

export async function POST(request: Request) {
  const { response, settled } = await handleGenerate(request, deps());
  // If the visitor disconnects mid-stream the response ends early, but usage
  // still has to be written back. `after` keeps the function alive for that.
  after(() => settled);
  return response;
}
