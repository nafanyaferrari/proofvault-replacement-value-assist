import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, ChevronRight, ExternalLink, FileText, Home, LockKeyhole, MapPin, Package, Pencil, Plus, Search, Settings, ShieldCheck, Sparkles, Tag, TriangleAlert } from 'lucide-react';
import { loadBatchDefaults, loadItems, loadLocations, loadTier, replaceLocalData, saveBatchDefaults, saveItems, saveLocations, saveTier, seedIncident, seedItems, seedLocations } from './data';
import { InventoryItem, LocationRecord, SubscriptionTier, ValuationResult } from './types';
import { completenessScore } from './services/completeness';
import { VALUATION_DISCLAIMER, valuationService } from './services/valuationService';
import { dateTime, money, uid } from './lib/utils';
import { ItemForm } from './components/ItemForm';
import { IncidentManager } from './components/IncidentManager';
import { BackupPanel } from './components/BackupPanel';
import { ProofVaultBackup } from './services/backupService';
import { LocationsManager } from './components/LocationsManager';
import { PrivacySecurityPanel } from './components/PrivacySecurityPanel';
import { AboutPanel } from './components/AboutPanel';
import { itemIntakeService } from './services/itemIntakeService';
import { itemReviewBacklog, itemReviewFlags } from './services/itemReview';
import { CloudSyncPanel } from './components/CloudSyncPanel';
import { CloudSnapshot, CloudStatus, cloudPersistenceService } from './services/cloudPersistenceService';
import { AccountGate } from './components/AccountGate';

type View = 'home' | 'inventory' | 'detail' | 'form' | 'locations' | 'incident' | 'settings';

