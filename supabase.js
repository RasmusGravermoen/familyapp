/* =============================================
   supabase.js — Database connection
   
   STEP 1 (now):  App runs in LOCAL/DEMO mode — data saved in browser only.
   STEP 2 (later): Paste your Supabase URL and Key below to enable the real database.
   ============================================= */

// ─── PASTE YOUR SUPABASE DETAILS HERE (later) ───────────────────────────────
const SUPABASE_URL = 'https://vzaukvlnvpmzbvktnbaj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6YXVrdmxudnBtemJ2a3RuYmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODIxMDIsImV4cCI6MjA5NDU1ODEwMn0.oEsjKflQlNyJMsy4svMe8x6aiW6Ga23q_q9VjAt3nYw'
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
