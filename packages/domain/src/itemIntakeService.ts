import type { Confidence, InventoryDraft, ValuationResult } from './types';
import { valuationService } from './valuationService';

export interface ItemIntakeInput { photoUri:string; location?:string; room?:string; }
export interface ItemIntakeResult {
  draft:InventoryDraft;
  suggestedTitle:string;
  suggestedDescription:string;
  fieldConfidence:Record<'make'|'model'|'serialNumber',Confidence>;
  needsSerialVerification:boolean;
  provider:'mock';
  valuation?:ValuationResult;
}
export interface ItemIntakeAnalyzer { analyze(input:ItemIntakeInput, includeValuation:boolean):Promise<ItemIntakeResult>; }

// Production photo recognition and OCR must run through a secure backend. Provider/API keys
// must never be shipped in the web or mobile client. This interface keeps that future adapter
// replaceable and prevents the intake UI from depending on a particular AI vendor.
export const itemIntakeService:ItemIntakeAnalyzer={
  async analyze(input,includeValuation){
    await new Promise(resolve=>setTimeout(resolve,650));
    const draft:InventoryDraft={itemName:'Cordless drill/driver kit',category:'Tools',location:input.location||'Unassigned',room:input.room||'',make:'Milwaukee',model:'M18',serialNumber:'VERIFY-48291',barcode:'',ownerMarking:'',markingType:'',markingLocation:'',markingNotes:'',distinguishingFeatures:'Red and black cordless drill with battery and carrying case',purchaseDate:'',userDescription:'Milwaukee M18 cordless drill/driver kit shown with battery and carrying case. Make, model, accessories, condition, and serial number should be verified against the physical item.',notes:'Created by simulated photo intake.',condition:'used',status:'normal'};
    return {draft,suggestedTitle:'Milwaukee M18 cordless drill/driver kit',suggestedDescription:draft.userDescription,fieldConfidence:{make:'high',model:'medium',serialNumber:'low'},needsSerialVerification:true,provider:'mock',valuation:includeValuation?await valuationService.findComparableValues({...draft,photos:[input.photoUri]}):undefined};
  }
};
