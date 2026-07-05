import type { SQLiteDatabase } from 'expo-sqlite';
import { uid, type AttachmentType, type InventoryDraft, type InventoryItem, type LocationRecord, type SubscriptionTier, type ValuationResult } from '@proofvault/domain';
import { schema } from './schema';

type ItemRow = { id: string; item_name: string; category: string; location_text: string; make: string | null; model: string | null; serial_number: string | null; owner_marking:string|null; marking_location:string|null; distinguishing_features:string|null; user_description:string|null; user_entered_value: number | null; condition: InventoryItem['condition']; status: InventoryItem['status']; archived_at:string|null; created_at: string; updated_at: string };

const emptyEvidence = { comparableListings: [], photos: [], serialPhotos: [], markingPhotos: [], receiptFiles: [], appraisalFiles: [], warrantyFiles: [] };
const fromRow = (row: ItemRow): InventoryItem => ({ id: row.id, itemName: row.item_name, category: row.category, location: row.location_text, make: row.make ?? undefined, model: row.model ?? undefined, serialNumber: row.serial_number ?? undefined, ownerMarking:row.owner_marking??undefined, markingLocation:row.marking_location??undefined, distinguishingFeatures:row.distinguishing_features??undefined, userDescription:row.user_description??undefined, userEnteredValue: row.user_entered_value ?? undefined, condition: row.condition, status: row.status, archivedAt:row.archived_at??undefined, createdAt: row.created_at, updatedAt: row.updated_at, ...emptyEvidence });

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(schema);
  const incidentColumns=await db.getAllAsync<{name:string}>('PRAGMA table_info(incidents)');
  const existing=new Set(incidentColumns.map(column=>column.name));
  for(const column of ['owner_name','owner_phone','owner_email','owner_address','police_agency','police_case_number','insurance_company','insurance_claim_number'])if(!existing.has(column))await db.execAsync(`ALTER TABLE incidents ADD COLUMN ${column} TEXT`);
  const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM inventory_items');
  if (!result?.count) {
    const now = new Date().toISOString();
    await db.runAsync('INSERT INTO inventory_items (id,item_name,category,location_text,make,model,serial_number,user_entered_value,condition,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', 'item_demo_drill', 'M18 Drill/Driver Kit', 'Tools', 'Garage', 'Milwaukee', 'M18', 'PV-M18-48291', 225, 'used', 'normal', now, now);
  }
}

export async function listInventory(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<ItemRow>('SELECT id,item_name,category,location_text,make,model,serial_number,owner_marking,marking_location,distinguishing_features,user_description,user_entered_value,condition,status,archived_at,created_at,updated_at FROM inventory_items WHERE archived_at IS NULL ORDER BY updated_at DESC');
  return rows.map(fromRow);
}

export async function listArchivedInventory(db:SQLiteDatabase){const rows=await db.getAllAsync<ItemRow>('SELECT id,item_name,category,location_text,make,model,serial_number,owner_marking,marking_location,distinguishing_features,user_description,user_entered_value,condition,status,archived_at,created_at,updated_at FROM inventory_items WHERE archived_at IS NOT NULL ORDER BY archived_at DESC');return rows.map(fromRow);}
export async function archiveInventoryItem(db:SQLiteDatabase,itemId:string){const now=new Date().toISOString();await db.runAsync('UPDATE inventory_items SET archived_at=?,updated_at=? WHERE id=?',now,now,itemId);}
export async function restoreInventoryItem(db:SQLiteDatabase,itemId:string){await db.runAsync('UPDATE inventory_items SET archived_at=NULL,updated_at=? WHERE id=?',new Date().toISOString(),itemId);}
export async function listLocations(db:SQLiteDatabase):Promise<LocationRecord[]>{return await db.getAllAsync<LocationRecord>('SELECT id,name,notes,created_at AS createdAt FROM locations ORDER BY name COLLATE NOCASE');}
export async function addLocation(db:SQLiteDatabase,name:string){const now=new Date().toISOString();await db.runAsync('INSERT INTO locations(id,name,created_at,updated_at) VALUES (?,?,?,?)',uid('location'),name.trim(),now,now);}

export async function getSubscriptionTier(db: SQLiteDatabase): Promise<SubscriptionTier> {
  const setting=await db.getFirstAsync<{value:string}>('SELECT value FROM app_settings WHERE key = ?', 'subscriptionTier');
  return setting?.value==='premium'?'premium':'free';
}

export async function setSubscriptionTier(db: SQLiteDatabase, tier: SubscriptionTier) {
  await db.runAsync('INSERT INTO app_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', 'subscriptionTier', tier, new Date().toISOString());
}

