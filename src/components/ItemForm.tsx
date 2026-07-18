import { ChangeEvent, FormEvent, useState } from 'react';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { InventoryItem, ItemCondition, ItemStatus, LocationRecord } from '../types';
import { uid } from '../lib/utils';
import { EvidenceUploader } from './EvidenceUploader';
import { aiDescriptionService, AiDescriptionResult } from '../services/aiDescriptionService';
import { evidenceStorageService, EvidenceKind } from '../services/evidenceStorageService';

interface ItemFormProps {
  item?: InventoryItem;
  assisted?: boolean;
  assistedWarnings?: string[];
  locations: LocationRecord[];
  onCancel: () => void;
  onSave: (item: InventoryItem) => void;
  onSaveAndAddAnother?: (item: InventoryItem) => void;
}

const emptyItem = (): InventoryItem => {
  const now = new Date().toISOString();
  return {
    id: uid('item'), itemName: '', category: 'Other', location: '', condition: 'unknown',
    comparableListings: [], photos: [], serialPhotos: [], markingPhotos: [], receiptFiles: [],
    appraisalFiles: [], warrantyFiles: [], damagePhotos: [], status: 'normal', createdAt: now, updatedAt: now
  };
};

export function ItemForm({ item, assisted = false, assistedWarnings = [], locations, onCancel, onSave, onSaveAndAddAnother }: ItemFormProps) {
  const [draft, setDraft] = useState<InventoryItem>(() => item ? {...item,damagePhotos:item.damagePhotos??[]} : emptyItem());
  const [error, setError] = useState('');
  const [aiResult,setAiResult]=useState<AiDescriptionResult>();
  const [aiLoading,setAiLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const isEditing = Boolean(item && !assisted);
  const set = <K extends keyof InventoryItem>(key: K, value: InventoryItem[K]) => setDraft(current => ({...current, [key]: value}));
  const text = (key: keyof InventoryItem) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, event.target.value as never);
  const number = (key: 'purchasePrice' | 'userEnteredValue') => (event: ChangeEvent<HTMLInputElement>) => set(key, event.target.value ? Number(event.target.value) : undefined);

  const evidenceKeys: Array<'photos'|'serialPhotos'|'markingPhotos'|'receiptFiles'|'appraisalFiles'|'warrantyFiles'|'damagePhotos'|'otherFiles'> = ['photos','serialPhotos','markingPhotos','receiptFiles','appraisalFiles','warrantyFiles','damagePhotos','otherFiles'];
  const evidenceKinds: Record<typeof evidenceKeys[number],EvidenceKind> = { photos:'item', serialPhotos:'serial', markingPhotos:'marking', receiptFiles:'receipt', appraisalFiles:'appraisal', warrantyFiles:'warranty', damagePhotos:'damage', otherFiles:'other' };
  const setEvidence = (key:typeof evidenceKeys[number], values:string[]) => {
    const total=evidenceKeys.reduce((sum,current)=>sum+(current===key?values:(draft[current]??[])).reduce((size,value)=>size+value.length,0),0);
    if(total>4_000_000){setError('All attachments together exceed the safe browser-storage limit. Remove files or use smaller images.');return false}
    set(key,values);return true;
  };
  const suggest=async()=>{setAiLoading(true);const result=await aiDescriptionService.suggest({photos:draft.photos,notes:draft.notes,category:draft.category,make:draft.make,model:draft.model,serialNumber:draft.serialNumber});setAiResult(result);set('aiSuggestedTitle',result.suggestedTitle);set('aiDescription',result.suggestedDescription);setAiLoading(false)};

  const validatedDraft = () => {
    if (!draft.itemName.trim() || !draft.location.trim()) { setError('Item name and location are required.'); return; }
    const now = new Date().toISOString();
    const hasAiAssist = Boolean(draft.aiDescription || draft.aiSuggestedTitle);
    return {...draft, itemName:draft.itemName.trim(), location:draft.location.trim(), aiFieldsReviewedAt:hasAiAssist ? draft.aiFieldsReviewedAt ?? now : undefined, updatedAt:now};
  };
  const uploadEmbeddedEvidence = async (item: InventoryItem) => {
    if (!(await evidenceStorageService.canUseCloudStorage())) return item;
    const next = { ...item };
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
    try { onSave(await uploadEmbeddedEvidence(next)); }
    catch(reason){ setError(reason instanceof Error?reason.message:'Could not save evidence to cloud storage.'); }
    finally{ setSaving(false); }
  };
  const saveAndAddAnother = async () => {
    const next = validatedDraft();
    if (!next) return;
    setSaving(true);
    try { onSaveAndAddAnother?.(await uploadEmbeddedEvidence(next)); }
    catch(reason){ setError(reason instanceof Error?reason.message:'Could not save evidence to cloud storage.'); }
    finally{ setSaving(false); }
  };

  return <form className="itemForm" onSubmit={submit}>
    <button type="button" className="back" onClick={onCancel}><ArrowLeft/> Inventory</button>
    <header><p className="eyebrow green">{isEditing ? 'EDIT ITEM' : 'NEW INVENTORY ITEM'}</p><h1>{isEditing ? `Update ${item?.itemName}` : 'Document an item'}</h1><p className="sub">Capture enough detail to identify, value, and recover it later.</p></header>
    {assisted && <div className="assistNotice" role="status"><Sparkles/><div><b>Photo intake prefilled this draft</b><p>No-cloud demo mode uses a fixed simulated recognition result. Review every field before saving, and treat the serial number as a candidate until you compare it with the physical label or receipt.</p>{assistedWarnings.length>0&&<ul>{assistedWarnings.map(warning=><li key={warning}>{warning}</li>)}</ul>}</div></div>}
    {error && <div className="formError" role="alert">{error}</div>}
    <div className="formGrid">
      <section className="panel formSection"><h2>Item basics</h2><div className="fields two"><label>Item name <input required value={draft.itemName} onChange={text('itemName')} placeholder="Milwaukee M18 drill"/></label><label>Category <select value={draft.category} onChange={text('category')}><option>Tools</option><option>Electronics</option><option>Jewelry</option><option>Bicycles</option><option>Furniture</option><option>Collectibles</option><option>Other</option></select></label><label>Location <input required list="saved-locations" value={draft.location} onChange={text('location')} placeholder="Garage"/><datalist id="saved-locations">{locations.map(location=><option key={location.id} value={location.name}/>)}</datalist></label><label>Room / sub-location <input value={draft.room ?? ''} onChange={text('room')} placeholder="Tool cabinet"/></label><label>Condition <select value={draft.condition} onChange={e=>set('condition',e.target.value as ItemCondition)}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option><option value="unknown">Unknown</option></select></label><label>Status <select value={draft.status} onChange={e=>set('status',e.target.value as ItemStatus)}><option value="normal">Normal</option><option value="stolen">Stolen</option><option value="damaged">Damaged</option><option value="destroyed">Destroyed</option><option value="missing">Missing</option><option value="recovered">Recovered</option></select></label></div><label>Description <textarea value={draft.userDescription ?? ''} onChange={text('userDescription')} placeholder="What is it, what came with it, and how is it used?"/></label></section>
      <section className="panel formSection"><h2>Make & identifiers</h2><div className="fields two"><label>Manufacturer / make <input value={draft.make ?? ''} onChange={text('make')}/></label><label>Model <input value={draft.model ?? ''} onChange={text('model')}/></label><label>Serial number <input value={draft.serialNumber ?? ''} onChange={text('serialNumber')}/></label><label>Barcode <input value={draft.barcode ?? ''} onChange={text('barcode')}/></label></div><label>Distinguishing features <textarea value={draft.distinguishingFeatures ?? ''} onChange={text('distinguishingFeatures')} placeholder="Scratches, repairs, dents, modifications, or unique details"/></label></section>
      <section className="panel formSection"><h2>Owner-applied markings</h2><p className="helper">Examples: initials, engraving, paint mark, business sticker, QR tag, hidden marking, or distinct repair.</p><label className="toggleField"><input type="checkbox" checked={draft.hasOwnerMarking??Boolean(draft.ownerMarking)} onChange={event=>set('hasOwnerMarking',event.target.checked)}/>This item has an owner-applied marking</label><div className="fields two"><label>Marking text / description <input value={draft.ownerMarking ?? ''} onChange={text('ownerMarking')}/></label><label>Marking type <select value={draft.markingType ?? ''} onChange={text('markingType')}><option value="">None</option><option>initials</option><option>engraved</option><option>paint</option><option>marker</option><option>sticker</option><option>QR/asset tag</option><option>UV marker</option><option>custom number</option><option>other</option></select></label><label>Location on item <input value={draft.markingLocation ?? ''} onChange={text('markingLocation')}/></label></div><label>Marking notes<textarea value={draft.markingNotes??''} onChange={text('markingNotes')}/></label></section>
      <section className="panel formSection"><h2>Value & notes</h2><div className="fields two"><label>Purchase date<input type="date" value={draft.purchaseDate??''} onChange={text('purchaseDate')}/></label><label>Purchase price <input type="number" min="0" step="0.01" value={draft.purchasePrice ?? ''} onChange={number('purchasePrice')}/></label><label>User-entered replacement value <input type="number" min="0" step="0.01" value={draft.userEnteredValue ?? ''} onChange={number('userEnteredValue')}/></label></div><label>Notes <textarea value={draft.notes ?? ''} onChange={text('notes')}/></label></section>
      <section className="panel formSection aiSection"><div className="aiHeading"><div><p className="eyebrow green">SUGGESTED BY AI — PLEASE VERIFY</p><h2>AI description assistant</h2></div><button type="button" onClick={suggest} disabled={aiLoading}><Sparkles/>{aiLoading?'Reviewing…':'Generate suggestion'}</button></div><p className="helper">Mocked for this MVP. AI output is never treated as a confirmed identifier.</p>{aiResult&&<div className="aiResult"><b>{aiResult.suggestedTitle}</b><p>{aiResult.suggestedDescription}</p>{aiResult.visibleIdentifiers.map(identifier=><small key={identifier}>{identifier}</small>)}{aiResult.missingRecommendedFields.length>0&&<small>Recommended: add {aiResult.missingRecommendedFields.join(', ')}.</small>}<div><button type="button" onClick={()=>{set('itemName',aiResult.suggestedTitle);set('userDescription',aiResult.suggestedDescription)}}>Use title & description</button></div></div>}</section>
    </div>
    <section className="panel formSection documentationSection"><h2>Documentation & evidence</h2><p className="helper">If you are signed in with Supabase, new evidence uploads to private cloud storage. Otherwise it stays in this browser as demo/local data.</p><div className="evidenceGrid"><EvidenceUploader label="Item photos" hint="Overall views and unique details" itemId={draft.id} kind="item" values={draft.photos} max={5} onChange={values=>setEvidence('photos',values)} onError={setError}/><EvidenceUploader label="Serial-number photos" hint="Clear, readable identifier photos" itemId={draft.id} kind="serial" values={draft.serialPhotos} onChange={values=>setEvidence('serialPhotos',values)} onError={setError}/><EvidenceUploader label="Marking photos" hint="Owner-applied marking and its location" itemId={draft.id} kind="marking" values={draft.markingPhotos} onChange={values=>setEvidence('markingPhotos',values)} onError={setError}/><EvidenceUploader label="Receipts" hint="Images or PDF purchase records" itemId={draft.id} kind="receipt" values={draft.receiptFiles} accept="image/*,.pdf,application/pdf" onChange={values=>setEvidence('receiptFiles',values)} onError={setError}/><EvidenceUploader label="Appraisals" hint="Images or PDF appraisal records" itemId={draft.id} kind="appraisal" values={draft.appraisalFiles} accept="image/*,.pdf,application/pdf" onChange={values=>setEvidence('appraisalFiles',values)} onError={setError}/><EvidenceUploader label="Warranty files" hint="Images or PDF warranty records" itemId={draft.id} kind="warranty" values={draft.warrantyFiles} accept="image/*,.pdf,application/pdf" onChange={values=>setEvidence('warrantyFiles',values)} onError={setError}/><EvidenceUploader label="Damage / loss photos" hint="Condition after an incident" itemId={draft.id} kind="damage" values={draft.damagePhotos??[]} onChange={values=>setEvidence('damagePhotos',values)} onError={setError}/><EvidenceUploader label="Other documentation" hint="Additional supporting evidence" itemId={draft.id} kind="other" values={draft.otherFiles??[]} accept="image/*,.pdf,application/pdf" onChange={values=>setEvidence('otherFiles',values)} onError={setError}/></div></section>
    <div className="formActions"><button type="button" onClick={onCancel}>Cancel</button>{!isEditing&&onSaveAndAddAnother?<button type="button" disabled={saving} onClick={()=>void saveAndAddAnother()}><Save/> {saving?'Saving…':'Save & add another'}</button>:null}<button className="primary" type="submit" disabled={saving}><Save/> {saving?'Saving…':'Save item'}</button></div>
  </form>;
}
