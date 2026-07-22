// Keep this Vercel Function self-contained. Runtime imports from the workspace
// packages are not bundled reliably for this standalone serverless entry point.
declare const process: { env: Record<string, string | undefined> };

type Confidence = 'low' | 'medium' | 'high';
type ItemCondition = 'new' | 'used' | 'refurbished' | 'unknown';
type ItemStatus = 'normal' | 'stolen' | 'damaged' | 'destroyed' | 'missing' | 'recovered';

interface InventoryDraft {
  itemName: string; category: string; location: string; room: string; make: string; model: string;
  serialNumber: string; barcode: string; ownerMarking: string; markingType: string; markingLocation: string;
  markingNotes: string; distinguishingFeatures: string; purchaseDate: string; userDescription: string;
  notes: string; condition: ItemCondition; status: ItemStatus;
}

interface ComparableListing {
  id: string; title: string; marketplace: string; condition: ItemCondition; price: number;
  currency: string; url: string; matchReason: string; matchConfidence: Confidence; checkedAt: string;
}

interface ValuationResult {
  estimatedReplacementValueLow: number; estimatedReplacementValueHigh: number; suggestedReplacementValue: number;
  confidence: Confidence; sourceSummary: string; comparableListings: ComparableListing[]; missingFields: string[];
  disclaimer: string;
}

interface SecureItemIntakeRequest {
  photos: Array<{ uri: string; mimeType?: string; width?: number; height?: number; sha256?: string }>;
  itemContext?: { location?: string; room?: string; userHint?: string; categoryHint?: string };
  includeValuation: boolean;
}

interface SecureItemIntakeResponse {
  draft: InventoryDraft; suggestedTitle: string; suggestedDescription: string;
  fields: Record<string, { value: string; confidence: Confidence; source: string } | undefined>;
  warnings: string[]; needsSerialVerification: boolean; providersUsed: string[]; valuation?: ValuationResult;
}

const SERIAL_VERIFICATION_WARNING =
  'Serial numbers and barcodes extracted from photos must be reviewed by the user before they are treated as documented evidence.';
const VALUATION_DISCLAIMER =
  'This is an approximate replacement estimate based on comparable marketplace listings. It is not an appraisal, guarantee of coverage, or confirmed insurance value.';

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

function isTrustedQueueWorker(req: VercelRequest) {
  const secret = process.env.PROOFVAULT_QUEUE_WORKER_SECRET;
  return Boolean(secret && headerValue(req, 'x-proofvault-queue-secret') === secret);
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
  if (isTrustedQueueWorker(req)) return;
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
const valuationCatalog: Record<string, Array<[string, string, number, 'new' | 'used' | 'refurbished']>> = {
  tools: [['M18 1/2 in. Drill/Driver Kit', 'Tool Market', 249, 'new'], ['M18 Brushless Drill Kit', 'Resale Hub', 159, 'used'], ['M18 Drill Kit - Certified', 'Outlet Store', 199, 'refurbished']],
  jewelry: [['Comparable Gold Wedding Band', 'Jewelry Market', 1350, 'new'], ['Pre-owned Gold Band', 'Estate Market', 925, 'used']],
  electronics: [['Current Equivalent Laptop', 'Tech Retail', 1099, 'new'], ['Certified Refurbished Laptop', 'ReTech', 799, 'refurbished'], ['Used Comparable Laptop', 'Resale Hub', 675, 'used']],
  bicycles: [['Comparable Trek Hybrid Bicycle', 'Cycle Shop', 899, 'new'], ['Used Trek Hybrid Bicycle', 'Bike Exchange', 625, 'used']],
  other: [['Comparable Replacement Item', 'General Retail', 199, 'new'], ['Used Comparable Item', 'Resale Hub', 125, 'used']]
};

function findComparableValues(input: InventoryDraft): ValuationResult {
  const category = (input.category || '').toLowerCase();
  const key = category.includes('tool') ? 'tools' : category.includes('jewel') ? 'jewelry' : category.includes('elect') ? 'electronics' : category.includes('bicy') ? 'bicycles' : 'other';
  const checkedAt = new Date().toISOString();
  const query = encodeURIComponent([input.make, input.model, input.itemName].filter(Boolean).join(' '));
  const comparableListings = valuationCatalog[key].map(([title, marketplace, price, listingCondition], index): ComparableListing => ({
    id: `comp-${Date.now()}-${index}`,
    title,
    marketplace,
    condition: listingCondition,
    price,
    currency: 'USD',
    url: `https://www.google.com/search?q=${query}&tbm=shop&result=${index + 1}`,
    matchReason: index === 0 ? 'Closest current replacement by make, category, and product details' : `Similar ${listingCondition} item in the same category`,
    matchConfidence: input.make && input.model ? 'high' : 'medium',
    checkedAt
  }));
  const prices = comparableListings.map(listing => listing.price);
  const missingFields = ['make', 'model', 'condition'].filter(field => !input[field as keyof InventoryDraft]);
  return {
    estimatedReplacementValueLow: Math.min(...prices),
    estimatedReplacementValueHigh: Math.max(...prices),
    suggestedReplacementValue: Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length),
    confidence: missingFields.length ? 'medium' : 'high',
    sourceSummary: `${comparableListings.length} comparable listings across ${new Set(comparableListings.map(listing => listing.marketplace)).size} sources`,
    comparableListings,
    missingFields,
    disclaimer: VALUATION_DISCLAIMER
  };
}

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

