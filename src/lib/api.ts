import { localApi } from "./localApi";
import { isSupabaseConfigured } from "./supabase";
import { supabaseApi } from "./supabaseApi";

export const usingSupabase = isSupabaseConfigured;
export const api = usingSupabase ? supabaseApi : localApi;
