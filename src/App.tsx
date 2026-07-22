import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, ChevronRight, Cloud, ExternalLink, FileText, Home, LockKeyhole, MapPin, Package, Pencil, Plus, Search, Settings, ShieldCheck, Sparkles, Tag, TriangleAlert } from 'lucide-react';
import { clearBulkDrafts, loadBatchDefaults, loadBulkDrafts, loadIncidents, loadItems, loadLocations, loadPremiumAiAssistUsage, loadTier, loadTrialPhotoUses, premiumAiAssistLimit, PremiumAiAssistUsage, replaceLocalData, saveBatchDefaults, saveBulkDrafts, saveItems, saveLocations, savePremiumAiAssistUsage, saveTier, saveTrialPhotoUses, seedIncident, seedItems, seedLocations, trialPhotoLimit } from './data';
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
import { analysisQueueService, analysisStorageReference, AnalysisJob } from './services/analysisQueueService';
import { evidenceStorageService, isSupabaseStorageReference } from './services/evidenceStorageService';

type View = 'home' | 'inventory' | 'bulkReview' | 'detail' | 'form' | 'locations' | 'incident' | 'settings';
const emptyAccountLocations:LocationRecord[]=[{id:'loc-home',name:'Home',notes:'Default location for your first items',createdAt:new Date().toISOString()}];
const maxBulkPhotosPerBatch = 12;
let queuePresentation:{jobs:AnalysisJob[];pendingDrafts:number;resumeReview:()=>void;signedIn:boolean;canUseAiPhoto?:boolean;startItemPhotos?:(files:File[])=>void;retryFailed?:(jobId:string)=>void}={jobs:[],pendingDrafts:0,resumeReview:()=>undefined,signedIn:false};

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
  const [queuedAnalysisCount, setQueuedAnalysisCount] = useState(0);
  const [analysisJobs, setAnalysisJobs] = useState<AnalysisJob[]>([]);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({ configured: cloudPersistenceService.isConfigured(), authenticated: false });
  const [localDemoAllowed, setLocalDemoAllowed] = useState(() => localStorage.getItem('pv-account-mode') === 'local');
  const [trialScope, setTrialScope] = useState('local');
  const [trialPhotoUses, setTrialPhotoUses] = useState(() => loadTrialPhotoUses('local'));
  const [premiumAiUsage, setPremiumAiUsage] = useState<PremiumAiAssistUsage>(() => loadPremiumAiAssistUsage('local'));
  const [cloudReadyToSync, setCloudReadyToSync] = useState(false);
  const [syncRevision, setSyncRevision] = useState(0);
  const [cloudSyncState, setCloudSyncState] = useState<'idle'|'loading'|'saving'|'saved'|'error'>('idle');
  const [cloudSyncMessage, setCloudSyncMessage] = useState('');
  const skipNextCloudAutosave = useRef(false);
  const adoptingQueuedJobs = useRef(false);
  const selected = items.find(item => item.id === selectedId) ?? items[0];
  const trialPhotosRemaining = Math.max(0, trialPhotoLimit - trialPhotoUses);
  const premiumAiAssistsRemaining = Math.max(0, premiumAiAssistLimit - premiumAiUsage.uses);
  const canUseAiPhoto = tier === 'premium' ? premiumAiAssistsRemaining > 0 : trialPhotosRemaining > 0;
  queuePresentation={jobs:analysisJobs,pendingDrafts:bulkDrafts.length,resumeReview:()=>setView('bulkReview'),signedIn:cloudStatus.authenticated};
  useEffect(()=>{setManual('');setQuickSerial('');},[selectedId]);
  const markLocalChange = () => setSyncRevision(value => value + 1);
  const hydrateCloudAccount = async () => {
    localStorage.removeItem('pv-account-mode');
    setLocalDemoAllowed(false);
    setCloudReadyToSync(false);
    setCloudSyncState('loading');
    setCloudSyncMessage('Loading your cloud account...');
    try {
      const status = await cloudPersistenceService.status();
      const nextTrialScope = status.userId ? `account:${status.userId}` : 'account';
      setTrialScope(nextTrialScope);
      setTrialPhotoUses(loadTrialPhotoUses(nextTrialScope));
      setPremiumAiUsage(loadPremiumAiAssistUsage(nextTrialScope));
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
  const resetDemoData = () => { if(cloudStatus.authenticated){setNotice('Demo reset is only available in local demo mode so sample data is not saved to your account.');return;} const freshPremiumUsage={cycleStartedAt:new Date().toISOString(),uses:0}; try { replaceLocalData(seedItems,[seedIncident],seedLocations,'free',{location:'',room:''}); saveTrialPhotoUses('local',0); savePremiumAiAssistUsage('local',freshPremiumUsage); } catch { setNotice('Could not reset demo data in this browser. Existing browser data was kept.'); return; } setTrialScope('local'); setTrialPhotoUses(0); setPremiumAiUsage(freshPremiumUsage); setBulkDrafts([]); setItems(seedItems); setLocations(seedLocations); setTierState('free'); setSelectedId(seedItems[0]?.id ?? ''); setAssistedDraft(undefined); setAssistedWarnings([]); setEditingId(undefined); setView('home'); setNotice('Demo data reset. Your three Try Before You Buy photo analyses are available again.'); };
  const continueLocalDemo = () => { const freshPremiumUsage={cycleStartedAt:new Date().toISOString(),uses:0}; try { replaceLocalData(seedItems,[seedIncident],seedLocations,'free',{location:'',room:''}); saveTrialPhotoUses('local',0); savePremiumAiAssistUsage('local',freshPremiumUsage); } catch { setNotice('Could not prepare a separate local demo because browser storage is full.'); return; } localStorage.setItem('pv-account-mode','local'); setTrialScope('local'); setTrialPhotoUses(0); setPremiumAiUsage(freshPremiumUsage); setBulkDrafts([]); setItems(seedItems); setLocations(seedLocations); setTierState('free'); setSelectedId(seedItems[0]?.id ?? ''); setAssistedDraft(undefined); setAssistedWarnings([]); setEditingId(undefined); setView('home'); setLocalDemoAllowed(true); setNotice('Fresh local demo opened with three Try Before You Buy photo analyses. It stays separate from signed-in account data.'); };
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
  const draftFromIntakeResult = (result: Awaited<ReturnType<typeof itemIntakeService.analyze>>, photo: string|string[], sourceDraft=result.draft, valuation=sourceDraft===result.draft?result.valuation:undefined): InventoryItem => {
    const now = new Date().toISOString();
    const photos=Array.isArray(photo)?photo:[photo];
    return applyValuation({
      ...sourceDraft,
      id: uid('item'),
      photos: photos.slice(0,1),
      serialPhotos: photos.slice(1),
      markingPhotos: [],
      receiptFiles: [],
      appraisalFiles: [],
      warrantyFiles: [],
      damagePhotos: [],
      otherFiles: [],
      comparableListings: [],
      aiSuggestedTitle: sourceDraft.itemName || result.suggestedTitle,
      aiDescription: result.suggestedDescription,
      valuationNotes: result.needsSerialVerification ? 'AI-prefilled draft. Serial number requires user verification.' : undefined,
      createdAt: now,
      updatedAt: now
    }, valuation);
  };
  const draftsFromIntakeResult = (result: Awaited<ReturnType<typeof itemIntakeService.analyze>>, photos: string[]) => {
    const candidates=result.candidates?.length?result.candidates:[result.draft];
    return candidates.map(candidate=>draftFromIntakeResult(result,photos,candidate));
  };
  const draftFromQueuedJob = (job: AnalysisJob) => {
    const response = job.result as { draft?: InventoryItem; candidates?: InventoryItem[]; suggestedTitle?: string; suggestedDescription?: string; fields?: Record<string, { confidence?: 'low'|'medium'|'high' } | undefined>; warnings?: string[]; needsSerialVerification?: boolean; providersUsed?: string[]; valuation?: ValuationResult } | undefined;
    if (!response?.draft) return;
    const result={
      draft: response.draft as Awaited<ReturnType<typeof itemIntakeService.analyze>>['draft'],
      suggestedTitle: response.suggestedTitle || response.draft.itemName,
      suggestedDescription: response.suggestedDescription || response.draft.userDescription || '',
      fieldConfidence: {
        make: response.fields?.make?.confidence || 'low',
        model: response.fields?.model?.confidence || 'low',
        serialNumber: response.fields?.serialNumber?.confidence || 'low'
      },
      needsSerialVerification: Boolean(response.needsSerialVerification),
      provider: (response.providersUsed?.includes('mock') ? 'mock' : 'secure-backend') as 'mock'|'secure-backend',
      warnings: response.warnings,
      valuation: response.valuation,
      candidates: response.candidates as Awaited<ReturnType<typeof itemIntakeService.analyze>>['candidates']
    };
    const photoPaths=job.storage_paths?.length?job.storage_paths:[job.storage_path];
    return draftsFromIntakeResult(result,photoPaths.map(analysisStorageReference));
  };
  useEffect(() => {
    if (!cloudStatus.authenticated || !analysisQueueService.isAvailable()) {
      setQueuedAnalysisCount(0);
      setAnalysisJobs([]);
      return;
    }
    let active = true;
    const refreshQueuedJobs = async () => {
      if (adoptingQueuedJobs.current) return;
      try {
        // A signed-in browser starts eligible jobs immediately. A scheduler can
        // continue the same work after the browser closes.
        await analysisQueueService.kick().catch(() => undefined);
        const jobs = await analysisQueueService.loadAwaitingReview();
        if (!active) return;
        setAnalysisJobs(jobs);
        setQueuedAnalysisCount(jobs.filter(job => ['queued', 'processing', 'retrying'].includes(job.status)).length);
        const completed = jobs.filter(job => job.status === 'complete' && job.result);
        const drafts = completed.flatMap(job=>draftFromQueuedJob(job)??[]);
        if (!drafts.length) return;
        adoptingQueuedJobs.current = true;
        try {
          const next = [...loadBulkDrafts(), ...drafts];
          saveBulkDrafts(next);
          await Promise.all(completed.map(job => analysisQueueService.acknowledge(job.id)));
          if (!active) return;
          if (tier === 'free') {
            const uses = loadTrialPhotoUses(trialScope);
            const nextUses = Math.min(trialPhotoLimit, uses + drafts.length);
            saveTrialPhotoUses(trialScope, nextUses);
            setTrialPhotoUses(nextUses);
          } else {
            const usage = loadPremiumAiAssistUsage(trialScope);
            const nextUsage = { ...usage, uses: Math.min(premiumAiAssistLimit, usage.uses + drafts.length) };
            savePremiumAiAssistUsage(trialScope, nextUsage);
            setPremiumAiUsage(nextUsage);
          }
          setBulkDrafts(next);
          setNotice(`${drafts.length} saved photo analysis${drafts.length===1?' is':'es are'} ready for review.`);
        } finally {
          adoptingQueuedJobs.current = false;
        }
      } catch {
        // Jobs remain in Supabase and will be retried on the next app visit or by the scheduler.
      }
    };
    void refreshQueuedJobs();
    const interval = window.setInterval(() => void refreshQueuedJobs(), 12_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [cloudStatus.authenticated, tier, trialScope]);
  const queueDurablePhoto = async (photos: string[], defaultLocation?: string, defaultRoom?: string) => {
    const queued = await analysisQueueService.enqueue(photos, { location: defaultLocation || locations[0]?.name || 'Home', room: defaultRoom }, true);
    setQueuedAnalysisCount(count => count + 1);
    void analysisQueueService.kick().catch(() => undefined);
    return queued;
  };
  const retryFailedAnalysis = async (jobId: string) => {
    try {
      await analysisQueueService.retry(jobId);
      setNotice('Saved photo analysis restarted. It will update here when the draft is ready.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The saved photo could not be retried yet.');
    }
  };
  queuePresentation.retryFailed=retryFailedAnalysis;
  const recordTrialPhotoUse = (nextUses: number) => {
    try {
      saveTrialPhotoUses(trialScope, nextUses);
      setTrialPhotoUses(nextUses);
      return true;
    } catch {
      setNotice('Browser storage is full, so this AI usage count could not be saved.');
      return false;
    }
  };
  const recordPremiumAiAssist = (nextUses: number) => {
    const nextUsage={...premiumAiUsage,uses:nextUses};
    try {
      savePremiumAiAssistUsage(trialScope,nextUsage);
      setPremiumAiUsage(nextUsage);
      return true;
    } catch {
      setNotice('Browser storage is full, so this AI usage count could not be saved.');
      return false;
    }
  };
  const quickPhotoIntake = async (files: File|File[], defaultLocation?: string, defaultRoom?: string) => {
    const selectedFiles=(Array.isArray(files)?files:[files]).slice(0,4);
    if (!selectedFiles.length) return;
    if (!canUseAiPhoto) {
      setNotice(tier==='premium'?`Your ${premiumAiAssistLimit} annual Premium AI assists are used. Add more assists when billing is enabled, or add an item and value manually.`:'Your three Try Before You Buy AI photo analyses have been used. Enable Premium demo access for more photo analysis, or add an item and value manually.');
      return;
    }
    setIntakeLoading(true);
    try {
      const photos = await Promise.all(selectedFiles.map(optimizedPhotoDataUrl));
      if (cloudStatus.authenticated && analysisQueueService.isAvailable()) {
        await queueDurablePhoto(photos, defaultLocation, defaultRoom);
        setNotice(`Photo set saved safely. ProofVault is analyzing the overview and ${photos.length-1||'no'} close-up${photos.length===2?'':'s'} in the background; you can keep using the app or close it.`);
        return;
      }
      const result = await itemIntakeService.analyze({ photoUri: photos[0], photos, location: defaultLocation || locations[0]?.name || 'Home', room: defaultRoom }, true);
      const drafts = draftsFromIntakeResult(result, photos);
      if (tier === 'free' && !recordTrialPhotoUse(trialPhotoUses + 1)) return;
      if (tier === 'premium' && !recordPremiumAiAssist(premiumAiUsage.uses + 1)) return;
      if (drafts.length > 1) {
        saveBulkDrafts([...loadBulkDrafts(), ...drafts]);
        setBulkDrafts(current=>[...current,...drafts]);
        setView('bulkReview');
        setNotice(`ProofVault found ${drafts.length} possible items. Choose which records to save; one photo analysis was used.`);
        return;
      }
      setEditingId(undefined);
      setAssistedDraft(drafts[0]);
      setAssistedWarnings(result.warnings ?? []);
      setView('form');
      setNotice(tier === 'free' ? `Try Before You Buy analysis complete. ${Math.max(0, trialPhotosRemaining - 1)} of ${trialPhotoLimit} free photo analyses remain.` : `Photo intake created a draft. ${Math.max(0,premiumAiAssistsRemaining-1)} of ${premiumAiAssistLimit} annual Premium AI assists remain.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Photo intake could not create a draft.');
    } finally {
      setIntakeLoading(false);
    }
  };
  const bulkPhotoIntake = async (files: File[], defaultLocation?: string, defaultRoom?: string) => {
    if (!files.length) return;
    if (!canUseAiPhoto) {
      setNotice(tier==='premium'?`Your ${premiumAiAssistLimit} annual Premium AI assists are used. Add more assists when billing is enabled, or add items and values manually.`:'Your three Try Before You Buy AI photo analyses have been used. Enable Premium demo access for more photo analysis, or add items and values manually.');
      return;
    }
    if (bulkDrafts.length) {
      setNotice(`You have ${bulkDrafts.length} saved photo draft${bulkDrafts.length===1?'':'s'} waiting. Resume or save that batch before starting another.`);
      setView('bulkReview');
      return;
    }
    const permittedPhotos = Math.min(maxBulkPhotosPerBatch,tier === 'premium' ? premiumAiAssistsRemaining : trialPhotosRemaining);
    const selectedFiles = files.slice(0, permittedPhotos);
    const leftForNextBatch = files.length - selectedFiles.length;
    setBulkImportLoading(true);
    setBulkImportMessage(`Preparing ${selectedFiles.length} item photo${selectedFiles.length===1?'':'s'}...`);
    const drafts: InventoryItem[] = [];
    let unreadablePhotos = 0;
    let unavailableAnalyses = 0;
    let durableQueued = 0;
    let storageStopped = false;
    let trialUsesDuringImport = trialPhotoUses;
    let premiumUsesDuringImport = premiumAiUsage.uses;
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        setBulkImportMessage(`Analyzing photo ${index + 1} of ${selectedFiles.length}...`);
        try {
          const photo = await optimizedPhotoDataUrl(file);
          if (cloudStatus.authenticated && analysisQueueService.isAvailable()) {
            await queueDurablePhoto([photo], defaultLocation, defaultRoom);
            durableQueued += 1;
            continue;
          }
          let draft: InventoryItem;
          let analyzed = false;
          try {
            const result = await itemIntakeService.analyze({ photoUri: photo, location: defaultLocation || locations[0]?.name || 'Home', room: defaultRoom }, true);
            draft = draftFromIntakeResult(result, photo);
            analyzed = true;
          } catch (error) {
            unavailableAnalyses += 1;
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
              notes: 'AI could not analyze this photo. No AI assist was used. Review and fill in make, model, serial number, and value before relying on this record.',
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
          if (analyzed && tier === 'free') {
            trialUsesDuringImport += 1;
            if (!recordTrialPhotoUse(trialUsesDuringImport)) {
              storageStopped = true;
              break;
            }
          }
          if (analyzed && tier === 'premium') {
            premiumUsesDuringImport += 1;
            if (!recordPremiumAiAssist(premiumUsesDuringImport)) {
              storageStopped = true;
              break;
            }
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
          unavailableAnalyses ? `${unavailableAnalyses} photo${unavailableAnalyses===1?' analysis was':' analyses were'} unavailable and saved for manual review without using an AI assist` : '',
          leftForNextBatch ? `${leftForNextBatch} photo${leftForNextBatch===1?'':'s'} left for the next batch` : '',
          tier === 'free' ? `${Math.max(0, trialPhotoLimit - trialUsesDuringImport)} Try Before You Buy photo analysis${trialPhotoLimit - trialUsesDuringImport===1?'':'es'} remain` : '',
          tier === 'premium' ? `${Math.max(0,premiumAiAssistLimit-premiumUsesDuringImport)} annual Premium AI assist${premiumAiAssistLimit-premiumUsesDuringImport===1?'':'s'} remain` : '',
          storageStopped ? 'browser storage is full, so the remaining photos were not added' : ''
        ].filter(Boolean);
        setNotice(`Saved ${drafts.length} draft${drafts.length===1?'':'s'} for review.${extra.length ? ` ${extra.join('; ')}.` : ''}`);
      } else if (durableQueued) {
        setNotice(`${durableQueued} photo${durableQueued===1?' was':'s were'} saved safely and queued for background analysis. You can leave this page; completed drafts will appear for review automatically.`);
      } else {
        setNotice(storageStopped ? 'Browser storage is full, so no photo drafts were saved. Clear space or use a smaller batch.' : 'No photo drafts could be created. Try clearer image files or a smaller batch.');
      }
    } finally {
      setBulkImportLoading(false);
      setBulkImportMessage('');
    }
  };
  queuePresentation={...queuePresentation,canUseAiPhoto,startItemPhotos:files=>void quickPhotoIntake(files)};
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
  const find = async () => { if(tier!=='premium'){setNotice('Replacement Value Assist lookup is a Premium feature. You can still add a manual value.');return;} if(!premiumAiAssistsRemaining){setNotice(`Your ${premiumAiAssistLimit} annual Premium AI assists are used. Add more assists when billing is enabled, or add a manual value.`);return;} setLoading(true); try { const r = await valuationService.findComparableValues(selected); const saved=update({...selected, estimatedReplacementValueLow:r.estimatedReplacementValueLow, estimatedReplacementValueHigh:r.estimatedReplacementValueHigh, estimatedReplacementValueSelected:r.suggestedReplacementValue, valuationCurrency:'USD', valuationConfidence:r.confidence, valuationSourceSummary:r.sourceSummary, valuationCheckedAt:new Date().toISOString(), comparableListings:r.comparableListings, updatedAt:new Date().toISOString()}); if(saved&&recordPremiumAiAssist(premiumAiUsage.uses+1))setNotice(`Comparable values found and saved. ${Math.max(0,premiumAiAssistsRemaining-1)} annual Premium AI assists remain.`); } finally { setLoading(false); } };
  const choose = (price: number) => { if(update({...selected, estimatedReplacementValueSelected:price, valuationNotes:'Selected from a saved comparable', updatedAt:new Date().toISOString()}))setNotice('Selected comparable value saved.'); };
  const saveManual = () => { const value=Number(manual); if(value>0&&update({...selected,userEnteredValue:value,updatedAt:new Date().toISOString()})){setManual('');setNotice('Manual value saved.');} };
  const saveQuickSerial = () => { const value=quickSerial.trim(); if(value&&update({...selected,serialNumber:value,updatedAt:new Date().toISOString()})){setQuickSerial('');setNotice('Serial number saved.');} };
  const nav = (target: Exclude<View,'detail'|'form'|'bulkReview'>, label: string, icon: ReactNode) => <button className={view===target?'nav active':'nav'} onClick={()=>setView(target)}>{icon}<span>{label}</span></button>;
  if (!cloudStatus.authenticated && !localDemoAllowed) return <AccountGate status={cloudStatus} onContinueLocal={continueLocalDemo} onStatusChange={setCloudStatus}/>;
  return <div className="shell">
    <aside><div className="brand"><ShieldCheck/><b>ProofVault</b></div><p className="eyebrow">PROPERTY EVIDENCE</p>{nav('home','Overview',<Home/>)}{nav('inventory','Inventory',<Package/>)}{nav('locations','Locations',<MapPin/>)}{nav('incident','Incident',<FileText/>)}<div className="spacer"/>{nav('settings','Settings',<Settings/>)}<div className="privacy"><LockKeyhole/><div><b>{cloudStatus.authenticated?'Cloud account':'Local demo'}</b><small>{cloudStatus.authenticated?cloudStatus.email:'Data stays in this browser'}</small></div></div></aside>
    <main>{notice&&<button className="toast" onClick={()=>setNotice('')} aria-label="Dismiss notification"><Check/>{notice}</button>}
      <AccountStatusBanner status={cloudStatus} tier={tier} trialPhotosRemaining={trialPhotosRemaining} premiumAiAssistsRemaining={premiumAiAssistsRemaining} queuedAnalysisCount={queuedAnalysisCount} syncState={cloudSyncState} syncMessage={cloudSyncMessage}/>
      {view==='home'&&<HomeView items={items} tier={tier} trialPhotosRemaining={trialPhotosRemaining} premiumAiAssistsRemaining={premiumAiAssistsRemaining} canUseAiPhoto={canUseAiPhoto} open={open} add={startNew} startBulk={bulkPhotoIntake} bulkLoading={bulkImportLoading} bulkMessage={bulkImportMessage} pendingBulkDrafts={bulkDrafts.length} resumeBulk={()=>setView('bulkReview')} upgrade={()=>setTier('premium')} review={()=>setView('inventory')} incident={()=>setView('incident')}/>} {view==='inventory'&&<InventoryView items={items} tier={tier} trialPhotosRemaining={trialPhotosRemaining} premiumAiAssistsRemaining={premiumAiAssistsRemaining} canUseAiPhoto={canUseAiPhoto} upgrade={()=>setTier('premium')} localChange={markLocalChange} open={open} edit={startEdit} add={startNew} bulkIntake={bulkPhotoIntake} bulkLoading={bulkImportLoading} bulkMessage={bulkImportMessage} pendingBulkDrafts={bulkDrafts.length} resumeBulk={()=>setView('bulkReview')} quickIntake={quickPhotoIntake} intakeLoading={intakeLoading} analysisJobs={analysisJobs} signedIn={cloudStatus.authenticated}/>} {view==='bulkReview'&&<BulkReviewView drafts={bulkDrafts} update={updateBulkDraft} save={id=>finishBulkDraft(id,'save')} skip={id=>finishBulkDraft(id,'skip')} saveAll={saveAllBulkDrafts} back={()=>setView('inventory')}/>} {view==='detail'&&selected&&<DetailView item={selected} tier={tier} loading={loading} back={()=>setView('inventory')} edit={()=>startEdit(selected.id)} archive={()=>toggleArchive(selected)} find={find} choose={choose} manual={manual} setManual={setManual} saveManual={saveManual} quickSerial={quickSerial} setQuickSerial={setQuickSerial} saveQuickSerial={saveQuickSerial} upgrade={()=>setTier('premium')}/>} {view==='form'&&<ItemForm locations={locations} tier={tier} onUpgrade={()=>setTier('premium')} item={editingId ? items.find(item=>item.id===editingId) : assistedDraft} assisted={Boolean(assistedDraft)} assistedWarnings={assistedWarnings} onCancel={()=>{setAssistedDraft(undefined);setAssistedWarnings([]);setView(editingId?'detail':'inventory')}} onSave={saveItem} onSaveAndAddAnother={next=>saveItem(next,true)}/>} {view==='locations'&&<LocationsManager locations={locations} items={items} onChange={updateLocations}/>} {view==='incident'&&<IncidentManager items={items} tier={tier} onLocalChange={markLocalChange}/>} {view==='settings'&&<SettingsView items={items} locations={locations} tier={tier} trialPhotosRemaining={trialPhotosRemaining} premiumAiAssistsRemaining={premiumAiAssistsRemaining} status={cloudStatus} syncState={cloudSyncState} syncMessage={cloudSyncMessage} setTier={setTier} restore={restoreBackup} restoreCloud={restoreCloudSnapshot} resetDemoData={resetDemoData}/>} 
    </main>
  </div>;
}

function PageHead({kicker,title,sub}:{kicker:string;title:string;sub:string}){return <header><p className="eyebrow green">{kicker}</p><h1>{title}</h1><p className="sub">{sub}</p></header>}
function AccountStatusBanner({status,tier,trialPhotosRemaining,premiumAiAssistsRemaining,queuedAnalysisCount,syncState,syncMessage}:{status:CloudStatus;tier:SubscriptionTier;trialPhotosRemaining:number;premiumAiAssistsRemaining:number;queuedAnalysisCount:number;syncState:'idle'|'loading'|'saving'|'saved'|'error';syncMessage:string}){
  const signedIn=status.authenticated;
  const syncLabel=signedIn?(syncMessage||'Autosave ready'):'Local demo only';
  const accessLabel=tier==='premium'?`Premium demo - ${premiumAiAssistsRemaining} AI assists left`:trialPhotosRemaining?`Free demo - ${trialPhotosRemaining} AI photo trial${trialPhotosRemaining===1?'':'s'} left`:'Free demo - AI photo trial used';
  return <section className={`accountStatusBanner ${signedIn?'cloud':'local'} ${syncState}`} aria-label="Account and sync status"><div><Cloud/><span>{signedIn?'Signed-in account':'Local demo'}</span></div><div><ShieldCheck/><span>{accessLabel}</span></div>{queuedAnalysisCount>0&&<div><Sparkles/><span>{queuedAnalysisCount} photo{queuedAnalysisCount===1?'':'s'} analyzing safely</span></div>}<small>{syncLabel}</small></section>;
}
function ItemIcon({category}:{category:string}){return <div className="itemicon">{category==='Jewelry'?<Tag/>:<Package/>}</div>}
function StoredPhoto({value,alt}:{value:string;alt:string}){
  const [src,setSrc]=useState(value);
  useEffect(()=>{let active=true;evidenceStorageService.resolveDisplayUrl(value).then(url=>{if(active)setSrc(url||'')}).catch(()=>{if(active)setSrc('')});return()=>{active=false}},[value]);
  return src.startsWith('data:image')||src.startsWith('http')?<img src={src} alt={alt}/>:<div className="photoPlaceholder"><Camera/>Saved photo</div>;
}
function ItemPhotoAssist({canUseAiPhoto,startItemPhotos}:{canUseAiPhoto?:boolean;startItemPhotos?:(files:File[])=>void}){
  const inputRef=useRef<HTMLInputElement>(null);
  if (!startItemPhotos) return null;
  return <section className="panel itemPhotoAssist"><div><p className="eyebrow green">ONE ITEM, BETTER RESULTS</p><h2>Add an overview plus close-ups</h2><p>Choose up to four photos of the same item. Start with a clear overall photo, then add close-ups of the brand, model, serial number, barcode, receipt, or distinguishing marks.</p><ul><li>Keep the item centered and well lit.</li><li>Make and model labels should fill the frame when possible.</li><li>Serial numbers are usually on a separate close-up; ProofVault will flag them for verification.</li><li>If the overview contains several separate items, ProofVault creates review cards so you choose which ones to save.</li></ul></div><div className="itemPhotoAction"><button className="primary" type="button" disabled={!canUseAiPhoto} onClick={()=>inputRef.current?.click()}><Camera/>{canUseAiPhoto?'Add photos of one item':'Enable photo analysis'}</button><small>One overview + up to three close-ups</small></div><input ref={inputRef} className="visuallyHiddenInput" type="file" aria-label="Choose overview and close-up photos of one item" accept="image/*" capture="environment" multiple disabled={!canUseAiPhoto} onChange={event=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';if(files.length)startItemPhotos(files);}}/></section>;
}
function PhotoAnalysisQueue({jobs,pendingDrafts,resumeReview,signedIn,retryFailed}:{jobs:AnalysisJob[];pendingDrafts:number;resumeReview:()=>void;signedIn:boolean;retryFailed?:(jobId:string)=>void}){
  if (!signedIn) return null;
  const visible=jobs.filter(job=>job.status!=='reviewed'&&job.status!=='cancelled');
  const analyzing=visible.filter(job=>['queued','processing','retrying'].includes(job.status));
  const ready=visible.filter(job=>job.status==='complete');
  const needsHelp=visible.filter(job=>job.status==='failed');
  if (!visible.length && !pendingDrafts) return null;
  const statusCopy=(job:AnalysisJob)=>job.status==='queued'?'Saved — waiting to start':job.status==='processing'?'Analyzing photo':job.status==='retrying'?'Temporarily busy — retrying automatically':job.status==='complete'?'Ready for your quick review':'Needs attention';
  const context=(job:AnalysisJob)=>[job.item_context?.location,job.item_context?.room].filter(Boolean).join(' · ') || 'Photo saved to your account';
  return <section className="panel photoAnalysisQueue" aria-label="Photo analysis queue"><div className="sectionTitle"><div><p className="eyebrow green">PHOTO ANALYSIS QUEUE</p><h2>{analyzing.length?`${analyzing.length} photo${analyzing.length===1?'':'s'} being analyzed`:'Your photo analysis activity'}</h2></div><span className="queueLive"><Sparkles/>Updates automatically</span></div><p className="queueIntro">Every photo is saved to your account first. You can leave the app while analysis continues.</p>{(ready.length||pendingDrafts>0)&&<div className="queueReady"><div><b>{pendingDrafts||ready.length} draft{(pendingDrafts||ready.length)===1?'':'s'} ready to review</b><small>Confirm the name, make, model, serial number, and value before saving.</small></div><button className="primary" onClick={resumeReview}>Review now</button></div>}{visible.map(job=><div className={`analysisJob ${job.status}`} key={job.id}><div className="analysisJobPhoto"><StoredPhoto value={analysisStorageReference(job.storage_path)} alt="Saved photo waiting for analysis"/></div><div><b>{statusCopy(job)}</b><small>{context(job)}</small><small>Added {dateTime(job.created_at)}{job.attempts>1?` · Attempt ${job.attempts}`:''}</small>{job.status==='failed'&&job.last_error&&<span className="analysisError">{job.last_error}</span>}</div><div className="analysisJobAction"><span className={`jobStatus ${job.status}`}>{job.status==='processing'?'Working':job.status==='retrying'?'Retrying':job.status==='complete'?'Ready':job.status==='failed'?'Needs help':'Queued'}</span>{job.status==='failed'&&retryFailed&&<button onClick={()=>retryFailed(job.id)}>Retry analysis</button>}</div></div>)}{needsHelp.length>0&&<p className="queueHelp">This photo remains saved. Fix the message above, then choose Retry analysis; no re-upload is needed.</p>}</section>;
}
function Score({item}:{item:InventoryItem}){const s=completenessScore(item);return <div className="score"><span style={{width:`${s.score}%`}}/><small>{s.score}%</small></div>}
function ItemRow({item,open}:{item:InventoryItem;open:(id:string)=>void}){return <button className="itemrow" onClick={()=>open(item.id)}><ItemIcon category={item.category}/><div><b>{item.itemName}</b><small>{item.location} - {item.serialNumber||item.ownerMarking||'Needs identifier'}</small></div><Score item={item}/><ChevronRight/></button>}

function HomeView({items,tier,trialPhotosRemaining,premiumAiAssistsRemaining,canUseAiPhoto,open,add,startBulk,bulkLoading,bulkMessage,pendingBulkDrafts,resumeBulk,upgrade,review,incident}:{items:InventoryItem[];tier:SubscriptionTier;trialPhotosRemaining:number;premiumAiAssistsRemaining:number;canUseAiPhoto:boolean;open:(id:string)=>void;add:()=>void;startBulk:(files:File[],location?:string,room?:string)=>void;bulkLoading:boolean;bulkMessage:string;pendingBulkDrafts:number;resumeBulk:()=>void;upgrade:()=>void;review:()=>void;incident:()=>void}){
  const active=items.filter(item=>!item.archivedAt);
  const reviewTotal=itemReviewBacklog(active,1).total;
  const weak=active.map(item=>({item,...completenessScore(item)})).filter(entry=>entry.score<70).sort((a,b)=>a.score-b.score).slice(0,3);
  const bulkInputRef=useRef<HTMLInputElement>(null);
  const isPremium=tier==='premium';
  const photoActionLabel=bulkLoading?'Building drafts...':isPremium?'Add many photos':canUseAiPhoto?`Try ${trialPhotosRemaining} AI photo${trialPhotosRemaining===1?'':'s'} free`:'Enable Premium demo features';
  const photoHelp=isPremium?`Your annual Premium plan includes ${premiumAiAssistLimit} AI assists; ${premiumAiAssistsRemaining} remain. Choose one clear overview photo per item. Each assist drafts item names, make, model, serial-number candidates, and replacement estimates for quick review.`:canUseAiPhoto?`Try Before You Buy includes ${trialPhotosRemaining} free AI photo analysis${trialPhotosRemaining===1?'':'es'} on this browser. Each creates a description, make/model/SN candidate, and approximate replacement estimate for review.`:'Your three Try Before You Buy AI photo analyses are used. Add items manually, or enable Premium demo access for more photo analysis.';
  return <><PageHead kicker="START HERE" title="Document your home without the paperwork." sub="Take photos first. ProofVault helps turn them into useful records you can review and save."/>{pendingBulkDrafts>0&&<section className="panel resumeBatch"><div><p className="eyebrow green">SAVED PHOTO BATCH</p><h2>{pendingBulkDrafts} draft{pendingBulkDrafts===1?'':'s'} ready to review</h2><p>Your batch is saved in this browser. Finish the key fields now or save the drafts to inventory for later.</p></div><button className="primary" onClick={resumeBulk}>Resume review</button></section>}<section className="panel startPanel"><div><p className="eyebrow green">{isPremium?'FASTEST PATH':'TRY BEFORE YOU BUY'}</p><h2>Walk around and add many photos</h2><p>{photoHelp}</p><small>{isPremium?'Premium includes one household owner, one invited household member, and three active devices when billing is enabled.':'Prototype trial only: the count is stored in this browser, not billing or a permanent account entitlement.'}</small>{bulkMessage&&<small className="bulkProgress">{bulkMessage}</small>}</div><button className="primary heroAction" disabled={bulkLoading} onClick={()=>canUseAiPhoto?bulkInputRef.current?.click():upgrade()}><Camera/>{photoActionLabel}</button><input ref={bulkInputRef} className="visuallyHiddenInput" type="file" accept="image/*" multiple aria-label="Choose item photos for AI analysis" onChange={event=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';void startBulk(files)}}/></section><div className="quickActions"><button onClick={add}><Plus/><b>Add one item</b><span>Manual entry with photos, make, model, SN, and value.</span></button><button onClick={review}><TriangleAlert/><b>Review records</b><span>{reviewTotal?`${reviewTotal} quick check${reviewTotal===1?'':'s'} waiting`:'Nothing urgent right now'}</span></button><button onClick={incident}><FileText/><b>Create incident packet</b><span>Build a police or insurance export from saved items.</span></button></div><div className="stats simplified"><div><Package/><span><b>{active.length}</b>Items saved</span></div><div><ShieldCheck/><span><b>{active.filter(i=>i.make||i.model||i.serialNumber).length}</b>With make, model, or SN</span></div><div><Sparkles/><span><b>{active.filter(i=>i.estimatedReplacementValueSelected||i.userEnteredValue).length}</b>With value</span></div></div>{weak.length>0&&<section className="panel guidancePanel"><div className="sectionTitle"><div><p className="eyebrow">BEST NEXT FIXES</p><h2>Make these records stronger</h2><small>Make, model, and serial number matter most for value and recovery.</small></div><span>{weak.length} priority</span></div>{weak.map(entry=><button key={entry.item.id} onClick={()=>open(entry.item.id)}><TriangleAlert/><div><b>{entry.item.itemName}</b><small>{entry.feedback}</small></div><strong>{entry.score}%</strong><ChevronRight/></button>)}</section>}<section className="panel"><div className="sectionTitle"><div><p className="eyebrow">RECENT INVENTORY</p><h2>Recently saved</h2></div><span className="tier">{isPremium?`${premiumAiAssistsRemaining} Premium assists left`:`${trialPhotosRemaining} AI trial${trialPhotosRemaining===1?'':'s'} left`}</span></div>{active.length?active.slice(0,4).map(item=><ItemRow key={item.id} item={item} open={open}/>):<div className="empty"><Package/><h3>No items yet</h3><p>Start with a batch of photos or add one item manually.</p></div>}</section></>;
}
function ReviewQueue({items,open,edit}:{items:InventoryItem[];open:(id:string)=>void;edit:(id:string)=>void}){
  const {records,total,issueSummary}=itemReviewBacklog(items,4);
  const first=records[0];
  const reviewPanel=!records.length ? <section className="panel reviewQueue clear"><div className="sectionTitle"><div><p className="eyebrow">BULK REVIEW QUEUE</p><h2>All quick checks are clear</h2><small>{items.length ? 'No active item currently needs AI review, make/model, serial verification, value, photo, receipt, or appraisal follow-up.' : 'Add items with fast photo intake, then review tasks will appear here.'}</small></div><span className="ok"><Check/>Clear</span></div></section> : <section className="panel reviewQueue"><div className="sectionTitle"><div><p className="eyebrow">BULK REVIEW QUEUE</p><h2>Quick checks before you move on</h2><small>Sorted so make/model, likely AI-prefill, and serial checks float to the top.</small></div><div className="queueActions"><span>{records.length} of {total} shown</span>{first&&<button onClick={()=>edit(first.item.id)}>Review next</button>}</div></div><div className="reviewChips" aria-label="Review backlog by issue type">{issueSummary.map(issue=><span key={issue.id}>{issue.label}: {issue.count}</span>)}</div>{records.map(record=><button key={record.item.id} onClick={()=>open(record.item.id)}><TriangleAlert/><div><b>{record.item.itemName}</b><small>{record.flags[0].label} - {record.flags[0].detail}</small><span className="reviewReasons">{record.flags.map(flag=>flag.label).join(' - ')}</span></div><ChevronRight/></button>)}</section>;
  return <><ItemPhotoAssist {...queuePresentation}/><PhotoAnalysisQueue {...queuePresentation}/>{reviewPanel}</>;
}
function BulkReviewView({drafts,update,save,skip,saveAll,back}:{drafts:InventoryItem[];update:(id:string,patch:Partial<InventoryItem>)=>void;save:(id:string)=>void;skip:(id:string)=>void;saveAll:()=>void;back:()=>void}){
  const current=drafts[0];
  if(!current)return <section className="panel empty"><Check/><h2>Bulk review complete</h2><p>All photo drafts have been handled.</p><button className="primary" onClick={back}>Back to inventory</button></section>;
  const photo=current.photos.find(value=>value.startsWith('data:image')||isSupabaseStorageReference(value))??current.photos[0];
  const setText=(key:keyof InventoryItem)=>(event:ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>update(current.id,{[key]:event.target.value} as Partial<InventoryItem>);
  const setValue=(event:ChangeEvent<HTMLInputElement>)=>update(current.id,{userEnteredValue:event.target.value?Number(event.target.value):undefined});
  return <><div className="detailToolbar"><button className="back" onClick={back}><ArrowLeft/>Inventory</button><div className="bulkCount">{drafts.length} draft{drafts.length===1?'':'s'} waiting</div></div><section className="panel bulkReviewHero"><div><p className="eyebrow green">QUICK REVIEW</p><h1>Check the fields that matter most.</h1><p>Make and model drive replacement value. Serial number helps identify lost or stolen property. This saved batch survives refreshes, so you can stop and return later.</p></div><button className="primary" onClick={saveAll}><Check/>Save all drafts for later</button></section><section className="panel bulkDraftCard">{photo&&photo.startsWith('data:image')?<img src={photo} alt={`${current.itemName || 'Draft item'} photo`} />:<div className="photoPlaceholder"><Camera/>Photo draft</div>}<div className="bulkDraftFields"><div className="reviewStep"><span>1</span><b>Name the item</b></div><label>Item name<input value={current.itemName} onChange={setText('itemName')} placeholder="Cordless drill, TV, bicycle..."/></label><div className="fields three priorityFields"><label>Make<input value={current.make??''} onChange={setText('make')} placeholder="Milwaukee"/></label><label>Model<input value={current.model??''} onChange={setText('model')} placeholder="M18 2801-20"/></label><label>Serial number (SN)<input value={current.serialNumber??''} onChange={setText('serialNumber')} placeholder="Verify from label"/></label></div><div className="fields two"><label>Location<input value={current.location} onChange={setText('location')}/></label><label>Your value (optional)<input type="number" min="0" step="0.01" value={current.userEnteredValue??''} onChange={setValue} placeholder="Enter your own replacement value"/></label></div>{current.estimatedReplacementValueSelected&&<p className="estimateHint">AI estimate: {money(current.estimatedReplacementValueSelected)} - {current.valuationConfidence || 'unknown'} confidence</p>}<label>Quick notes<textarea value={current.notes??''} onChange={setText('notes')} placeholder="Accessories, condition, visible details..."/></label><div className="bulkReviewActions"><button className="primary" onClick={()=>save(current.id)}><Check/>Save this item</button><button onClick={()=>skip(current.id)}>Skip photo</button></div><p className="helper">One uploaded photo creates one item draft. For multiple angles of the same item, save this record first, then attach more photos from the item screen. AI-filled make, model, and SN should be verified against the item, label, receipt, or packaging.</p></div></section></>;
}
function InventoryView({items,tier,trialPhotosRemaining,premiumAiAssistsRemaining,canUseAiPhoto,upgrade,localChange,open,edit,add,bulkIntake,bulkLoading,bulkMessage,pendingBulkDrafts,resumeBulk,quickIntake,intakeLoading,analysisJobs,signedIn}:{items:InventoryItem[];tier:SubscriptionTier;trialPhotosRemaining:number;premiumAiAssistsRemaining:number;canUseAiPhoto:boolean;upgrade:()=>void;localChange:()=>void;open:(id:string)=>void;edit:(id:string)=>void;add:()=>void;bulkIntake:(files:File[],defaultLocation?:string,defaultRoom?:string)=>void;bulkLoading:boolean;bulkMessage:string;pendingBulkDrafts:number;resumeBulk:()=>void;quickIntake:(file:File,defaultLocation?:string,defaultRoom?:string)=>void;intakeLoading:boolean;analysisJobs:AnalysisJob[];signedIn:boolean}){
  const[query,setQuery]=useState('');
  const[showArchived,setShowArchived]=useState(false);
  const initialBatch=loadBatchDefaults();
  const[batchLocation,setBatchLocationState]=useState(initialBatch.location);
  const[batchRoom,setBatchRoomState]=useState(initialBatch.room);
  const isPremium=tier==='premium';
  const trialLabel=`${trialPhotosRemaining} free AI photo trial${trialPhotosRemaining===1?'':'s'} left`;
  const setBatchLocation=(value:string)=>{setBatchLocationState(value);try{saveBatchDefaults({location:value,room:batchRoom});localChange()}catch{}};
  const setBatchRoom=(value:string)=>{setBatchRoomState(value);try{saveBatchDefaults({location:batchLocation,room:value});localChange()}catch{}};
  const fileInputRef=useRef<HTMLInputElement>(null);
  const bulkInputRef=useRef<HTMLInputElement>(null);
  const active=items.filter(item=>!item.archivedAt);
  const locationOptions=Array.from(new Set(items.map(item=>item.location).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const filtered=items.filter(item=>(showArchived?Boolean(item.archivedAt):!item.archivedAt)&&[item.itemName,item.category,item.location,item.make,item.model,item.serialNumber].some(value=>value?.toLowerCase().includes(query.toLowerCase())));
  const intakeTitle=isPremium?'Add many photos at once':canUseAiPhoto?'Try Before You Buy AI photo analysis':'Your free AI photo trial is used';
  const intakeDescription=isPremium?`Choose one clear overview photo per item. This annual plan includes ${premiumAiAssistLimit} AI assists; ${premiumAiAssistsRemaining} remain. Saved drafts let you continue room by room.`:canUseAiPhoto?`Use up to ${trialPhotosRemaining} free photo${trialPhotosRemaining===1?'':'s'} for AI description, make/model help, SN candidates, and approximate value estimates. This prototype count is stored in this browser.`:'Add items and values manually, or enable Premium demo access for more AI photo analysis.';
  return <><div className="pageTitleRow"><PageHead kicker="INVENTORY" title="Documented property" sub="Add batches first, then review the important details: make, model, SN, and value."/><button className="primary addButton" onClick={add}><Plus/>Add one item</button></div>{pendingBulkDrafts>0&&<section className="panel resumeBatch"><div><p className="eyebrow green">SAVED PHOTO BATCH</p><h2>{pendingBulkDrafts} draft{pendingBulkDrafts===1?'':'s'} ready to review</h2><p>These drafts survive a refresh. Save the key facts one by one, or save all drafts to inventory for later.</p></div><button className="primary" onClick={resumeBulk}>Resume review</button></section>}<section className="panel intakePanel bulkFirst"><div><p className="eyebrow green">{isPremium?'BULK PHOTO IMPORT':'TRY BEFORE YOU BUY'}</p><h2>{intakeTitle}</h2><p>{intakeDescription}</p><small>{bulkMessage||'Tip: set the room first so every draft starts in the right place.'}</small><div className="batchDefaults"><label>Apply location to new photos<input list="batch-locations" value={batchLocation} onChange={event=>setBatchLocation(event.target.value)} placeholder="Garage, storage unit, bedroom?"/><datalist id="batch-locations">{locationOptions.map(location=><option key={location} value={location}/>)}</datalist></label><label>Room / area<input value={batchRoom} onChange={event=>setBatchRoom(event.target.value)} placeholder="Shelf, closet, tool cabinet?"/></label></div></div><div className="intakeButtons"><button className="primary intakeButton" type="button" disabled={bulkLoading} onClick={()=>canUseAiPhoto?bulkInputRef.current?.click():upgrade()}><Camera/>{bulkLoading?'Building drafts...':isPremium?'Add many photos':canUseAiPhoto?`Try AI photos (${trialLabel})`:'Enable Premium demo features'}</button><button className="secondaryAction" type="button" disabled={intakeLoading} onClick={()=>canUseAiPhoto?fileInputRef.current?.click():upgrade()}><Plus/>{intakeLoading?'Analyzing...':isPremium?'Add one photo':canUseAiPhoto?'Try one AI photo':'Enable Premium demo features'}</button></div><input ref={bulkInputRef} className="visuallyHiddenInput" type="file" aria-label="Choose item photos for AI analysis" accept="image/*" multiple disabled={bulkLoading||!canUseAiPhoto} onChange={event=>{const files=Array.from(event.currentTarget.files??[]);if(files.length)bulkIntake(files,batchLocation.trim()||undefined,batchRoom.trim()||undefined);event.currentTarget.value='';}}/><input ref={fileInputRef} className="visuallyHiddenInput" type="file" aria-label="Choose one item photo for AI analysis" accept="image/*" capture="environment" disabled={intakeLoading||!canUseAiPhoto} onChange={event=>{const file=event.currentTarget.files?.[0];if(file)quickIntake(file,batchLocation.trim()||undefined,batchRoom.trim()||undefined);event.currentTarget.value='';}}/></section><ReviewQueue items={active} open={open} edit={edit}/><div className="inventoryTools"><div className="search"><Search/><input aria-label="Search inventory" placeholder="Search by item, make, model, serial number, or room" value={query} onChange={event=>setQuery(event.target.value)}/></div><button className={showArchived?'selected':''} onClick={()=>setShowArchived(!showArchived)}>{showArchived?'Showing archived':'View archived'} ({items.filter(item=>item.archivedAt).length})</button></div><section className="panel">{filtered.length?filtered.map(item=><ItemRow key={item.id} item={item} open={open}/>):<div className="empty"><Search/><h3>No matching items</h3><p>{showArchived?'No archived items match this search.':'Try a different item name, make, model, serial number, or location.'}</p></div>}</section></>;
}

interface DetailProps{item:InventoryItem;tier:SubscriptionTier;loading:boolean;back:()=>void;edit:()=>void;archive:()=>void;find:()=>void;choose:(price:number)=>void;manual:string;setManual:(value:string)=>void;saveManual:()=>void;quickSerial:string;setQuickSerial:(value:string)=>void;saveQuickSerial:()=>void;upgrade:()=>void}
function DetailView({item,tier,loading,back,edit,archive,find,choose,manual,setManual,saveManual,quickSerial,setQuickSerial,saveQuickSerial,upgrade}:DetailProps){const c=completenessScore(item);const best=item.comparableListings[0];const reviewFlags=itemReviewFlags(item);const[confirmArchive,setConfirmArchive]=useState(false);return <><div className="detailToolbar"><button className="back" onClick={back}><ArrowLeft/>Inventory</button><div className="detailActions"><button onClick={edit}><Pencil/>Edit item</button><button className={item.archivedAt?'restoreButton':'archiveButton'} onClick={()=>item.archivedAt?archive():setConfirmArchive(true)}>{item.archivedAt?'Restore item':'Archive item'}</button></div></div>{confirmArchive&&<div className="confirmStrip"><div><b>Archive this item?</b><span>It will leave active inventory but remain available to existing incident records.</span></div><button onClick={()=>setConfirmArchive(false)}>Cancel</button><button className="dangerButton" onClick={archive}>Archive</button></div>}<div className="detailHead"><ItemIcon category={item.category}/><div><p className="eyebrow green">{item.category}{item.archivedAt?' - ARCHIVED':''}</p><h1>{item.itemName}</h1><p>{item.make} {item.model} - {item.location}</p></div><div className="scorebox"><b>{c.score}%</b><span>{c.label}</span></div></div><div className="grid"><div>{reviewFlags.length>0&&<section className="panel reviewChecklist"><div className="sectionTitle"><div><p className="eyebrow">REVIEW BEFORE RELYING ON THIS RECORD</p><h2>Finish these quick checks</h2></div><button onClick={edit}>Edit details</button></div>{reviewFlags.map(flag=><div className={`reviewFlag ${flag.priority}`} key={flag.id}><TriangleAlert/><div><b>{flag.label}</b><small>{flag.detail}</small>{flag.id==='verify-serial'&&<div className="quickValue"><input aria-label="Quick serial number" value={quickSerial} onChange={e=>setQuickSerial(e.target.value)} placeholder={item.serialNumber?.startsWith('VERIFY-')?'Enter confirmed serial':item.serialNumber||'Enter confirmed serial'}/><button onClick={saveQuickSerial}>Save serial</button></div>}{flag.id==='add-value'&&<div className="quickValue"><input aria-label="Quick manual value" type="number" value={manual} onChange={e=>setManual(e.target.value)} placeholder={item.userEnteredValue?`Manual value: ${money(item.userEnteredValue)}`:'Enter value now'}/><button onClick={saveManual}>Save value</button></div>}</div></div>)}</section>}<section className="panel facts"><div className="sectionTitle"><h2>Identity & evidence</h2><span className="ok"><Check/>Documented</span></div>{item.photos.some(photo=>photo.startsWith('data:image'))&&<div className="detailPhotos">{item.photos.filter(photo=>photo.startsWith('data:image')).map((photo,index)=><img key={`${photo.slice(0,24)}-${index}`} src={photo} alt={`${item.itemName} photo ${index+1}`}/>)}</div>}<dl><div><dt>Serial number</dt><dd>{item.serialNumber||'Not recorded'}</dd></div><div><dt>Owner-applied marking</dt><dd>{item.ownerMarking||'Not recorded'}</dd></div><div><dt>Marking location</dt><dd>{item.markingLocation||'Not recorded'}</dd></div><div><dt>Condition</dt><dd>{item.condition}</dd></div></dl><p className="feedback">{c.feedback}</p></section><section className="panel valuation"><div className="valueTitle"><div className="spark"><Sparkles/></div><div><p className="eyebrow green">PREMIUM DEMO ASSIST</p><h2>Replacement Value Assist</h2></div>{tier==='premium'&&<span className="premium">PREMIUM DEMO</span>}</div>
  {item.estimatedReplacementValueSelected ? <ValuationResults item={item} best={best} choose={choose}/> : tier==='free' ? <div className="locked"><LockKeyhole/><h3>Know what replacement may cost</h3><p>Premium demo access finds and saves comparable new, used, and refurbished listings. Manual values stay available on free demo access.</p><button className="primary" onClick={upgrade}>Enable Premium demo features</button></div> : <div className="empty"><Sparkles/><h3>No estimate yet</h3><p>Search mocked marketplace sources to build an approximate replacement range.</p></div>}
  <div className="actions"><button className="primary" disabled={tier==='free'||loading} onClick={find}>{loading?'Checking sources...':'Estimate replacement cost'}</button>{item.estimatedReplacementValueSelected&&<button onClick={()=>choose(item.estimatedReplacementValueSelected!)}>Use this value</button>}</div><div className="manual"><input aria-label="Manual value" type="number" value={manual} onChange={e=>setManual(e.target.value)} placeholder={item.userEnteredValue?`Manual value: ${money(item.userEnteredValue)}`:'Enter manual value'}/><button onClick={saveManual}>Add manual value</button></div><div className="checked">Checked: {dateTime(item.valuationCheckedAt)}{item.valuationSourceSummary&&` - ${item.valuationSourceSummary}`}</div><p className="disclaimer">{VALUATION_DISCLAIMER}</p></section></div><aside className="side"><section className="panel"><p className="eyebrow">VALUE SUMMARY</p><div className="bigvalue">{money(item.userEnteredValue)}</div><small>User-entered value</small><hr/><div className="bigvalue">{money(item.estimatedReplacementValueSelected)}</div><small>Replacement Value Assist</small></section><section className="panel"><p className="eyebrow">DOCUMENTATION</p><p>{item.photos.length} item photo</p><p>{item.serialPhotos.length+item.markingPhotos.length} identifier photos</p><p>{item.receiptFiles.length} receipt</p><p>{item.appraisalFiles.length} appraisal</p></section></aside></div></>}

function ValuationResults({item,best,choose}:{item:InventoryItem;best?:InventoryItem['comparableListings'][number];choose:(n:number)=>void}){return <><div className="estimate"><div><small>ESTIMATED REPLACEMENT RANGE</small><b>{money(item.estimatedReplacementValueLow)} - {money(item.estimatedReplacementValueHigh)}</b><span>Selected estimate: {money(item.estimatedReplacementValueSelected)}</span></div><div className={`confidence ${item.valuationConfidence}`}>{item.valuationConfidence} confidence</div></div>{best&&<><p className="eyebrow">BEST COMPARABLE</p><div className="comparable"><div><b>{best.title}</b><small>{best.marketplace} - {best.condition} - {best.matchReason}</small></div><strong>{money(best.price)}</strong><a href={best.url} target="_blank" rel="noreferrer" aria-label="Open comparable listing"><ExternalLink/></a></div></>}{item.comparableListings.slice(1).map(x=><div className="comparable minor" key={x.id}><div><b>{x.title}</b><small>{x.marketplace} - {x.condition}</small></div><strong>{money(x.price)}</strong><button className="textBtn" onClick={()=>choose(x.price)}>Use this value</button></div>)}</>}

function BrowserStoragePanel(){const[estimate,setEstimate]=useState<{usage?:number;quota?:number}>({});useEffect(()=>{let active=true;navigator.storage?.estimate?.().then(result=>{if(active)setEstimate({usage:result.usage,quota:result.quota})}).catch(()=>undefined);return()=>{active=false}},[]);const usage=estimate.usage??0;const quota=estimate.quota??0;const percent=quota?Math.min(100,Math.round((usage/quota)*100)):0;const mb=(bytes:number)=>(bytes/1024/1024).toFixed(bytes>10_000_000?1:2);return <section className="panel settings"><h2>Browser storage</h2><p>This web demo stores inventory, incidents, and uploaded evidence in this browser. For large real inventories, the mobile app will use app-private file storage instead.</p>{quota?<><div className="storageMeter" aria-label={`Browser storage ${percent}% used`}><span style={{width:`${percent}%`}}/></div><small>{mb(usage)} MB used of about {mb(quota)} MB available to this browser.</small></>:<small>Storage estimate is not available in this browser.</small>}</section>}

function SettingsView({items,locations,tier,trialPhotosRemaining,premiumAiAssistsRemaining,status,syncState,syncMessage,setTier,restore,restoreCloud,resetDemoData}:{items:InventoryItem[];locations:LocationRecord[];tier:SubscriptionTier;trialPhotosRemaining:number;premiumAiAssistsRemaining:number;status:CloudStatus;syncState:'idle'|'loading'|'saving'|'saved'|'error';syncMessage:string;setTier:(tier:SubscriptionTier)=>void;restore:(backup:ProofVaultBackup)=>boolean;restoreCloud:(snapshot:CloudSnapshot)=>boolean;resetDemoData:()=>void}){
  const[confirmReset,setConfirmReset]=useState(false);
  const usageText=tier==='premium'?`Your annual Premium plan includes ${premiumAiAssistLimit} AI assists. You have used ${premiumAiAssistLimit-premiumAiAssistsRemaining}; ${premiumAiAssistsRemaining} remain in this annual cycle.`:`You have used ${trialPhotoLimit-trialPhotosRemaining} of ${trialPhotoLimit} free AI photo analyses. Each successful photo creates an AI description, make/model/SN candidate, and approximate replacement estimate to review.`;
  return <><PageHead kicker="SETTINGS" title="Settings & privacy" sub="Manage account sync, local backups, privacy, security placeholders, and prototype feature access."/>
    <section className="panel settings accountModePanel"><h2>Current workspace</h2><p>{status.authenticated?`Signed in as ${status.email}. Inventory, incidents, locations, prototype access setting, and batch defaults autosave to this account.`:'Local demo mode. Data stays in this browser unless you sign in or export a backup.'}</p><span className={`syncPill ${syncState}`}>{status.authenticated?(syncMessage||'Autosave ready'):'Not syncing'}</span></section>
    <section className="panel settings"><h2>AI usage</h2><p>{usageText}</p><small>One AI assist analyzes one overview photo. Premium will allow optional 100-assist add-ons when billing is enabled.</small></section>
    <section className="panel settings"><h2>Household access</h2><p>Premium is designed for one account owner and one invited household member, with up to three active devices. This prevents shared subscriptions while still letting a couple document the same home.</p><small>Household invitations, device management, add-ons, and payment enforcement are prepared for the secure backend but are not active in this prototype.</small></section>
    <section className="panel settings"><h2>Prototype feature access</h2><div className="segmented"><button className={tier==='free'?'selected':''} onClick={()=>setTier('free')}>Free demo access</button><button className={tier==='premium'?'selected premiumBtn':''} onClick={()=>setTier('premium')}>Premium demo access</button></div><p>This switch is a prototype test setting, not a paid subscription. Premium demo access enables up to {premiumAiAssistLimit} AI assists per annual cycle, automatic comparable lookup, saved estimates, and marketplace links in incident exports. Real customer access will be enforced by a secure server-side subscription system.</p></section>
    <CloudSyncPanel items={items} locations={locations} tier={tier} onRestoreCloud={restoreCloud}/><BrowserStoragePanel/><BackupPanel items={items} locations={locations} tier={tier} onRestore={restore}/>
    {!status.authenticated&&<section className="panel settings"><h2>Demo reset</h2><p>Use this before a walkthrough or when browser storage gets crowded. Download a backup first if you want to keep your current local records.</p>{confirmReset?<div className="restoreConfirm"><div><b>Reset this browser demo?</b><small>This replaces local inventory, incidents, locations, prototype access, saved photo drafts, batch defaults, and Try Before You Buy trial count with the original sample data.</small></div><button onClick={()=>setConfirmReset(false)}>Cancel</button><button className="dangerButton" onClick={resetDemoData}>Reset demo data</button></div>:<button className="dangerButton" onClick={()=>setConfirmReset(true)}>Reset demo data</button>}</section>}
    <PrivacySecurityPanel/><AboutPanel/>
  </>;
}
