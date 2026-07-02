import { Incident, InventoryItem, LocationRecord, SubscriptionTier } from './types';
const now='2026-06-30T19:00:00.000Z';
export const seedItems:InventoryItem[]=[
 {id:'drill',itemName:'Milwaukee M18 Brushless Drill',category:'Tools',location:'Garage',room:'Tool cabinet',make:'Milwaukee',model:'M18 2801-20',serialNumber:'PV-M18-48291',ownerMarking:'NJR',markingType:'engraved',markingLocation:'Battery well',distinguishingFeatures:'Red paint scuff near chuck',condition:'used',purchasePrice:179,userEnteredValue:225,comparableListings:[],photos:['drill'],serialPhotos:['serial'],markingPhotos:['mark'],receiptFiles:[],appraisalFiles:[],warrantyFiles:[],status:'normal',notes:'Includes two batteries and hard case.',createdAt:now,updatedAt:now},
 {id:'ring',itemName:'Wedding Ring',category:'Jewelry',location:'Primary bedroom',ownerMarking:'Always, N + J',markingType:'inscription',markingLocation:'Inner band',condition:'used',userEnteredValue:1500,comparableListings:[],photos:['ring'],serialPhotos:[],markingPhotos:['inscription'],receiptFiles:[],appraisalFiles:['appraisal'],warrantyFiles:[],status:'normal',createdAt:now,updatedAt:now},
 {id:'bike',itemName:'Trek FX Bicycle',category:'Bicycles',location:'Garage',make:'Trek',model:'FX 3',serialNumber:'WTU35892K',condition:'used',comparableListings:[],photos:['bike'],serialPhotos:['frame'],markingPhotos:[],receiptFiles:[],appraisalFiles:[],warrantyFiles:[],status:'normal',createdAt:now,updatedAt:now},
 {id:'laptop',itemName:'Work Laptop',category:'Electronics',location:'Home office',make:'Lenovo',model:'ThinkPad X1',serialNumber:'PF4X92LQ',condition:'used',comparableListings:[],photos:['laptop'],serialPhotos:['serial'],markingPhotos:[],receiptFiles:['receipt'],appraisalFiles:[],warrantyFiles:[],status:'normal',createdAt:now,updatedAt:now},
 {id:'tote',itemName:'Storage Tote — Camping Gear',category:'Other',location:'Storage unit',ownerMarking:'QR-PV-0042',markingType:'QR/asset tag',markingLocation:'Lid and front panel',condition:'used',comparableListings:[],photos:['tote'],serialPhotos:[],markingPhotos:['qr'],receiptFiles:[],appraisalFiles:[],warrantyFiles:[],status:'normal',createdAt:now,updatedAt:now}
];
export const seedIncident:Incident={id:'incident-1',title:'Garage burglary',type:'Burglary',incidentDate:'2026-06-28',location:'Home garage',policeAgency:'Denver Police Department',policeCaseNumber:'DEMO-2026-1842',insuranceCompany:'Example Mutual',insuranceClaimNumber:'CLM-DEMO-882',items:[{itemId:'drill',status:'stolen',notes:'Missing with hard case and batteries.'}],createdAt:now};
export const loadItems=()=>{try{return JSON.parse(localStorage.getItem('pv-items')||'null')||seedItems}catch{return seedItems}};
export const saveItems=(items:InventoryItem[])=>localStorage.setItem('pv-items',JSON.stringify(items));
export const loadTier=():SubscriptionTier=>(localStorage.getItem('pv-tier') as SubscriptionTier)||'free';
export const saveTier=(tier:SubscriptionTier)=>localStorage.setItem('pv-tier',tier);
export const loadIncidents=():Incident[]=>{try{return JSON.parse(localStorage.getItem('pv-incidents')||'null')||[seedIncident]}catch{return[seedIncident]}};
export const saveIncidents=(incidents:Incident[])=>localStorage.setItem('pv-incidents',JSON.stringify(incidents));
const seedLocations:LocationRecord[]=[{id:'loc-home',name:'Home',notes:'Primary residence',createdAt:now},{id:'loc-garage',name:'Garage',createdAt:now},{id:'loc-storage',name:'Storage unit',createdAt:now}];
export const loadLocations=():LocationRecord[]=>{try{return JSON.parse(localStorage.getItem('pv-locations')||'null')||seedLocations}catch{return seedLocations}};
export const saveLocations=(locations:LocationRecord[])=>localStorage.setItem('pv-locations',JSON.stringify(locations));
