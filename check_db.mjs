import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars", supabaseUrl, supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('families').select('*');
  console.log("Families:", JSON.stringify(data, null, 2), error);
  const { data: m, error: me } = await supabase.from('family_members').select('*');
  console.log("Members:", JSON.stringify(m, null, 2), me);
}
check();
