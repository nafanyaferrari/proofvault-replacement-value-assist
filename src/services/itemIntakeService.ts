import { createSecureBackendItemIntakeAnalyzer, type SecureItemIntakeBackendClient, type SecureItemIntakeRequest } from '../../packages/domain/src/itemIntakeBackendContract';
import { itemIntakeService as mockItemIntakeService } from '../../packages/domain/src/itemIntakeService';
import { supabase } from './supabaseClient';

const endpoint = import.meta.env.VITE_AI_INTAKE_BACKEND_URL || '/api/analyze-item';

const secureBackendClient: SecureItemIntakeBackendClient = {
  async analyzeItem(request: SecureItemIntakeRequest) {
    const session=await supabase?.auth.getSession();
    const accessToken=session?.data.session?.access_token;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json',...(accessToken?{authorization:`Bearer ${accessToken}`}:{}) },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      const body=await response.json().catch(()=>undefined) as { error?:string;code?:string }|undefined;
      const error=new Error(body?.error||`Photo analysis failed (${response.status}).`) as Error & { code?:string };
      error.code=body?.code;
      throw error;
    }
    return response.json();
  }
};

const secureBackendAnalyzer = createSecureBackendItemIntakeAnalyzer(secureBackendClient);

export const itemIntakeService = {
  async analyze(input: Parameters<typeof mockItemIntakeService.analyze>[0], includeValuation: boolean) {
    try {
      return await secureBackendAnalyzer.analyze(input, includeValuation);
    } catch (error) {
      if((error as Error & { code?:string }).code?.startsWith('AI_USAGE_'))throw error;
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
