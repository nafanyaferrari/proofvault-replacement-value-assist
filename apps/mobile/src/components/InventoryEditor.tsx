import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { InventoryDraft, InventoryItem, ItemCondition } from '@proofvault/domain';

interface InventoryEditorProps { item?:InventoryItem; locationSuggestions?:string[]; onCancel():void; onSave(draft:InventoryDraft):Promise<void>; }
const conditions: ItemCondition[] = ['new','used','refurbished','unknown'];

export function InventoryEditor({ item, locationSuggestions=[], onCancel, onSave }: InventoryEditorProps) {
  const [draft, setDraft] = useState<InventoryDraft>({ itemName:item?.itemName??'', category:item?.category??'', location:item?.location??'', make:item?.make??'', model:item?.model??'', serialNumber:item?.serialNumber??'', ownerMarking:item?.ownerMarking??'', markingLocation:item?.markingLocation??'', distinguishingFeatures:item?.distinguishingFeatures??'', userDescription:item?.userDescription??'', userEnteredValue:item?.userEnteredValue, condition:item?.condition??'unknown' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof InventoryDraft>(key:K,value:InventoryDraft[K]) => setDraft(current=>({...current,[key]:value}));
  async function submit(){if(!draft.itemName.trim()||!draft.category.trim()||!draft.location.trim()){setError('Item name, category, and location are required.');return;}if(draft.userEnteredValue!==undefined&&!Number.isFinite(draft.userEnteredValue)){setError('Manual value must be a valid number.');return;}setError('');setSaving(true);try{await onSave(draft);}catch{setError('This item could not be saved. Please try again.');}finally{setSaving(false);}}
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}><ScrollView style={styles.safe} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>PROOFVAULT INVENTORY</Text><Text style={styles.title}>{item?'Edit item':'Add item'}</Text>
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
    <Field label="Item name *" value={draft.itemName} onChangeText={value=>set('itemName',value)} />
    <Field label="Category *" value={draft.category} onChangeText={value=>set('category',value)} />
    <Field label="Location *" value={draft.location} onChangeText={value=>set('location',value)} />
    {locationSuggestions.length?<View style={styles.conditionRow}>{locationSuggestions.map(location=><Pressable accessibilityRole="button" key={location} style={styles.chip} onPress={()=>set('location',location)}><Text style={styles.chipText}>{location}</Text></Pressable>)}</View>:null}
    <View style={styles.row}><View style={styles.half}><Field label="Make" value={draft.make} onChangeText={value=>set('make',value)} /></View><View style={styles.half}><Field label="Model" value={draft.model} onChangeText={value=>set('model',value)} /></View></View>
    <Field label="Serial number" value={draft.serialNumber} onChangeText={value=>set('serialNumber',value)} autoCapitalize="characters" />
    <Field label="Owner-applied marking" value={draft.ownerMarking} onChangeText={value=>set('ownerMarking',value)} autoCapitalize="characters" />
    <Field label="Marking location" value={draft.markingLocation} onChangeText={value=>set('markingLocation',value)} />
    <Field label="Other distinguishing features" value={draft.distinguishingFeatures} onChangeText={value=>set('distinguishingFeatures',value)} multiline />
    <Field label="Manual value" value={draft.userEnteredValue?.toString()??''} onChangeText={value=>set('userEnteredValue',value?Number(value):undefined)} keyboardType="decimal-pad" />
    <Text style={styles.label}>Condition</Text><View style={styles.conditionRow}>{conditions.map(condition=><Pressable accessibilityRole="radio" accessibilityState={{selected:draft.condition===condition}} key={condition} style={[styles.chip,draft.condition===condition&&styles.chipSelected]} onPress={()=>set('condition',condition)}><Text style={draft.condition===condition?styles.chipTextSelected:styles.chipText}>{condition}</Text></Pressable>)}</View>
    <Field label="Description" value={draft.userDescription} onChangeText={value=>set('userDescription',value)} multiline />
    <Pressable accessibilityRole="button" style={styles.save} disabled={saving} onPress={()=>void submit()}><Text style={styles.saveText}>{saving?'Saving…':'Save item'}</Text></Pressable>
    <Pressable accessibilityRole="button" style={styles.cancel} onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
  </ScrollView></Modal>;
}

interface FieldProps {label:string;value:string;onChangeText(value:string):void;multiline?:boolean;keyboardType?:'default'|'decimal-pad';autoCapitalize?:'none'|'sentences'|'words'|'characters'}
function Field({label,multiline,...props}:FieldProps){return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#60756e" style={[styles.input,multiline&&styles.multiline]} multiline={multiline} {...props}/></View>}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#07110f'},page:{padding:22,gap:13},eyebrow:{color:'#5dd6ad',fontSize:11,fontWeight:'800',letterSpacing:2},title:{color:'#f2faf7',fontSize:29,fontWeight:'800',marginBottom:4},error:{color:'#ffaaa5',backgroundColor:'#3b1818',padding:11,borderRadius:9},field:{gap:6},label:{color:'#b8cac4',fontSize:13,fontWeight:'700'},input:{color:'#f2faf7',backgroundColor:'#10201c',borderColor:'#29473e',borderWidth:1,borderRadius:11,paddingHorizontal:13,paddingVertical:12,fontSize:16},multiline:{minHeight:92,textAlignVertical:'top'},row:{flexDirection:'row',gap:10},half:{flex:1},conditionRow:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{borderColor:'#29473e',borderWidth:1,borderRadius:99,paddingHorizontal:12,paddingVertical:8},chipSelected:{backgroundColor:'#5dd6ad',borderColor:'#5dd6ad'},chipText:{color:'#b8cac4',textTransform:'capitalize'},chipTextSelected:{color:'#07110f',fontWeight:'800',textTransform:'capitalize'},save:{backgroundColor:'#5dd6ad',borderRadius:12,padding:14,alignItems:'center',marginTop:6},saveText:{color:'#07110f',fontWeight:'800'},cancel:{padding:12,alignItems:'center'},cancelText:{color:'#8da39d',fontWeight:'700'}});
