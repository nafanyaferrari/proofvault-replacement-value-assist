import { valuationService } from '../packages/domain/src/valuationService';
import type { Confidence, InventoryDraft, ItemCondition } from '../packages/domain/src/types';
import type { SecureItemIntakeRequest, SecureItemIntakeResponse } from '../packages/domain/src/itemIntakeBackendContract';
import { SERIAL_VERIFICATION_WARNING } from '../packages/domain/src/itemIntakeBackendContract';

interface VercelRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: unknown): void;
  setHeader(name: string, value: string): void;
}

interface AiItemJson {
  itemName?: string;
  category?: string;
  make?: string;
  model?: string;
  serialNumber?: string;
  barcode?: string;
  condition?: ItemCondition;
  distinguishingFeatures?: string;
  suggestedDescription?: string;
  confidence?: Partial<Record<'make' | 'model' | 'serialNumber' | 'barcode' | 'category' | 'condition', Confidence>>;
  warnings?: string[];
}

interface VerifiedUser { id:string; }

function headerValue(req: VercelRequest, name: string) {
  const value=req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value)?value[0]:value;
}

async function verifiedUser(req: VercelRequest): Promise<VerifiedUser> {
  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const authorization=headerValue(req,'authorization');
  if(!url||!anonKey||!authorization)throw new Error('Sign in is required for AI analysis.');
  const response=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anonKey,authorization}});
  if(!response.ok)throw new Error('Your sign-in session could not be verified.');
  return response.json();
}

