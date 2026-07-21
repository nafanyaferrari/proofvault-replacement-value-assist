import type { InventoryItem } from './types';

export interface ItemReviewFlag {
  id: 'verify-serial' | 'review-ai-prefill' | 'add-make-model' | 'add-value' | 'add-photo' | 'add-supporting-doc';
  label: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ItemReviewQueueRecord {
  item: InventoryItem;
  flags: ItemReviewFlag[];
}

export interface ItemReviewIssueSummary {
  id: ItemReviewFlag['id'];
  label: string;
  count: number;
}

export interface ItemReviewBacklog {
  records: ItemReviewQueueRecord[];
  total: number;
  countsByFlag: Record<ItemReviewFlag['id'], number>;
  issueSummary: ItemReviewIssueSummary[];
}

const reviewIssueLabels: Record<ItemReviewFlag['id'], string> = {
  'verify-serial': 'Serial',
  'review-ai-prefill': 'AI review',
  'add-make-model': 'Make & model',
  'add-value': 'Value',
  'add-photo': 'Photo',
  'add-supporting-doc': 'Docs'
};

export function itemReviewFlags(item: InventoryItem): ItemReviewFlag[] {
  const flags: ItemReviewFlag[] = [];
  const notes = `${item.notes ?? ''} ${item.valuationNotes ?? ''}`.toLowerCase();
  const hasEstimatedValue = Boolean(item.estimatedReplacementValueSelected || item.userEnteredValue);

  const needsSerialVerification = item.serialNumber?.toUpperCase().startsWith('VERIFY-') || (!item.serialNumber && notes.includes('serial number requires user verification'));
  if (needsSerialVerification) {
    flags.push({
      id: 'verify-serial',
      label: 'Verify serial candidate',
      detail: 'Compare the serial number against the physical label, receipt, or serial photo.',
      priority: 'high'
    });
  }

  if (!item.aiFieldsReviewedAt && (item.aiDescription || item.aiSuggestedTitle || notes.includes('simulated photo intake'))) {
    flags.push({
      id: 'review-ai-prefill',
      label: 'Review AI-prefilled details',
      detail: 'Confirm make, model, description, condition, and accessories before relying on this record.',
      priority: 'medium'
    });
  }

  const missingIdentity = [
    !item.make?.trim() ? 'make' : '',
    !item.model?.trim() ? 'model' : ''
  ].filter(Boolean);
  if (missingIdentity.length) {
    flags.push({
      id: 'add-make-model',
      label: `Add ${missingIdentity.join(' and ')}`,
      detail: 'Make and model are the fastest details for matching the right replacement item.',
      priority: 'high'
    });
  }

  if (!hasEstimatedValue) {
    flags.push({
      id: 'add-value',
      label: 'Add a value',
      detail: 'Record a manual value or use Replacement Value Assist on Premium.',
      priority: 'medium'
    });
  }

  if (!item.photos.length) {
    flags.push({
      id: 'add-photo',
      label: 'Add an overview photo',
      detail: 'A broad item photo makes the record easier to recognize later.',
      priority: 'medium'
    });
  }

  if (!item.receiptFiles.length && !item.appraisalFiles.length) {
    flags.push({
      id: 'add-supporting-doc',
      label: 'Add receipt or appraisal if available',
      detail: 'Supporting documents strengthen value and ownership evidence.',
      priority: 'low'
    });
  }

  return flags;
}

export function itemReviewQueue(items: InventoryItem[], limit = 4): ItemReviewQueueRecord[] {
  const priority = { high: 0, medium: 1, low: 2 } as const;
  return items
    .filter(item => !item.archivedAt)
    .map(item => ({ item, flags: itemReviewFlags(item) }))
    .filter(record => record.flags.length > 0)
    .sort((a, b) => {
      const priorityDelta = priority[a.flags[0].priority] - priority[b.flags[0].priority];
      if (priorityDelta) return priorityDelta;
      return (a.item.updatedAt ?? '').localeCompare(b.item.updatedAt ?? '');
    })
    .slice(0, limit);
}

export function itemReviewBacklog(items: InventoryItem[], limit = 4): ItemReviewBacklog {
  const all = itemReviewQueue(items, items.length);
  const countsByFlag: ItemReviewBacklog['countsByFlag'] = {
    'verify-serial': 0,
    'review-ai-prefill': 0,
    'add-make-model': 0,
    'add-value': 0,
    'add-photo': 0,
    'add-supporting-doc': 0
  };
  all.forEach(record => record.flags.forEach(flag => { countsByFlag[flag.id] += 1; }));
  const issueSummary = (Object.keys(reviewIssueLabels) as ItemReviewFlag['id'][])
    .map(id => ({ id, label: reviewIssueLabels[id], count: countsByFlag[id] }))
    .filter(issue => issue.count > 0);
  return { records: all.slice(0, limit), total: all.length, countsByFlag, issueSummary };
}
