import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { completenessScore, money, valuationService, VALUATION_DISCLAIMER, type AttachmentType, type Incident, type IncidentDraft, type InventoryDraft, type InventoryItem, type LocationRecord, type SubscriptionTier, type ValuationResult } from '@proofvault/domain';
import { addLocation, archiveInventoryItem, getLatestValuation, getSubscriptionTier, initializeDatabase, listArchivedInventory, listInventory, listLocations, restoreInventoryItem, saveInventoryItem, saveItemAttachment, saveValuation, setSubscriptionTier } from './src/db/inventoryRepository';
import { chooseItemPhoto, takeItemPhoto } from './src/services/photoService';
import { authenticateForVault, canUseAppLock, isAppLockEnabled, setAppLockEnabled } from './src/services/appLockService';
import { InventoryEditor } from './src/components/InventoryEditor';
import { chooseSupportingDocument } from './src/services/documentService';
import { deleteIncidentRecord, listIncidents, saveIncidentPhoto, saveIncidentRecord } from './src/db/incidentRepository';
import { IncidentEditor } from './src/components/IncidentEditor';
import { LocationsPanel } from './src/components/LocationsPanel';
import { pickDatabaseBackup, restoreDatabaseBackup, shareDatabaseBackup } from './src/services/databaseBackupService';
import { shareIncidentPacket } from './src/services/incidentExportService';

const dbPromise = SQLite.openDatabaseAsync('proofvault.db');

