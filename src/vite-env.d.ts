/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_PILOT_REGION?: string;
  readonly VITE_MARKETPLACE_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

