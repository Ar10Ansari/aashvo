/**
 * Aashvo Data Service Adapter
 * Seamlessly interfaces with Supabase when valid environment variables are present,
 * or operates via local deterministic mock storage during offline development.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isLiveBackendConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co'
);

export interface BackendStatus {
  isLive: boolean;
  provider: 'Supabase PostgreSQL' | 'Local Deterministic Store';
  region: string;
}

export function getBackendStatus(): BackendStatus {
  return {
    isLive: isLiveBackendConfigured,
    provider: isLiveBackendConfigured ? 'Supabase PostgreSQL' : 'Local Deterministic Store',
    region: 'Delhi NCR (Gurugram & South Delhi)',
  };
}
