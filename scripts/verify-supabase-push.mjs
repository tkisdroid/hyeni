import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const parentClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const childClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = `diag-${Date.now()}`;
const pairCode = `KID-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

async function ensureSession(client, label) {
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`${label} anonymous sign-in failed: ${error.message}`);
  if (!data.session?.access_token || !data.user?.id) {
    throw new Error(`${label} session/token missing after anonymous sign-in`);
  }
  return data;
}

async function main() {
  const report = {
    runId,
    familyCreated: false,
    parentUserId: null,
    childUserId: null,
    familyId: null,
    tokenInsert: null,
    tokenSelectCount: 0,
    pushFunctionResponse: null,
    pendingNotificationsCount: 0,
    cleanup: {},
  };

  let parentSession;
  let childSession;

  try {
    const parentAuth = await ensureSession(parentClient, "parent");
    const childAuth = await ensureSession(childClient, "child");

    parentSession = parentAuth.session;
    childSession = childAuth.session;
    report.parentUserId = parentAuth.user.id;
    report.childUserId = childAuth.user.id;

    const { data: family, error: familyError } = await parentClient
      .from("families")
      .insert({
        parent_id: parentAuth.user.id,
        pair_code: pairCode,
        parent_name: `Diag Parent ${runId}`,
      })
      .select("id, pair_code")
      .single();

    if (familyError) {
      throw new Error(`family insert failed: ${familyError.message}`);
    }

    report.familyCreated = true;
    report.familyId = family.id;

    const { error: parentMemberError } = await parentClient.from("family_members").insert({
      family_id: family.id,
      user_id: parentAuth.user.id,
      role: "parent",
      name: `Diag Parent ${runId}`,
    });

    report.cleanup.parentMemberInsertError = parentMemberError?.message || null;

    const fakeChildToken = `diagnostic-child-token-${runId}`;
    const { error: tokenInsertError } = await childClient.from("fcm_tokens").upsert(
      {
        user_id: childAuth.user.id,
        family_id: family.id,
        fcm_token: fakeChildToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,fcm_token" },
    );

    report.tokenInsert = tokenInsertError ? { ok: false, error: tokenInsertError.message } : { ok: true };

    const { data: insertedTokens, error: tokenSelectError } = await childClient
      .from("fcm_tokens")
      .select("id, user_id, family_id, fcm_token, updated_at")
      .eq("user_id", childAuth.user.id)
      .eq("family_id", family.id);

    if (tokenSelectError) {
      report.tokenSelectError = tokenSelectError.message;
    } else {
      report.tokenSelectCount = insertedTokens?.length || 0;
    }

    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${parentSession.access_token}`,
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({
        action: "new_memo",
        familyId: family.id,
        senderUserId: parentAuth.user.id,
        title: `diag push ${runId}`,
        message: `diag push body ${runId}`,
      }),
    });

    const pushText = await pushResponse.text();
    let pushJson = null;
    try {
      pushJson = JSON.parse(pushText);
    } catch {
      pushJson = { raw: pushText };
    }

    report.pushFunctionResponse = {
      ok: pushResponse.ok,
      status: pushResponse.status,
      body: pushJson,
    };

    const { data: pending, error: pendingError } = await childClient.rpc("get_pending_notifications", {
      p_family_id: family.id,
    });

    if (pendingError) {
      report.pendingNotificationsError = pendingError.message;
    } else {
      report.pendingNotificationsCount = pending?.length || 0;
      report.pendingNotifications = pending || [];

      if (pending?.length) {
        const ids = pending.map((item) => item.id);
        const { error: deliveredError } = await childClient.rpc("mark_notifications_delivered", {
          p_ids: ids,
        });
        report.cleanup.markDelivered = deliveredError ? deliveredError.message : "ok";
      }
    }

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    if (report.familyId && report.childUserId) {
      const { error } = await childClient
        .from("fcm_tokens")
        .delete()
        .eq("user_id", report.childUserId)
        .eq("family_id", report.familyId);
      report.cleanup.deleteFcmTokens = error ? error.message : "ok";
    }

    if (report.familyId && report.parentUserId) {
      const { error } = await parentClient
        .from("family_members")
        .delete()
        .eq("family_id", report.familyId)
        .eq("user_id", report.parentUserId);
      report.cleanup.deleteParentMember = error ? error.message : "ok";
    }

    if (report.familyId) {
      const { error } = await parentClient.from("families").delete().eq("id", report.familyId);
      report.cleanup.deleteFamily = error ? error.message : "ok";
    }

    if (parentSession) {
      await parentClient.auth.signOut().catch(() => {});
    }
    if (childSession) {
      await childClient.auth.signOut().catch(() => {});
    }
  }
}

await main();