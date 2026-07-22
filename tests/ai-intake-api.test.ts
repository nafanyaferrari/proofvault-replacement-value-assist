import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/analyze-item.ts';

function createResponse() {
  let statusCode = 200;
  let payload: unknown;
  const headers: Record<string,string> = {};
  return {
    res: {
      status(code: number) { statusCode = code; return this; },
      json(body: unknown) { payload = body; },
      setHeader(name: string, value: string) { headers[name] = value; }
    },
    result: () => ({ statusCode, payload, headers })
  };
}

test('AI intake API returns backend mock when provider is not configured', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_VISION_MODEL;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousGeminiModel = process.env.GEMINI_VISION_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_VISION_MODEL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_VISION_MODEL;

  const { res, result } = createResponse();
  await handler({
    method: 'POST',
    body: {
      photos: [{ uri: 'data:image/jpeg;base64,abc' }],
      itemContext: { location: 'Garage', room: 'Tool cabinet' },
      includeValuation: false
    }
  }, res);

  const response = result();
  assert.equal(response.statusCode, 200);
  const payload = response.payload as any;
  assert.equal(payload.providersUsed[0], 'mock');
  assert.equal(payload.draft.location, 'Garage');
  assert.equal(payload.needsSerialVerification, true);
  assert.equal(payload.candidates.length, 1);
  assert.match(payload.warnings.join(' '), /provider is not configured/i);

  if (previousKey) process.env.OPENAI_API_KEY = previousKey;
  if (previousModel) process.env.OPENAI_VISION_MODEL = previousModel;
  if (previousGeminiKey) process.env.GEMINI_API_KEY = previousGeminiKey;
  if (previousGeminiModel) process.env.GEMINI_VISION_MODEL = previousGeminiModel;
});

test('AI intake API accepts an overview plus close-up evidence photos', async () => {
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousOpenAiModel = process.env.OPENAI_VISION_MODEL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_VISION_MODEL;
  const { res, result } = createResponse();
  await handler({ method: 'POST', body: { photos: [{ uri: 'data:image/jpeg;base64,overview' }, { uri: 'data:image/jpeg;base64,serial' }], includeValuation: false } }, res);
  assert.equal(result().statusCode, 200);
  if (previousGeminiKey) process.env.GEMINI_API_KEY = previousGeminiKey;
  if (previousOpenAiKey) process.env.OPENAI_API_KEY = previousOpenAiKey;
  if (previousOpenAiModel) process.env.OPENAI_VISION_MODEL = previousOpenAiModel;
});

test('AI intake API rejects missing photos', async () => {
  const { res, result } = createResponse();
  await handler({ method: 'POST', body: { photos: [], includeValuation: false } }, res);

  assert.equal(result().statusCode, 400);
});
