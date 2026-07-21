import { ChangeEvent, FormEvent, useState } from 'react';
import { ArrowLeft, LockKeyhole, Save, Sparkles } from 'lucide-react';
import { InventoryItem, ItemCondition, ItemStatus, LocationRecord, SubscriptionTier } from '../types';
import { uid } from '../lib/utils';
import { EvidenceUploader } from './EvidenceUploader';
import { aiDescriptionService, AiDescriptionResult } from '../services/aiDescriptionService';
import { evidenceStorageService, EvidenceKind } from '../services/evidenceStorageService';

interface ItemFormProps {
  item?: InventoryItem;
  assisted?: boolean;
  assistedWarnings?: string[];
  locations: LocationRecord[];
  tier: SubscriptionTier;
  onUpgrade: () => void;
  onCancel: () => void;
  onSave: (item: InventoryItem) => void;
  onSaveAndAddAnother?: (item: InventoryItem) => void;
}

type EvidenceKey = 'photos' | 'serialPhotos' | 'markingPhotos' | 'receiptFiles' | 'appraisalFiles' | 'warrantyFiles' | 'damagePhotos' | 'otherFiles';

const emptyItem = (): InventoryItem => {
  const now = new Date().toISOString();
  return {
    id: uid('item'),
    itemName: '',
    category: 'Other',
    location: '',
    condition: 'unknown',
    comparableListings: [],
    photos: [],
    serialPhotos: [],
    markingPhotos: [],
    receiptFiles: [],
    appraisalFiles: [],
    warrantyFiles: [],
    damagePhotos: [],
    otherFiles: [],
    status: 'normal',
    createdAt: now,
    updatedAt: now
  };
};

