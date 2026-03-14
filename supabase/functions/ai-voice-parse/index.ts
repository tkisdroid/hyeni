import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { text, academies, todayEvents, currentDate } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const academyList = (academies || [])
      .map((a: { name: string; category: string }) => `- ${a.name} (${a.category})`)
      .join("\n");

    const eventList = (todayEvents || [])
      .map((e: { id: string; title: string; time: string; memo?: string }) =>
        `- id:${e.id} "${e.title}" ${e.time}${e.memo ? ` 메모:"${e.memo}"` : ""}`)
      .join("\n");

    const { year, month, day } = currentDate || {};
    const monthDisplay = month !== undefined ? month + 1 : "?";

    const systemPrompt = `당신은 어린이 일정관리 앱의 AI 비서입니다. 사용자의 음성 입력을 분석하여 정확한 JSON으로 변환합니다.

현재 날짜: ${year}년 ${monthDisplay}월 ${day}일
등록된 학원 목록:
${academyList || "(없음)"}

오늘 일정:
${eventList || "(없음)"}

카테고리 종류: school(학원/교육), sports(운동), hobby(취미), family(가족), friend(친구), other(기타)

## 규칙

1. **일정 추가** 의도 감지:
   - "내일 3시 피아노", "수요일에 태권도 가야해" 등
   - 등록된 학원명이 언급되면 반드시 해당 학원 정보를 사용
   - 날짜가 없으면 오늘, 시간이 없으면 null
   - **중요**: title에는 순수한 일정 이름만 넣어라. "입력해줘", "추가해줘", "등록해줘", "저장해줘", "해줘", "해", "좀", "가요", "갈게", "가야해" 같은 명령어/조사/어미는 반드시 제거하라.
     예시: "내일 3시에 수학학원 입력해줘" → title: "수학학원" (O) / "수학학원 입력해줘" (X)

2. **메모 추가** 의도 감지:
   - "준비물 챙기라고 저장해줘", "피아노 메모에 악보 가져가기"
   - 오늘 일정 중 가장 관련 있는 일정에 메모를 추가
   - 대상 일정을 찾지 못하면 targetEventId를 null로

3. 날짜 파싱:
   - "내일" → 현재 날짜 + 1일
   - "모레" → 현재 날짜 + 2일
   - "다음주 월요일" → 가장 가까운 다음 주 월요일
   - month는 0-based (1월=0, 12월=11)

## 응답 형식 (JSON만, 다른 텍스트 없이)

일정 추가:
{"action":"add_event","title":"피아노학원","time":"15:00","category":"school","year":${year},"month":${month},"day":${day + 1},"academyName":"피아노학원"}

메모 추가:
{"action":"add_memo","targetEventId":"이벤트id","memoText":"준비물 챙기기"}

길찾기/내비게이션 (다음일정까지 길 알려줘, 길찾기, 어떻게 가 등):
{"action":"navigate"}

인식 불가:
{"action":"unknown","message":"이해하지 못했어요"}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ai-voice-parse] OpenAI error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service error", details: response.status }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { action: "unknown", message: "AI 응답 파싱 실패" };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[ai-voice-parse] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
