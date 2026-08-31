/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** `"false"` = Edge Functions Pagnovo. Qualquer outro valor = mock no browser. */
  readonly VITE_PAGANOVO_MOCK?: string;
  /** Pixel nativo do TikTok (Events API continua a ir pela Utmify). */
  readonly VITE_TIKTOK_PIXEL_ID?: string;
  /** Pixel da Utmify (Integrações → Pixel). Opcional se o TikTok já está ligado no dashboard. */
  readonly VITE_UTMIFY_PIXEL_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