export function ItemForm({ item, assisted = false, assistedWarnings = [], locations, tier, onUpgrade, onCancel, onSave, onSaveAndAddAnother }: ItemFormProps) {
  const [draft, setDraft] = useState<InventoryItem>(() => item ? { ...item, damagePhotos: item.damagePhotos ?? [], otherFiles: item.otherFiles ?? [] } : emptyItem());
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState<AiDescriptionResult>();
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(item && !assisted);
  const isPremium = tier === 'premium';
  const set = <K extends keyof InventoryItem>(key: K, value: InventoryItem[K]) => setDraft(current => ({ ...current, [key]: value }));
  const text = <K extends keyof InventoryItem>(key: K) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, event.target.value as InventoryItem[K]);
  const number = (key: 'purchasePrice' | 'userEnteredValue') => (event: ChangeEvent<HTMLInputElement>) => set(key, event.target.value ? Number(event.target.value) : undefined);

  const evidenceKeys: EvidenceKey[] = ['photos', 'serialPhotos', 'markingPhotos', 'receiptFiles', 'appraisalFiles', 'warrantyFiles', 'damagePhotos', 'otherFiles'];
  const evidenceKinds: Record<EvidenceKey, EvidenceKind> = { photos: 'item', serialPhotos: 'serial', markingPhotos: 'marking', receiptFiles: 'receipt', appraisalFiles: 'appraisal', warrantyFiles: 'warranty', damagePhotos: 'damage', otherFiles: 'other' };
  const setEvidence = (key: EvidenceKey, values: string[]) => {
    const total = evidenceKeys.reduce((sum, current) => sum + (current === key ? values : (draft[current] ?? [])).reduce((size, value) => size + value.length, 0), 0);
    if (total > 4_000_000) {
      setError('All attachments together exceed the safe browser-storage limit. Remove files or use smaller images.');
      return false;
    }
    set(key, values);
    return true;
  };

  const suggest = async () => {
    if (!isPremium) {
      setError('AI description assistance is a Premium feature. Free users can still write their own description.');
      return;
    }
    setAiLoading(true);
    const result = await aiDescriptionService.suggest({ photos: draft.photos, notes: draft.notes, category: draft.category, make: draft.make, model: draft.model, serialNumber: draft.serialNumber });
    setAiResult(result);
    set('aiSuggestedTitle', result.suggestedTitle);
    set('aiDescription', result.suggestedDescription);
    setAiLoading(false);
  };

  const validatedDraft = () => {
    if (!draft.itemName.trim() || !draft.location.trim()) {
      setError('Item name and location are required.');
      return;
    }
    const now = new Date().toISOString();
    const hasAiAssist = Boolean(draft.aiDescription || draft.aiSuggestedTitle);
    return { ...draft, itemName: draft.itemName.trim(), location: draft.location.trim(), aiFieldsReviewedAt: hasAiAssist ? draft.aiFieldsReviewedAt ?? now : undefined, updatedAt: now };
  };

  const uploadEmbeddedEvidence = async (itemToSave: InventoryItem) => {
    if (!(await evidenceStorageService.canUseCloudStorage())) return itemToSave;
    const next = { ...itemToSave };
    for (const key of evidenceKeys) {
      const values = next[key] ?? [];
      next[key] = await Promise.all(values.map(value => evidenceStorageService.uploadDataUrl(value, next.id, evidenceKinds[key]))) as never;
    }
    return next;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = validatedDraft();
    if (!next) return;
    setSaving(true);
    try {
      onSave(await uploadEmbeddedEvidence(next));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save evidence to cloud storage.');
    } finally {
      setSaving(false);
    }
  };

  const saveAndAddAnother = async () => {
    const next = validatedDraft();
    if (!next) return;
    setSaving(true);
    try {
      onSaveAndAddAnother?.(await uploadEmbeddedEvidence(next));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save evidence to cloud storage.');
    } finally {
      setSaving(false);
    }
  };

  return <form className="itemForm redesignedItemForm" onSubmit={submit}>
    <button type="button" className="back" onClick={onCancel}><ArrowLeft /> Inventory</button>
    <header className="formHero">
      <p className="eyebrow green">{isEditing ? 'EDIT ITEM' : assisted ? 'REVIEW AI DRAFT' : 'NEW INVENTORY ITEM'}</p>
      <h1>{isEditing ? `Update ${item?.itemName}` : 'Save the useful facts first.'}</h1>
      <p className="sub">Make, model, Serial Number (SN), photos, and value are the high-impact details. Everything else can wait.</p>
    </header>

    {assisted && <div className="assistNotice" role="status"><Sparkles /><div><b>Photo intake prefilled this draft</b><p>Review make, model, and SN before relying on the record. AI can help, but the label, receipt, or packaging is the final source of truth.</p>{assistedWarnings.length > 0 && <ul>{assistedWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}</div></div>}
    {error && <div className="formError" role="alert">{error}</div>}

    <section className="panel formSection essentialPanel">
      <div className="sectionTitle relaxed">
        <div>
          <p className="eyebrow green">ESSENTIAL</p>
          <h2>Start with identification and value</h2>
          <small>These fields are the fastest path to a useful record.</small>
        </div>
      </div>
      <div className="fields two">
        <label>Item name <input required value={draft.itemName} onChange={text('itemName')} placeholder="Milwaukee M18 drill" /></label>
        <label>Location <input required list="saved-locations" value={draft.location} onChange={text('location')} placeholder="Garage" /><datalist id="saved-locations">{locations.map(location => <option key={location.id} value={location.name} />)}</datalist></label>
      </div>
      <div className="fields three priorityFields">
        <label>Make <input value={draft.make ?? ''} onChange={text('make')} placeholder="Milwaukee" /></label>
        <label>Model <input value={draft.model ?? ''} onChange={text('model')} placeholder="M18 2801-20" /></label>
        <label>Serial Number (SN) <input value={draft.serialNumber ?? ''} onChange={text('serialNumber')} placeholder="Verify from label" /></label>
      </div>
      <p className="essentialHint">Make and model usually drive replacement value. SN helps identify the exact item if it is lost, stolen, or recovered later.</p>
      <div className="fields two">
        <label>User-entered replacement value <input type="number" min="0" step="0.01" value={draft.userEnteredValue ?? ''} onChange={number('userEnteredValue')} placeholder="Optional, but helpful" /></label>
        <label>Room / area <input value={draft.room ?? ''} onChange={text('room')} placeholder="Tool cabinet, closet, shelf..." /></label>
      </div>
    </section>

    <section className="panel formSection proofFirstSection">
      <div className="sectionTitle relaxed">
        <div>
          <p className="eyebrow green">PROOF</p>
          <h2>Add photos now</h2>
          <small>Overall item photos plus a clear serial-number photo are the best quick evidence.</small>
        </div>
      </div>
      <div className="evidenceGrid proofGrid">
        <EvidenceUploader label="Item photos" hint="Overall views and unique details" itemId={draft.id} kind="item" values={draft.photos} max={5} onChange={values => setEvidence('photos', values)} onError={setError} />
        <EvidenceUploader label="Serial-number photos" hint="Close, readable label or engraving" itemId={draft.id} kind="serial" values={draft.serialPhotos} onChange={values => setEvidence('serialPhotos', values)} onError={setError} />
      </div>
    </section>

    <section className="panel formSection aiSection">
      <div className="aiHeading">
        <div>
          <p className="eyebrow green">{isPremium ? 'PREMIUM DEMO AI ASSIST' : 'PREMIUM DEMO FEATURE'}</p>
          <h2>Use AI to clean up the record</h2>
        </div>
        <button type="button" onClick={isPremium ? suggest : onUpgrade} disabled={aiLoading}>{isPremium ? <Sparkles /> : <LockKeyhole />}{aiLoading ? 'Reviewing...' : isPremium ? 'Generate description' : 'Enable Premium demo features'}</button>
      </div>
      <p className="helper">{isPremium ? 'AI can draft a plain-language description from photos and visible details. Please verify any identifier it suggests.' : 'Premium demo access includes AI descriptions, make/model help, SN recognition from photos, and automatic value comparison. It is a prototype test setting, not a paid subscription.'}</p>
      {aiResult && <div className="aiResult"><b>{aiResult.suggestedTitle}</b><p>{aiResult.suggestedDescription}</p>{aiResult.visibleIdentifiers.map(identifier => <small key={identifier}>{identifier}</small>)}{aiResult.missingRecommendedFields.length > 0 && <small>Recommended: add {aiResult.missingRecommendedFields.join(', ')}.</small>}<div><button type="button" onClick={() => { set('itemName', aiResult.suggestedTitle); set('userDescription', aiResult.suggestedDescription); }}>Use title & description</button></div></div>}
    </section>

    <details className="panel formSection moreDetails">
      <summary>
        <div>
          <p className="eyebrow">MORE DETAILS</p>
          <h2>Receipts, markings, condition, and notes</h2>
          <small>Useful for stronger documentation, but not required to save the item.</small>
        </div>
        <span>Open</span>
      </summary>
      <div className="moreDetailsBody">
        <section className="subSection">
          <h3>Category & condition</h3>
          <div className="fields three">
            <label>Category <select value={draft.category} onChange={text('category')}><option>Tools</option><option>Electronics</option><option>Jewelry</option><option>Bicycles</option><option>Furniture</option><option>Collectibles</option><option>Other</option></select></label>
            <label>Condition <select value={draft.condition} onChange={event => set('condition', event.target.value as ItemCondition)}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option><option value="unknown">Unknown</option></select></label>
            <label>Status <select value={draft.status} onChange={event => set('status', event.target.value as ItemStatus)}><option value="normal">Normal</option><option value="stolen">Stolen</option><option value="damaged">Damaged</option><option value="destroyed">Destroyed</option><option value="missing">Missing</option><option value="recovered">Recovered</option></select></label>
          </div>
          <label>Barcode <input value={draft.barcode ?? ''} onChange={text('barcode')} /></label>
        </section>

        <section className="subSection">
          <h3>Description & distinguishing details</h3>
          <label>Description <textarea value={draft.userDescription ?? ''} onChange={text('userDescription')} placeholder="What is it, what came with it, and how is it used?" /></label>
          <label>Distinguishing features <textarea value={draft.distinguishingFeatures ?? ''} onChange={text('distinguishingFeatures')} placeholder="Scratches, repairs, dents, modifications, or unique details" /></label>
        </section>

        <section className="subSection">
          <h3>Owner-applied markings</h3>
          <p className="helper">Examples: initials, engraving, paint mark, business sticker, QR tag, hidden marking, or distinct repair.</p>
          <label className="toggleField"><input type="checkbox" checked={draft.hasOwnerMarking ?? Boolean(draft.ownerMarking)} onChange={event => set('hasOwnerMarking', event.target.checked)} />This item has an owner-applied marking</label>
          <div className="fields two">
            <label>Marking text / description <input value={draft.ownerMarking ?? ''} onChange={text('ownerMarking')} /></label>
            <label>Marking type <select value={draft.markingType ?? ''} onChange={text('markingType')}><option value="">None</option><option>initials</option><option>engraved</option><option>paint</option><option>marker</option><option>sticker</option><option>QR/asset tag</option><option>UV marker</option><option>custom number</option><option>other</option></select></label>
            <label>Location on item <input value={draft.markingLocation ?? ''} onChange={text('markingLocation')} /></label>
          </div>
          <label>Marking notes <textarea value={draft.markingNotes ?? ''} onChange={text('markingNotes')} /></label>
        </section>

        <section className="subSection">
          <h3>Purchase details</h3>
          <div className="fields two">
            <label>Purchase date <input type="date" value={draft.purchaseDate ?? ''} onChange={text('purchaseDate')} /></label>
            <label>Purchase price <input type="number" min="0" step="0.01" value={draft.purchasePrice ?? ''} onChange={number('purchasePrice')} /></label>
          </div>
          <label>Notes <textarea value={draft.notes ?? ''} onChange={text('notes')} placeholder="Accessories, warranty notes, where it was bought, or anything else useful." /></label>
        </section>

        <section className="subSection">
          <h3>Additional documentation</h3>
          <p className="helper">If you are signed in with Supabase, new evidence uploads to private cloud storage. Otherwise it stays in this browser as demo/local data.</p>
          <div className="evidenceGrid">
            <EvidenceUploader label="Marking photos" hint="Owner-applied marking and its location" itemId={draft.id} kind="marking" values={draft.markingPhotos} onChange={values => setEvidence('markingPhotos', values)} onError={setError} />
            <EvidenceUploader label="Receipts" hint="Images or PDF purchase records" itemId={draft.id} kind="receipt" values={draft.receiptFiles} accept="image/*,.pdf,application/pdf" onChange={values => setEvidence('receiptFiles', values)} onError={setError} />
            <EvidenceUploader label="Appraisals" hint="Images or PDF appraisal records" itemId={draft.id} kind="appraisal" values={draft.appraisalFiles} accept="image/*,.pdf,application/pdf" onChange={values => setEvidence('appraisalFiles', values)} onError={setError} />
            <EvidenceUploader label="Warranty files" hint="Images or PDF warranty records" itemId={draft.id} kind="warranty" values={draft.warrantyFiles} accept="image/*,.pdf,application/pdf" onChange={values => setEvidence('warrantyFiles', values)} onError={setError} />
            <EvidenceUploader label="Damage / loss photos" hint="Condition after an incident" itemId={draft.id} kind="damage" values={draft.damagePhotos ?? []} onChange={values => setEvidence('damagePhotos', values)} onError={setError} />
            <EvidenceUploader label="Other documentation" hint="Additional supporting evidence" itemId={draft.id} kind="other" values={draft.otherFiles ?? []} accept="image/*,.pdf,application/pdf" onChange={values => setEvidence('otherFiles', values)} onError={setError} />
          </div>
        </section>
      </div>
    </details>

    <div className="formActions">
      <button type="button" onClick={onCancel}>Cancel</button>
      {!isEditing && onSaveAndAddAnother ? <button type="button" disabled={saving} onClick={() => void saveAndAddAnother()}><Save /> {saving ? 'Saving...' : 'Save & add another'}</button> : null}
      <button className="primary" type="submit" disabled={saving}><Save /> {saving ? 'Saving...' : 'Save item'}</button>
    </div>
  </form>;
}
