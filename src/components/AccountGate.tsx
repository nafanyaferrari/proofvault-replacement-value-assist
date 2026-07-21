import { useState } from 'react';
import { ArrowDown, ArrowRight, Camera, Check, Cloud, FileText, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
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
    <header className="landingNav">
      <div className="accountBrand"><ShieldCheck /><b>ProofVault</b></div>
      <a href="#account">Sign in or create account</a>
    </header>

    <section className="accountHero landingHero">
      <p className="eyebrow green">BEFORE SOMETHING HAPPENS</p>
      <h1>Could you prove what your home is worth if you had to do it today?</h1>
      <p className="sub">After a theft, fire, or loss, people are often asked to remember makes, models, serial numbers, receipts, and values when the evidence is hardest to find. ProofVault makes the first step simple: walk around and take photos.</p>
      <div className="landingHeroActions">
        <a className="primary landingPrimary" href="#why">See why ProofVault exists <ArrowDown /></a>
        <a className="landingTextLink" href="#demo">Jump to the no-sign-up demo <ArrowRight /></a>
      </div>
      <div className="accountHighlights" aria-label="ProofVault benefits">
        <span><Camera />Start with photos, not forms</span>
        <span><Sparkles />AI helps find make, model, and SN</span>
        <span><FileText />Keep a usable incident packet</span>
      </div>
    </section>

    <section className="whyPitch" id="why">
      <div className="whyIntro"><p className="eyebrow green">THE REAL PROBLEM</p><h2>A vague list is not the same as proof.</h2><p>"A TV," "some tools," or "jewelry" is difficult to replace, identify, or explain later. What matters is the information people usually do not have time to gather after a loss.</p></div>
      <div className="whySteps">
        <article><b>1</b><h3>Memory fades fast</h3><p>Names, serial numbers, accessories, and purchase details are easy to forget under stress.</p></article>
        <article><b>2</b><h3>Evidence gets scattered</h3><p>Photos, receipts, and notes live in different places - or disappear with the item.</p></article>
        <article><b>3</b><h3>Claims need specifics</h3><p>Clear item records make it easier to describe what was lost and what replacement may cost.</p></article>
      </div>
      <div className="whyReveal"><p className="eyebrow green">THE RELIEF</p><h2>Picture opening one clear record instead of rebuilding your memory.</h2><p>ProofVault turns a photo walk-around into reviewable item details, approximate replacement estimates, and an incident-ready packet. You remain in control: AI suggestions are clearly marked for review.</p></div>
    </section>

    <section className="demoSpotlight" id="demo">
      <div><p className="eyebrow green">SEE THE ACTUAL FLOW</p><h2>Try ProofVault before you share an email.</h2><p>Use sample property, take the same photo-first path, and see make/model/SN review, approximate values, and an incident packet for yourself.</p><ul><li><Check />No account or payment needed</li><li><Check />Three free AI photo analyses in this browser</li><li><Check />Demo data stays separate from personal accounts</li></ul></div>
      <div className="demoSpotlightAction"><Camera /><b>Ready to see it work?</b><button className="primary" onClick={onContinueLocal}>Open the interactive demo <ArrowRight /></button><small>About two minutes. You can reset the sample data any time.</small></div>
    </section>

    <section className="demoFlowPreview" aria-label="ProofVault demo workflow preview">
      <div><b>1</b><span>Take a clear photo of each item</span></div>
      <div><b>2</b><span>Review make, model, SN, and value</span></div>
      <div><b>3</b><span>Save records or create an incident packet</span></div>
    </section>

    <section className="panel accountCard" id="account">
      <p className="eyebrow green">WHEN YOU ARE READY</p><h2>Create your private ProofVault account</h2>
      <p>Use an account when you are ready to begin your own inventory. Your signed-in records stay separate from the interactive demo and sync to your private account.</p>
      {status.configured ? <>
        {message && <div className="inlineNotice">{message}</div>}
        {error && <div className="formError" role="alert">{error}</div>}
        <label>Email address
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
        </label>
        <button className="primary" disabled={busy || !email.trim()} onClick={sendMagicLink}>{busy ? 'Sending link...' : 'Send secure sign-in link'}</button>
      </> : <>
        <p>Cloud accounts are not configured in this environment yet. You can still explore the interactive demo on this device.</p>
        <div className="formError" role="status">Supabase URL and anon key are missing.</div>
      </>}
      <small className="localDemoNote"><LockKeyhole /> The interactive demo needs no account. Personal account data stays separate.</small>
    </section>
  </main>;
}
