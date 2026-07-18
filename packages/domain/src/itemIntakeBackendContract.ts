import type { Confidence, InventoryDraft, ValuationResult } from './types';
import type { ItemIntakeAnalyzer, ItemIntakeInput, ItemIntakeResult } from './itemIntakeService';

export type IntakeBackendProvider = 'gemini-vision' | 'openai-vision' | 'document-ocr' | 'marketplace-valuations' | 'manual-review' | 'mock';

export interface IntakePhotoReference {
  uri: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sha256?: string;
}

export interface IntakeFieldCandidate<T = string> {
  value: T;
  confidence: Confidence;
  source: IntakeBackendProvider;
  evidence?: string;
}

export interface SecureItemIntakeRequest {
  photos: IntakePhotoReference[];
  itemContext?: {
    location?: string;
    room?: string;
    userHint?: string;
    categoryHint?: string;
  };
  includeValuation: boolean;
}

export interface SecureItemIntakeResponse {
  draft: InventoryDraft;
  suggestedTitle: string;
  suggestedDescription: string;
  fields: {
    make?: IntakeFieldCandidate;
    model?: IntakeFieldCandidate;
    serialNumber?: IntakeFieldCandidate;
    barcode?: IntakeFieldCandidate;
    category?: IntakeFieldCandidate;
    condition?: IntakeFieldCandidate;
  };
  warnings: string[];
  needsSerialVerification: boolean;
  providersUsed: IntakeBackendProvider[];
  valuation?: ValuationResult;
}

export interface SecureItemIntakeBackendClient {
  analyzeItem(request: SecureItemIntakeRequest): Promise<SecureItemIntakeResponse>;
}

export const SERIAL_VERIFICATION_WARNING =
  'Serial numbers and barcodes extracted from photos must be reviewed by the user before they are treated as documented evidence.';

// Future live photo recognition, OCR, and marketplace searches should call a secure backend
// that implements SecureItemIntakeBackendClient. Do not put OpenAI, OCR, eBay, Amazon,
// Walmart, Best Buy, or other provider API keys in the web or mobile app.
export function createSecureBackendItemIntakeAnalyzer(client: SecureItemIntakeBackendClient): ItemIntakeAnalyzer {
  return {
    async analyze(input: ItemIntakeInput, includeValuation: boolean): Promise<ItemIntakeResult> {
      const response = await client.analyzeItem({
        photos: [{ uri: input.photoUri }],
        itemContext: { location: input.location, room: input.room },
        includeValuation
      });

      return {
        draft: response.draft,
        suggestedTitle: response.suggestedTitle,
        suggestedDescription: response.suggestedDescription,
        fieldConfidence: {
          make: response.fields.make?.confidence ?? 'low',
          model: response.fields.model?.confidence ?? 'low',
          serialNumber: response.fields.serialNumber?.confidence ?? 'low'
        },
        needsSerialVerification: response.needsSerialVerification,
        provider: response.providersUsed.includes('mock') ? 'mock' : 'secure-backend',
        warnings: response.warnings,
        valuation: response.valuation
      };
    }
  };
}
