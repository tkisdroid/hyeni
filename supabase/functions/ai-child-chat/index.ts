// supabase/functions/ai-child-chat/index.ts
// 아이모드 AI 캐릭터 채팅 — 서버 측 인증·일일 한도·OpenAI 호출·로그 기록을 단일 진입점에서 처리.
//
// 요청(POST):
//   { message: string, usageDate?: 'YYYY-MM-DD' }
// 응답:
//   200 OK   { reply, remaining, dailyLimit, character, characterName }
//   401      { error: 'auth_required' }
//   403      { error: 'not_child' | 'feature_disabled' }
//   429      { error: 'daily_limit_reached', creditBalance, remaining: 0, dailyLimit }
//   500/502  { error: 'ai_failure', details? }
//
// 클라이언트는 단순히 메시지를 보내고 응답만 받는다. 한도 차감·로그 저장은 모두 서버에서.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PERSONAS: Record<string, { name: string; tone: string; trait: string; species: string }> = {
    "🐰": { name: "통통이", species: "토끼", tone: "활발하고 깡총거리는", trait: "호기심이 많고 친구를 빨리 좋아해" },
    "🐱": { name: "야옹이", species: "고양이", tone: "부드럽고 차분한", trait: "조용히 들어주고 따뜻하게 말해" },
    "🦊": { name: "꼬미",   species: "여우",   tone: "똑똑하고 장난스러운", trait: "재미있는 질문을 잘 해" },
    "🐶": { name: "멍이",   species: "강아지", tone: "다정하고 신난",      trait: "응원과 칭찬을 잘 해" },
    "🐥": { name: "삐약이", species: "병아리", tone: "어리고 귀여운",      trait: "쉽고 짧은 말로 이야기해" },
    "🐻": { name: "곰돌이", species: "곰",     tone: "느긋하고 든든한",    trait: "천천히 또박또박 이야기해" },
    "🐼": { name: "푸푸",   species: "판다",   tone: "평화롭고 순한",      trait: "마음을 진정시켜 줘" },
    "🐯": { name: "호야",   species: "호랑이", tone: "씩씩하고 용감한",    trait: "용기를 북돋워 줘" },
};

function getPersona(emoji: string) {
    return PERSONAS[emoji] || PERSONAS["🐰"];
}

function ageFromBirthdate(birthdate: string | null | undefined): number | null {
    if (!birthdate) return null;
    const b = new Date(birthdate + "T00:00:00Z");
    if (Number.isNaN(b.getTime())) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - b.getUTCFullYear();
    const m = now.getUTCMonth() - b.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
    return age >= 0 ? age : null;
}

function ageBucket(age: number | null): "early" | "mid" | "tween" {
    if (age == null) return "mid";
    if (age <= 7) return "early";
    if (age <= 10) return "mid";
    return "tween";
}

const SAFETY_KEYWORDS = [
    "죽고싶", "죽고 싶", "자살", "자해", "때려", "맞았어", "맞아", "무서워서 못", "도와줘 누가",
    "아무도 몰래", "비밀이야 진짜", "피가 나", "다쳤어",
];

function detectSafetyFlag(text: string): boolean {
    const lower = text.toLowerCase();
    return SAFETY_KEYWORDS.some((kw) => lower.includes(kw));
}

function todayDateKST(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
}

