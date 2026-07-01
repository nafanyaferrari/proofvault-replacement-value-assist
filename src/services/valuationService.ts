import { ComparableListing, ValuationInput, ValuationResult } from '../types';
import { uid } from '../lib/utils';

export const VALUATION_DISCLAIMER = 'This is an approximate replacement estimate based on comparable marketplace listings. It is not an appraisal, guarantee of coverage, or confirmed insurance value.';
export interface MarketplaceAdapter { readonly id: string; search(input: ValuationInput): Promise<ComparableListing[]>; }
export type EbayAdapter = MarketplaceAdapter;
export type AmazonAdapter = MarketplaceAdapter;
export type WalmartAdapter = MarketplaceAdapter;
export type BestBuyAdapter = MarketplaceAdapter;
export type ManualComparableAdapter = MarketplaceAdapter;
// Future live searches must run through a secure backend. Never expose marketplace API keys in this client.
const catalog: Record<string, Array<[string,string,number,'new'|'used'|'refurbished']>> = {
 tools:[['M18 1/2 in. Drill/Driver Kit','Tool Market',249,'new'],['M18 Brushless Drill Kit','Resale Hub',159,'used'],['M18 Drill Kit — Certified','Outlet Store',199,'refurbished']],
 jewelry:[['Comparable Gold Wedding Band','Jewelry Market',1350,'new'],['Pre-owned Gold Band','Estate Market',925,'used']],
 electronics:[['Current Equivalent Laptop','Tech Retail',1099,'new'],['Certified Refurbished Laptop','ReTech',799,'refurbished'],['Used Comparable Laptop','Resale Hub',675,'used']],
 bicycles:[['Comparable Trek Hybrid Bicycle','Cycle Shop',899,'new'],['Used Trek Hybrid Bicycle','Bike Exchange',625,'used']],
 other:[['Comparable Replacement Item','General Retail',199,'new'],['Used Comparable Item','Resale Hub',125,'used']]
};
export const valuationService={async findComparableValues(input:ValuationInput):Promise<ValuationResult>{
 await new Promise(r=>setTimeout(r,450)); const cat=(input.category||'').toLowerCase(); const key=cat.includes('tool')?'tools':cat.includes('jewel')?'jewelry':cat.includes('elect')?'electronics':cat.includes('bicy')?'bicycles':'other'; const checkedAt=new Date().toISOString(); const q=encodeURIComponent([input.make,input.model,input.itemName].filter(Boolean).join(' '));
 const comparableListings=catalog[key].map(([title,marketplace,price,condition],i):ComparableListing=>({id:uid('comp'),title,marketplace,condition,price,currency:'USD',url:`https://www.google.com/search?q=${q}&tbm=shop&result=${i+1}`,matchReason:i===0?'Closest current replacement by make, category, and product details':`Similar ${condition} item in the same category`,matchConfidence:input.make&&input.model?'high':'medium',checkedAt}));
 const prices=comparableListings.map(x=>x.price); const missingFields=['make','model','condition'].filter(k=>!input[k as keyof ValuationInput]); return {estimatedReplacementValueLow:Math.min(...prices),estimatedReplacementValueHigh:Math.max(...prices),suggestedReplacementValue:Math.round(prices.reduce((a,b)=>a+b,0)/prices.length),confidence:missingFields.length?'medium':'high',sourceSummary:`${comparableListings.length} comparable listings across ${new Set(comparableListings.map(x=>x.marketplace)).size} sources`,comparableListings,missingFields,disclaimer:VALUATION_DISCLAIMER};
}};
