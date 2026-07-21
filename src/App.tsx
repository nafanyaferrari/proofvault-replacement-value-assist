import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, ChevronRight, Cloud, ExternalLink, FileText, Home, LockKeyhole, MapPin, Package, Pencil, Plus, Search, Settings, ShieldCheck, Sparkles, Tag, TriangleAlert } from 'lucide-react';
import { clearBulkDrafts, loadBatchDefaults, loadBulkDrafts, loadIncidents, loadItems, loadLocations, loadTier, replaceLocalData, saveBatchDefaults, saveBulkDrafts, saveItems, saveLocations, saveTier, seedIncident, seedItems, seedLocations } from './data';
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

type View = 'home' | 'inventory' | 'bulkReview' | 'detail' | 'form' | 'locations' | 'incident' | 'settings';
const emptyAccountLocations:LocationRecord[]=[{id:'loc-home',name:'Home',notes:'Default location for your first items',createdAt:new Date().toISOString()}];
const maxBulkPhotosPerBatch = 12;

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
  const [bulkDrafts, setBulkDrafts] = useState<InventoryItem[]>(loadBulkDrafts);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportMessage, setBulkImportMessage] = useState('');
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({ configured: cloudPersistenceService.isConfigured(), authenticated: false });
  const [localDemoAllowed, setLocalDemoAllowed] = useState(() => localStorage.getItem('pv-account-mode') === 'local');
  const [cloudReadyToSync, setCloudReadyToSync] = useState(false);
  const [syncRevision, setSyncRevision] = useState(0);
  const [cloudSyncState, setCloudSyncState] = useState<'idle'|'loading'|'saving'|'saved'|'error'>('idle');
  const [cloudSyncMessage, setCloudSyncMessage] = useState('');
  const skipNextCloudAutosave = useRef(false);
  const selected = items.find(item => item.id === selectedId) ?? items[0];
  useEffect(()=>{setManual('');setQuickSerial('');},[selectedId]);
  const markLocalChange = () => setSyncRevision(value => value + 1);
  const hydrateCloudAccount = async () => {
    localStorage.removeItem('pv-account-mode');
    setLocalDemoAllowed(false);
    setCloudReadyToSync(false);
    setCloudSyncState('loading');
    setCloudSyncMessage('Loading your cloud account...');
    try {
      const snapshot = await cloudPersistenceService.loadSnapshot();
      skipNextCloudAutosave.current = true;
      if (!restoreCloudSnapshot(snapshot)) throw new Error('Cloud data could not be loaded into this browser.');
      clearBulkDrafts();
      setBulkDrafts([]);
      setView('inventory');
      setCloudSyncState('saved');
      setCloudSyncMessage(snapshot.items.length ? `Loaded ${snapshot.items.length} cloud item${snapshot.items.length===1?'':'s'}. Autosave is on.` : 'Cloud account ready. Autosave is on.');
      setCloudReadyToSync(true);
    } catch (error) {
      clearBulkDrafts();
      setBulkDrafts([]);
      setItems([]);
      setLocations(emptyAccountLocations);
      setTierState('free');
      setSelectedId('');
      setView('home');
      setCloudSyncState('error');
      setCloudSyncMessage(error instanceof Error ? error.message : 'Cloud account could not be loaded.');
      setNotice('Signed in, but cloud data could not be loaded. Changes are not autosaving yet.');
    }
  };
  useEffect(() => {
    let active = true;
    cloudPersistenceService.status().then(status => { if (!active) return; setCloudStatus(status); if (status.authenticated) void hydrateCloudAccount(); }).catch(() => undefined);
    const unsubscribe = cloudPersistenceService.subscribeToAuthChanges(status => {
      setCloudStatus(status);
      if (status.authenticated) {
        void hydrateCloudAccount();
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!cloudStatus.authenticated || !cloudReadyToSync) return;
    if (skipNextCloudAutosave.current) { skipNextCloudAutosave.current = false; return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCloudSyncState('saving');
      setCloudSyncMessage('Autosaving to your account...');
      cloudPersistenceService.saveSnapshot({items,incidents:loadIncidents(false),locations,tier,batchDefaults:loadBatchDefaults()})
        .then(() => {
          if (cancelled) return;
          setCloudSyncState('saved');
          setCloudSyncMessage(`Autosaved ${items.length} item${items.length===1?'':'s'} to your account.`);
        })
        .catch(error => {
          if (cancelled) return;
          setCloudSyncState('error');
          setCloudSyncMessage(error instanceof Error ? error.message : 'Autosave failed.');
        });
    }, 900);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [items,locations,tier,syncRevision,cloudStatus.authenticated,cloudReadyToSync]);
  const storageFullNotice = 'Browser storage is full, so this change was not saved. Export a backup, remove large attachments, or continue in the mobile app for larger evidence sets.';
  const persistItems = (nextItems: InventoryItem[]) => { try { saveItems(nextItems); return true; } catch { setNotice(storageFullNotice); return false; } };
  const update = (next: InventoryItem) => { const all = items.map(i => i.id === next.id ? next : i); if(!persistItems(all)) return false; setItems(all); markLocalChange(); return true; };
  const setTier = (next: SubscriptionTier) => { try { saveTier(next); setTierState(next); markLocalChange(); setNotice(`${next === 'premium' ? 'Premium' : 'Free'} demo access enabled.`); } catch { setNotice('Could not save the prototype access setting in this browser.'); } };
  const restoreBackup = (backup: ProofVaultBackup) => { try { replaceLocalData(backup.items,backup.incidents,backup.locations,backup.settings.subscriptionTier,backup.settings.batchDefaults); } catch { setNotice('Could not restore the backup because browser storage is full. Existing browser data was kept.'); return false; } setBulkDrafts([]); setItems(backup.items); setLocations(backup.locations); setTierState(backup.settings.subscriptionTier); setSelectedId(backup.items[0]?.id ?? ''); markLocalChange(); setNotice(cloudStatus.authenticated?'Backup restored. Autosave will update your account.':'Local backup restored.'); return true; };
  const restoreCloudSnapshot = (snapshot: CloudSnapshot) => { try { replaceLocalData(snapshot.items,snapshot.incidents,snapshot.locations,snapshot.tier,snapshot.batchDefaults); } catch { setNotice('Could not restore cloud data because browser storage is full. Existing browser data was kept.'); return false; } setBulkDrafts([]); setItems(snapshot.items); setLocations(snapshot.locations.length?snapshot.locations:emptyAccountLocations); setTierState(snapshot.tier); setSelectedId(snapshot.items[0]?.id ?? ''); setNotice(snapshot.items.length?'Cloud data loaded into this browser.':'Cloud account is empty. Start by adding your first item.'); return true; };
  const updateLocations = (next: LocationRecord[]) => { try { saveLocations(next); setLocations(next); markLocalChange(); setNotice('Locations updated.'); } catch { setNotice('Could not save locations in this browser.'); } };
  const resetDemoData = () => { if(cloudStatus.authenticated){setNotice('Demo reset is only available in local demo mode so sample data is not saved to your account.');return;} try { replaceLocalData(seedItems,[seedIncident],seedLocations,'free',{location:'',room:''}); } catch { setNotice('Could not reset demo data in this browser. Existing browser data was kept.'); return; } setBulkDrafts([]); setItems(seedItems); setLocations(seedLocations); setTierState('free'); setSelectedId(seedItems[0]?.id ?? ''); setAssistedDraft(undefined); setAssistedWarnings([]); setEditingId(undefined); setView('home'); setNotice('Demo data reset. You are back in free demo access.'); };
  const continueLocalDemo = () => { try { replaceLocalData(seedItems,[seedIncident],seedLocations,'free',{location:'',room:''}); } catch { setNotice('Could not prepare a separate local demo because browser storage is full.'); return; } localStorage.setItem('pv-account-mode','local'); setBulkDrafts([]); setItems(seedItems); setLocations(seedLocations); setTierState('free'); setSelectedId(seedItems[0]?.id ?? ''); setAssistedDraft(undefined); setAssistedWarnings([]); setEditingId(undefined); setView('home'); setLocalDemoAllowed(true); setNotice('Fresh local demo opened. It stays separate from signed-in account data.'); };
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
    valuationNotes: item.valuationNotes ? `${item.valuationNotes} Replacement estimate created from photo-first intake mock analysis.` : 'Created from photo-first intake mock analysis.',
    comparableListings: valuation.comparableListings
  } : item;
  const draftFromIntakeResult = (result: Awaited<ReturnType<typeof itemIntakeService.analyze>>, photo: string): InventoryItem => {
    const now = new Date().toISOString();
    return applyValuation({
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
  };
  const quickPhotoIntake = async (file: File, defaultLocation?: string, defaultRoom?: string) => {
    if (tier !== 'premium') {
      setNotice('AI photo intake is a Premium feature. Free users can still add items, photos, and manual values.');
      return;
    }
    setIntakeLoading(true);
    try {
      const photo = await optimizedPhotoDataUrl(file);
      const result = await itemIntakeService.analyze({ photoUri: photo, location: defaultLocation || locations[0]?.name || 'Home', room: defaultRoom }, true);
      const draft = draftFromIntakeResult(result, photo);
      setEditingId(undefined);
      setAssistedDraft(draft);
      setAssistedWarnings(result.warnings ?? []);
      setView('form');
      setNotice('Photo intake created a draft with AI-filled details and a mock replacement estimate.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Photo intake could not create a draft.');
    } finally {
      setIntakeLoading(false);
    }
  };
  const bulkPhotoIntake = async (files: File[], defaultLocation?: string, defaultRoom?: string) => {
    if (!files.length) return;
    if (tier !== 'premium') {
      setNotice('Bulk AI photo import is a Premium feature. Free users can still add items and photos manually.');
      return;
    }
    if (bulkDrafts.length) {
      setNotice(`You have ${bulkDrafts.length} saved photo draft${bulkDrafts.length===1?'':'s'} waiting. Resume or save that batch before starting another.`);
      setView('bulkReview');
      return;
    }
    const selectedFiles = files.slice(0, maxBulkPhotosPerBatch);
    const leftForNextBatch = files.length - selectedFiles.length;
    setBulkImportLoading(true);
    setBulkImportMessage(`Preparing ${selectedFiles.length} item photo${selectedFiles.length===1?'':'s'}...`);
    const drafts: InventoryItem[] = [];
    let unreadablePhotos = 0;
    let storageStopped = false;
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        setBulkImportMessage(`Analyzing photo ${index + 1} of ${selectedFiles.length}...`);
        try {
          const photo = await optimizedPhotoDataUrl(file);
          let draft: InventoryItem;
          try {
            const result = await itemIntakeService.analyze({ photoUri: photo, location: defaultLocation || locations[0]?.name || 'Home', room: defaultRoom }, true);
            draft = draftFromIntakeResult(result, photo);
          } catch {
            const now = new Date().toISOString();
            draft = {
              id: uid('item'),
              itemName: `Photo draft ${index + 1}`,
              category: 'Other',
              location: defaultLocation || locations[0]?.name || 'Home',
              room: defaultRoom,
              condition: 'unknown',
              photos: [photo],
              serialPhotos: [],
              markingPhotos: [],
              receiptFiles: [],
              appraisalFiles: [],
              warrantyFiles: [],
              damagePhotos: [],
              otherFiles: [],
              comparableListings: [],
              notes: 'AI could not analyze this photo. Review and fill in make, model, serial number, and value before relying on this record.',
              status: 'normal',
              createdAt: now,
              updatedAt: now
            };
          }
          const nextDrafts = [...drafts, draft];
          try {
            saveBulkDrafts(nextDrafts);
          } catch {
            storageStopped = true;
            break;
          }
          drafts.push(draft);
          setBulkDrafts(nextDrafts);
        } catch {
          unreadablePhotos += 1;
        }
      }
      if (drafts.length) {
        setView('bulkReview');
        const extra = [
          unreadablePhotos ? `${unreadablePhotos} photo${unreadablePhotos===1?' was':'s were'} unreadable and skipped` : '',
          leftForNextBatch ? `${leftForNextBatch} photo${leftForNextBatch===1?'':'s'} left for the next batch` : '',
          storageStopped ? 'browser storage is full, so the remaining photos were not added' : ''
        ].filter(Boolean);
        setNotice(`Saved ${drafts.length} draft${drafts.length===1?'':'s'} for review.${extra.length ? ` ${extra.join('; ')}.` : ''}`);
      } else {
        setNotice(storageStopped ? 'Browser storage is full, so no photo drafts were saved. Clear space or use a smaller batch.' : 'No photo drafts could be created. Try clearer image files or a smaller batch.');
      }
    } finally {
      setBulkImportLoading(false);
      setBulkImportMessage('');
    }
  };
  const saveItem = (next: InventoryItem, addAnother = false) => {
    const exists = items.some(item => item.id === next.id);
    const all = exists ? items.map(item => item.id === next.id ? next : item) : [next, ...items];
    if(!persistItems(all)) return;
    setItems(all); markLocalChange(); setSelectedId(next.id); setAssistedDraft(undefined); setAssistedWarnings([]);
    if (addAnother && !exists) {
      setView('inventory');
      setNotice('Item saved. Ready for the next photo or manual entry.');
      return;
    }
    setView('detail'); setNotice(exists ? 'Item updated.' : 'Item added to inventory.');
  };
  const updateBulkDraft = (id: string, patch: Partial<InventoryItem>) => {
    const next = bulkDrafts.map(draft => draft.id === id ? {...draft, ...patch, updatedAt:new Date().toISOString()} : draft);
    try { saveBulkDrafts(next); } catch { setNotice('This draft change could not be saved because browser storage is full.'); return; }
    setBulkDrafts(next);
  };
  const finishBulkDraft = (id: string, action: 'save'|'skip') => {
    const draft = bulkDrafts.find(item => item.id === id);
    if (!draft) return;
    const remaining = bulkDrafts.filter(item => item.id !== id);
    if (action === 'save') {
      const reviewedDraft = (draft.aiDescription || draft.aiSuggestedTitle) ? {...draft,aiFieldsReviewedAt:new Date().toISOString(),updatedAt:new Date().toISOString()} : draft;
      const all = items.some(item => item.id === reviewedDraft.id) ? items.map(item => item.id === reviewedDraft.id ? reviewedDraft : item) : [reviewedDraft, ...items];
      if(!persistItems(all)) return;
      setItems(all);
      markLocalChange();
      setNotice(`Saved ${reviewedDraft.itemName || 'draft item'}. ${remaining.length ? `${remaining.length} draft${remaining.length===1?'':'s'} left.` : 'Bulk review complete.'}`);
    } else {
      setNotice(remaining.length ? `Skipped draft. ${remaining.length} draft${remaining.length===1?'':'s'} left.` : 'Bulk review complete.');
    }
    try { remaining.length ? saveBulkDrafts(remaining) : clearBulkDrafts(); } catch { setNotice('The item was saved, but the remaining draft queue could not be updated in browser storage.'); }
    setBulkDrafts(remaining);
    if (!remaining.length) setView('inventory');
  };
  const saveAllBulkDrafts = () => {
    if (!bulkDrafts.length) return;
    const all = [...bulkDrafts.filter(draft => !items.some(item => item.id === draft.id)), ...items];
    if(!persistItems(all)) return;
    setItems(all);
    markLocalChange();
    setNotice(`Saved ${bulkDrafts.length} draft${bulkDrafts.length===1?'':'s'} to inventory. You can refine details later.`);
    try { clearBulkDrafts(); } catch { setNotice('Drafts were saved to inventory, but the saved queue could not be cleared from this browser.'); }
    setBulkDrafts([]);
    setView('inventory');
  };
  const toggleArchive = (item: InventoryItem) => { const next={...item,archivedAt:item.archivedAt?undefined:new Date().toISOString(),updatedAt:new Date().toISOString()};if(!update(next))return;setNotice(item.archivedAt?'Item restored to active inventory.':'Item archived. Incident records are preserved.');setView('inventory'); };
  const find = async () => { if(tier!=='premium'){setNotice('Replacement Value Assist lookup is a Premium feature. You can still add a manual value.');return;} setLoading(true); const r = await valuationService.findComparableValues(selected); const saved=update({...selected, estimatedReplacementValueLow:r.estimatedReplacementValueLow, estimatedReplacementValueHigh:r.estimatedReplacementValueHigh, estimatedReplacementValueSelected:r.suggestedReplacementValue, valuationCurrency:'USD', valuationConfidence:r.confidence, valuationSourceSummary:r.sourceSummary, valuationCheckedAt:new Date().toISOString(), comparableListings:r.comparableListings, updatedAt:new Date().toISOString()}); setLoading(false); if(saved)setNotice('Comparable values found and saved.'); };
  const choose = (price: number) => { if(update({...selected, estimatedReplacementValueSelected:price, valuationNotes:'Selected from a saved comparable', updatedAt:new Date().toISOString()}))setNotice('Selected comparable value saved.'); };
  const saveManual = () => { const value=Number(manual); if(value>0&&update({...selected,userEnteredValue:value,updatedAt:new Date().toISOString()})){setManual('');setNotice('Manual value saved.');} };
  const saveQuickSerial = () => { const value=quickSerial.trim(); if(value&&update({...selected,serialNumber:value,updatedAt:new Date().toISOString()})){setQuickSerial('');setNotice('Serial number saved.');} };
  const nav = (target: Exclude<View,'detail'|'form'|'bulkReview'>, label: string, icon: ReactNode) => <button className={view===target?'nav active':'nav'} onClick={()=>setView(target)}>{icon}<span>{label}</span></button>;
  if (!cloudStatus.authenticated && !localDemoAllowed) return <AccountGate status={cloudStatus} onContinueLocal={continueLocalDemo} onStatusChange={setCloudStatus}/>;
  return <div className="shell">
    <aside><div className="brand"><ShieldCheck/><b>ProofVault</b></div><p className="eyebrow">PROPERTY EVIDENCE</p>{nav('home','Overview',<Home/>)}{nav('inventory','Inventory',<Package/>)}{nav('locations','Locations',<MapPin/>)}{nav('incident','Incident',<FileText/>)}<div className="spacer"/>{nav('settings','Settings',<Settings/>)}<div className="privacy"><LockKeyhole/><div><b>{cloudStatus.authenticated?'Cloud account':'Local demo'}</b><small>{cloudStatus.authenticated?cloudStatus.email:'Data stays in this browser'}</small></div></div></aside>
    <main>{notice&&<button className="toast" onClick={()=>setNotice('')} aria-label="Dismiss notification"><Check/>{notice}</button>}
      <AccountStatusBanner status={cloudStatus} tier={tier} syncState={cloudSyncState} syncMessage={cloudSyncMessage}/>
      {view==='home'&&<HomeView items={items} tier={tier} open={open} add={startNew} startBulk={bulkPhotoIntake} bulkLoading={bulkImportLoading} bulkMessage={bulkImportMessage} pendingBulkDrafts={bulkDrafts.length} resumeBulk={()=>setView('bulkReview')} upgrade={()=>setTier('premium')} review={()=>setView('inventory')} incident={()=>setView('incident')}/>} {view==='inventory'&&<InventoryView items={items} tier={tier} upgrade={()=>setTier('premium')} localChange={markLocalChange} open={open} edit={startEdit} add={startNew} bulkIntake={bulkPhotoIntake} bulkLoading={bulkImportLoading} bulkMessage={bulkImportMessage} pendingBulkDrafts={bulkDrafts.length} resumeBulk={()=>setView('bulkReview')} quickIntake={quickPhotoIntake} intakeLoading={intakeLoading}/>} {view==='bulkReview'&&<BulkReviewView drafts={bulkDrafts} update={updateBulkDraft} save={id=>finishBulkDraft(id,'save')} skip={id=>finishBulkDraft(id,'skip')} saveAll={saveAllBulkDrafts} back={()=>setView('inventory')}/>} {view==='detail'&&selected&&<DetailView item={selected} tier={tier} loading={loading} back={()=>setView('inventory')} edit={()=>startEdit(selected.id)} archive={()=>toggleArchive(selected)} find={find} choose={choose} manual={manual} setManual={setManual} saveManual={saveManual} quickSerial={quickSerial} setQuickSerial={setQuickSerial} saveQuickSerial={saveQuickSerial} upgrade={()=>setTier('premium')}/>} {view==='form'&&<ItemForm locations={locations} tier={tier} onUpgrade={()=>setTier('premium')} item={editingId ? items.find(item=>item.id===editingId) : assistedDraft} assisted={Boolean(assistedDraft)} assistedWarnings={assistedWarnings} onCancel={()=>{setAssistedDraft(undefined);setAssistedWarnings([]);setView(editingId?'detail':'inventory')}} onSave={saveItem} onSaveAndAddAnother={next=>saveItem(next,true)}/>} {view==='locations'&&<LocationsManager locations={locations} items={items} onChange={updateLocations}/>} {view==='incident'&&<IncidentManager items={items} tier={tier} onLocalChange={markLocalChange}/>} {view==='settings'&&<SettingsView items={items} locations={locations} tier={tier} status={cloudStatus} syncState={cloudSyncState} syncMessage={cloudSyncMessage} setTier={setTier} restore={restoreBackup} restoreCloud={restoreCloudSnapshot} resetDemoData={resetDemoData}/>}
    </main>
  </div>;
}

