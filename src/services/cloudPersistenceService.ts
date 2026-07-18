import { BatchDefaults } from '../data';
import { Incident, InventoryItem, LocationRecord, SubscriptionTier } from '../types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export interface CloudSnapshot {
  items: InventoryItem[];
  incidents: Incident[];
  locations: LocationRecord[];
  tier: SubscriptionTier;
  batchDefaults?: BatchDefaults;
}

export interface CloudStatus {
  configured: boolean;
  authenticated: boolean;
  email?: string;
}

async function requireUser() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in before using cloud sync.');
  return data.user;
}

function assertSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export const cloudPersistenceService = {
  isConfigured: () => isSupabaseConfigured,

  async status(): Promise<CloudStatus> {
    if (!supabase) return { configured: false, authenticated: false };
    const { data } = await supabase.auth.getSession();
    return {
      configured: true,
      authenticated: Boolean(data.session?.user),
      email: data.session?.user.email
    };
  },

  subscribeToAuthChanges(callback: (status: CloudStatus) => void) {
    if (!supabase) return () => undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback({
        configured: true,
        authenticated: Boolean(session?.user),
        email: session?.user.email
      });
    });
    return () => data.subscription.unsubscribe();
  },

  async signInWithEmail(email: string) {
    const client = assertSupabase();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
  },

  async signOut() {
    const client = assertSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },

  async saveSnapshot(snapshot: CloudSnapshot) {
    const client = assertSupabase();
    const user = await requireUser();
    const now = new Date().toISOString();

    const itemRows = snapshot.items.map(item => ({
      id: item.id,
      user_id: user.id,
      item,
      updated_at: item.updatedAt ?? now
    }));
    const incidentRows = snapshot.incidents.map(incident => ({
      id: incident.id,
      user_id: user.id,
      incident,
      updated_at: incident.createdAt ?? now
    }));
    const locationRows = snapshot.locations.map(location => ({
      id: location.id,
      user_id: user.id,
      location,
      updated_at: now
    }));

    const { error: itemsError } = await client.from('proofvault_inventory_items').upsert(itemRows);
    if (itemsError) throw itemsError;

    const { error: incidentsError } = await client.from('proofvault_incidents').upsert(incidentRows);
    if (incidentsError) throw incidentsError;

    const { error: locationsError } = await client.from('proofvault_locations').upsert(locationRows);
    if (locationsError) throw locationsError;

    const { error: settingsError } = await client.from('proofvault_user_settings').upsert({
      user_id: user.id,
      subscription_tier: snapshot.tier,
      batch_defaults: snapshot.batchDefaults ?? { location: '', room: '' },
      updated_at: now
    });
    if (settingsError) throw settingsError;
  },

  async loadSnapshot(): Promise<CloudSnapshot> {
    const client = assertSupabase();
    await requireUser();
    const [itemsResult, incidentsResult, locationsResult, settingsResult] = await Promise.all([
      client.from('proofvault_inventory_items').select('item').order('updated_at', { ascending: false }),
      client.from('proofvault_incidents').select('incident').order('created_at', { ascending: false }),
      client.from('proofvault_locations').select('location').order('created_at', { ascending: true }),
      client.from('proofvault_user_settings').select('subscription_tier,batch_defaults').maybeSingle()
    ]);

    if (itemsResult.error) throw itemsResult.error;
    if (incidentsResult.error) throw incidentsResult.error;
    if (locationsResult.error) throw locationsResult.error;
    if (settingsResult.error) throw settingsResult.error;

    return {
      items: (itemsResult.data ?? []).map(row => row.item as InventoryItem),
      incidents: (incidentsResult.data ?? []).map(row => row.incident as Incident),
      locations: (locationsResult.data ?? []).map(row => row.location as LocationRecord),
      tier: (settingsResult.data?.subscription_tier as SubscriptionTier | undefined) ?? 'free',
      batchDefaults: settingsResult.data?.batch_defaults as BatchDefaults | undefined
    };
  }
};