export async function saveInventoryItem(db: SQLiteDatabase, draft: InventoryDraft, itemId?: string) {
  const now = new Date().toISOString();
  if (itemId) {
    await db.runAsync('UPDATE inventory_items SET item_name=?,category=?,location_text=?,make=?,model=?,serial_number=?,has_owner_marking=?,owner_marking=?,marking_location=?,distinguishing_features=?,user_description=?,user_entered_value=?,condition=?,updated_at=? WHERE id=?', draft.itemName.trim(), draft.category.trim(), draft.location.trim(), draft.make.trim()||null, draft.model.trim()||null, draft.serialNumber.trim()||null, draft.ownerMarking.trim()?1:0, draft.ownerMarking.trim()||null, draft.markingLocation.trim()||null, draft.distinguishingFeatures.trim()||null, draft.userDescription.trim()||null, draft.userEnteredValue??null, draft.condition, now, itemId);
    return itemId;
  }
  const id=uid('item');
  await db.runAsync('INSERT INTO inventory_items (id,item_name,category,location_text,make,model,serial_number,has_owner_marking,owner_marking,marking_location,distinguishing_features,user_description,user_entered_value,condition,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id, draft.itemName.trim(), draft.category.trim(), draft.location.trim(), draft.make.trim()||null, draft.model.trim()||null, draft.serialNumber.trim()||null, draft.ownerMarking.trim()?1:0, draft.ownerMarking.trim()||null, draft.markingLocation.trim()||null, draft.distinguishingFeatures.trim()||null, draft.userDescription.trim()||null, draft.userEnteredValue??null, draft.condition, 'normal', now, now);
  return id;
}

export async function getLatestValuation(db: SQLiteDatabase, item: InventoryItem): Promise<InventoryItem> {
  const attachments = await db.getAllAsync<{ local_uri: string; attachment_type: string }>('SELECT local_uri,attachment_type FROM item_attachments WHERE item_id = ? ORDER BY created_at', item.id);
  const hydratedItem: InventoryItem = {
    ...item,
    photos: attachments.filter(file => file.attachment_type === 'item').map(file => file.local_uri),
    serialPhotos: attachments.filter(file => file.attachment_type === 'serial').map(file => file.local_uri),
    markingPhotos: attachments.filter(file => file.attachment_type === 'marking').map(file => file.local_uri),
    receiptFiles: attachments.filter(file => file.attachment_type === 'receipt').map(file => file.local_uri),
    appraisalFiles: attachments.filter(file => file.attachment_type === 'appraisal').map(file => file.local_uri),
    warrantyFiles: attachments.filter(file => file.attachment_type === 'warranty').map(file => file.local_uri),
    damagePhotos: attachments.filter(file => file.attachment_type === 'damage').map(file => file.local_uri),
    otherFiles: attachments.filter(file => file.attachment_type === 'other').map(file => file.local_uri),
  };
  const valuation = await db.getFirstAsync<{ id:string; estimated_low:number|null; estimated_high:number|null; selected_value:number|null; currency:string; confidence:InventoryItem['valuationConfidence']; source_summary:string|null; checked_at:string|null; notes:string|null }>('SELECT id,estimated_low,estimated_high,selected_value,currency,confidence,source_summary,checked_at,notes FROM valuation_records WHERE item_id = ? ORDER BY checked_at DESC LIMIT 1', item.id);
  if (!valuation) return hydratedItem;
  const comparableListings = await db.getAllAsync<{ id:string; title:string; marketplace:string; condition:InventoryItem['condition']; price:number; currency:string; url:string; image_url:string|null; match_reason:string; match_confidence:'low'|'medium'|'high'; checked_at:string }>('SELECT id,title,marketplace,condition,price,currency,url,image_url,match_reason,match_confidence,checked_at FROM comparable_listings WHERE valuation_id = ? ORDER BY price DESC', valuation.id);
  return { ...hydratedItem, estimatedReplacementValueLow: valuation.estimated_low ?? undefined, estimatedReplacementValueHigh: valuation.estimated_high ?? undefined, estimatedReplacementValueSelected: valuation.selected_value ?? undefined, valuationCurrency: valuation.currency, valuationConfidence: valuation.confidence ?? undefined, valuationSourceSummary: valuation.source_summary ?? undefined, valuationCheckedAt: valuation.checked_at ?? undefined, valuationNotes: valuation.notes ?? undefined, comparableListings: comparableListings.map(listing => ({ id:listing.id, title:listing.title, marketplace:listing.marketplace, condition:listing.condition, price:listing.price, currency:listing.currency, url:listing.url, imageUrl:listing.image_url ?? undefined, matchReason:listing.match_reason, matchConfidence:listing.match_confidence, checkedAt:listing.checked_at })) };
}

export async function saveItemAttachment(db: SQLiteDatabase, itemId: string, attachmentType: AttachmentType, uri: string, mimeType?: string, originalName?: string) {
  await db.runAsync('INSERT INTO item_attachments (id,item_id,attachment_type,local_uri,mime_type,original_name,created_at) VALUES (?,?,?,?,?,?,?)', `attachment_${Date.now()}`, itemId, attachmentType, uri, mimeType ?? null, originalName ?? null, new Date().toISOString());
}

export async function saveValuation(db: SQLiteDatabase, itemId: string, result: ValuationResult) {
  const id = `valuation_${Date.now()}`;
  const checkedAt = result.comparableListings[0]?.checkedAt ?? new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO valuation_records (id,item_id,estimated_low,estimated_high,selected_value,currency,confidence,source_summary,checked_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', id, itemId, result.estimatedReplacementValueLow, result.estimatedReplacementValueHigh, result.suggestedReplacementValue, 'USD', result.confidence, result.sourceSummary, checkedAt, checkedAt, checkedAt);
    for (const listing of result.comparableListings) await db.runAsync('INSERT INTO comparable_listings (id,valuation_id,title,marketplace,condition,price,currency,url,image_url,match_reason,match_confidence,checked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', listing.id, id, listing.title, listing.marketplace, listing.condition, listing.price, listing.currency, listing.url, listing.imageUrl ?? null, listing.matchReason, listing.matchConfidence, listing.checkedAt);
  });
}
