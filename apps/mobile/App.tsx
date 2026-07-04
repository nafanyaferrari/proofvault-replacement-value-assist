import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { completenessScore, money, valuationService, VALUATION_DISCLAIMER, type InventoryDraft, type InventoryItem, type SubscriptionTier, type ValuationResult } from '@proofvault/domain';
import { getLatestValuation, getSubscriptionTier, initializeDatabase, listInventory, saveInventoryItem, saveItemPhoto, saveValuation, setSubscriptionTier } from './src/db/inventoryRepository';
import { chooseItemPhoto, takeItemPhoto } from './src/services/photoService';
import { authenticateForVault, canUseAppLock, isAppLockEnabled, setAppLockEnabled } from './src/services/appLockService';
import { InventoryEditor } from './src/components/InventoryEditor';

const dbPromise = SQLite.openDatabaseAsync('proofvault.db');

export default function App() {
  const [items, setItems] = useState<InventoryItem[]>([]);
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

  const load = useCallback(async () => {
    const db = await dbPromise;
    await initializeDatabase(db);
    const [inventory,subscriptionTier]=await Promise.all([listInventory(db),getSubscriptionTier(db)]);
    setItems(inventory);setTier(subscriptionTier);
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
  async function addPhoto(source: 'camera' | 'library', attachmentType: 'item'|'serial'|'marking') {
    if (!selected) return;
    try {
      const photo = source === 'camera' ? await takeItemPhoto() : await chooseItemPhoto();
      if (!photo) return;
      const db = await dbPromise;
      await saveItemPhoto(db, selected.id, attachmentType, photo.uri, photo.mimeType, photo.originalName);
      setSelected(await getLatestValuation(db, selected));
    } catch (error) {
      Alert.alert('Could not add photo', error instanceof Error ? error.message : 'Please try again.');
    }
  }
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
    const updatedItems=await listInventory(db);
    setItems(updatedItems);
    if(selected?.id===savedId){const updated=updatedItems.find(item=>item.id===savedId);if(updated)setSelected(await getLatestValuation(db,updated));}
    setEditorOpen(false);setEditingItem(undefined);
  }
  async function changeTier(nextTier: SubscriptionTier){const db=await dbPromise;await setSubscriptionTier(db,nextTier);setTier(nextTier);}
  const editor=editorOpen?<InventoryEditor item={editingItem} onCancel={()=>{setEditorOpen(false);setEditingItem(undefined);}} onSave={saveEditor}/>:null;

  if (!lockReady || (loading && !locked)) return <SafeAreaView style={styles.center}><ActivityIndicator color="#5dd6ad" /><Text style={styles.muted}>Opening your private vault…</Text></SafeAreaView>;
  if (locked) return <SafeAreaView style={styles.center}><Text style={styles.lockIcon}>◆</Text><Text style={styles.title}>ProofVault is locked</Text><Text style={styles.lockCopy}>Authenticate with your device to view private inventory records.</Text><Pressable accessibilityRole="button" style={styles.unlockButton} onPress={() => void unlock()}><Text style={styles.buttonText}>Unlock ProofVault</Text></Pressable></SafeAreaView>;
  if (!selected) return <><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.brand}>PROOFVAULT</Text><Text style={styles.title}>Your inventory</Text><Text style={styles.muted}>Stored locally on this device.</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={()=>{setEditingItem(undefined);setEditorOpen(true);}}><Text style={styles.buttonText}>Add inventory item</Text></Pressable>
    {items.map(item => <Pressable accessibilityRole="button" key={item.id} style={styles.card} onPress={() => void openItem(item)}><Text style={styles.cardTitle}>{item.itemName}</Text><Text style={styles.muted}>{item.category} · {item.location}</Text><Text style={styles.value}>{money(item.userEnteredValue)}</Text></Pressable>)}
    <View style={styles.card}><View style={styles.settingRow}><View style={styles.settingCopy}><Text style={styles.cardTitle}>App lock</Text><Text style={styles.muted}>Require device authentication whenever ProofVault reopens.</Text></View><Switch accessibilityLabel="Enable app lock" value={lockEnabled} onValueChange={value => void toggleAppLock(value)} trackColor={{ false:'#29473e', true:'#3f9f7e' }} thumbColor={lockEnabled ? '#5dd6ad' : '#8da39d'} /></View></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Demo subscription</Text><Text style={styles.muted}>Stored only on this device. No payment or cloud account is required.</Text><View style={styles.actionRow}><Pressable accessibilityRole="radio" accessibilityState={{selected:tier==='free'}} style={[styles.planButton,tier==='free'&&styles.planSelected]} onPress={()=>void changeTier('free')}><Text style={tier==='free'?styles.planTextSelected:styles.secondaryButtonText}>Free</Text></Pressable><Pressable accessibilityRole="radio" accessibilityState={{selected:tier==='premium'}} style={[styles.planButton,tier==='premium'&&styles.planSelected]} onPress={()=>void changeTier('premium')}><Text style={tier==='premium'?styles.planTextSelected:styles.secondaryButtonText}>Premium</Text></Pressable></View></View>
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
    <View style={styles.card}><Text style={styles.cardTitle}>Item record</Text><Text style={styles.value}>{[selected.make, selected.model].filter(Boolean).join(' ')}</Text><Text style={styles.muted}>Serial: {selected.serialNumber || 'Not recorded'}</Text><Text style={styles.muted}>Owner marking: {selected.ownerMarking || 'Not recorded'}</Text><Text style={styles.muted}>Marking location: {selected.markingLocation || 'Not recorded'}</Text><Text style={styles.muted}>Distinguishing features: {selected.distinguishingFeatures || 'Not recorded'}</Text><Text style={styles.muted}>Manual value: {money(selected.userEnteredValue)}</Text><Text style={styles.score}>{completenessScore(selected).score}% complete</Text><Pressable accessibilityRole="button" style={styles.smallOutlineButton} onPress={()=>{setEditingItem(selected);setEditorOpen(true);}}><Text style={styles.secondaryButtonText}>Edit item details</Text></Pressable></View>
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
});
