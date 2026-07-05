export type SubscriptionTier = 'free' | 'premium';
export type Confidence = 'low' | 'medium' | 'high';
export type ItemCondition = 'new' | 'used' | 'refurbished' | 'unknown';
export type ItemStatus = 'normal' | 'stolen' | 'damaged' | 'destroyed' | 'missing' | 'recovered';
export type AttachmentType = 'item' | 'serial' | 'marking' | 'receipt' | 'appraisal' | 'warranty' | 'damage' | 'other';

export interface LocationRecord { id: string; name: string; notes?: string; createdAt: string; }
export interface ComparableListing { id: string; title: string; marketplace: string; condition: ItemCondition; price: number; currency: string; url: string; imageUrl?: string; matchReason: string; matchConfidence: Confidence; checkedAt: string; }
export interface InventoryItem {
  id: string; itemName: string; aiSuggestedTitle?: string; aiDescription?: string; userDescription?: string;
  category: string; location: string; room?: string; make?: string; model?: string; serialNumber?: string;
  barcode?: string; ownerMarking?: string; markingType?: string; markingLocation?: string;
  distinguishingFeatures?: string; purchaseDate?: string; condition: ItemCondition; purchasePrice?: number;
  userEnteredValue?: number; estimatedReplacementValueLow?: number; estimatedReplacementValueHigh?: number;
  estimatedReplacementValueSelected?: number; valuationCurrency?: string; valuationConfidence?: Confidence;
  valuationSourceSummary?: string; valuationCheckedAt?: string; valuationNotes?: string;
  comparableListings: ComparableListing[]; photos: string[]; serialPhotos: string[]; markingPhotos: string[];
  markingNotes?: string; hasOwnerMarking?: boolean; damagePhotos?: string[]; otherFiles?: string[];
  receiptFiles: string[]; appraisalFiles: string[]; warrantyFiles: string[]; status: ItemStatus;
  notes?: string; archivedAt?: string; createdAt: string; updatedAt: string;
}
export interface IncidentItem { itemId: string; status: Exclude<ItemStatus, 'normal'>; notes?: string; photos?: string[]; }
export interface Incident { id: string; title: string; type: string; incidentDate: string; location: string; policeAgency?: string; policeCaseNumber?: string; insuranceCompany?: string; insuranceClaimNumber?: string; ownerName?: string; ownerPhone?: string; ownerEmail?: string; ownerAddress?: string; notes?: string; items: IncidentItem[]; createdAt: string; }
export interface IncidentDraft { title:string; type:string; incidentDate:string; location:string; ownerName:string; ownerPhone:string; ownerEmail:string; ownerAddress:string; policeAgency:string; policeCaseNumber:string; insuranceCompany:string; insuranceClaimNumber:string; notes:string; items:IncidentItem[]; }
export interface ValuationInput { itemName: string; category?: string; make?: string; model?: string; serialNumber?: string; barcode?: string; aiDescription?: string; userDescription?: string; condition?: ItemCondition; photos?: string[]; }
export interface InventoryDraft { itemName:string; category:string; location:string; room:string; make:string; model:string; serialNumber:string; barcode:string; ownerMarking:string; markingType:string; markingLocation:string; markingNotes:string; distinguishingFeatures:string; purchaseDate:string; purchasePrice?:number; userDescription:string; notes:string; userEnteredValue?:number; condition:ItemCondition; status:ItemStatus; }
export interface ValuationResult { estimatedReplacementValueLow: number; estimatedReplacementValueHigh: number; suggestedReplacementValue: number; confidence: Confidence; sourceSummary: string; comparableListings: ComparableListing[]; missingFields: string[]; disclaimer: string; }