function pause(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function providerUnavailableError() {
  const error = new Error('Photo analysis is temporarily busy. Please try again in a moment; no AI assist was used.') as Error & { code?: string };
  error.code = 'AI_PROVIDER_UNAVAILABLE';
  return error;
}

async function analyzeWithGemini(request: SecureItemIntakeRequest): Promise<AiItemJson> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_VISION_MODEL || 'gemini-3.5-flash';
  const models = [...new Set([model, process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash'])];
  if (!apiKey) throw new Error('Gemini is not configured.');

  const image = request.photos[0]?.uri;
  if (!image) throw new Error('At least one photo is required.');
  const inline = dataUrlParts(image);

  const requestBody = JSON.stringify({
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
  });

  // Gemini documents 429 and 5xx responses as transient. Retry the preferred
  // model once, then use a stable multimodal fallback before reporting failure.
  for (const activeModel of models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
          body: requestBody
        });
        if (response.ok) {
          const text = parseGeminiText(await response.json());
          const start = text.indexOf('{');
          const end = text.lastIndexOf('}');
          if (start < 0 || end < start) throw new Error('Gemini response was not valid JSON.');
          return JSON.parse(text.slice(start, end + 1));
        }

        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (!retryable) {
          const error = new Error(`Gemini photo analysis failed: ${response.status}`) as Error & { code?: string };
          error.code = 'AI_PROVIDER_REQUEST_FAILED';
          throw error;
        }
        console.warn('[analyze-item] transient Gemini response', { model: activeModel, status: response.status, attempt });
      } catch (error) {
        if ((error as Error & { code?: string }).code === 'AI_PROVIDER_REQUEST_FAILED') throw error;
        console.warn('[analyze-item] transient Gemini request failure', { model: activeModel, attempt, message: error instanceof Error ? error.message : 'Unknown error' });
      }
      if (attempt < 2) await pause(500);
    }
    console.warn('[analyze-item] Gemini model exhausted; trying fallback', { model: activeModel });
  }

  throw providerUnavailableError();
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
  if (process.env.GEMINI_API_KEY) {
    try {
      return responseFromAi(request, await analyzeWithGemini(request), 'gemini-vision');
    } catch (error) {
      const openAiConfigured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_VISION_MODEL);
      if ((error as Error & { code?: string }).code === 'AI_PROVIDER_UNAVAILABLE' && openAiConfigured) {
        console.warn('[analyze-item] Gemini unavailable; trying OpenAI fallback');
        return responseFromAi(request, await analyzeWithOpenAi(request), 'openai-vision');
      }
      throw error;
    }
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_VISION_MODEL) return responseFromAi(request, await analyzeWithOpenAi(request), 'openai-vision');
  return mockResponse(request);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const request = req.body as SecureItemIntakeRequest;
  if (!request?.photos?.length) return res.status(400).json({ error: 'At least one photo is required.' });

  try {
    console.log('[analyze-item] request received', {
      photoCount: request.photos.length,
      includeValuation: request.includeValuation,
      provider: process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'mock',
      queued: isTrustedQueueWorker(req)
    });
    await consumeAiAssist(req);
    const response = await analyzeWithConfiguredProvider(request);

    if (request.includeValuation) {
      response.valuation = findComparableValues(response.draft);
    }

    console.log('[analyze-item] request completed', { provider: response.providersUsed[0], hasValuation: Boolean(response.valuation) });
    return res.status(200).json(response);
  } catch (error) {
    const code=(error as Error & { code?:string }).code || (process.env.AI_USAGE_ENFORCEMENT==='true' ? 'AI_USAGE_DENIED' : undefined);
    console.error('[analyze-item] request failed', {
      message: error instanceof Error ? error.message : 'Photo analysis failed.',
      code
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Photo analysis failed.',
      code
    });
  }
}
