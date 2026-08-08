// Supabase project connection details for your "life-hq" project.
// The anon/publishable key is safe to expose in client-side code —
// it's the same mechanism every Supabase app uses. Just don't publish
// this repo publicly without adding Row Level Security later if that
// ever matters to you.
const SUPABASE_URL = "https://gkpzipgvuuiflmjsozes.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrcHppcGd2dXVpZmxtanNvemVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNzE2MjEsImV4cCI6MjEwMTc0NzYyMX0.5W63f9Ffh8sDO-igJdmk9-N_xdrKMSzIvKMc2Fk6Eu0";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
