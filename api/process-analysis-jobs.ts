// Durable photo-analysis worker.
// This route is safe to call after a signed-in user queues photos and can also
// be invoked by a scheduler with CRON_SECRET. It never accepts an image from
// the browser: it processes the private copy already saved in Supabase Storage.
declare const process: { env: Record<string, string | undefined> };

interface RequestLike {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(payload: unknown): void;
  setHeader(name: string, value: string): void;
}

interface AnalysisJob {
  id: string;
  user_id: string;
  storage_path: string;
  storage_paths?: string[] | null;
  mime_type: string;
  item_context: { location?: string; room?: string };
  include_valuation: boolean;
  attempts: number;
}

function headerValue(req: RequestLike, name: string) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function serverConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Durable analysis queue is not configured on the server.');
  return { url, serviceRoleKey };
}

async function verifiedUserId(req: RequestLike, url: string, anonKey: string) {
  const authorization = headerValue(req, 'authorization');
  if (!authorization) return undefined;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, authorization } });
  if (!response.ok) return undefined;
  const user = await response.json() as { id?: string };
  return user.id;
}

function isScheduler(req: RequestLike) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && headerValue(req, 'authorization') === `Bearer ${secret}`);
}

function headers(serviceRoleKey: string, extra: Record<string, string> = {}) {
  return { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, ...extra };
}

async function updateJob(url: string, serviceRoleKey: string, id: string, patch: Record<string, unknown>) {
  const response = await fetch(`${url}/rest/v1/proofvault_analysis_jobs?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(serviceRoleKey, { 'content-type': 'application/json' }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Could not update analysis job (${response.status}).`);
}

async function requeueFailedJob(url: string, serviceRoleKey: string, id: string, userId: string) {
  const response = await fetch(`${url}/rest/v1/proofvault_analysis_jobs?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.failed`, {
    method: 'PATCH',
    headers: headers(serviceRoleKey, { 'content-type': 'application/json', prefer: 'return=representation' }),
    body: JSON.stringify({ status: 'queued', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null, completed_at: null, updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Could not restart the saved photo analysis (${response.status}).`);
  const rows = await response.json() as AnalysisJob[];
  if (!rows.length) throw new Error('This saved photo is no longer available to retry.');
}

async function downloadDataUrl(url: string, serviceRoleKey: string, job: AnalysisJob) {
  const response = await fetch(`${url}/storage/v1/object/authenticated/proofvault-item-photos/${job.storage_path}`, {
    headers: headers(serviceRoleKey)
  });
  if (!response.ok) throw new Error(`Stored photo could not be read (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${job.mime_type || 'image/jpeg'};base64,${btoa(binary)}`;
}

function internalAnalysisUrl(req: RequestLike) {
  const configured = process.env.PROOFVAULT_APP_URL;
  if (configured) return `${configured.replace(/\/$/, '')}/api/analyze-item`;
  const host = headerValue(req, 'host') || process.env.VERCEL_URL;
  if (!host) throw new Error('PROOFVAULT_APP_URL is required for the queue worker.');
  return `https://${host}/api/analyze-item`;
}

function mimeTypeForPath(path: string, fallback: string) {
  const extension=path.split('.').pop()?.toLowerCase();
  if (extension==='png') return 'image/png';
  if (extension==='webp') return 'image/webp';
  return fallback || 'image/jpeg';
}

async function processJob(req: RequestLike, config: ReturnType<typeof serverConfig>, job: AnalysisJob) {
  const attempts = job.attempts;
  try {
    const paths=job.storage_paths?.length ? job.storage_paths : [job.storage_path];
    const photoUris = await Promise.all(paths.map(async path => {
      const photoJob={...job,storage_path:path,mime_type:mimeTypeForPath(path,job.mime_type)};
      return { uri: await downloadDataUrl(config.url, config.serviceRoleKey, photoJob), mimeType: photoJob.mime_type };
    }));
    const response = await fetch(internalAnalysisUrl(req), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-proofvault-queue-secret': process.env.PROOFVAULT_QUEUE_WORKER_SECRET || '' },
      body: JSON.stringify({ photos: photoUris, itemContext: job.item_context, includeValuation: job.include_valuation })
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; code?: string };
    if (!response.ok) {
      if (payload.code === 'AI_PROVIDER_UNAVAILABLE' && attempts < 10) {
        const delaySeconds = Math.min(3600, 60 * 2 ** (attempts - 1));
        await updateJob(config.url, config.serviceRoleKey, job.id, {
          status: 'retrying',
          next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
          last_error: payload.error || 'AI provider temporarily unavailable.'
        });
        return 'retrying';
      }
      if (payload.code === 'AI_PROVIDER_CONFIGURATION_ERROR' || payload.code === 'AI_PROVIDER_REQUEST_FAILED') {
        await updateJob(config.url, config.serviceRoleKey, job.id, {
          status: 'failed', completed_at: new Date().toISOString(), last_error: payload.error || 'Photo analysis configuration needs attention.'
        });
        return 'failed';
      }
      throw new Error(payload.error || `Photo analysis returned ${response.status}.`);
    }
    await updateJob(config.url, config.serviceRoleKey, job.id, {
      status: 'complete', result: payload, completed_at: new Date().toISOString(), last_error: null
    });
    return 'complete';
  } catch (error) {
    await updateJob(config.url, config.serviceRoleKey, job.id, {
      status: attempts < 10 ? 'retrying' : 'failed',
      next_attempt_at: new Date(Date.now() + Math.min(3600, 60 * 2 ** (attempts - 1)) * 1000).toISOString(),
      last_error: error instanceof Error ? error.message : 'Photo analysis failed.'
    });
    return attempts < 10 ? 'retrying' : 'failed';
  }
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const config = serverConfig();
    const userId = isScheduler(req) ? undefined : await verifiedUserId(req, config.url, process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '');
    if (!isScheduler(req) && !userId) return res.status(401).json({ error: 'Sign in is required to process saved photo jobs.' });
    const retryJobId = typeof (req.body as { retryJobId?: unknown } | undefined)?.retryJobId === 'string' ? (req.body as { retryJobId: string }).retryJobId : undefined;
    if (retryJobId && userId) await requeueFailedJob(config.url, config.serviceRoleKey, retryJobId, userId);
    // This database RPC claims a single row with SKIP LOCKED so concurrent
    // browser kicks cannot run the same paid photo more than once.
    const response = await fetch(`${config.url}/rest/v1/rpc/proofvault_claim_analysis_job`, {
      method: 'POST',
      headers: headers(config.serviceRoleKey, { 'content-type': 'application/json' }),
      body: JSON.stringify({ target_user: userId ?? null })
    });
    if (!response.ok) throw new Error(`Could not claim queued analysis job (${response.status}).`);
    const jobs = await response.json() as AnalysisJob[];
    const outcomes = await Promise.all(jobs.map(job => processJob(req, config, job)));
    return res.status(200).json({ processed: jobs.length, outcomes });
  } catch (error) {
    console.error('[process-analysis-jobs] failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Analysis queue worker failed.' });
  }
}
