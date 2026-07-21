import { useState } from 'react';
import { Camera, Cloud, FileText, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
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
      <div className="accountBrand"><ShieldCheck /><b>ProofVault</b></div>
      <p className="eyebrow green">PROOFVAULT DEMO</p>
      <h1>Try the fast inventory flow before you sign in.</h1>
      <p className="sub">Open the local demo to see the new walk-around photo workflow, make/model/SN review, Replacement Value Assist, and incident packet exports. Sign in when you want your own private empty account.</p>
      <div className="accountHighlights">
        <span><Camera />Walk-around bulk photos</span>
        <span><Sparkles />AI drafts make, model, and SN</span>
        <span><ShieldCheck />Replacement value estimates</span>
        <span><FileText />Incident export packets</span>
        <span><Cloud />Private cloud sync</span>
      </div>
      <div className="demoFlowPreview" aria-label="Demo workflow preview">
        <div><b>1</b><span>Take lots of photos</span></div>
        <div><b>2</b><span>Check make, model, SN, and value</span></div>
        <div><b>3</b><span>Save records or export a packet</span></div>
      </div>
    </section>
    <section className="panel accountCard">
      <h2>Start with the demo</h2>
      <p>The demo stays outside personal accounts and uses sample data in this browser. It is the safest place to click around, test the new UI, and see how a real inventory should feel.</p>
      <button className="primary" onClick={onContinueLocal}>Open local demo</button>
      <div className="orDivider"><span>or create your private account</span></div>
      {status.configured ? <>
        <p>Enter your email and Supabase will send a secure sign-in link. New emails create an account automatically when signups are enabled in Supabase.</p>
        {message && <div className="inlineNotice">{message}</div>}
        {error && <div className="formError" role="alert">{error}</div>}
        <label>Email address
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
        </label>
        <button className="primary" disabled={busy || !email.trim()} onClick={sendMagicLink}>{busy ? 'Sending link...' : 'Send magic link'}</button>
      </> : <>
        <p>Cloud accounts are not configured in this environment yet. You can still explore the local demo on this device.</p>
        <div className="formError" role="status">Supabase URL and anon key are missing.</div>
      </>}
      <small className="localDemoNote"><LockKeyhole /> Local demo data stays in this browser. Signed-in account data stays separate.</small>
    </section>
  </main>;
}
