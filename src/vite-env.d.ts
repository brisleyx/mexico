/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** `"false"` = Edge Functions Pagnovo. Qualquer outro valor = mock no browser. */
  readonly VITE_PAGANOVO_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
