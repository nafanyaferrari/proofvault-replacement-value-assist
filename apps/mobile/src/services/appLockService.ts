import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const APP_LOCK_KEY = 'proofvault.appLockEnabled';

export async function isAppLockEnabled() {
  return await SecureStore.getItemAsync(APP_LOCK_KEY) === 'true';
}

export async function setAppLockEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(APP_LOCK_KEY, String(enabled), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function canUseAppLock() {
  return await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
}

export async function authenticateForVault() {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock ProofVault', cancelLabel: 'Cancel', fallbackLabel: 'Use device passcode', disableDeviceFallback: false, biometricsSecurityLevel: 'strong' });
  return result.success;
}