function buildSystemPrompt(opts: {
    persona: { name: string; species: string; tone: string; trait: string };
    childName: string;
    bucket: "early" | "mid" | "tween";
    safetyHit: boolean;
}): string {
    const { persona, childName, bucket, safetyHit } = opts;
    const ageGuide =
        bucket === "early"
            ? "- 6~7세 수준. 한 문장 8글자 이내, 쉬운 단어만. 한 번에 한 가지 생각만 말해."
            : bucket === "mid"
                ? "- 8~10세 수준. 한 문장 12글자 내외, 일상 단어. 짧고 부드러운 두 문장."
                : "- 11~13세 수준. 친근한 반말, 두세 문장. 정확한 단어를 써도 좋아.";

    const safetyBlock = safetyHit
        ? `\n## 중요 안전 가이드\n아이가 무섭거나 다친 상황을 말했어. 절대 가볍게 넘기지 말고, 마음을 따뜻하게 받아준 뒤 "엄마 아빠나 믿을 수 있는 어른에게 꼭 이야기해줘"라고 한 번 말해줘. 절대 비밀로 하라고 하지 마.`
        : "";

    return `너는 어린이 앱 "혜니캘린더"의 친구 캐릭터 "${persona.name}"(${persona.species})이야. ${persona.tone} 말투를 가지고 있고, ${persona.trait}.

지금 너랑 이야기하는 친구 이름은 "${childName || "친구"}"야.

## 말투 규칙
- 반드시 한국어 반말. "~해", "~야", "~지", "~어" 같은 친근한 어미.
- 이모지는 한 답에 최대 1개. 너무 많이 쓰지 마.
- 절대 어른 같은 설명체("~합니다", "~입니다") 쓰지 마.
- 자신을 "나"라고 부르고, 가끔 "${persona.name}는~" 처럼 자기 이름을 말해도 좋아.

## 연령 맞춤
${ageGuide}

## 행동 원칙
- 친구의 호기심에 따뜻하게 대답해줘. 잘 모르면 "흠… 그건 같이 알아볼까?" 처럼 솔직히 말해.
- 학교 숙제의 정답을 그대로 알려주지 말고, 함께 생각해보자고 유도해.
- 가족·친구 험담을 들으면 진정시키고 어떻게 느꼈는지 물어봐줘.
- 무서운 이야기, 폭력적인 내용, 야한 이야기, 돈/투자/약 이야기는 자연스럽게 다른 주제로 돌려.
- 개인정보(주소, 학교, 전화번호)는 묻지도 말고 받지도 마.
- 답은 짧게 — 길어야 2~3문장.${safetyBlock}

## 금지
- 의학·법률·약 복용 조언 금지. 대신 "어른한테 꼭 물어봐" 라고 안내.
- "비밀이야"라고 약속하지 않기. 부모/선생님과 공유할 수 있다고 부드럽게 말해.
- 거짓 정보를 사실처럼 말하지 않기.`;
}

