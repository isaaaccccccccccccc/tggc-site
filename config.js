/*
  Tarlac Gospel of Grace Church website — settings
  ------------------------------------------------
  Paste your two Supabase values below (Supabase → Project Settings → API Keys).
  Both are safe to publish: the database security rules in supabase/setup.sql
  decide who may read and who may post.
*/
window.TGGC_CONFIG = {
  // Supabase → Project Settings → Data API → "Project URL", e.g. "https://abcdefghijklmnop.supabase.co"
  SUPABASE_URL: "https://kbcceardovhjkefhvyth.supabase.co",

  // Supabase → Project Settings → API Keys → the "anon public" key (starts with "eyJ")
  // or the "publishable" key (starts with "sb_publishable_")
  SUPABASE_ANON_KEY: "sb_publishable_6cRWfne97WW3rcfnbVhbVQ_Uus6jYgN",

  // Optional: the address people should use, for the QR code and share links.
  // Leave empty to use the address the site is opened from (for example https://tggc.netlify.app).
  SITE_URL: "https://tggc.site/"
};
