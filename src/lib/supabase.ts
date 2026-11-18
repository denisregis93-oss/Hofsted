import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, storageKey: "hofstede-admin-auth" },
});

export const FUNCOES_URL = `${url}/functions/v1`;
export const ANON_KEY = key;