interface ChatBody {
    message?: string;
    usageDate?: string;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
        return json({ error: "method_not_allowed" }, 405);
    }

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
        console.error("[ai-child-chat] missing env: OPENAI_API_KEY/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY");
        return json({ error: "server_misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return json({ error: "auth_required" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user?.id) {
        return json({ error: "auth_required" }, 401);
    }
    const userId = userRes.user.id;

    let body: ChatBody = {};
    try {
        body = await req.json();
    } catch {
        return json({ error: "invalid_json" }, 400);
    }
    const message = (body.message || "").toString().trim();
    if (!message) return json({ error: "empty_message" }, 400);
    if (message.length > 500) return json({ error: "message_too_long" }, 400);

    const usageDate = body.usageDate && /^\d{4}-\d{2}-\d{2}$/.test(body.usageDate)
        ? body.usageDate
        : todayDateKST();

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: member, error: memberErr } = await admin
        .from("family_members")
        .select("family_id, role, name, birthdate, emoji")
        .eq("user_id", userId)
        .maybeSingle();

    if (memberErr) {
        console.error("[ai-child-chat] family_members lookup failed", memberErr);
        return json({ error: "lookup_failed" }, 500);
    }
    if (!member || !member.family_id) return json({ error: "no_family" }, 403);
    if (member.role !== "child")       return json({ error: "not_child" }, 403);

    const familyId = member.family_id as string;
    const childName = (member.name || "").toString();
    const birthdate = (member.birthdate || null) as string | null;
    const characterEmoji = (member.emoji || "🐰") as string;

    const { data: settingsRow, error: settingsErr } = await admin
        .from("ai_chat_settings")
        .select("enabled, daily_limit, credit_balance")
        .eq("family_id", familyId)
        .maybeSingle();
    if (settingsErr) {
        console.error("[ai-child-chat] settings lookup failed", settingsErr);
        return json({ error: "lookup_failed" }, 500);
    }
    const enabled = !!settingsRow?.enabled;
    const dailyLimit = Number(settingsRow?.daily_limit ?? 10);
    const creditBalance = Number(settingsRow?.credit_balance ?? 0);
    if (!enabled) {
        return json({ error: "feature_disabled" }, 403);
    }

    const { data: usageRow } = await admin
        .from("ai_chat_usage")
        .select("count")
        .eq("family_id", familyId)
        .eq("child_user_id", userId)
        .eq("usage_date", usageDate)
        .maybeSingle();
    const usedToday = Number(usageRow?.count ?? 0);
    if (usedToday >= dailyLimit && creditBalance <= 0) {
        return json({
            error: "daily_limit_reached",
            remaining: 0,
            dailyLimit,
            creditBalance,
        }, 429);
    }
    const useCredit = usedToday >= dailyLimit && creditBalance > 0;

    const { data: recent } = await admin
        .from("ai_chat_messages")
        .select("role, content")
        .eq("family_id", familyId)
        .eq("child_user_id", userId)
        .neq("role", "system")
        .order("created_at", { ascending: false })
        .limit(6);
    const contextWindow = (recent || []).reverse().map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: m.content as string,
    }));

    const persona = getPersona(characterEmoji);
    const age = ageFromBirthdate(birthdate);
    const bucket = ageBucket(age);
    const userSafetyHit = detectSafetyFlag(message);
    const systemPrompt = buildSystemPrompt({ persona, childName, bucket, safetyHit: userSafetyHit });

    let assistantText = "";
    try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...contextWindow,
                    { role: "user", content: message },
                ],
                temperature: 0.7,
                max_tokens: 220,
            }),
        });
        if (!openaiRes.ok) {
            const errText = await openaiRes.text();
            console.error("[ai-child-chat] openai error", openaiRes.status, errText);
            return json({ error: "ai_failure", details: openaiRes.status }, 502);
        }
        const data = await openaiRes.json();
        assistantText = (data.choices?.[0]?.message?.content || "").toString().trim();
    } catch (err) {
        console.error("[ai-child-chat] openai exception", err);
        return json({ error: "ai_failure" }, 502);
    }
    if (!assistantText) {
        assistantText = "음… 잠깐 생각이 안 났어. 다시 한 번 말해줄래?";
    }

    const assistantSafetyHit = detectSafetyFlag(assistantText);
    const flagged = userSafetyHit || assistantSafetyHit;

    const baseRow = {
        family_id: familyId,
        child_user_id: userId,
        animal_character: characterEmoji,
    };
    const { error: insertErr } = await admin.from("ai_chat_messages").insert([
        { ...baseRow, role: "user",      content: message,       flagged: userSafetyHit },
        { ...baseRow, role: "assistant", content: assistantText, flagged: assistantSafetyHit },
    ]);
    if (insertErr) {
        console.error("[ai-child-chat] log insert failed", insertErr);
    }

    if (useCredit) {
        await admin
            .from("ai_chat_settings")
            .update({ credit_balance: Math.max(0, creditBalance - 1), updated_at: new Date().toISOString() })
            .eq("family_id", familyId);
    } else {
        const nextCount = usedToday + 1;
        const { error: usageErr } = await admin
            .from("ai_chat_usage")
            .upsert(
                {
                    family_id: familyId,
                    child_user_id: userId,
                    usage_date: usageDate,
                    count: nextCount,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "family_id,child_user_id,usage_date" }
            );
        if (usageErr) {
            console.error("[ai-child-chat] usage upsert failed", usageErr);
        }
    }

    const newUsed = useCredit ? usedToday : usedToday + 1;
    const remaining = Math.max(0, dailyLimit - newUsed);
    const newCredit = useCredit ? Math.max(0, creditBalance - 1) : creditBalance;

    return json({
        reply: assistantText,
        remaining,
        dailyLimit,
        creditBalance: newCredit,
        usedCredit: useCredit,
        character: characterEmoji,
        characterName: persona.name,
        flagged,
    }, 200);
});

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}
