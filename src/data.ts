import { ComparableListing, Incident, InventoryItem, LocationRecord, SubscriptionTier } from './types';
const now='2026-06-30T19:00:00.000Z';
const bikeComparableListings:ComparableListing[]=[
 {id:'demo-comp-bike-new',title:'Comparable Trek FX Hybrid Bicycle',marketplace:'Cycle Shop',condition:'new',price:899,currency:'USD',url:'https://www.google.com/search?q=Trek%20FX%203%20hybrid%20bicycle&tbm=shop',matchReason:'Closest current replacement by make and model family',matchConfidence:'high',checkedAt:now},
 {id:'demo-comp-bike-used',title:'Used Trek FX Hybrid Bicycle',marketplace:'Bike Exchange',condition:'used',price:625,currency:'USD',url:'https://www.google.com/search?q=used%20Trek%20FX%203%20bicycle&tbm=shop',matchReason:'Similar used bicycle in the same category',matchConfidence:'medium',checkedAt:now}
];
export const seedItems:InventoryItem[]=[
 {id:'drill',itemName:'Milwaukee M18 Brushless Drill',category:'Tools',location:'Garage',room:'Tool cabinet',make:'Milwaukee',model:'M18 2801-20',serialNumber:'PV-M18-48291',ownerMarking:'NJR',markingType:'engraved',markingLocation:'Battery well',distinguishingFeatures:'Red paint scuff near chuck',condition:'used',purchasePrice:179,userEnteredValue:225,comparableListings:[],photos:['drill'],serialPhotos:['serial'],markingPhotos:['mark'],receiptFiles:[],appraisalFiles:[],warrantyFiles:[],status:'normal',notes:'Includes two batteries and hard case.',createdAt:now,updatedAt:now},
 {id:'ring',itemName:'Wedding Ring',category:'Jewelry',location:'Primary bedroom',ownerMarking:'Always, N + J',markingType:'inscription',markingLocation:'Inner band',condition:'used',userEnteredValue:1500,comparableListings:[],photos:['ring'],serialPhotos:[],markingPhotos:['inscription'],receiptFiles:[],appraisalFiles:['appraisal'],warrantyFiles:[],status:'normal',createdAt:now,updatedAt:now},
 {id:'bike',itemName:'Trek FX Bicycle',aiSuggestedTitle:'Trek FX hybrid bicycle',aiDescription:'AI-prefilled sample draft for a Trek FX hybrid bicycle. The serial number candidate should be verified against the frame before relying on it.',category:'Bicycles',location:'Garage',make:'Trek',model:'FX 3',serialNumber:'VERIFY-WTU35892K',condition:'used',estimatedReplacementValueLow:625,estimatedReplacementValueHigh:899,estimatedReplacementValueSelected:762,valuationCurrency:'USD',valuationConfidence:'medium',valuationSourceSummary:'2 comparable listings across 2 sources',valuationCheckedAt:now,valuationNotes:'AI-prefilled draft. Serial number requires user verification.',comparableListings:bikeComparableListings,photos:['bike'],serialPhotos:['frame'],markingPhotos:[],receiptFiles:[],appraisalFiles:[],warrantyFiles:[],status:'normal',createdAt:now,updatedAt:now},
 {id:'laptop',itemName:'Work Laptop',category:'Electronics',location:'Home office',make:'Lenovo',model:'ThinkPad X1',serialNumber:'PF4X92LQ',condition:'used',comparableListings:[],photos:['laptop'],serialPhotos:['serial'],markingPhotos:[],receiptFiles:['receipt'],appraisalFiles:[],warrantyFiles:[],status:'normal',createdAt:now,updatedAt:now},
 {id:'tote',itemName:'Storage Tote — Camping Gear',category:'Other',location:'Storage unit',ownerMarking:'QR-PV-0042',markingType:'QR/asset tag',markingLocation:'Lid and front panel',condition:'used',comparableListings:[],photos:['tote'],serialPhotos:[],markingPhotos:['qr'],receiptFiles:[],appraisalFiles:[],warrantyFiles:[],status:'normal',createdAt:now,updatedAt:now}
];
export const seedIncident:Incident={id:'incident-1',title:'Garage burglary',type:'Burglary',incidentDate:'2026-06-28',location:'Home garage',policeAgency:'Denver Police Department',policeCaseNumber:'DEMO-2026-1842',insuranceCompany:'Example Mutual',insuranceClaimNumber:'CLM-DEMO-882',items:[{itemId:'drill',status:'stolen',notes:'Missing with hard case and batteries.'}],createdAt:now};
export const loadItems=(useDemoFallback=true)=>{try{const stored=JSON.parse(localStorage.getItem('pv-items')||'null');return stored||(useDemoFallback?seedItems:[])}catch{return useDemoFallback?seedItems:[]}};
export const saveItems=(items:InventoryItem[])=>localStorage.setItem('pv-items',JSON.stringify(items));
export const loadTier=():SubscriptionTier=>(localStorage.getItem('pv-tier') as SubscriptionTier)||'free';
export const saveTier=(tier:SubscriptionTier)=>localStorage.setItem('pv-tier',tier);
export const loadIncidents=(useDemoFallback=true):Incident[]=>{try{const stored=JSON.parse(localStorage.getItem('pv-incidents')||'null');return stored||(useDemoFallback?[seedIncident]:[])}catch{return useDemoFallback?[seedIncident]:[]}};
export const saveIncidents=(incidents:Incident[])=>localStorage.setItem('pv-incidents',JSON.stringify(incidents));
export const seedLocations:LocationRecord[]=[{id:'loc-home',name:'Home',notes:'Primary residence',createdAt:now},{id:'loc-garage',name:'Garage',createdAt:now},{id:'loc-storage',name:'Storage unit',createdAt:now}];
export const loadLocations=(useDemoFallback=true):LocationRecord[]=>{try{const stored=JSON.parse(localStorage.getItem('pv-locations')||'null');return stored||(useDemoFallback?seedLocations:[])}catch{return useDemoFallback?seedLocations:[]}};
export const saveLocations=(locations:LocationRecord[])=>localStorage.setItem('pv-locations',JSON.stringify(locations));
export interface BatchDefaults { location:string; room:string; }
export const loadBatchDefaults=():BatchDefaults=>{try{return JSON.parse(localStorage.getItem('pv-batch-defaults')||'null')||{location:'',room:''}}catch{return{location:'',room:''}}};
export const saveBatchDefaults=(defaults:BatchDefaults)=>localStorage.setItem('pv-batch-defaults',JSON.stringify(defaults));
export const loadBulkDrafts=():InventoryItem[]=>{try{const stored=JSON.parse(localStorage.getItem('pv-bulk-drafts')||'null');return Array.isArray(stored)?stored:[]}catch{return[]}};
export const saveBulkDrafts=(drafts:InventoryItem[])=>localStorage.setItem('pv-bulk-drafts',JSON.stringify(drafts));
export const clearBulkDrafts=()=>localStorage.removeItem('pv-bulk-drafts');
export const replaceLocalData=(items:InventoryItem[],incidents:Incident[],locations:LocationRecord[],tier:SubscriptionTier,batchDefaults?:BatchDefaults)=>{
 const next=[['pv-items',JSON.stringify(items)],['pv-incidents',JSON.stringify(incidents)],['pv-locations',JSON.stringify(locations)],['pv-tier',tier],['pv-bulk-drafts',''],...(batchDefaults?[['pv-batch-defaults',JSON.stringify(batchDefaults)] as const]:[])] as const;
 const previous=next.map(([key])=>({key,value:localStorage.getItem(key),hadValue:localStorage.getItem(key)!==null}));
 try{next.forEach(([key,value])=>value?localStorage.setItem(key,value):localStorage.removeItem(key))}
 catch(error){previous.forEach(({key,value,hadValue})=>{try{hadValue?localStorage.setItem(key,value??''):localStorage.removeItem(key)}catch{}});throw error}
};