function PageHead({kicker,title,sub}:{kicker:string;title:string;sub:string}){return <header><p className="eyebrow green">{kicker}</p><h1>{title}</h1><p className="sub">{sub}</p></header>}
function AccountStatusBanner({status,tier,syncState,syncMessage}:{status:CloudStatus;tier:SubscriptionTier;syncState:'idle'|'loading'|'saving'|'saved'|'error';syncMessage:string}){
  const signedIn=status.authenticated;
  const syncLabel=signedIn?(syncMessage||'Autosave ready'):'Local demo only';
  return <section className={`accountStatusBanner ${signedIn?'cloud':'local'} ${syncState}`} aria-label="Account and sync status"><div><Cloud/><span>{signedIn?'Signed-in account':'Local demo'}</span></div><div><ShieldCheck/><span>{tier==='premium'?'Premium demo access':'Free demo access'}</span></div><small>{syncLabel}</small></section>;
}
function ItemIcon({category}:{category:string}){return <div className="itemicon">{category==='Jewelry'?<Tag/>:<Package/>}</div>}
function Score({item}:{item:InventoryItem}){const s=completenessScore(item);return <div className="score"><span style={{width:`${s.score}%`}}/><small>{s.score}%</small></div>}
function ItemRow({item,open}:{item:InventoryItem;open:(id:string)=>void}){return <button className="itemrow" onClick={()=>open(item.id)}><ItemIcon category={item.category}/><div><b>{item.itemName}</b><small>{item.location} - {item.serialNumber||item.ownerMarking||'Needs identifier'}</small></div><Score item={item}/><ChevronRight/></button>}

