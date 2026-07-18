import { uid } from '../lib/utils';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export type EvidenceKind = 'item' | 'serial' | 'marking' | 'receipt' | 'appraisal' | 'warranty' | 'damage' | 'other' | 'incident';

const STORAGE_PREFIX = 'supabase://';
const IMAGE_BUCKET = 'proofvault-item-photos';
const DOCUMENT_BUCKET = 'proofvault-documents';

export function isSupabaseStorageReference(value: string) {
  return value.startsWith(STORAGE_PREFIX);
}

function storageBucket(kind: EvidenceKind, fileType = '') {
  if (fileType.includes('pdf') || ['receipt', 'appraisal', 'warranty', 'other'].includes(kind)) return DOCUMENT_BUCKET;
  return IMAGE_BUCKET;
}

function extensionFor(file: File) {
  const nameExt = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (nameExt) return nameExt.slice(0, 8);
  if (file.type.includes('png')) return 'png';
  if (file.type.includes('webp')) return 'webp';
  if (file.type.includes('pdf')) return 'pdf';
  return 'jpg';
}

function parseReference(value: string) {
  if (!isSupabaseStorageReference(value)) return;
  const withoutPrefix = value.slice(STORAGE_PREFIX.length);
  const slash = withoutPrefix.indexOf('/');
  if (slash < 1) return;
  return { bucket: withoutPrefix.slice(0, slash), path: withoutPrefix.slice(slash + 1) };
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, base64] = dataUrl.split(',');
  const contentType = meta.match(/data:(.*?);base64/)?.[1] ?? 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  return new Blob([bytes], { type: contentType });
}

async function currentUser() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  return data.session?.user;
}

export const evidenceStorageService = {
  isConfigured: () => isSupabaseConfigured,

  async canUseCloudStorage() {
    return Boolean(await currentUser());
  },

  async uploadFile(file: File, itemId: string, kind: EvidenceKind) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const user = await currentUser();
    if (!user) throw new Error('Sign in before uploading files to Supabase Storage.');

    const bucket = storageBucket(kind, file.type);
    const path = `${user.id}/${itemId}/${kind}/${Date.now()}-${uid('file')}.${extensionFor(file)}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined
    });
    if (error) throw error;
    return `${STORAGE_PREFIX}${bucket}/${path}`;
  },

  async uploadDataUrl(dataUrl: string, itemId: string, kind: EvidenceKind) {
    if (!dataUrl.startsWith('data:')) return dataUrl;
    if (!supabase) return dataUrl;
    const user = await currentUser();
    if (!user) return dataUrl;

    const blob = dataUrlToBlob(dataUrl);
    const bucket = storageBucket(kind, blob.type);
    const extension = blob.type.includes('pdf') ? 'pdf' : blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    const path = `${user.id}/${itemId}/${kind}/${Date.now()}-${uid('file')}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: blob.type || undefined
    });
    if (error) throw error;
    return `${STORAGE_PREFIX}${bucket}/${path}`;
  },

  async resolveDisplayUrl(value: string) {
    if (!isSupabaseStorageReference(value)) return value;
    if (!supabase) return '';
    const parsed = parseReference(value);
    if (!parsed) return '';
    const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  }
};