export default function App() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [archivedItems,setArchivedItems]=useState<InventoryItem[]>([]);
  const [selected, setSelected] = useState<InventoryItem>();
  const [valuation, setValuation] = useState<ValuationResult>();
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockReady, setLockReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem>();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [incidents,setIncidents]=useState<Incident[]>([]);
  const [screen,setScreen]=useState<'inventory'|'incidents'|'settings'>('inventory');
  const [incidentEditorOpen,setIncidentEditorOpen]=useState(false);
  const [editingIncident,setEditingIncident]=useState<Incident>();
  const [locations,setLocations]=useState<LocationRecord[]>([]);

  const load = useCallback(async () => {
    const db = await dbPromise;
    await initializeDatabase(db);
    const [inventory,archived,subscriptionTier,savedIncidents,savedLocations]=await Promise.all([listInventory(db),listArchivedInventory(db),getSubscriptionTier(db),listIncidents(db),listLocations(db)]);
    setItems(inventory);setArchivedItems(archived);setTier(subscriptionTier);setIncidents(savedIncidents);setLocations(savedLocations);
    setLoading(false);
  }, []);
  useEffect(() => { void (async () => { const enabled = await isAppLockEnabled(); setLockEnabled(enabled); setLocked(enabled); setLockReady(true); if (!enabled) await load(); })(); }, [load]);
  useEffect(() => { const subscription = AppState.addEventListener('change', state => { if (lockEnabled && state !== 'active') setLocked(true); }); return () => subscription.remove(); }, [lockEnabled]);

  async function openItem(item: InventoryItem) {
    const db = await dbPromise;
    setSelected(await getLatestValuation(db, item));
    setSaved(false);
  }
  async function findValues() {
    if (!selected||tier!=='premium') return;
    setFinding(true);
    setValuation(await valuationService.findComparableValues(selected));
    setFinding(false);
  }
  async function useValue() {
    if (!selected || !valuation) return;
    const db = await dbPromise;
    await saveValuation(db, selected.id, valuation);
    setSelected(await getLatestValuation(db, selected));
    setSaved(true);
  }
  async function addPhoto(source: 'camera' | 'library', attachmentType: 'item'|'serial'|'marking'|'damage') {
    if (!selected) return;
    try {
      const photo = source === 'camera' ? await takeItemPhoto() : await chooseItemPhoto();
      if (!photo) return;
      const db = await dbPromise;
      await saveItemAttachment(db, selected.id, attachmentType, photo.uri, photo.mimeType, photo.originalName);
      setSelected(await getLatestValuation(db, selected));
    } catch (error) {
      Alert.alert('Could not add photo', error instanceof Error ? error.message : 'Please try again.');
    }
  }
  async function addDocument(attachmentType: Extract<AttachmentType,'receipt'|'appraisal'|'warranty'|'other'>){if(!selected)return;try{const document=await chooseSupportingDocument();if(!document)return;const db=await dbPromise;await saveItemAttachment(db,selected.id,attachmentType,document.uri,document.mimeType,document.originalName);setSelected(await getLatestValuation(db,selected));}catch(error){Alert.alert('Could not add document',error instanceof Error?error.message:'Please try again.');}}
  async function unlock() { if (await authenticateForVault()) { setLocked(false); if (!items.length) await load(); } }
  async function toggleAppLock(enabled: boolean) {
    if (enabled) {
      if (!await canUseAppLock()) { Alert.alert('App lock unavailable', 'Set up Face ID, Touch ID, or fingerprint authentication in your device settings first.'); return; }
      if (!await authenticateForVault()) return;
    }
    await setAppLockEnabled(enabled);
    setLockEnabled(enabled);
  }
  async function saveEditor(draft: InventoryDraft) {
    const db=await dbPromise;
    const savedId=await saveInventoryItem(db,draft,editingItem?.id);
    const [updatedItems,archived]=await Promise.all([listInventory(db),listArchivedInventory(db)]);
    setItems(updatedItems);setArchivedItems(archived);
    if(selected?.id===savedId){const updated=updatedItems.find(item=>item.id===savedId);if(updated)setSelected(await getLatestValuation(db,updated));}
    setEditorOpen(false);setEditingItem(undefined);
  }
  async function changeTier(nextTier: SubscriptionTier){const db=await dbPromise;await setSubscriptionTier(db,nextTier);setTier(nextTier);}
  async function createLocation(name:string){const db=await dbPromise;await addLocation(db,name);setLocations(await listLocations(db));}
  async function exportBackup(){try{await shareDatabaseBackup(await dbPromise);}catch(error){Alert.alert('Could not export backup',error instanceof Error?error.message:'Please try again.');}}
  async function chooseBackupToRestore(){try{const bytes=await pickDatabaseBackup();if(!bytes)return;Alert.alert('Replace local database?', 'This will replace inventory, incidents, valuations, settings, and database attachment references on this device. This cannot be undone.',[{text:'Cancel',style:'cancel'},{text:'Restore backup',style:'destructive',onPress:()=>void restoreBackup(bytes)}]);}catch(error){Alert.alert('Could not read backup',error instanceof Error?error.message:'Please try again.');}}
  async function restoreBackup(bytes:Uint8Array){try{const db=await dbPromise;await restoreDatabaseBackup(db,bytes);await load();setScreen('inventory');Alert.alert('Backup restored','ProofVault restored the validated database backup.');}catch(error){Alert.alert('Restore failed',error instanceof Error?error.message:'The live database was not replaced.');}}
  async function saveIncident(draft:IncidentDraft){const db=await dbPromise;await saveIncidentRecord(db,draft,editingIncident?.id);setIncidents(await listIncidents(db));setIncidentEditorOpen(false);setEditingIncident(undefined);}
  async function shareIncident(incident:Incident){try{const db=await dbPromise;const affectedItems:InventoryItem[]=[];const allItems=[...items,...archivedItems];for(const affected of incident.items){const item=allItems.find(candidate=>candidate.id===affected.itemId);if(item)affectedItems.push(await getLatestValuation(db,item));}await shareIncidentPacket(incident,affectedItems,tier);}catch(error){Alert.alert('Could not share packet',error instanceof Error?error.message:'Please try again.');}}
  async function archiveItem(item:InventoryItem){const db=await dbPromise;await archiveInventoryItem(db,item.id);const[active,archived]=await Promise.all([listInventory(db),listArchivedInventory(db)]);setItems(active);setArchivedItems(archived);setSelected(undefined);}
  function confirmArchiveItem(item:InventoryItem){const references=incidents.filter(incident=>incident.items.some(affected=>affected.itemId===item.id)).length;Alert.alert('Archive inventory item?',references?`This item appears in ${references} incident record${references===1?'':'s'}. It will remain available in those records and exports.`:'The item will move to Archived inventory and can be restored later.',[{text:'Cancel',style:'cancel'},{text:'Archive item',style:'destructive',onPress:()=>void archiveItem(item)}]);}
  async function restoreItem(itemId:string){const db=await dbPromise;await restoreInventoryItem(db,itemId);const[active,archived]=await Promise.all([listInventory(db),listArchivedInventory(db)]);setItems(active);setArchivedItems(archived);}
  async function deleteIncident(incidentId:string){try{const db=await dbPromise;await deleteIncidentRecord(db,incidentId);setIncidents(await listIncidents(db));}catch{Alert.alert('Could not delete incident','Your incident was not changed. Please try again.');}}
  async function addIncidentPhoto(source:'camera'|'library',incidentId:string,itemId:string){try{const photo=source==='camera'?await takeItemPhoto():await chooseItemPhoto();if(!photo)return;const db=await dbPromise;await saveIncidentPhoto(db,incidentId,itemId,photo.uri,photo.mimeType,photo.originalName);setIncidents(await listIncidents(db));}catch(error){Alert.alert('Could not add incident photo',error instanceof Error?error.message:'Please try again.');}}
  function confirmDeleteIncident(incident:Incident){Alert.alert('Delete incident?',`Delete “${incident.title}”? Inventory items and their evidence will not be deleted.`,[{text:'Cancel',style:'cancel'},{text:'Delete incident',style:'destructive',onPress:()=>void deleteIncident(incident.id)}]);}
  const editor=editorOpen?<InventoryEditor item={editingItem} locationSuggestions={locations.map(location=>location.name)} onCancel={()=>{setEditorOpen(false);setEditingItem(undefined);}} onSave={saveEditor}/>:null;
  const incidentEditor=incidentEditorOpen?<IncidentEditor incident={editingIncident} inventory={editingIncident?[...items,...archivedItems]:items} onCancel={()=>{setIncidentEditorOpen(false);setEditingIncident(undefined);}} onSave={saveIncident}/>:null;

  if (!lockReady || (loading && !locked)) return <SafeAreaView style={styles.center}><ActivityIndicator color="#5dd6ad" /><Text style={styles.muted}>Opening your private vault…</Text></SafeAreaView>;
  if (locked) return <SafeAreaView style={styles.center}><Text style={styles.lockIcon}>◆</Text><Text style={styles.title}>ProofVault is locked</Text><Text style={styles.lockCopy}>Authenticate with your device to view private inventory records.</Text><Pressable accessibilityRole="button" style={styles.unlockButton} onPress={() => void unlock()}><Text style={styles.buttonText}>Unlock ProofVault</Text></Pressable></SafeAreaView>;
  if (!selected&&screen==='settings') return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><MobileTabs selected="settings" onSelect={setScreen}/><Text style={styles.brand}>PROOFVAULT</Text><Text style={styles.title}>Settings</Text><LocationsPanel locations={locations} onAdd={createLocation}/><View style={styles.card}><Text style={styles.cardTitle}>Database backup</Text><Text style={styles.muted}>Export an exact SQLite database image or restore a validated ProofVault database. Camera photos and documents are app-private files and are not embedded in this database-only backup.</Text><View style={styles.actionRow}><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>void exportBackup()}><Text style={styles.secondaryButtonText}>Export database</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>void chooseBackupToRestore()}><Text style={styles.secondaryButtonText}>Restore database</Text></Pressable></View></View><View style={styles.card}><View style={styles.settingRow}><View style={styles.settingCopy}><Text style={styles.cardTitle}>App lock</Text><Text style={styles.muted}>Require device authentication whenever ProofVault reopens.</Text></View><Switch accessibilityLabel="Enable app lock" value={lockEnabled} onValueChange={value=>void toggleAppLock(value)} trackColor={{false:'#29473e',true:'#3f9f7e'}} thumbColor={lockEnabled?'#5dd6ad':'#8da39d'}/></View></View><View style={styles.card}><Text style={styles.cardTitle}>Demo subscription</Text><Text style={styles.muted}>Stored only on this device. No payment or cloud account is required.</Text><View style={styles.actionRow}><Pressable accessibilityRole="radio" accessibilityState={{selected:tier==='free'}} style={[styles.planButton,tier==='free'&&styles.planSelected]} onPress={()=>void changeTier('free')}><Text style={tier==='free'?styles.planTextSelected:styles.secondaryButtonText}>Free</Text></Pressable><Pressable accessibilityRole="radio" accessibilityState={{selected:tier==='premium'}} style={[styles.planButton,tier==='premium'&&styles.planSelected]} onPress={()=>void changeTier('premium')}><Text style={tier==='premium'?styles.planTextSelected:styles.secondaryButtonText}>Premium</Text></Pressable></View></View><View style={styles.card}><Text style={styles.cardTitle}>Privacy</Text><Text style={styles.muted}>Inventory, incidents, photos, documents, and valuations stay on this device. ProofVault has no login, analytics, tracking, or cloud synchronization. Deleting the app can delete local data, so maintain independent copies of important evidence.</Text></View><View style={styles.card}><Text style={styles.cardTitle}>About ProofVault</Text><Text style={styles.muted}>ProofVault helps document property before and after loss. Replacement Value Assist provides approximate estimates from comparable listings; it is not an appraisal or guaranteed insurance value.</Text><Text style={styles.documentName}>Mobile MVP 0.1 · Expo SDK 56 · Local-first</Text></View></ScrollView></SafeAreaView>;
  if (!selected&&screen==='incidents') return <><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <MobileTabs selected="incidents" onSelect={setScreen}/>
    <Text style={styles.brand}>PROOFVAULT</Text><Text style={styles.title}>Incidents</Text><Text style={styles.muted}>Record affected property while details are fresh.</Text><Pressable accessibilityRole="button" style={styles.button} onPress={()=>{setEditingIncident(undefined);setIncidentEditorOpen(true);}}><Text style={styles.buttonText}>Create incident</Text></Pressable>
    {incidents.length?incidents.map(incident=><View key={incident.id} style={styles.card}><Text style={styles.cardTitle}>{incident.title}</Text><Text style={styles.muted}>{incident.type} · {incident.incidentDate}</Text><Text style={styles.muted}>{incident.ownerName||'Owner not recorded'} · {incident.policeCaseNumber?`Case ${incident.policeCaseNumber}`:'No police case'}</Text><Text style={styles.value}>{incident.items.length} affected {incident.items.length===1?'item':'items'}</Text>{incident.items.map(affected=><View key={affected.itemId} style={styles.incidentEvidence}><Text style={styles.value}>{[...items,...archivedItems].find(item=>item.id===affected.itemId)?.itemName??'Item record unavailable'} — {affected.status}</Text>{affected.notes?<Text style={styles.documentName}>{affected.notes}</Text>:null}{affected.photos?.length?<ScrollView horizontal contentContainerStyle={styles.photoRow}>{affected.photos.map(uri=><Image key={uri} source={{uri}} style={styles.incidentPhoto} accessibilityLabel="Incident-specific evidence photo"/>)}</ScrollView>:<Text style={styles.documentName}>No incident-specific photos.</Text>}<View style={styles.actionRow}><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>void addIncidentPhoto('camera',incident.id,affected.itemId)}><Text style={styles.secondaryButtonText}>Take incident photo</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>void addIncidentPhoto('library',incident.id,affected.itemId)}><Text style={styles.secondaryButtonText}>Choose photo</Text></Pressable></View></View>)}<View style={styles.actionRow}><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>{setEditingIncident(incident);setIncidentEditorOpen(true);}}><Text style={styles.secondaryButtonText}>Edit incident</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>void shareIncident(incident)}><Text style={styles.secondaryButtonText}>Share packet</Text></Pressable></View><Pressable accessibilityRole="button" style={styles.dangerButton} onPress={()=>confirmDeleteIncident(incident)}><Text style={styles.dangerText}>Delete incident</Text></Pressable>{tier==='free'?<Text style={styles.disclaimer}>Free exports omit marketplace links. Values, confidence, checked date, and the estimate disclaimer remain included.</Text>:null}</View>):<View style={styles.card}><Text style={styles.muted}>No incidents recorded yet.</Text></View>}
  </ScrollView></SafeAreaView>{incidentEditor}</>;
  if (!selected) return <><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <MobileTabs selected="inventory" onSelect={setScreen}/>
    <Text style={styles.brand}>PROOFVAULT</Text><Text style={styles.title}>Your inventory</Text><Text style={styles.muted}>Stored locally on this device.</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={()=>{setEditingItem(undefined);setEditorOpen(true);}}><Text style={styles.buttonText}>Add inventory item</Text></Pressable>
    {items.map(item => <Pressable accessibilityRole="button" key={item.id} style={styles.card} onPress={() => void openItem(item)}><Text style={styles.cardTitle}>{item.itemName}</Text><Text style={styles.muted}>{item.category} · {item.location}</Text><Text style={styles.value}>{money(item.userEnteredValue)}</Text></Pressable>)}
    {archivedItems.length?<View style={styles.card}><Text style={styles.cardTitle}>Archived inventory</Text><Text style={styles.muted}>Archived items remain available to historical incidents and exports.</Text>{archivedItems.map(item=><View key={item.id} style={styles.archivedRow}><View style={styles.settingCopy}><Text style={styles.value}>{item.itemName}</Text><Text style={styles.documentName}>Archived {item.archivedAt?new Date(item.archivedAt).toLocaleDateString():''}</Text></View><Pressable accessibilityRole="button" style={styles.restoreButton} onPress={()=>void restoreItem(item.id)}><Text style={styles.secondaryButtonText}>Restore</Text></Pressable></View>)}</View>:null}
  </ScrollView></SafeAreaView>{editor}</>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => { setSelected(undefined); setValuation(undefined); }}><Text style={styles.back}>‹ Inventory</Text></Pressable>
    <Text style={styles.eyebrow}>{selected.category} · {selected.location}</Text><Text style={styles.title}>{selected.itemName}</Text>
    <View style={styles.card}><Text style={styles.cardTitle}>Item photos</Text>
      {selected.photos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>{selected.photos.map(uri => <Image key={uri} source={{ uri }} style={styles.photo} accessibilityLabel="Item evidence photo" />)}</ScrollView> : <Text style={styles.muted}>No item photos yet.</Text>}
      <View style={styles.actionRow}><Pressable accessibilityRole="button" style={styles.smallButton} onPress={() => void addPhoto('camera','item')}><Text style={styles.buttonText}>Take photo</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={() => void addPhoto('library','item')}><Text style={styles.secondaryButtonText}>Choose photo</Text></Pressable></View>
      <Text style={styles.disclaimer}>Photos are copied into ProofVault’s private app documents folder and referenced by the local database.</Text>
    </View>
    <View style={styles.card}><Text style={styles.cardTitle}>Serial-number evidence</Text>{selected.serialPhotos.length?<ScrollView horizontal contentContainerStyle={styles.photoRow}>{selected.serialPhotos.map(uri=><Image key={uri} source={{uri}} style={styles.photo} accessibilityLabel="Serial number evidence photo"/>)}</ScrollView>:<Text style={styles.muted}>No serial-number photo yet.</Text>}<View style={styles.actionRow}><Pressable accessibilityRole="button" style={styles.smallButton} onPress={()=>void addPhoto('camera','serial')}><Text style={styles.buttonText}>Photograph serial</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>void addPhoto('library','serial')}><Text style={styles.secondaryButtonText}>Choose photo</Text></Pressable></View></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Owner-marking evidence</Text>{selected.markingPhotos.length?<ScrollView horizontal contentContainerStyle={styles.photoRow}>{selected.markingPhotos.map(uri=><Image key={uri} source={{uri}} style={styles.photo} accessibilityLabel="Owner marking evidence photo"/>)}</ScrollView>:<Text style={styles.muted}>No owner-marking photo yet.</Text>}<View style={styles.actionRow}><Pressable accessibilityRole="button" style={styles.smallButton} onPress={()=>void addPhoto('camera','marking')}><Text style={styles.buttonText}>Photograph marking</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>void addPhoto('library','marking')}><Text style={styles.secondaryButtonText}>Choose photo</Text></Pressable></View></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Damage or loss evidence</Text>{selected.damagePhotos?.length?<ScrollView horizontal contentContainerStyle={styles.photoRow}>{selected.damagePhotos.map(uri=><Image key={uri} source={{uri}} style={styles.photo} accessibilityLabel="Damage or loss evidence photo"/>)}</ScrollView>:<Text style={styles.muted}>No damage or loss photos yet.</Text>}<View style={styles.actionRow}><Pressable accessibilityRole="button" style={styles.smallButton} onPress={()=>void addPhoto('camera','damage')}><Text style={styles.buttonText}>Photograph damage</Text></Pressable><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>void addPhoto('library','damage')}><Text style={styles.secondaryButtonText}>Choose photo</Text></Pressable></View><Text style={styles.disclaimer}>Use this category for condition after theft, fire, water, impact, or another incident.</Text></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Supporting documents</Text><Text style={styles.muted}>PDFs and images are copied into private app storage.</Text><View style={styles.documentGrid}><DocumentButton label="Add receipt" onPress={()=>void addDocument('receipt')}/><DocumentButton label="Add appraisal" onPress={()=>void addDocument('appraisal')}/><DocumentButton label="Add warranty" onPress={()=>void addDocument('warranty')}/><DocumentButton label="Add other file" onPress={()=>void addDocument('other')}/></View><DocumentList label="Receipts" files={selected.receiptFiles}/><DocumentList label="Appraisals" files={selected.appraisalFiles}/><DocumentList label="Warranties" files={selected.warrantyFiles}/><DocumentList label="Other files" files={selected.otherFiles}/></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Item record</Text><Text style={styles.value}>{[selected.make, selected.model].filter(Boolean).join(' ')}</Text><Text style={styles.muted}>Status / condition: {selected.status} · {selected.condition}</Text><Text style={styles.muted}>Location: {selected.location}{selected.room?` · ${selected.room}`:''}</Text><Text style={styles.muted}>Serial: {selected.serialNumber || 'Not recorded'}</Text><Text style={styles.muted}>Barcode: {selected.barcode || 'Not recorded'}</Text><Text style={styles.muted}>Owner marking: {selected.ownerMarking || 'Not recorded'}{selected.markingType?` (${selected.markingType})`:''}</Text><Text style={styles.muted}>Marking location: {selected.markingLocation || 'Not recorded'}</Text><Text style={styles.muted}>Distinguishing features: {selected.distinguishingFeatures || 'Not recorded'}</Text><Text style={styles.muted}>Purchased: {selected.purchaseDate || 'Date not recorded'} · {money(selected.purchasePrice)}</Text><Text style={styles.muted}>Manual value: {money(selected.userEnteredValue)}</Text><Text style={styles.muted}>Notes: {selected.notes || 'None'}</Text><Text style={styles.score}>{completenessScore(selected).score}% complete</Text><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>{setEditingItem(selected);setEditorOpen(true);}}><Text style={styles.secondaryButtonText}>Edit item details</Text></Pressable><Pressable accessibilityRole="button" style={styles.dangerButton} onPress={()=>confirmArchiveItem(selected)}><Text style={styles.dangerText}>Archive item</Text></Pressable></View>
    <View style={styles.premiumCard}><Text style={styles.pill}>{tier.toUpperCase()}</Text><Text style={styles.cardTitle}>Replacement Value Assist</Text>
      {valuation ? <><Text style={styles.range}>{money(valuation.estimatedReplacementValueLow)}–{money(valuation.estimatedReplacementValueHigh)}</Text><Text style={styles.value}>{valuation.confidence.toUpperCase()} confidence</Text>{valuation.comparableListings.map(listing => <View key={listing.id} style={styles.listing}><Text style={styles.value}>{listing.title}</Text><Text style={styles.muted}>{listing.marketplace} · {listing.condition} · {money(listing.price)}</Text></View>)}<Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => void useValue()}><Text style={styles.secondaryButtonText}>{saved ? 'Value saved on this device' : `Use ${money(valuation.suggestedReplacementValue)}`}</Text></Pressable></> : selected.estimatedReplacementValueSelected ? <><Text style={styles.range}>{money(selected.estimatedReplacementValueLow)}–{money(selected.estimatedReplacementValueHigh)}</Text><Text style={styles.value}>Saved value: {money(selected.estimatedReplacementValueSelected)} · {selected.valuationConfidence?.toUpperCase()} confidence</Text>{selected.comparableListings.map(listing => <View key={listing.id} style={styles.listing}><Text style={styles.value}>{listing.title}</Text><Text style={styles.muted}>{listing.marketplace} · {listing.condition} · {money(listing.price)}</Text></View>)}</> : <Text style={styles.muted}>Estimate replacement cost using mock comparable marketplace listings.</Text>}
      {tier==='premium'?<Pressable accessibilityRole="button" style={styles.button} onPress={() => void findValues()} disabled={finding}><Text style={styles.buttonText}>{finding ? 'Finding comparables…' : 'Find Comparable Values'}</Text></Pressable>:<View style={styles.upgradeBox}><Text style={styles.value}>Premium finds marketplace comparables automatically.</Text><Text style={styles.muted}>Free users can record a manual value in Edit item details. Change the local demo subscription from the inventory screen to preview premium.</Text></View>}
      <Text style={styles.disclaimer}>{VALUATION_DISCLAIMER}</Text>
    </View>
  </ScrollView>{editor}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#07110f'}, center:{flex:1,backgroundColor:'#07110f',alignItems:'center',justifyContent:'center',gap:12}, page:{padding:22,gap:14},
  brand:{color:'#5dd6ad',fontSize:12,fontWeight:'800',letterSpacing:2}, eyebrow:{color:'#8da39d',fontSize:12,textTransform:'uppercase'}, title:{color:'#f2faf7',fontSize:30,fontWeight:'800'}, back:{color:'#5dd6ad',fontSize:17},
  card:{backgroundColor:'#10201c',borderColor:'#203b34',borderWidth:1,borderRadius:16,padding:18,gap:9}, premiumCard:{backgroundColor:'#11251e',borderColor:'#4fb991',borderWidth:1,borderRadius:18,padding:18,gap:12}, cardTitle:{color:'#f2faf7',fontSize:19,fontWeight:'700'}, value:{color:'#dbe9e4',fontSize:15}, muted:{color:'#8da39d',fontSize:14}, score:{color:'#5dd6ad',fontWeight:'700',marginTop:5},
  pill:{alignSelf:'flex-start',color:'#07110f',backgroundColor:'#e7b85b',paddingHorizontal:9,paddingVertical:4,borderRadius:99,fontSize:10,fontWeight:'900'}, range:{color:'#f2faf7',fontSize:27,fontWeight:'800'}, listing:{borderTopColor:'#29473e',borderTopWidth:1,paddingTop:10,gap:3},
  button:{backgroundColor:'#5dd6ad',borderRadius:12,padding:14,alignItems:'center',marginTop:4}, buttonText:{color:'#07110f',fontWeight:'800'}, secondaryButton:{borderColor:'#5dd6ad',borderWidth:1,borderRadius:12,padding:13,alignItems:'center'}, secondaryButtonText:{color:'#5dd6ad',fontWeight:'800'},
  photoRow:{gap:10}, photo:{width:150,height:112,borderRadius:10,backgroundColor:'#07110f'}, actionRow:{flexDirection:'row',gap:9}, smallButton:{flex:1,backgroundColor:'#5dd6ad',borderRadius:10,padding:11,alignItems:'center'}, smallOutlineButton:{flex:1,borderColor:'#5dd6ad',borderWidth:1,borderRadius:10,padding:10,alignItems:'center'}, disclaimer:{color:'#82968f',fontSize:11,lineHeight:16},
  lockIcon:{color:'#5dd6ad',fontSize:34}, lockCopy:{color:'#8da39d',fontSize:15,textAlign:'center',maxWidth:300,lineHeight:22}, unlockButton:{backgroundColor:'#5dd6ad',borderRadius:12,paddingHorizontal:24,paddingVertical:14,marginTop:8}, settingRow:{flexDirection:'row',alignItems:'center',gap:12}, settingCopy:{flex:1,gap:5},
  planButton:{flex:1,borderColor:'#5dd6ad',borderWidth:1,borderRadius:10,padding:11,alignItems:'center'},planSelected:{backgroundColor:'#5dd6ad'},planTextSelected:{color:'#07110f',fontWeight:'800'},upgradeBox:{backgroundColor:'#0b1915',borderRadius:10,padding:12,gap:5},
  documentGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},documentButton:{width:'48%',borderColor:'#5dd6ad',borderWidth:1,borderRadius:10,padding:10,alignItems:'center'},documentGroup:{gap:3,borderTopColor:'#29473e',borderTopWidth:1,paddingTop:8},documentLabel:{color:'#dbe9e4',fontWeight:'700'},documentName:{color:'#8da39d',fontSize:12},
  navRow:{flexDirection:'row',gap:8},navButton:{flex:1,borderColor:'#5dd6ad',borderWidth:1,borderRadius:10,padding:11,alignItems:'center'},navSelected:{backgroundColor:'#5dd6ad'},
  dangerButton:{borderColor:'#b75858',borderWidth:1,borderRadius:10,padding:10,alignItems:'center'},dangerText:{color:'#ffaaa5',fontWeight:'800'},
  archivedRow:{flexDirection:'row',alignItems:'center',gap:10,borderTopColor:'#29473e',borderTopWidth:1,paddingTop:9},restoreButton:{borderColor:'#5dd6ad',borderWidth:1,borderRadius:9,paddingHorizontal:12,paddingVertical:8},
  incidentEvidence:{borderTopColor:'#29473e',borderTopWidth:1,paddingTop:9,gap:7},incidentPhoto:{width:110,height:82,borderRadius:8,backgroundColor:'#07110f'},
});

function DocumentButton({label,onPress}:{label:string;onPress():void}){return <Pressable accessibilityRole="button" style={styles.documentButton} onPress={onPress}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>}
function DocumentList({label,files}:{label:string;files?:string[]}){if(!files?.length)return null;return <View style={styles.documentGroup}><Text style={styles.documentLabel}>{label} ({files.length})</Text>{files.map(uri=><Text key={uri} numberOfLines={1} style={styles.documentName}>{decodeURIComponent(uri.split('/').pop()??'Document')}</Text>)}</View>}
function MobileTabs({selected,onSelect}:{selected:'inventory'|'incidents'|'settings';onSelect(value:'inventory'|'incidents'|'settings'):void}){const tabs=[['inventory','Inventory'],['incidents','Incidents'],['settings','Settings']] as const;return <View accessibilityRole="tablist" style={styles.navRow}>{tabs.map(([value,label])=><Pressable key={value} accessibilityRole="tab" accessibilityState={{selected:selected===value}} style={[styles.navButton,selected===value&&styles.navSelected]} onPress={()=>onSelect(value)}><Text style={selected===value?styles.planTextSelected:styles.secondaryButtonText}>{label}</Text></Pressable>)}</View>}
