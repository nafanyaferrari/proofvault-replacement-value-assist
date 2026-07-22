-- Allows one analysis job to hold an overview photo plus up to three close-ups
-- of the same item (for example its make/model and serial-number labels).
alter table public.proofvault_analysis_jobs
  add column if not exists storage_paths jsonb not null default '[]'::jsonb;

-- Keep existing jobs compatible: their original primary image becomes the first
-- and only photo in the new list.
update public.proofvault_analysis_jobs
set storage_paths = jsonb_build_array(storage_path)
where storage_paths = '[]'::jsonb;
