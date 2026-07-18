import { useState } from 'react';
import { Cloud, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { cloudPersistenceService, CloudStatus } from '../services/cloudPersistenceService';

interface AccountGateProps {
  status: CloudStatus;
  onContinueLocal: () => void;
  onStatusChange: (status: CloudStatus) => void;
}

export function AccountGate({ status, onContinueLocal, onStatusChange }: AccountGateProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendMagicLink = async () => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await cloudPersistenceService.signInWithEmail(email.trim());
      onStatusChange(await cloudPersistenceService.status());
      setMessage('Sign-in link sent. Open it in this browser to finish creating or accessing your account.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send the sign-in link.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="accountPage">
    <section className="accountHero">
      <div className="accountBrand"><ShieldCheck/><b>ProofVault</b></div>
      <p className="eyebrow green">PROPERTY EVIDENCE</p>
      <h1>Start with an account, then document items fast.</h1>
      <p className="sub">Use an email magic link to create an account or sign back in. Each account gets its own private inventory, incidents, locations, and uploaded evidence through Supabase row-level security.</p>
      <div className="accountHighlights">
        <span><Sparkles/>Photo-first item intake</span>
        <span><Cloud/>Private cloud sync</span>
        <span><LockKeyhole/>User-isolated records</span>
      </div>
    </section>
    <section className="panel accountCard">
      <h2>Create account or sign in</h2>
      {status.configured ? <>
        <p>Enter your email and Supabase will send a secure sign-in link. New emails create an account automatically when signups are enabled in Supabase.</p>
        {message && <div className="inlineNotice">{message}</div>}
        {error && <div className="formError" role="alert">{error}</div>}
        <label>Email address
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email"/>
        </label>
        <button className="primary" disabled={busy || !email.trim()} onClick={sendMagicLink}>{busy ? 'Sending link…' : 'Send magic link'}</button>
      </> : <>
        <p>Cloud accounts are not configured in this environment yet. You can still explore the local demo on this device.</p>
        <div className="formError" role="status">Supabase URL and anon key are missing.</div>
      </>}
      <button className="textOnlyButton" onClick={onContinueLocal}>Continue in local demo mode</button>
      <small>Local demo data stays in this browser until you sign in and upload it from Settings.</small>
    </section>
  </main>;
}
