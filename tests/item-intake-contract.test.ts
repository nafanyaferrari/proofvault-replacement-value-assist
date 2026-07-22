import assert from 'node:assert/strict';
import test from 'node:test';
import { createSecureBackendItemIntakeAnalyzer, SERIAL_VERIFICATION_WARNING, type SecureItemIntakeBackendClient } from '../packages/domain/src/index.ts';

test('secure backend intake adapter preserves review warnings and confidence', async () => {
  const client: SecureItemIntakeBackendClient = {
    async analyzeItem(request) {
      assert.equal(request.includeValuation, false);
      assert.equal(request.photos[0].uri, 'file:///drill.jpg');
      assert.equal(request.photos[1].uri, 'file:///drill-serial.jpg');
      return {
        draft: {
          itemName: 'Cordless drill',
          category: 'Tools',
          location: request.itemContext?.location ?? 'Unassigned',
          room: '',
          make: 'Milwaukee',
          model: 'M18',
          serialNumber: 'VERIFY-123',
          barcode: '',
          ownerMarking: '',
          markingType: '',
          markingLocation: '',
          markingNotes: '',
          distinguishingFeatures: 'Red and black drill',
          purchaseDate: '',
          userDescription: 'Milwaukee M18 drill. Serial must be verified.',
          notes: '',
          condition: 'used',
          status: 'normal'
        },
        suggestedTitle: 'Milwaukee M18 cordless drill',
        suggestedDescription: 'Milwaukee M18 drill. Serial must be verified.',
        fields: {
          make: { value: 'Milwaukee', confidence: 'high', source: 'openai-vision' },
          model: { value: 'M18', confidence: 'medium', source: 'openai-vision' },
          serialNumber: { value: 'VERIFY-123', confidence: 'low', source: 'document-ocr' }
        },
        warnings: [SERIAL_VERIFICATION_WARNING],
        needsSerialVerification: true,
        providersUsed: ['openai-vision', 'document-ocr']
      };
    }
  };

  const analyzer = createSecureBackendItemIntakeAnalyzer(client);
  const result = await analyzer.analyze({ photoUri: 'file:///drill.jpg', photos: ['file:///drill.jpg', 'file:///drill-serial.jpg'], location: 'Garage' }, false);

  assert.equal(result.provider, 'secure-backend');
  assert.equal(result.fieldConfidence.make, 'high');
  assert.equal(result.fieldConfidence.serialNumber, 'low');
  assert.equal(result.needsSerialVerification, true);
  assert.deepEqual(result.warnings, [SERIAL_VERIFICATION_WARNING]);
});
