import { Incident, InventoryItem, SubscriptionTier } from '../types';
import { dateTime, money } from '../lib/utils';
import { VALUATION_DISCLAIMER } from './valuationService';

const count = (values?: string[]) => values?.length ?? 0;
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const html = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

export function incidentReport(incident: Incident, items: InventoryItem[], tier: SubscriptionTier) {
  const rows = incident.items.map(affected => {
    const item = items.find(candidate => candidate.id === affected.itemId);
    if (!item) return '';
    const links = tier === 'premium' && item.comparableListings.length
      ? item.comparableListings.map(comparable => `- ${comparable.title} (${comparable.condition}): ${money(comparable.price, comparable.currency)} — ${comparable.url}`).join('\n')
      : 'Not included';
    return `ITEM: ${item.itemName}
Status: ${affected.status.toUpperCase()}
Serial Number: ${item.serialNumber || 'Not recorded'}
Serial Number Photos: ${count(item.serialPhotos)}
Owner-Applied Marking: ${item.ownerMarking || 'Not recorded'}
Location of Marking: ${item.markingLocation || 'Not recorded'}
Photo of Marking: ${count(item.markingPhotos)} attached
Other Distinguishing Characteristics: ${item.distinguishingFeatures || 'Not recorded'}
General Item Photos: ${count(item.photos)}
Incident-Specific Photos: ${count(affected.photos)}
Damage/Loss Photos: ${count(item.damagePhotos)}
Receipts: ${count(item.receiptFiles)} | Appraisals: ${count(item.appraisalFiles)} | Warranties: ${count(item.warrantyFiles)} | Other Documents: ${count(item.otherFiles)}
User-entered value: ${money(item.userEnteredValue)}
Approximate replacement estimate based on comparable listings: ${money(item.estimatedReplacementValueSelected)}
Estimate range: ${money(item.estimatedReplacementValueLow)}–${money(item.estimatedReplacementValueHigh)}
Confidence: ${item.valuationConfidence || 'Not estimated'}
Checked: ${dateTime(item.valuationCheckedAt)}
Comparable item links:
${links}
Incident Notes: ${affected.notes || 'None'}
Item Notes: ${item.notes || 'None'}

${VALUATION_DISCLAIMER}`;
  }).join('\n\n------------------------------\n\n');
  return `PROOFVAULT INCIDENT PACKET

${incident.title}
Type: ${incident.type}
Date: ${incident.incidentDate}
Location: ${incident.location}
Owner: ${incident.ownerName || 'Not recorded'}
Phone: ${incident.ownerPhone || 'Not recorded'}
Email: ${incident.ownerEmail || 'Not recorded'}
Address: ${incident.ownerAddress || 'Not recorded'}
Police agency: ${incident.policeAgency || 'Not recorded'}
Police case: ${incident.policeCaseNumber || 'Not recorded'}
Insurance: ${incident.insuranceCompany || 'Not recorded'}
Claim: ${incident.insuranceClaimNumber || 'Not recorded'}
Incident notes: ${incident.notes || 'None'}

AFFECTED PROPERTY

${rows}`;
}