function HomeView({items,tier,open,add,startBulk,bulkLoading,bulkMessage,pendingBulkDrafts,resumeBulk,upgrade,review,incident}:{items:InventoryItem[];tier:SubscriptionTier;open:(id:string)=>void;add:()=>void;startBulk:(files:File[],location?:string,room?:string)=>void;bulkLoading:boolean;bulkMessage:string;pendingBulkDrafts:number;resumeBulk:()=>void;upgrade:()=>void;review:()=>void;incident:()=>void}){
  const active=items.filter(item=>!item.archivedAt);
  const reviewTotal=itemReviewBacklog(active,1).total;
  const weak=active.map(item=>({item,...completenessScore(item)})).filter(entry=>entry.score<70).sort((a,b)=>a.score-b.score).slice(0,3);
  const bulkInputRef=useRef<HTMLInputElement>(null);
  const isPremium=tier==='premium';
  return <><PageHead kicker="START HERE" title="Document your home without the paperwork." sub="Take photos first. ProofVault helps turn them into useful records you can review and save."/>{pendingBulkDrafts>0&&<section className="panel resumeBatch"><div><p className="eyebrow green">SAVED PHOTO BATCH</p><h2>{pendingBulkDrafts} draft{pendingBulkDrafts===1?'':'s'} ready to review</h2><p>Your batch is saved in this browser. Finish the key fields now or save the drafts to inventory for later.</p></div><button className="primary" onClick={resumeBulk}>Resume review</button></section>}<section className="panel startPanel"><div><p className="eyebrow green">FASTEST PATH</p><h2>Walk around and add many photos</h2><p>Choose one clear overview photo per item. For a reliable web demo, add up to {maxBulkPhotosPerBatch} items per batch; your saved review queue lets you keep going room by room. Premium drafts item names, make, model, serial-number candidates, and replacement estimates for quick review.</p>{bulkMessage&&<small className="bulkProgress">{bulkMessage}</small>}</div><button className="primary heroAction" disabled={bulkLoading} onClick={()=>isPremium?bulkInputRef.current?.click():upgrade()}><Camera/>{bulkLoading?'Building drafts...':isPremium?'Add many photos':'Enable Premium demo features'}</button><input ref={bulkInputRef} className="visuallyHiddenInput" type="file" accept="image/*" multiple aria-label="Choose many item photos" onChange={event=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';void startBulk(files)}}/></section><div className="quickActions"><button onClick={add}><Plus/><b>Add one item</b><span>Manual entry with photos, make, model, SN, and value.</span></button><button onClick={review}><TriangleAlert/><b>Review records</b><span>{reviewTotal?`${reviewTotal} quick check${reviewTotal===1?'':'s'} waiting`:'Nothing urgent right now'}</span></button><button onClick={incident}><FileText/><b>Create incident packet</b><span>Build a police or insurance export from saved items.</span></button></div><div className="stats simplified"><div><Package/><span><b>{active.length}</b>Items saved</span></div><div><ShieldCheck/><span><b>{active.filter(i=>i.make||i.model||i.serialNumber).length}</b>With make, model, or SN</span></div><div><Sparkles/><span><b>{active.filter(i=>i.estimatedReplacementValueSelected||i.userEnteredValue).length}</b>With value</span></div></div>{weak.length>0&&<section className="panel guidancePanel"><div className="sectionTitle"><div><p className="eyebrow">BEST NEXT FIXES</p><h2>Make these records stronger</h2><small>Make, model, and serial number matter most for value and recovery.</small></div><span>{weak.length} priority</span></div>{weak.map(entry=><button key={entry.item.id} onClick={()=>open(entry.item.id)}><TriangleAlert/><div><b>{entry.item.itemName}</b><small>{entry.feedback}</small></div><strong>{entry.score}%</strong><ChevronRight/></button>)}</section>}<section className="panel"><div className="sectionTitle"><div><p className="eyebrow">RECENT INVENTORY</p><h2>Recently saved</h2></div><span className="tier">{isPremium?'Premium demo access':'Free demo access'}</span></div>{active.length?active.slice(0,4).map(item=><ItemRow key={item.id} item={item} open={open}/>):<div className="empty"><Package/><h3>No items yet</h3><p>Start with a batch of photos or add one item manually.</p></div>}</section></>;
}
function ReviewQueue({items,open,edit}:{items:InventoryItem[];open:(id:string)=>void;edit:(id:string)=>void}){const{records,total,issueSummary}=itemReviewBacklog(items,4);const first=records[0];if(!records.length)return <section className="panel reviewQueue clear"><div className="sectionTitle"><div><p className="eyebrow">BULK REVIEW QUEUE</p><h2>All quick checks are clear</h2><small>{items.length ? 'No active item currently needs AI review, make/model, serial verification, value, photo, receipt, or appraisal follow-up.' : 'Add items with fast photo intake, then review tasks will appear here.'}</small></div><span className="ok"><Check/>Clear</span></div></section>;return <section className="panel reviewQueue"><div className="sectionTitle"><div><p className="eyebrow">BULK REVIEW QUEUE</p><h2>Quick checks before you move on</h2><small>Sorted so make/model, likely AI-prefill, and serial checks float to the top.</small></div><div className="queueActions"><span>{records.length} of {total} shown</span>{first&&<button onClick={()=>edit(first.item.id)}>Review next</button>}</div></div><div className="reviewChips" aria-label="Review backlog by issue type">{issueSummary.map(issue=><span key={issue.id}>{issue.label}: {issue.count}</span>)}</div>{records.map(record=><button key={record.item.id} onClick={()=>open(record.item.id)}><TriangleAlert/><div><b>{record.item.itemName}</b><small>{record.flags[0].label} - {record.flags[0].detail}</small><span className="reviewReasons">{record.flags.map(flag=>flag.label).join(' - ')}</span></div><ChevronRight/></button>)}</section>}
function BulkReviewView({drafts,update,save,skip,saveAll,back}:{drafts:InventoryItem[];update:(id:string,patch:Partial<InventoryItem>)=>void;save:(id:string)=>void;skip:(id:string)=>void;saveAll:()=>void;back:()=>void}){
  const current=drafts[0];
  if(!current)return <section className="panel empty"><Check/><h2>Bulk review complete</h2><p>All photo drafts have been handled.</p><button className="primary" onClick={back}>Back to inventory</button></section>;
  const photo=current.photos.find(value=>value.startsWith('data:image'))??current.photos[0];
  const setText=(key:keyof InventoryItem)=>(event:ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>update(current.id,{[key]:event.target.value} as Partial<InventoryItem>);
  const setValue=(event:ChangeEvent<HTMLInputElement>)=>update(current.id,{userEnteredValue:event.target.value?Number(event.target.value):undefined});
  return <><div className="detailToolbar"><button className="back" onClick={back}><ArrowLeft/>Inventory</button><div className="bulkCount">{drafts.length} draft{drafts.length===1?'':'s'} waiting</div></div><section className="panel bulkReviewHero"><div><p className="eyebrow green">QUICK REVIEW</p><h1>Check the fields that matter most.</h1><p>Make and model drive replacement value. Serial number helps identify lost or stolen property. This saved batch survives refreshes, so you can stop and return later.</p></div><button className="primary" onClick={saveAll}><Check/>Save all drafts for later</button></section><section className="panel bulkDraftCard">{photo&&photo.startsWith('data:image')?<img src={photo} alt={`${current.itemName || 'Draft item'} photo`} />:<div className="photoPlaceholder"><Camera/>Photo draft</div>}<div className="bulkDraftFields"><div className="reviewStep"><span>1</span><b>Name the item</b></div><label>Item name<input value={current.itemName} onChange={setText('itemName')} placeholder="Cordless drill, TV, bicycle..."/></label><div className="fields three priorityFields"><label>Make<input value={current.make??''} onChange={setText('make')} placeholder="Milwaukee"/></label><label>Model<input value={current.model??''} onChange={setText('model')} placeholder="M18 2801-20"/></label><label>Serial number (SN)<input value={current.serialNumber??''} onChange={setText('serialNumber')} placeholder="Verify from label"/></label></div><div className="fields two"><label>Location<input value={current.location} onChange={setText('location')}/></label><label>Your value (optional)<input type="number" min="0" step="0.01" value={current.userEnteredValue??''} onChange={setValue} placeholder="Enter your own replacement value"/></label></div>{current.estimatedReplacementValueSelected&&<p className="estimateHint">AI estimate: {money(current.estimatedReplacementValueSelected)} - {current.valuationConfidence || 'unknown'} confidence</p>}<label>Quick notes<textarea value={current.notes??''} onChange={setText('notes')} placeholder="Accessories, condition, visible details..."/></label><div className="bulkReviewActions"><button className="primary" onClick={()=>save(current.id)}><Check/>Save this item</button><button onClick={()=>skip(current.id)}>Skip photo</button></div><p className="helper">One uploaded photo creates one item draft. For multiple angles of the same item, save this record first, then attach more photos from the item screen. AI-filled make, model, and SN should be verified against the item, label, receipt, or packaging.</p></div></section></>;
}
function InventoryView({items,tier,upgrade,localChange,open,edit,add,bulkIntake,bulkLoading,bulkMessage,pendingBulkDrafts,resumeBulk,quickIntake,intakeLoading}:{items:InventoryItem[];tier:SubscriptionTier;upgrade:()=>void;localChange:()=>void;open:(id:string)=>void;edit:(id:string)=>void;add:()=>void;bulkIntake:(files:File[],defaultLocation?:string,defaultRoom?:string)=>void;bulkLoading:boolean;bulkMessage:string;pendingBulkDrafts:number;resumeBulk:()=>void;quickIntake:(file:File,defaultLocation?:string,defaultRoom?:string)=>void;intakeLoading:boolean}){
  const[query,setQuery]=useState('');
  const[showArchived,setShowArchived]=useState(false);
  const initialBatch=loadBatchDefaults();
  const[batchLocation,setBatchLocationState]=useState(initialBatch.location);
  const[batchRoom,setBatchRoomState]=useState(initialBatch.room);
  const isPremium=tier==='premium';
  const setBatchLocation=(value:string)=>{setBatchLocationState(value);try{saveBatchDefaults({location:value,room:batchRoom});localChange()}catch{}};
  const setBatchRoom=(value:string)=>{setBatchRoomState(value);try{saveBatchDefaults({location:batchLocation,room:value});localChange()}catch{}};
  const fileInputRef=useRef<HTMLInputElement>(null);
  const bulkInputRef=useRef<HTMLInputElement>(null);
  const active=items.filter(item=>!item.archivedAt);
  const locationOptions=Array.from(new Set(items.map(item=>item.location).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const filtered=items.filter(item=>(showArchived?Boolean(item.archivedAt):!item.archivedAt)&&[item.itemName,item.category,item.location,item.make,item.model,item.serialNumber].some(value=>value?.toLowerCase().includes(query.toLowerCase())));
  return <><div className="pageTitleRow"><PageHead kicker="INVENTORY" title="Documented property" sub="Add batches first, then review the important details: make, model, SN, and value."/><button className="primary addButton" onClick={add}><Plus/>Add one item</button></div>{pendingBulkDrafts>0&&<section className="panel resumeBatch"><div><p className="eyebrow green">SAVED PHOTO BATCH</p><h2>{pendingBulkDrafts} draft{pendingBulkDrafts===1?'':'s'} ready to review</h2><p>These drafts survive a refresh. Save the key facts one by one, or save all drafts to inventory for later.</p></div><button className="primary" onClick={resumeBulk}>Resume review</button></section>}<section className="panel intakePanel bulkFirst"><div><p className="eyebrow green">{isPremium?'BULK PHOTO IMPORT':'PREMIUM DEMO FEATURE'}</p><h2>{isPremium?'Add many photos at once':'Bulk AI import is a Premium demo feature'}</h2><p>{isPremium?`Choose one clear overview photo per item. For a reliable browser batch, add up to ${maxBulkPhotosPerBatch} items at once; saved drafts let you continue room by room.`:'Free users can add items manually. Premium demo access unlocks bulk photo import, AI descriptions, make/model help, SN recognition, and value comparison.'}</p><small>{bulkMessage||'Tip: set the room first so every draft starts in the right place.'}</small><div className="batchDefaults"><label>Apply location to new photos<input list="batch-locations" value={batchLocation} onChange={event=>setBatchLocation(event.target.value)} placeholder="Garage, storage unit, bedroom?"/><datalist id="batch-locations">{locationOptions.map(location=><option key={location} value={location}/>)}</datalist></label><label>Room / area<input value={batchRoom} onChange={event=>setBatchRoom(event.target.value)} placeholder="Shelf, closet, tool cabinet?"/></label></div></div><div className="intakeButtons"><button className="primary intakeButton" type="button" disabled={bulkLoading} onClick={()=>isPremium?bulkInputRef.current?.click():upgrade()}><Camera/>{bulkLoading?'Building drafts...':isPremium?'Add many photos':'Enable Premium demo features'}</button><button className="secondaryAction" type="button" disabled={intakeLoading} onClick={()=>isPremium?fileInputRef.current?.click():upgrade()}><Plus/>{intakeLoading?'Analyzing...':isPremium?'Add one photo':'Premium one-photo AI'}</button></div><input ref={bulkInputRef} className="visuallyHiddenInput" type="file" aria-label="Choose many item photos for premium bulk import" accept="image/*" multiple disabled={bulkLoading||!isPremium} onChange={event=>{const files=Array.from(event.currentTarget.files??[]);if(files.length)bulkIntake(files,batchLocation.trim()||undefined,batchRoom.trim()||undefined);event.currentTarget.value='';}}/><input ref={fileInputRef} className="visuallyHiddenInput" type="file" aria-label="Choose one item photo for premium AI intake" accept="image/*" capture="environment" disabled={intakeLoading||!isPremium} onChange={event=>{const file=event.currentTarget.files?.[0];if(file)quickIntake(file,batchLocation.trim()||undefined,batchRoom.trim()||undefined);event.currentTarget.value='';}}/></section><ReviewQueue items={active} open={open} edit={edit}/><div className="inventoryTools"><div className="search"><Search/><input aria-label="Search inventory" placeholder="Search by item, make, model, serial number, or room" value={query} onChange={event=>setQuery(event.target.value)}/></div><button className={showArchived?'selected':''} onClick={()=>setShowArchived(!showArchived)}>{showArchived?'Showing archived':'View archived'} ({items.filter(item=>item.archivedAt).length})</button></div><section className="panel">{filtered.length?filtered.map(item=><ItemRow key={item.id} item={item} open={open}/>):<div className="empty"><Search/><h3>No matching items</h3><p>{showArchived?'No archived items match this search.':'Try a different item name, make, model, serial number, or location.'}</p></div>}</section></>;
}

interface DetailProps{item:InventoryItem;tier:SubscriptionTier;loading:boolean;back:()=>void;edit:()=>void;archive:()=>void;find:()=>void;choose:(price:number)=>void;manual:string;setManual:(value:string)=>void;saveManual:()=>void;quickSerial:string;setQuickSerial:(value:string)=>void;saveQuickSerial:()=>void;upgrade:()=>void}
function DetailView({item,tier,loading,back,edit,archive,find,choose,manual,setManual,saveManual,quickSerial,setQuickSerial,saveQuickSerial,upgrade}:DetailProps){const c=completenessScore(item);const best=item.comparableListings[0];const reviewFlags=itemReviewFlags(item);const[confirmArchive,setConfirmArchive]=useState(false);return <><div className="detailToolbar"><button className="back" onClick={back}><ArrowLeft/>Inventory</button><div className="detailActions"><button onClick={edit}><Pencil/>Edit item</button><button className={item.archivedAt?'restoreButton':'archiveButton'} onClick={()=>item.archivedAt?archive():setConfirmArchive(true)}>{item.archivedAt?'Restore item':'Archive item'}</button></div></div>{confirmArchive&&<div className="confirmStrip"><div><b>Archive this item?</b><span>It will leave active inventory but remain available to existing incident records.</span></div><button onClick={()=>setConfirmArchive(false)}>Cancel</button><button className="dangerButton" onClick={archive}>Archive</button></div>}<div className="detailHead"><ItemIcon category={item.category}/><div><p className="eyebrow green">{item.category}{item.archivedAt?' - ARCHIVED':''}</p><h1>{item.itemName}</h1><p>{item.make} {item.model} - {item.location}</p></div><div className="scorebox"><b>{c.score}%</b><span>{c.label}</span></div></div><div className="grid"><div>{reviewFlags.length>0&&<section className="panel reviewChecklist"><div className="sectionTitle"><div><p className="eyebrow">REVIEW BEFORE RELYING ON THIS RECORD</p><h2>Finish these quick checks</h2></div><button onClick={edit}>Edit details</button></div>{reviewFlags.map(flag=><div className={`reviewFlag ${flag.priority}`} key={flag.id}><TriangleAlert/><div><b>{flag.label}</b><small>{flag.detail}</small>{flag.id==='verify-serial'&&<div className="quickValue"><input aria-label="Quick serial number" value={quickSerial} onChange={e=>setQuickSerial(e.target.value)} placeholder={item.serialNumber?.startsWith('VERIFY-')?'Enter confirmed serial':item.serialNumber||'Enter confirmed serial'}/><button onClick={saveQuickSerial}>Save serial</button></div>}{flag.id==='add-value'&&<div className="quickValue"><input aria-label="Quick manual value" type="number" value={manual} onChange={e=>setManual(e.target.value)} placeholder={item.userEnteredValue?`Manual value: ${money(item.userEnteredValue)}`:'Enter value now'}/><button onClick={saveManual}>Save value</button></div>}</div></div>)}</section>}<section className="panel facts"><div className="sectionTitle"><h2>Identity & evidence</h2><span className="ok"><Check/>Documented</span></div>{item.photos.some(photo=>photo.startsWith('data:image'))&&<div className="detailPhotos">{item.photos.filter(photo=>photo.startsWith('data:image')).map((photo,index)=><img key={`${photo.slice(0,24)}-${index}`} src={photo} alt={`${item.itemName} photo ${index+1}`}/>)}</div>}<dl><div><dt>Serial number</dt><dd>{item.serialNumber||'Not recorded'}</dd></div><div><dt>Owner-applied marking</dt><dd>{item.ownerMarking||'Not recorded'}</dd></div><div><dt>Marking location</dt><dd>{item.markingLocation||'Not recorded'}</dd></div><div><dt>Condition</dt><dd>{item.condition}</dd></div></dl><p className="feedback">{c.feedback}</p></section><section className="panel valuation"><div className="valueTitle"><div className="spark"><Sparkles/></div><div><p className="eyebrow green">PREMIUM DEMO ASSIST</p><h2>Replacement Value Assist</h2></div>{tier==='premium'&&<span className="premium">PREMIUM DEMO</span>}</div>
  {item.estimatedReplacementValueSelected ? <ValuationResults item={item} best={best} choose={choose}/> : tier==='free' ? <div className="locked"><LockKeyhole/><h3>Know what replacement may cost</h3><p>Premium demo access finds and saves comparable new, used, and refurbished listings. Manual values stay available on free demo access.</p><button className="primary" onClick={upgrade}>Enable Premium demo features</button></div> : <div className="empty"><Sparkles/><h3>No estimate yet</h3><p>Search mocked marketplace sources to build an approximate replacement range.</p></div>}
  <div className="actions"><button className="primary" disabled={tier==='free'||loading} onClick={find}>{loading?'Checking sources...':'Estimate replacement cost'}</button>{item.estimatedReplacementValueSelected&&<button onClick={()=>choose(item.estimatedReplacementValueSelected!)}>Use this value</button>}</div><div className="manual"><input aria-label="Manual value" type="number" value={manual} onChange={e=>setManual(e.target.value)} placeholder={item.userEnteredValue?`Manual value: ${money(item.userEnteredValue)}`:'Enter manual value'}/><button onClick={saveManual}>Add manual value</button></div><div className="checked">Checked: {dateTime(item.valuationCheckedAt)}{item.valuationSourceSummary&&` - ${item.valuationSourceSummary}`}</div><p className="disclaimer">{VALUATION_DISCLAIMER}</p></section></div><aside className="side"><section className="panel"><p className="eyebrow">VALUE SUMMARY</p><div className="bigvalue">{money(item.userEnteredValue)}</div><small>User-entered value</small><hr/><div className="bigvalue">{money(item.estimatedReplacementValueSelected)}</div><small>Replacement Value Assist</small></section><section className="panel"><p className="eyebrow">DOCUMENTATION</p><p>{item.photos.length} item photo</p><p>{item.serialPhotos.length+item.markingPhotos.length} identifier photos</p><p>{item.receiptFiles.length} receipt</p><p>{item.appraisalFiles.length} appraisal</p></section></aside></div></>}

function ValuationResults({item,best,choose}:{item:InventoryItem;best?:InventoryItem['comparableListings'][number];choose:(n:number)=>void}){return <><div className="estimate"><div><small>ESTIMATED REPLACEMENT RANGE</small><b>{money(item.estimatedReplacementValueLow)} - {money(item.estimatedReplacementValueHigh)}</b><span>Selected estimate: {money(item.estimatedReplacementValueSelected)}</span></div><div className={`confidence ${item.valuationConfidence}`}>{item.valuationConfidence} confidence</div></div>{best&&<><p className="eyebrow">BEST COMPARABLE</p><div className="comparable"><div><b>{best.title}</b><small>{best.marketplace} - {best.condition} - {best.matchReason}</small></div><strong>{money(best.price)}</strong><a href={best.url} target="_blank" rel="noreferrer" aria-label="Open comparable listing"><ExternalLink/></a></div></>}{item.comparableListings.slice(1).map(x=><div className="comparable minor" key={x.id}><div><b>{x.title}</b><small>{x.marketplace} - {x.condition}</small></div><strong>{money(x.price)}</strong><button className="textBtn" onClick={()=>choose(x.price)}>Use this value</button></div>)}</>}

function BrowserStoragePanel(){const[estimate,setEstimate]=useState<{usage?:number;quota?:number}>({});useEffect(()=>{let active=true;navigator.storage?.estimate?.().then(result=>{if(active)setEstimate({usage:result.usage,quota:result.quota})}).catch(()=>undefined);return()=>{active=false}},[]);const usage=estimate.usage??0;const quota=estimate.quota??0;const percent=quota?Math.min(100,Math.round((usage/quota)*100)):0;const mb=(bytes:number)=>(bytes/1024/1024).toFixed(bytes>10_000_000?1:2);return <section className="panel settings"><h2>Browser storage</h2><p>This web demo stores inventory, incidents, and uploaded evidence in this browser. For large real inventories, the mobile app will use app-private file storage instead.</p>{quota?<><div className="storageMeter" aria-label={`Browser storage ${percent}% used`}><span style={{width:`${percent}%`}}/></div><small>{mb(usage)} MB used of about {mb(quota)} MB available to this browser.</small></>:<small>Storage estimate is not available in this browser.</small>}</section>}

function SettingsView({items,locations,tier,status,syncState,syncMessage,setTier,restore,restoreCloud,resetDemoData}:{items:InventoryItem[];locations:LocationRecord[];tier:SubscriptionTier;status:CloudStatus;syncState:'idle'|'loading'|'saving'|'saved'|'error';syncMessage:string;setTier:(tier:SubscriptionTier)=>void;restore:(backup:ProofVaultBackup)=>boolean;restoreCloud:(snapshot:CloudSnapshot)=>boolean;resetDemoData:()=>void}){const[confirmReset,setConfirmReset]=useState(false);return <><PageHead kicker="SETTINGS" title="Settings & privacy" sub="Manage account sync, local backups, privacy, security placeholders, and prototype feature access."/><section className="panel settings accountModePanel"><h2>Current workspace</h2><p>{status.authenticated?`Signed in as ${status.email}. Inventory, incidents, locations, prototype access setting, and batch defaults autosave to this account.`:'Local demo mode. Data stays in this browser unless you sign in or export a backup.'}</p><span className={`syncPill ${syncState}`}>{status.authenticated?(syncMessage||'Autosave ready'):'Not syncing'}</span></section><section className="panel settings"><h2>Prototype feature access</h2><div className="segmented"><button className={tier==='free'?'selected':''} onClick={()=>setTier('free')}>Free demo access</button><button className={tier==='premium'?'selected premiumBtn':''} onClick={()=>setTier('premium')}>Premium demo access</button></div><p>This switch is a prototype test setting, not a paid subscription. Premium demo access enables AI photo intake, AI-generated descriptions, serial recognition from photos, automatic comparable lookup, saved estimates, and marketplace links in incident exports. Real customer access will be enforced by a secure server-side subscription system.</p></section><CloudSyncPanel items={items} locations={locations} tier={tier} onRestoreCloud={restoreCloud}/><BrowserStoragePanel/><BackupPanel items={items} locations={locations} tier={tier} onRestore={restore}/>{!status.authenticated&&<section className="panel settings"><h2>Demo reset</h2><p>Use this before a walkthrough or when browser storage gets crowded. Download a backup first if you want to keep your current local records.</p>{confirmReset?<div className="restoreConfirm"><div><b>Reset this browser demo?</b><small>This replaces local inventory, incidents, locations, prototype access, saved photo drafts, and batch defaults with the original sample data.</small></div><button onClick={()=>setConfirmReset(false)}>Cancel</button><button className="dangerButton" onClick={resetDemoData}>Reset demo data</button></div>:<button className="dangerButton" onClick={()=>setConfirmReset(true)}>Reset demo data</button>}</section>}<PrivacySecurityPanel/><AboutPanel/></>}
