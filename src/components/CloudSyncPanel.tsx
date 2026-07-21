import { useEffect, useState } from 'react';
import { Cloud, DownloadCloud, LogOut, UploadCloud } from 'lucide-react';
import { loadBatchDefaults, loadIncidents } from '../data';
import { cloudPersistenceService, CloudStatus } from '../services/cloudPersistenceService';
import { Incident, InventoryItem, LocationRecord, SubscriptionTier } from '../types';

interface CloudSyncPanelProps {
  items: InventoryItem[];
  locations: LocationRecord[];
  tier: SubscriptionTier;
  onRestoreCloud: (snapshot: {
    items: InventoryItem[];
    incidents: Incident[];
    locations: LocationRecord[];
    tier: SubscriptionTier;
    batchDefaults?: ReturnType<typeof loadBatchDefaults>;
  }) => boolean;
}

export function CloudSyncPanel({ items, locations, tier, onRestoreCloud }: CloudSyncPanelProps) {
  const [status, setStatus] = useState<CloudStatus>({ configured: cloudPersistenceService.isConfigured(), authenticated: false });
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setStatus(await cloudPersistenceService.status());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cloud status could not be loaded.');
    }
  };

  useEffect(() => { void refresh(); }, []);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cloud action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!status.configured) {
    return <section className="panel cloudPanel">
      <div className="backupIntro"><Cloud/><div><h2>Cloud sync</h2><p>Supabase is not connected yet. Add the free-tier project URL and anon key to `.env.local`, then restart the dev server.</p></div></div>
      <ol>
        <li>Create a free Supabase project.</li>
        <li>Run `supabase/migrations/0001_proofvault_foundation.sql` in the SQL editor.</li>
        <li>Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.example`.</li>
      </ol>
    </section>;
  }

  return <section className="panel cloudPanel">
    <div className="backupIntro"><Cloud/><div><h2>Cloud sync</h2><p>Signed-in accounts autosave inventory, incidents, locations, prototype feature access, and batch defaults. Local backup still works as a safety net.</p></div></div>
    {message && <div className="inlineNotice">{message}</div>}
    {error && <div className="formError" role="alert">{error}</div>}
    {status.authenticated ? <>
      <p className="cloudIdentity">Signed in as <b>{status.email}</b>. Autosave is handled in the background.</p>
      <div className="backupActions">
        <button disabled={busy} onClick={() => run(async () => {
          await cloudPersistenceService.saveSnapshot({ items, incidents: loadIncidents(false), locations, tier, batchDefaults: loadBatchDefaults() });
          setMessage(`Saved ${items.length} items to Supabase now.`);
        })}><UploadCloud/>Save now</button>
        <button disabled={busy} onClick={() => run(async () => {
          const snapshot = await cloudPersistenceService.loadSnapshot();
          if (!onRestoreCloud(snapshot)) throw new Error('Cloud restore did not complete. Browser storage may be full.');
          setMessage(`Loaded ${snapshot.items.length} cloud items into this browser.`);
        })}><DownloadCloud/>Reload cloud data</button>
        <button disabled={busy} onClick={() => run(async () => {
          await cloudPersistenceService.signOut();
          setMessage('Signed out of Supabase.');
        })}><LogOut/>Sign out</button>
      </div>
    </> : <div className="cloudSignin">
      <label>Email for magic link<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label>
      <button disabled={busy || !email.trim()} onClick={() => run(async () => {
        await cloudPersistenceService.signInWithEmail(email.trim());
        setMessage('Magic link sent. Open it in this browser to finish sign-in.');
      })}>Send sign-in link</button>
    </div>}
    <p className="backupWarning">Cloud sync uses Supabase row-level security. Do not use service-role keys in the browser or mobile app.</p>
  </section>;
}
