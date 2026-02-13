
import { createClient } from '@supabase/supabase-js';

// --- GLOBAL CONFIGURATION ---
// These are the credentials you provided.
const GLOBAL_SUPABASE_URL = 'https://wwqhxwmxslcrjoyoonfl.supabase.co'; 
const GLOBAL_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3cWh4d214c2xjcmpveW9vbmZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMDM2NTksImV4cCI6MjA4Mzg3OTY1OX0.GIeaxog_E5Id-7o8yNiThKxpsuMKJos2igIW6MJEjj8'; 
// ----------------------------

export const getSupabaseConfig = () => {
    // FORCE OVERRIDE: 
    // We strictly prefer the Global Constants right now to ensure the correct key is used.
    // This bypasses any incorrect values that might be stuck in your browser's LocalStorage.
    if (GLOBAL_SUPABASE_URL && GLOBAL_SUPABASE_KEY) {
        return { 
            url: GLOBAL_SUPABASE_URL, 
            key: GLOBAL_SUPABASE_KEY, 
            isGlobal: true 
        };
    }

    // Fallback to LocalStorage (Only if globals are empty)
    const localUrl = (localStorage.getItem('sb_url') || '').trim();
    const localKey = (localStorage.getItem('sb_key') || '').trim();

    if (localUrl && localKey) {
        return { 
            url: localUrl, 
            key: localKey, 
            isGlobal: false 
        };
    }

    return { 
        url: '', 
        key: '', 
        isGlobal: false 
    };
};

let supabaseInstance: any = null;

export const getSupabase = () => {
    if (supabaseInstance) return supabaseInstance;

    const { url, key } = getSupabaseConfig();
    
    if (url && key) {
        try {
            supabaseInstance = createClient(url, key);
            return supabaseInstance;
        } catch (e) {
            console.error("Failed to initialize Supabase client", e);
            return null;
        }
    }
    
    return null;
};

export const isSupabaseConfigured = () => {
    const { url, key } = getSupabaseConfig();
    return !!(url && key);
};
