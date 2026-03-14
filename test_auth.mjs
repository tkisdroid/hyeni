import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
  const email = `testuser_${Date.now()}@example.com`;
  const password = "testpassword123!";
  
  console.log("Signing up...");
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    console.error("Signup failed:", authError);
    return;
  }
  
  const user = authData.user;
  console.log("Signed up user:", user.id);

  console.log("Setting up family...");
  // simulate setupFamily
  const { data: family, error: famInsError } = await supabase
    .from("families")
    .insert({ parent_id: user.id, pair_code: "KID-TEST1234", parent_name: "Test Parent" })
    .select("id, pair_code")
    .single();

  if (famInsError) {
    console.error("Family insert failed:", famInsError);
    return;
  }
  console.log("Family inserted:", family);

  const { error: memError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, user_id: user.id, role: "parent", name: "Test Parent" });
    
  if (memError) {
    console.error("Family member insert failed:", memError);
    return;
  }
  console.log("Family member inserted");

  console.log("Calling getMyFamily (Simulated)...");
  
  const { data: membership, error: memFetchErr } = await supabase
    .from("family_members")
    .select("family_id, role, name")
    .eq("user_id", user.id)
    .maybeSingle();
    
  if (memFetchErr) console.error("Membership fetch error:", memFetchErr);
  console.log("Fetched membership:", membership);
  
  if (membership) {
    const { data: fetchedFamily, error: famFetchErr } = await supabase
      .from("families")
      .select("id, pair_code, parent_name")
      .eq("id", membership.family_id)
      .single();
      
    if (famFetchErr) console.error("Family fetch error:", famFetchErr);
    console.log("Fetched family:", fetchedFamily);
  } else {
    console.log("No membership found.");
  }
}

testAuth();
