/* =============================================
   supabase.js — Database connection
   
   STEP 1 (now):  App runs in LOCAL/DEMO mode — data saved in browser only.
   STEP 2 (later): Paste your Supabase URL and Key below to enable the real database.
   ============================================= */

// ─── PASTE YOUR SUPABASE DETAILS HERE (later) ───────────────────────────────
const SUPABASE_URL = '';   // e.g. 'https://xxxx.supabase.co'
const SUPABASE_KEY = '';   // e.g. 'eyJhbGci...'
// ─────────────────────────────────────────────────────────────────────────────

// Detect if Supabase is configured
window.SUPABASE_READY = !!(SUPABASE_URL && SUPABASE_KEY);

if (window.SUPABASE_READY) {
  // Load the Supabase library dynamically only when credentials are present
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = () => {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase connected!');
  };
  document.head.appendChild(script);
} else {
  console.log('ℹ️ Running in local demo mode. Add Supabase credentials to enable cloud sync.');
}