async function consumeAiAssist(req: VercelRequest) {
  if(process.env.AI_USAGE_ENFORCEMENT!=='true')return;
  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceRoleKey)throw new Error('AI usage enforcement is not configured on the server.');
  const user=await verifiedUser(req);
  const response=await fetch(`${url}/rest/v1/rpc/proofvault_consume_ai_assist`,{
    method:'POST',
    headers:{apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`,'content-type':'application/json'},
    body:JSON.stringify({target_user_id:user.id,requested_feature:'photo_intake',requested_provider:process.env.GEMINI_API_KEY?'gemini-vision':process.env.OPENAI_API_KEY?'openai-vision':'mock'})
  });
  if(!response.ok)throw new Error('AI usage could not be checked.');
  const result=await response.json() as Array<{allowed:boolean;remaining:number}>;
  if(!result[0]?.allowed){const error=new Error('Your AI assist allowance is used. Add more assists or renew your plan.');(error as Error & { code?:string }).code='AI_USAGE_LIMIT';throw error;}
}

const categories = ['Tools','Electronics','Jewelry','Bicycles','Furniture','Collectibles','Other'];
const conditions: ItemCondition[] = ['new','used','refurbished','unknown'];
const confidenceValues: Confidence[] = ['low','medium','high'];

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, 500) : fallback;
}

function confidence(value: unknown): Confidence {
  return confidenceValues.includes(value as Confidence) ? value as Confidence : 'low';
}

function condition(value: unknown): ItemCondition {
  return conditions.includes(value as ItemCondition) ? value as ItemCondition : 'unknown';
}

function category(value: unknown) {
  const text = cleanText(value, 'Other');
  return categories.includes(text) ? text : 'Other';
}

function baseDraft(request: SecureItemIntakeRequest, ai: AiItemJson = {}): InventoryDraft {
  const serial = cleanText(ai.serialNumber);
  const make = cleanText(ai.make);
  const model = cleanText(ai.model);
  const itemName = cleanText(ai.itemName) || [make, model].filter(Boolean).join(' ') || 'Photo-documented item';
  const suggestedDescription = cleanText(ai.suggestedDescription, 'AI photo analysis created this draft. Verify all fields before relying on them for insurance, police, or recovery use.');
  return {
    itemName,
    category: category(ai.category),
    location: request.itemContext?.location || 'Unassigned',
    room: request.itemContext?.room || '',
    make,
    model,
    serialNumber: serial ? `VERIFY-${serial.replace(/^VERIFY-/i, '')}` : '',
    barcode: cleanText(ai.barcode),
    ownerMarking: '',
    markingType: '',
    markingLocation: '',
    markingNotes: '',
    distinguishingFeatures: cleanText(ai.distinguishingFeatures),
    purchaseDate: '',
    userDescription: suggestedDescription,
    notes: 'Created by secure backend photo analysis. User must verify all AI-filled identifiers.',
    condition: condition(ai.condition),
    status: 'normal'
  };
}

function mockResponse(request: SecureItemIntakeRequest): SecureItemIntakeResponse {
  const draft = baseDraft(request, {
    itemName: 'Cordless drill/driver kit',
    category: 'Tools',
    make: 'Milwaukee',
    model: 'M18',
    serialNumber: '48291',
    condition: 'used',
    distinguishingFeatures: 'Red and black cordless drill with battery and carrying case',
    suggestedDescription: 'Milwaukee M18 cordless drill/driver kit shown with battery and carrying case. Make, model, accessories, condition, and serial number should be verified against the physical item.'
  });
  return {
    draft,
    suggestedTitle: 'Milwaukee M18 cordless drill/driver kit',
    suggestedDescription: draft.userDescription,
    fields: {
      make: { value: draft.make, confidence: 'high', source: 'mock' },
      model: { value: draft.model, confidence: 'medium', source: 'mock' },
      serialNumber: { value: draft.serialNumber, confidence: 'low', source: 'mock' },
      category: { value: draft.category, confidence: 'high', source: 'mock' },
      condition: { value: draft.condition, confidence: 'medium', source: 'mock' }
    },
    warnings: ['AI provider is not configured yet; backend returned a mock photo-analysis result.', SERIAL_VERIFICATION_WARNING],
    needsSerialVerification: true,
    providersUsed: ['mock']
  };
}

function parseOpenAiText(payload: any) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const chunks = payload.output?.flatMap((item: any) => item.content ?? []) ?? [];
  return chunks.map((chunk: any) => chunk.text ?? '').join('\n');
}

function dataUrlParts(uri: string) {
  const match = uri.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Gemini test adapter currently expects an inline data URL image.');
  return { mimeType: match[1] || 'image/jpeg', data: match[2] };
}

function itemJsonSchema() {
  return {
    type: 'object',
    properties: {
      itemName: { type: 'string' },
      category: { type: 'string', enum: categories },
      make: { type: 'string' },
      model: { type: 'string' },
      serialNumber: { type: 'string' },
      barcode: { type: 'string' },
      condition: { type: 'string', enum: conditions },
      distinguishingFeatures: { type: 'string' },
      suggestedDescription: { type: 'string' },
      confidence: {
        type: 'object',
        properties: {
          make: { type: 'string', enum: confidenceValues },
          model: { type: 'string', enum: confidenceValues },
          serialNumber: { type: 'string', enum: confidenceValues },
          barcode: { type: 'string', enum: confidenceValues },
          category: { type: 'string', enum: confidenceValues },
          condition: { type: 'string', enum: confidenceValues }
        }
      },
      warnings: { type: 'array', items: { type: 'string' } }
    }
  };
}

function parseGeminiText(payload: any) {
  return payload.candidates?.flatMap((candidate: any) => candidate.content?.parts ?? [])
    .map((part: any) => part.text ?? '')
    .join('\n') ?? '';
}

async function analyzeWithGemini(request: SecureItemIntakeRequest): Promise<AiItemJson> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_VISION_MODEL || 'gemini-3.5-flash';
  if (!apiKey) throw new Error('Gemini is not configured.');

  const image = request.photos[0]?.uri;
  if (!image) throw new Error('At least one photo is required.');
  const inline = dataUrlParts(image);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            text: 'Analyze this household inventory item photo for an insurance/property documentation app. Return JSON only. Use empty strings for uncertain fields. Never invent serial numbers, barcodes, prices, or appraisals. If a serial number is not visibly legible, leave it empty and add a warning.'
          },
          {
            inline_data: {
              mime_type: inline.mimeType,
              data: inline.data
            }
          }
        ]
      }],
      generationConfig: {
        response_mime_type: 'application/json',
        response_schema: itemJsonSchema()
      }
    })
  });
  if (!response.ok) throw new Error(`Gemini photo analysis failed: ${response.status}`);
  const text = parseGeminiText(await response.json());
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Gemini response was not valid JSON.');
  return JSON.parse(text.slice(start, end + 1));
}

async function analyzeWithOpenAi(request: SecureItemIntakeRequest): Promise<AiItemJson> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL;
  if (!apiKey || !model) throw new Error('OpenAI is not configured.');

  const image = request.photos[0]?.uri;
  if (!image) throw new Error('At least one photo is required.');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: 'Analyze this household inventory item photo. Return only JSON with: itemName, category, make, model, serialNumber, barcode, condition, distinguishingFeatures, suggestedDescription, confidence, warnings. Use empty strings for uncertain fields. Prefix nothing with VERIFY; the app will do that. Never claim a serial number unless it is visibly legible.' },
          { type: 'input_image', image_url: image }
        ]
      }]
    })
  });
  if (!response.ok) throw new Error(`OpenAI photo analysis failed: ${response.status}`);
  const text = parseOpenAiText(await response.json());
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI response was not valid JSON.');
  return JSON.parse(text.slice(start, end + 1));
}

function responseFromAi(request: SecureItemIntakeRequest, ai: AiItemJson, source: 'gemini-vision' | 'openai-vision'): SecureItemIntakeResponse {
  const draft = baseDraft(request, ai);
  const warnings = [...(ai.warnings ?? []), SERIAL_VERIFICATION_WARNING];
  return {
    draft,
    suggestedTitle: draft.itemName,
    suggestedDescription: draft.userDescription,
    fields: {
      make: draft.make ? { value: draft.make, confidence: confidence(ai.confidence?.make), source } : undefined,
      model: draft.model ? { value: draft.model, confidence: confidence(ai.confidence?.model), source } : undefined,
      serialNumber: draft.serialNumber ? { value: draft.serialNumber, confidence: 'low', source } : undefined,
      barcode: draft.barcode ? { value: draft.barcode, confidence: 'low', source } : undefined,
      category: { value: draft.category, confidence: confidence(ai.confidence?.category), source },
      condition: { value: draft.condition, confidence: confidence(ai.confidence?.condition), source }
    },
    warnings,
    needsSerialVerification: Boolean(draft.serialNumber),
    providersUsed: [source]
  };
}

async function analyzeWithConfiguredProvider(request: SecureItemIntakeRequest) {
  if (process.env.GEMINI_API_KEY) return responseFromAi(request, await analyzeWithGemini(request), 'gemini-vision');
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_VISION_MODEL) return responseFromAi(request, await analyzeWithOpenAi(request), 'openai-vision');
  return mockResponse(request);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const request = req.body as SecureItemIntakeRequest;
  if (!request?.photos?.length) return res.status(400).json({ error: 'At least one photo is required.' });

  try {
    await consumeAiAssist(req);
    const response = await analyzeWithConfiguredProvider(request);

    if (request.includeValuation) {
      response.valuation = await valuationService.findComparableValues({ ...response.draft, photos: request.photos.map(photo => photo.uri) });
    }

    return res.status(200).json(response);
  } catch (error) {
    const code=(error as Error & { code?:string }).code || (process.env.AI_USAGE_ENFORCEMENT==='true' ? 'AI_USAGE_DENIED' : undefined);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Photo analysis failed.',
      code
    });
  }
}
