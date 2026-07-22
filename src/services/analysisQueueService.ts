import { supabase } from './supabaseClient';

export type AnalysisJobStatus = 'queued' | 'processing' | 'retrying' | 'complete' | 'reviewed' | 'failed' | 'cancelled';

export interface AnalysisJob {
  id: string;
  storage_path: string;
  storage_paths?: string[] | null;
  status: AnalysisJobStatus;
  attempts: number;
  next_attempt_at: string;
  result?: unknown;
  last_error?: string | null;
  created_at: string;
  completed_at?: string | null;
  item_context?: { location?: string; room?: string } | null;
}

export interface QueuedPhoto {
  job: AnalysisJob;
  localPreview: string;
}

export function analysisStorageReference(storagePath: string) {
  return `supabase://proofvault-item-photos/${storagePath}`;
}

function requireClient() {
  if (!supabase) throw new Error('Sign in and configure Supabase to save photos before analysis.');
  return supabase;
}

function dataUrlMimeType(dataUrl: string) {
  return dataUrl.match(/^data:(.*?);base64,/)?.[1] || 'image/jpeg';
}

async function dataUrlBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error('The selected photo could not be prepared for upload.');
  return response.blob();
}

export const analysisQueueService = {
  isAvailable: () => Boolean(supabase),

  async enqueue(photoDataUrls: string[], itemContext: { location?: string; room?: string }, includeValuation = true): Promise<QueuedPhoto> {
    const client = requireClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error('Sign in to save photos before analysis.');

    if (!photoDataUrls.length) throw new Error('Choose at least one photo to analyze.');
    const id = crypto.randomUUID();
    const uploads = await Promise.all(photoDataUrls.slice(0, 4).map(async (photoDataUrl, index) => {
      const mimeType = dataUrlMimeType(photoDataUrl);
      const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const storagePath = `${userData.user.id}/analysis-jobs/${id}-${index + 1}.${extension}`;
      const blob = await dataUrlBlob(photoDataUrl);
      const { error } = await client.storage.from('proofvault-item-photos').upload(storagePath, blob, { contentType: mimeType, upsert: false });
      if (error) throw error;
      return { storagePath, mimeType };
    }));
    const storagePath = uploads[0].storagePath;

    const row = {
      id,
      user_id: userData.user.id,
      storage_path: storagePath,
      mime_type: uploads[0].mimeType,
      storage_paths: uploads.map(upload => upload.storagePath),
      item_context: itemContext,
      include_valuation: includeValuation
    };
    const { data, error } = await client.from('proofvault_analysis_jobs').insert(row).select().single();
    if (error) {
      await client.storage.from('proofvault-item-photos').remove(uploads.map(upload => upload.storagePath));
      throw error;
    }
    return { job: data as AnalysisJob, localPreview: photoDataUrls[0] };
  },

  async load(jobIds: string[]) {
    const client = requireClient();
    if (!jobIds.length) return [] as AnalysisJob[];
    const { data, error } = await client.from('proofvault_analysis_jobs').select('*').in('id', jobIds);
    if (error) throw error;
    return (data ?? []) as AnalysisJob[];
  },

  async loadAwaitingReview() {
    const client = requireClient();
    const { data, error } = await client
      .from('proofvault_analysis_jobs')
      .select('*')
      .in('status', ['queued', 'processing', 'retrying', 'complete', 'failed'])
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AnalysisJob[];
  },

  async acknowledge(jobId: string) {
    const client = requireClient();
    const { error } = await client.from('proofvault_analysis_jobs').update({ status: 'reviewed' }).eq('id', jobId).eq('status', 'complete');
    if (error) throw error;
  },

  async kick() {
    const client = requireClient();
    const { data } = await client.auth.getSession();
    const response = await fetch('/api/process-analysis-jobs', {
      method: 'POST',
      headers: { ...(data.session?.access_token ? { authorization: `Bearer ${data.session.access_token}` } : {}) }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || 'Saved photo jobs could not be started yet. They remain safely queued.');
    }
    return response.json() as Promise<{ processed: number; outcomes: string[] }>;
  },

  async retry(jobId: string) {
    const client = requireClient();
    const { data } = await client.auth.getSession();
    const response = await fetch('/api/process-analysis-jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(data.session?.access_token ? { authorization: `Bearer ${data.session.access_token}` } : {}) },
      body: JSON.stringify({ retryJobId: jobId })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || 'The saved photo could not be retried yet.');
    }
    return response.json() as Promise<{ processed: number; outcomes: string[] }>;
  }
};