export function App() {
  const [view, setView] = useState<View>('home');
  const [items, setItems] = useState<InventoryItem[]>(loadItems);
  const [tier, setTierState] = useState<SubscriptionTier>(loadTier);
  const [selectedId, setSelectedId] = useState('drill');
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState('');
  const [quickSerial, setQuickSerial] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [locations, setLocations] = useState<LocationRecord[]>(loadLocations);
  const [assistedDraft, setAssistedDraft] = useState<InventoryItem>();
  const [assistedWarnings, setAssistedWarnings] = useState<string[]>([]);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({ configured: cloudPersistenceService.isConfigured(), authenticated: false });
  const [localDemoAllowed, setLocalDemoAllowed] = useState(() => localStorage.getItem('pv-account-mode') === 'local');
  const selected = items.find(item => item.id === selectedId) ?? items[0];
  useEffect(()=>{setManual('');setQuickSerial('');},[selectedId]);
  useEffect(() => {
    let active = true;
    cloudPersistenceService.status().then(status => { if (active) setCloudStatus(status); }).catch(() => undefined);
    const unsubscribe = cloudPersistenceService.subscribeToAuthChanges(status => {
      setCloudStatus(status);
      if (status.authenticated) localStorage.removeItem('pv-account-mode');
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  const storageFullNotice = 'Browser storage is full, so this change was not saved. Export a backup, remove large attachments, or continue in the mobile app for larger evidence sets.';
  const persistItems = (nextItems: InventoryItem[]) => { try { saveItems(nextItems); return true; } catch { setNotice(storageFullNotice); return false; } };
  const update = (next: InventoryItem) => { const all = items.map(i => i.id === next.id ? next : i); if(!persistItems(all)) return false; setItems(all); return true; };
  const setTier = (next: SubscriptionTier) => { try { saveTier(next); setTierState(next); setNotice(`${next === 'premium' ? 'Premium' : 'Free'} demo mode enabled.`); } catch { setNotice('Could not save the demo plan setting in this browser.'); } };
  const restoreBackup = (backup: ProofVaultBackup) => { try { replaceLocalData(backup.items,backup.incidents,backup.locations,backup.settings.subscriptionTier,backup.settings.batchDefaults); } catch { setNotice('Could not restore the backup because browser storage is full. Existing browser data was kept.'); return false; } setItems(backup.items); setLocations(backup.locations); setTierState(backup.settings.subscriptionTier); setSelectedId(backup.items[0]?.id ?? ''); setNotice('Local backup restored.'); return true; };
  const restoreCloudSnapshot = (snapshot: CloudSnapshot) => { try { replaceLocalData(snapshot.items,snapshot.incidents,snapshot.locations,snapshot.tier,snapshot.batchDefaults); } catch { setNotice('Could not restore cloud data because browser storage is full. Existing browser data was kept.'); return false; } setItems(snapshot.items); setLocations(snapshot.locations); setTierState(snapshot.tier); setSelectedId(snapshot.items[0]?.id ?? ''); setNotice('Cloud data loaded into this browser.'); return true; };
  const updateLocations = (next: LocationRecord[]) => { try { saveLocations(next); setLocations(next); setNotice('Locations updated.'); } catch { setNotice('Could not save locations in this browser.'); } };
  const resetDemoData = () => { try { replaceLocalData(seedItems,[seedIncident],seedLocations,'free',{location:'',room:''}); } catch { setNotice('Could not reset demo data in this browser. Existing browser data was kept.'); return; } setItems(seedItems); setLocations(seedLocations); setTierState('free'); setSelectedId(seedItems[0]?.id ?? ''); setAssistedDraft(undefined); setAssistedWarnings([]); setEditingId(undefined); setView('home'); setNotice('Demo data reset. You are back in free mode.'); };
  const continueLocalDemo = () => { localStorage.setItem('pv-account-mode','local'); setLocalDemoAllowed(true); setNotice('Local demo mode enabled. Sign in from Settings when you are ready to sync.'); };
  const open = (id: string) => { setSelectedId(id); setView('detail'); };
  const startNew = () => { setEditingId(undefined); setAssistedDraft(undefined); setAssistedWarnings([]); setView('form'); };
  const startEdit = (id: string) => { setEditingId(id); setAssistedDraft(undefined); setAssistedWarnings([]); setView('form'); };
  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Photo could not be read.'));
    reader.onerror = () => reject(new Error('Photo could not be read.'));
    reader.readAsDataURL(file);
  });
  const optimizedPhotoDataUrl = async (file: File) => {
    if (!file.type.startsWith('image/')) return readFileAsDataUrl(file);
    const original = await readFileAsDataUrl(file);
    return new Promise<string>(resolve => {
      const image = new Image();
      image.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const optimized = canvas.toDataURL('image/jpeg', 0.72);
        resolve(optimized.length < original.length ? optimized : original);
      };
      image.onerror = () => resolve(original);
      image.src = original;
    });
  };
  const applyValuation = (item: InventoryItem, valuation?: ValuationResult): InventoryItem => valuation ? {
    ...item,
    estimatedReplacementValueLow: valuation.estimatedReplacementValueLow,
    estimatedReplacementValueHigh: valuation.estimatedReplacementValueHigh,
    estimatedReplacementValueSelected: valuation.suggestedReplacementValue,
    valuationCurrency: 'USD',
    valuationConfidence: valuation.confidence,
    valuationSourceSummary: valuation.sourceSummary,
    valuationCheckedAt: new Date().toISOString(),
    valuationNotes: 'Created from photo-first intake mock analysis.',
    comparableListings: valuation.comparableListings
  } : item;
  const quickPhotoIntake = async (file: File, defaultLocation?: string, defaultRoom?: string) => {
    setIntakeLoading(true);
    try {
      const photo = await optimizedPhotoDataUrl(file);
      const result = await itemIntakeService.analyze({ photoUri: photo, location: defaultLocation || locations[0]?.name || 'Home', room: defaultRoom }, tier === 'premium');
      const now = new Date().toISOString();
      const draft: InventoryItem = applyValuation({
        ...result.draft,
        id: uid('item'),
        photos: [photo],
        serialPhotos: [],
        markingPhotos: [],
        receiptFiles: [],
        appraisalFiles: [],
        warrantyFiles: [],
        damagePhotos: [],
        otherFiles: [],
        comparableListings: [],
        aiSuggestedTitle: result.suggestedTitle,
        aiDescription: result.suggestedDescription,
        valuationNotes: result.needsSerialVerification ? 'AI-prefilled draft. Serial number requires user verification.' : undefined,
        createdAt: now,
        updatedAt: now
      }, result.valuation);
      setEditingId(undefined);
      setAssistedDraft(draft);
      setAssistedWarnings(result.warnings ?? []);
      setView('form');
      setNotice(tier === 'premium' ? 'Photo intake created a draft with a mock replacement estimate.' : 'Photo intake created a reviewable draft. Upgrade enables automatic value lookup.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Photo intake could not create a draft.');
    } finally {
      setIntakeLoading(false);
    }
  };
  const saveItem = (next: InventoryItem, addAnother = false) => {
    const exists = items.some(item => item.id === next.id);
    const all = exists ? items.map(item => item.id === next.id ? next : item) : [next, ...items];
    if(!persistItems(all)) return;
    setItems(all); setSelectedId(next.id); setAssistedDraft(undefined); setAssistedWarnings([]);
    if (addAnother && !exists) {
      setView('inventory');
      setNotice('Item saved. Ready for the next photo or manual entry.');
      return;
    }
    setView('detail'); setNotice(exists ? 'Item updated.' : 'Item added to inventory.');
  };
  const toggleArchive = (item: InventoryItem) => { const next={...item,archivedAt:item.archivedAt?undefined:new Date().toISOString(),updatedAt:new Date().toISOString()};if(!update(next))return;setNotice(item.archivedAt?'Item restored to active inventory.':'Item archived. Incident records are preserved.');setView('inventory'); };
  const find = async () => { setLoading(true); const r = await valuationService.findComparableValues(selected); const saved=update({...selected, estimatedReplacementValueLow:r.estimatedReplacementValueLow, estimatedReplacementValueHigh:r.estimatedReplacementValueHigh, estimatedReplacementValueSelected:r.suggestedReplacementValue, valuationCurrency:'USD', valuationConfidence:r.confidence, valuationSourceSummary:r.sourceSummary, valuationCheckedAt:new Date().toISOString(), comparableListings:r.comparableListings, updatedAt:new Date().toISOString()}); setLoading(false); if(saved)setNotice('Comparable values found and saved.'); };
  const choose = (price: number) => { if(update({...selected, estimatedReplacementValueSelected:price, valuationNotes:'Selected from a saved comparable', updatedAt:new Date().toISOString()}))setNotice('Selected comparable value saved.'); };
  const saveManual = () => { const value=Number(manual); if(value>0&&update({...selected,userEnteredValue:value,updatedAt:new Date().toISOString()})){setManual('');setNotice('Manual value saved.');} };
  const saveQuickSerial = () => { const value=quickSerial.trim(); if(value&&update({...selected,serialNumber:value,updatedAt:new Date().toISOString()})){setQuickSerial('');setNotice('Serial number saved.');} };
  const nav = (target: Exclude<View,'detail'|'form'>, label: string, icon: React.ReactNode) => <button className={view===target?'nav active':'nav'} onClick={()=>setView(target)}>{icon}<span>{label}</span></button>;
  if (!cloudStatus.authenticated && !localDemoAllowed) return <AccountGate status={cloudStatus} onContinueLocal={continueLocalDemo} onStatusChange={setCloudStatus}/>;
  return <div className="shell">
    <aside><div className="brand"><ShieldCheck/><b>ProofVault</b></div><p className="eyebrow">PROPERTY EVIDENCE</p>{nav('home','Overview',<Home/>)}{nav('inventory','Inventory',<Package/>)}{nav('locations','Locations',<MapPin/>)}{nav('incident','Incident',<FileText/>)}<div className="spacer"/>{nav('settings','Settings',<Settings/>)}<div className="privacy"><LockKeyhole/><div><b>{cloudStatus.authenticated?'Cloud account':'Local demo'}</b><small>{cloudStatus.authenticated?cloudStatus.email:'Data stays in this browser'}</small></div></div></aside>
    <main>{notice&&<button className="toast" onClick={()=>setNotice('')} aria-label="Dismiss notification"><Check/>{notice}</button>}
      {view==='home'&&<HomeView items={items} tier={tier} open={open} review={()=>setView('inventory')}/>} {view==='inventory'&&<InventoryView items={items} open={open} edit={startEdit} add={startNew} quickIntake={quickPhotoIntake} intakeLoading={intakeLoading}/>} {view==='detail'&&selected&&<DetailView item={selected} tier={tier} loading={loading} back={()=>setView('inventory')} edit={()=>startEdit(selected.id)} archive={()=>toggleArchive(selected)} find={find} choose={choose} manual={manual} setManual={setManual} saveManual={saveManual} quickSerial={quickSerial} setQuickSerial={setQuickSerial} saveQuickSerial={saveQuickSerial} upgrade={()=>setTier('premium')}/>} {view==='form'&&<ItemForm locations={locations} item={editingId ? items.find(item=>item.id===editingId) : assistedDraft} assisted={Boolean(assistedDraft)} assistedWarnings={assistedWarnings} onCancel={()=>{setAssistedDraft(undefined);setAssistedWarnings([]);setView(editingId?'detail':'inventory')}} onSave={saveItem} onSaveAndAddAnother={next=>saveItem(next,true)}/>} {view==='locations'&&<LocationsManager locations={locations} items={items} onChange={updateLocations}/>} {view==='incident'&&<IncidentManager items={items} tier={tier}/>} {view==='settings'&&<SettingsView items={items} locations={locations} tier={tier} setTier={setTier} restore={restoreBackup} restoreCloud={restoreCloudSnapshot} resetDemoData={resetDemoData}/>}
    </main>
  </div>;
}

function PageHead({kicker,title,sub}:{kicker:string;title:string;sub:string}){return <header><p className="eyebrow green">{kicker}</p><h1>{title}</h1><p className="sub">{sub}</p></header>}
function ItemIcon({category}:{category:string}){return <div className="itemicon">{category==='Jewelry'?<Tag/>:<Package/>}</div>}
function Score({item}:{item:InventoryItem}){const s=completenessScore(item);return <div className="score"><span style={{width:`${s.score}%`}}/><small>{s.score}%</small></div>}
function ItemRow({item,open}:{item:InventoryItem;open:(id:string)=>void}){return <button className="itemrow" onClick={()=>open(item.id)}><ItemIcon category={item.category}/><div><b>{item.itemName}</b><small>{item.location} · {item.serialNumber||item.ownerMarking||'Needs identifier'}</small></div><Score item={item}/><ChevronRight/></button>}

function HomeView({items,tier,open,review}:{items:InventoryItem[];tier:SubscriptionTier;open:(id:string)=>void;review:()=>void}){const active=items.filter(item=>!item.archivedAt);const reviewTotal=itemReviewBacklog(active,1).total;const weak=active.map(item=>({item,...completenessScore(item)})).filter(entry=>entry.score<70).sort((a,b)=>a.score-b.score).slice(0,3);return <><PageHead kicker="GOOD EVENING" title="Your property, documented." sub="Keep the details that matter ready before you need them."/><div className="stats"><div><Package/><span><b>{active.length}</b>Active inventory items</span></div><div><ShieldCheck/><span><b>{active.filter(i=>i.serialNumber||i.ownerMarking).length}</b>Identifiable records</span></div><div><Sparkles/><span><b>{active.filter(i=>i.estimatedReplacementValueSelected).length}</b>Value assisted</span></div><button type="button" onClick={review} aria-label={`${reviewTotal} records need quick review`}><TriangleAlert/><span><b>{reviewTotal}</b>Need quick review</span></button></div>{weak.length>0&&<section className="panel guidancePanel"><div className="sectionTitle"><div><p className="eyebrow">RECORDS TO STRENGTHEN</p><h2>Small additions, stronger evidence</h2></div><span>{weak.length} priority</span></div>{weak.map(entry=><button key={entry.item.id} onClick={()=>open(entry.item.id)}><TriangleAlert/><div><b>{entry.item.itemName}</b><small>{entry.feedback}</small></div><strong>{entry.score}%</strong><ChevronRight/></button>)}</section>}<section className="panel"><div className="sectionTitle"><div><p className="eyebrow">RECENT INVENTORY</p><h2>Ready when it matters</h2></div><span className="tier">{tier} plan</span></div>{active.slice(0,4).map(item=><ItemRow key={item.id} item={item} open={open}/>)}</section><div className="callout"><TriangleAlert/><div><b>Incident Mode</b><p>Create a focused police and insurance packet from your documented items.</p></div><span>Local incident tools ready</span></div></>}
function ReviewQueue({items,open,edit}:{items:InventoryItem[];open:(id:string)=>void;edit:(id:string)=>void}){const{records,total,issueSummary}=itemReviewBacklog(items,4);const first=records[0];if(!records.length)return <section className="panel reviewQueue clear"><div className="sectionTitle"><div><p className="eyebrow">BULK REVIEW QUEUE</p><h2>All quick checks are clear</h2><small>{items.length ? 'No active item currently needs AI review, serial verification, value, photo, receipt, or appraisal follow-up.' : 'Add items with fast photo intake, then review tasks will appear here.'}</small></div><span className="ok"><Check/>Clear</span></div></section>;return <section className="panel reviewQueue"><div className="sectionTitle"><div><p className="eyebrow">BULK REVIEW QUEUE</p><h2>Quick checks before you move on</h2><small>Sorted so likely AI-prefill and serial checks float to the top.</small></div><div className="queueActions"><span>{records.length} of {total} shown</span>{first&&<button onClick={()=>edit(first.item.id)}>Review next</button>}</div></div><div className="reviewChips" aria-label="Review backlog by issue type">{issueSummary.map(issue=><span key={issue.id}>{issue.label}: {issue.count}</span>)}</div>{records.map(record=><button key={record.item.id} onClick={()=>open(record.item.id)}><TriangleAlert/><div><b>{record.item.itemName}</b><small>{record.flags[0].label} · {record.flags[0].detail}</small><span className="reviewReasons">{record.flags.map(flag=>flag.label).join(' • ')}</span></div><ChevronRight/></button>)}</section>}
function InventoryView({items,open,edit,add,quickIntake,intakeLoading}:{items:InventoryItem[];open:(id:string)=>void;edit:(id:string)=>void;add:()=>void;quickIntake:(file:File,defaultLocation?:string,defaultRoom?:string)=>void;intakeLoading:boolean}){const[query,setQuery]=useState('');const[showArchived,setShowArchived]=useState(false);const initialBatch=loadBatchDefaults();const[batchLocation,setBatchLocationState]=useState(initialBatch.location);const[batchRoom,setBatchRoomState]=useState(initialBatch.room);const setBatchLocation=(value:string)=>{setBatchLocationState(value);try{saveBatchDefaults({location:value,room:batchRoom})}catch{}};const setBatchRoom=(value:string)=>{setBatchRoomState(value);try{saveBatchDefaults({location:batchLocation,room:value})}catch{}};const fileInputRef=useRef<HTMLInputElement>(null);const active=items.filter(item=>!item.archivedAt);const locationOptions=Array.from(new Set(items.map(item=>item.location).filter(Boolean))).sort((a,b)=>a.localeCompare(b));const filtered=items.filter(item=>(showArchived?Boolean(item.archivedAt):!item.archivedAt)&&[item.itemName,item.category,item.location,item.make,item.model,item.serialNumber].some(value=>value?.toLowerCase().includes(query.toLowerCase())));return <><div className="pageTitleRow"><PageHead kicker="INVENTORY" title="Documented property" sub="Identifiers, evidence, and values in one place."/><button className="primary addButton" onClick={add}><Plus/>Enter manually</button></div><section className="panel intakePanel"><div><p className="eyebrow green">FAST PHOTO INTAKE</p><h2>Add items with less typing</h2><p>Choose or take one overview photo. The demo creates a reviewable draft with description, make/model, serial candidate, and—on Premium—a mocked replacement estimate.</p><small>Bulk rhythm: set batch location → photo → review → Save & add another. No-cloud demo mode uses one fixed simulated recognition result, so verify every field against the real item.</small><div className="batchDefaults"><label>Batch location<input list="batch-locations" value={batchLocation} onChange={event=>setBatchLocation(event.target.value)} placeholder="Garage, storage unit, bedroom…"/><datalist id="batch-locations">{locationOptions.map(location=><option key={location} value={location}/>)}</datalist></label><label>Room / area<input value={batchRoom} onChange={event=>setBatchRoom(event.target.value)} placeholder="Shelf, closet, tool cabinet…"/></label></div></div><button className="primary intakeButton" type="button" disabled={intakeLoading} onClick={()=>fileInputRef.current?.click()}><Camera/>{intakeLoading?'Analyzing photo…':'Photograph & prefill'}</button><input ref={fileInputRef} className="visuallyHiddenInput" type="file" aria-label="Choose item photo for fast intake" accept="image/*" capture="environment" disabled={intakeLoading} onChange={event=>{const file=event.currentTarget.files?.[0];if(file)quickIntake(file,batchLocation.trim()||undefined,batchRoom.trim()||undefined);event.currentTarget.value='';}}/></section><ReviewQueue items={active} open={open} edit={edit}/><div className="inventoryTools"><div className="search"><Search/><input aria-label="Search inventory" placeholder="Search inventory" value={query} onChange={event=>setQuery(event.target.value)}/></div><button className={showArchived?'selected':''} onClick={()=>setShowArchived(!showArchived)}>{showArchived?'Showing archived':'View archived'} ({items.filter(item=>item.archivedAt).length})</button></div><section className="panel">{filtered.length?filtered.map(item=><ItemRow key={item.id} item={item} open={open}/>):<div className="empty"><Search/><h3>No matching items</h3><p>{showArchived?'No archived items match this search.':'Try a different name, location, make, model, or serial number.'}</p></div>}</section></>}

interface DetailProps{item:InventoryItem;tier:SubscriptionTier;loading:boolean;back:()=>void;edit:()=>void;archive:()=>void;find:()=>void;choose:(price:number)=>void;manual:string;setManual:(value:string)=>void;saveManual:()=>void;quickSerial:string;setQuickSerial:(value:string)=>void;saveQuickSerial:()=>void;upgrade:()=>void}
function DetailView({item,tier,loading,back,edit,archive,find,choose,manual,setManual,saveManual,quickSerial,setQuickSerial,saveQuickSerial,upgrade}:DetailProps){const c=completenessScore(item);const best=item.comparableListings[0];const reviewFlags=itemReviewFlags(item);const[confirmArchive,setConfirmArchive]=useState(false);return <><div className="detailToolbar"><button className="back" onClick={back}><ArrowLeft/>Inventory</button><div className="detailActions"><button onClick={edit}><Pencil/>Edit item</button><button className={item.archivedAt?'restoreButton':'archiveButton'} onClick={()=>item.archivedAt?archive():setConfirmArchive(true)}>{item.archivedAt?'Restore item':'Archive item'}</button></div></div>{confirmArchive&&<div className="confirmStrip"><div><b>Archive this item?</b><span>It will leave active inventory but remain available to existing incident records.</span></div><button onClick={()=>setConfirmArchive(false)}>Cancel</button><button className="dangerButton" onClick={archive}>Archive</button></div>}<div className="detailHead"><ItemIcon category={item.category}/><div><p className="eyebrow green">{item.category}{item.archivedAt?' · ARCHIVED':''}</p><h1>{item.itemName}</h1><p>{item.make} {item.model} · {item.location}</p></div><div className="scorebox"><b>{c.score}%</b><span>{c.label}</span></div></div><div className="grid"><div>{reviewFlags.length>0&&<section className="panel reviewChecklist"><div className="sectionTitle"><div><p className="eyebrow">REVIEW BEFORE RELYING ON THIS RECORD</p><h2>Finish these quick checks</h2></div><button onClick={edit}>Edit details</button></div>{reviewFlags.map(flag=><div className={`reviewFlag ${flag.priority}`} key={flag.id}><TriangleAlert/><div><b>{flag.label}</b><small>{flag.detail}</small>{flag.id==='verify-serial'&&<div className="quickValue"><input aria-label="Quick serial number" value={quickSerial} onChange={e=>setQuickSerial(e.target.value)} placeholder={item.serialNumber?.startsWith('VERIFY-')?'Enter confirmed serial':item.serialNumber||'Enter confirmed serial'}/><button onClick={saveQuickSerial}>Save serial</button></div>}{flag.id==='add-value'&&<div className="quickValue"><input aria-label="Quick manual value" type="number" value={manual} onChange={e=>setManual(e.target.value)} placeholder={item.userEnteredValue?`Manual value: ${money(item.userEnteredValue)}`:'Enter value now'}/><button onClick={saveManual}>Save value</button></div>}</div></div>)}</section>}<section className="panel facts"><div className="sectionTitle"><h2>Identity & evidence</h2><span className="ok"><Check/>Documented</span></div>{item.photos.some(photo=>photo.startsWith('data:image'))&&<div className="detailPhotos">{item.photos.filter(photo=>photo.startsWith('data:image')).map((photo,index)=><img key={`${photo.slice(0,24)}-${index}`} src={photo} alt={`${item.itemName} photo ${index+1}`}/>)}</div>}<dl><div><dt>Serial number</dt><dd>{item.serialNumber||'Not recorded'}</dd></div><div><dt>Owner-applied marking</dt><dd>{item.ownerMarking||'Not recorded'}</dd></div><div><dt>Marking location</dt><dd>{item.markingLocation||'Not recorded'}</dd></div><div><dt>Condition</dt><dd>{item.condition}</dd></div></dl><p className="feedback">{c.feedback}</p></section><section className="panel valuation"><div className="valueTitle"><div className="spark"><Sparkles/></div><div><p className="eyebrow green">PREMIUM ASSIST</p><h2>Replacement Value Assist</h2></div>{tier==='premium'&&<span className="premium">PREMIUM</span>}</div>
  {item.estimatedReplacementValueSelected ? <ValuationResults item={item} best={best} choose={choose}/> : tier==='free' ? <div className="locked"><LockKeyhole/><h3>Know what replacement may cost</h3><p>Premium finds and saves comparable new, used, and refurbished listings. Manual values stay available on the free plan.</p><button className="primary" onClick={upgrade}>Upgrade demo to Premium</button></div> : <div className="empty"><Sparkles/><h3>No estimate yet</h3><p>Search mocked marketplace sources to build an approximate replacement range.</p></div>}
  <div className="actions"><button className="primary" disabled={tier==='free'||loading} onClick={find}>{loading?'Checking sources…':'Find Comparable Values'}</button>{item.estimatedReplacementValueSelected&&<button onClick={()=>choose(item.estimatedReplacementValueSelected!)}>Use this value</button>}</div><div className="manual"><input aria-label="Manual value" type="number" value={manual} onChange={e=>setManual(e.target.value)} placeholder={item.userEnteredValue?`Manual value: ${money(item.userEnteredValue)}`:'Enter manual value'}/><button onClick={saveManual}>Add manual value</button></div><div className="checked">Checked: {dateTime(item.valuationCheckedAt)}{item.valuationSourceSummary&&` · ${item.valuationSourceSummary}`}</div><p className="disclaimer">{VALUATION_DISCLAIMER}</p></section></div><aside className="side"><section className="panel"><p className="eyebrow">VALUE SUMMARY</p><div className="bigvalue">{money(item.userEnteredValue)}</div><small>User-entered value</small><hr/><div className="bigvalue">{money(item.estimatedReplacementValueSelected)}</div><small>Replacement Value Assist</small></section><section className="panel"><p className="eyebrow">DOCUMENTATION</p><p>{item.photos.length} item photo</p><p>{item.serialPhotos.length+item.markingPhotos.length} identifier photos</p><p>{item.receiptFiles.length} receipt</p><p>{item.appraisalFiles.length} appraisal</p></section></aside></div></>}

function ValuationResults({item,best,choose}:{item:InventoryItem;best?:InventoryItem['comparableListings'][number];choose:(n:number)=>void}){return <><div className="estimate"><div><small>ESTIMATED REPLACEMENT RANGE</small><b>{money(item.estimatedReplacementValueLow)} – {money(item.estimatedReplacementValueHigh)}</b><span>Selected estimate: {money(item.estimatedReplacementValueSelected)}</span></div><div className={`confidence ${item.valuationConfidence}`}>{item.valuationConfidence} confidence</div></div>{best&&<><p className="eyebrow">BEST COMPARABLE</p><div className="comparable"><div><b>{best.title}</b><small>{best.marketplace} · {best.condition} · {best.matchReason}</small></div><strong>{money(best.price)}</strong><a href={best.url} target="_blank" rel="noreferrer" aria-label="Open comparable listing"><ExternalLink/></a></div></>}{item.comparableListings.slice(1).map(x=><div className="comparable minor" key={x.id}><div><b>{x.title}</b><small>{x.marketplace} · {x.condition}</small></div><strong>{money(x.price)}</strong><button className="textBtn" onClick={()=>choose(x.price)}>Use this value</button></div>)}</>}

function BrowserStoragePanel(){const[estimate,setEstimate]=useState<{usage?:number;quota?:number}>({});useEffect(()=>{let active=true;navigator.storage?.estimate?.().then(result=>{if(active)setEstimate({usage:result.usage,quota:result.quota})}).catch(()=>undefined);return()=>{active=false}},[]);const usage=estimate.usage??0;const quota=estimate.quota??0;const percent=quota?Math.min(100,Math.round((usage/quota)*100)):0;const mb=(bytes:number)=>(bytes/1024/1024).toFixed(bytes>10_000_000?1:2);return <section className="panel settings"><h2>Browser storage</h2><p>This web demo stores inventory, incidents, and uploaded evidence in this browser. For large real inventories, the mobile app will use app-private file storage instead.</p>{quota?<><div className="storageMeter" aria-label={`Browser storage ${percent}% used`}><span style={{width:`${percent}%`}}/></div><small>{mb(usage)} MB used of about {mb(quota)} MB available to this browser.</small></>:<small>Storage estimate is not available in this browser.</small>}</section>}

function SettingsView({items,locations,tier,setTier,restore,restoreCloud,resetDemoData}:{items:InventoryItem[];locations:LocationRecord[];tier:SubscriptionTier;setTier:(tier:SubscriptionTier)=>void;restore:(backup:ProofVaultBackup)=>boolean;restoreCloud:(snapshot:CloudSnapshot)=>boolean;resetDemoData:()=>void}){const[confirmReset,setConfirmReset]=useState(false);return <><PageHead kicker="SETTINGS" title="Settings & privacy" sub="Manage local data, cloud sync readiness, privacy, security placeholders, and the demo plan."/><section className="panel settings"><h2>Subscription status</h2><div className="segmented"><button className={tier==='free'?'selected':''} onClick={()=>setTier('free')}>Free</button><button className={tier==='premium'?'selected premiumBtn':''} onClick={()=>setTier('premium')}>Premium</button></div><p>Premium enables automatic comparable lookup, saved estimates, and marketplace links in incident exports.</p></section><CloudSyncPanel items={items} locations={locations} tier={tier} onRestoreCloud={restoreCloud}/><BrowserStoragePanel/><BackupPanel items={items} locations={locations} tier={tier} onRestore={restore}/><section className="panel settings"><h2>Demo reset</h2><p>Use this before a walkthrough or when browser storage gets crowded. Download a backup first if you want to keep your current local records.</p>{confirmReset?<div className="restoreConfirm"><div><b>Reset this browser demo?</b><small>This replaces local inventory, incidents, locations, and plan status with the original sample data.</small></div><button onClick={()=>setConfirmReset(false)}>Cancel</button><button className="dangerButton" onClick={resetDemoData}>Reset demo data</button></div>:<button className="dangerButton" onClick={()=>setConfirmReset(true)}>Reset demo data</button>}</section><PrivacySecurityPanel/><AboutPanel/></>}
