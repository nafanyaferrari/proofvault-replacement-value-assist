import { createSecureBackendItemIntakeAnalyzer, type SecureItemIntakeBackendClient, type SecureItemIntakeRequest } from '../../packages/domain/src/itemIntakeBackendContract';
import { itemIntakeService as mockItemIntakeService } from '../../packages/domain/src/itemIntakeService';

const endpoint = import.meta.env.VITE_AI_INTAKE_BACKEND_URL || '/api/analyze-item';

const secureBackendClient: SecureItemIntakeBackendClient = {
  async analyzeItem(request: SecureItemIntakeRequest) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!response.ok) throw new Error(`Photo analysis failed (${response.status}).`);
    return response.json();
  }
};

const secureBackendAnalyzer = createSecureBackendItemIntakeAnalyzer(secureBackendClient);

export const itemIntakeService = {
  async analyze(input: Parameters<typeof mockItemIntakeService.analyze>[0], includeValuation: boolean) {
    try {
      return await secureBackendAnalyzer.analyze(input, includeValuation);
    } catch {
      const fallback = await mockItemIntakeService.analyze(input, includeValuation);
      return {
        ...fallback,
        warnings: [
          ...(fallback.warnings ?? []),
          'Secure AI photo analysis endpoint was unavailable, so ProofVault used the local mock fallback.'
        ]
      };
    }
  }
};