export function incidentCsv(incident: Incident, items: InventoryItem[], tier: SubscriptionTier) {
  const header = ['Owner','Phone','Email','Address','Item','Status','Serial Number','Serial Photos','Owner-Applied Marking','Marking Location','Marking Photos','Make','Model','Item Photos','Incident Photos','Damage Photos','Receipts','Appraisals','Warranties','User Value','Replacement Estimate','Confidence','Checked At','Comparable Links','Incident Notes'];
  const rows = incident.items.map(affected => {
    const item = items.find(candidate => candidate.id === affected.itemId);
    if (!item) return [];
    const links = tier === 'premium' ? item.comparableListings.map(comparable => comparable.url).join(' | ') : '';
    return [incident.ownerName,incident.ownerPhone,incident.ownerEmail,incident.ownerAddress,item.itemName,affected.status,item.serialNumber,count(item.serialPhotos),item.ownerMarking,item.markingLocation,count(item.markingPhotos),item.make,item.model,count(item.photos),count(affected.photos),count(item.damagePhotos),count(item.receiptFiles),count(item.appraisalFiles),count(item.warrantyFiles),item.userEnteredValue,item.estimatedReplacementValueSelected,item.valuationConfidence,item.valuationCheckedAt,links,affected.notes];
  });
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

function imageGroup(label: string, values?: string[]) {
  const images = (values ?? []).filter(value => value.startsWith('data:image'));
  if (!images.length) return '';
  return `<div class="evidence"><h4>${html(label)}</h4><div class="photos">${images.map((value,index)=>`<figure><img src="${value}" alt="${html(label)} ${index+1}"><figcaption>${html(label)} ${index+1}</figcaption></figure>`).join('')}</div></div>`;
}

export function printableIncidentHtml(incident: Incident, items: InventoryItem[], tier: SubscriptionTier) {
  const cards = incident.items.map(affected => {
    const item = items.find(candidate => candidate.id === affected.itemId);
    if (!item) return '';
    const links = tier === 'premium' ? item.comparableListings.map(comparable => `<li><a href="${html(comparable.url)}">${html(comparable.title)}</a> — ${html(money(comparable.price, comparable.currency))}</li>`).join('') : '';
    const evidence = [imageGroup('Item photo',item.photos),imageGroup('Serial number photo',item.serialPhotos),imageGroup('Owner-applied marking photo',item.markingPhotos),imageGroup('Incident-specific photo',affected.photos),imageGroup('Damage/loss photo',item.damagePhotos),imageGroup('Receipt',item.receiptFiles),imageGroup('Appraisal',item.appraisalFiles),imageGroup('Warranty',item.warrantyFiles),imageGroup('Other documentation',item.otherFiles)].join('');
    const pdfCount = [...item.receiptFiles,...item.appraisalFiles,...item.warrantyFiles,...(item.otherFiles??[])].filter(value=>value.startsWith('data:application/pdf')).length;
    return `<section><h2>${html(item.itemName)} <span>${html(affected.status.toUpperCase())}</span></h2>${evidence}<dl><dt>Serial Number</dt><dd>${html(item.serialNumber||'Not recorded')}</dd><dt>Owner-Applied Marking</dt><dd>${html(item.ownerMarking||'Not recorded')}</dd><dt>Location of Marking</dt><dd>${html(item.markingLocation||'Not recorded')}</dd><dt>Photo of Marking</dt><dd>${count(item.markingPhotos)} attached</dd><dt>Other Distinguishing Characteristics</dt><dd>${html(item.distinguishingFeatures||'Not recorded')}</dd><dt>Make / Model</dt><dd>${html([item.make,item.model].filter(Boolean).join(' ')||'Not recorded')}</dd><dt>User-entered value</dt><dd>${html(money(item.userEnteredValue))}</dd><dt>Approximate replacement estimate based on comparable listings</dt><dd>${html(money(item.estimatedReplacementValueSelected))}</dd><dt>Confidence / checked</dt><dd>${html(item.valuationConfidence||'Not estimated')} · ${html(dateTime(item.valuationCheckedAt))}</dd><dt>PDF supporting documents</dt><dd>${pdfCount}</dd><dt>Incident notes</dt><dd>${html(affected.notes||'None')}</dd><dt>Item notes</dt><dd>${html(item.notes||'None')}</dd></dl>${links?`<h3>Comparable listings</h3><ul>${links}</ul>`:''}<p class="disclaimer">${html(VALUATION_DISCLAIMER)}</p></section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${html(incident.title)} — ProofVault</title><style>body{font:14px Arial,sans-serif;color:#172026;max-width:850px;margin:32px auto;padding:0 24px}header{border-bottom:3px solid #1b7f62;margin-bottom:24px}h1{margin-bottom:5px}section{page-break-inside:avoid;border:1px solid #ccd5d8;padding:18px;margin:16px 0}h2 span{font-size:11px;color:#a43b35}dl{display:grid;grid-template-columns:210px 1fr;gap:7px}dt{font-weight:bold}.evidence h4{margin-bottom:6px}.photos{display:flex;flex-wrap:wrap;gap:8px}.photos figure{margin:0}.photos img{width:150px;height:105px;object-fit:cover}.photos figcaption{font-size:9px;color:#65727a}.disclaimer{font-size:10px;color:#65727a;border-top:1px solid #ddd;padding-top:9px}@media print{body{margin:0}}</style></head><body><header><small>PROOFVAULT INCIDENT PACKET</small><h1>${html(incident.title)}</h1><p>${html(incident.type)} · ${html(incident.incidentDate)} · ${html(incident.location)}</p><h3>Owner / contact</h3><p>${html(incident.ownerName||'Not recorded')}<br>${html(incident.ownerPhone||'Not recorded')} · ${html(incident.ownerEmail||'Not recorded')}<br>${html(incident.ownerAddress||'Not recorded')}</p><p>Police: ${html(incident.policeAgency||'Not recorded')} · Case: ${html(incident.policeCaseNumber||'Not recorded')}<br>Insurance: ${html(incident.insuranceCompany||'Not recorded')} · Claim: ${html(incident.insuranceClaimNumber||'Not recorded')}</p></header>${cards}<script>window.addEventListener('load',()=>window.print())<\/script></body></html>`;
}
