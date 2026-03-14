import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemoSentimentRequest {
  familyId: string;
  analysisType: "memo_sentiment";
  memoText: string;
  eventTitle: string;
  childName: string;
}

interface ScheduleAdherenceRequest {
  familyId: string;
  analysisType: "schedule_adherence";
  events: {
    title: string;
    time: string;
    arrivedOnTime: boolean;
    arrivalDelay: number;
  }[];
}

interface WeeklySummaryRequest {
  familyId: string;
  analysisType: "weekly_summary";
  weekData: {
    totalEvents: number;
    onTimeCount: number;
    lateCount: number;
    memos: string[];
  };
}

type AnalysisRequest =
  | MemoSentimentRequest
  | ScheduleAdherenceRequest
  | WeeklySummaryRequest;

// ---------------------------------------------------------------------------
// System prompts per analysis type
// ---------------------------------------------------------------------------

const SYSTEM_BASE = `당신은 혜니캘린더 AI입니다. 어린이 일정관리 앱에서 아이의 행동 패턴과 메모를 분석하는 따뜻한 AI 도우미입니다.

## 핵심 원칙
- 항상 한국어로 응답합니다.
- 따뜻하고 지지적인 어조를 유지합니다. 절대 불안감을 조성하지 않습니다.
- 진짜 우려되는 패턴만 알립니다. 사소한 문제는 넘어갑니다.
- 대상 아이는 초등학생입니다.
- 거짓 양성(false positive)이 놓침(false negative)보다 낫지만, 지나치게 민감하지 않습니다.
- 반드시 유효한 JSON만 응답합니다. 다른 텍스트는 포함하지 않습니다.`;

function buildMemoSentimentPrompt(
  memoText: string,
  eventTitle: string,
  childName: string
): string {
  return `${SYSTEM_BASE}

## 분석 유형: 메모 감정 분석

아이(${childName})가 "${eventTitle}" 일정에 작성한 메모를 분석해주세요.
스트레스, 따돌림, 외로움, 과도한 압박, 건강 문제 등 부모가 알아야 할 신호를 확인합니다.

## 응답 형식 (JSON만)
{
  "action": "alert" 또는 "ok",
  "severity": "info" 또는 "warning" 또는 "urgent",
  "title": "알림 제목 (한국어)",
  "message": "상세 내용 (한국어, 부모 친화적, 따뜻한 어조)",
  "category": "emotional" 또는 "social" 또는 "academic" 또는 "health"
}

## 판단 기준
- "ok": 평범한 일상 메모 (예: "피아노 재밌었다", "오늘 급식 맛있었어")
- "info": 약간 신경 쓰일 수 있지만 지켜볼 수준 (예: "조금 피곤해", "시험 걱정돼")
- "warning": 부모가 관심을 가져야 할 수준 (예: "친구가 나만 빼놓고 놀았어", "학원 너무 많아서 힘들어")
- "urgent": 즉시 부모 관심이 필요한 수준 (예: 지속적 따돌림 암시, 심한 우울 표현)

메모 내용:
"${memoText}"`;
}

function buildScheduleAdherencePrompt(
  events: ScheduleAdherenceRequest["events"]
): string {
  const eventLines = events
    .map(
      (e) =>
        `- ${e.title} (${e.time}): ${e.arrivedOnTime ? "정시 도착" : `${e.arrivalDelay}분 지각`}`
    )
    .join("\n");

  return `${SYSTEM_BASE}

## 분석 유형: 일정 준수 패턴 분석

최근 일정 출석 데이터를 분석하여, 지각 패턴이 있는지 확인해주세요.
개별 지각이 아닌 추세(trend)에 집중합니다.

## 응답 형식 (JSON만)
{
  "action": "alert" 또는 "ok",
  "severity": "info" 또는 "warning",
  "title": "알림 제목 (한국어)",
  "message": "상세 내용 (한국어, 부모 친화적, 따뜻한 어조)"
}

## 판단 기준
- 1~2회 지각은 정상 범위 → "ok"
- 특정 일정에 반복적으로 지각 → "info" (해당 일정 시간 조정 제안)
- 전반적으로 지각이 늘어나는 추세 → "warning" (일정 과부하 가능성 제안)

일정 데이터:
${eventLines}`;
}

function buildWeeklySummaryPrompt(
  weekData: WeeklySummaryRequest["weekData"]
): string {
  const memoLines =
    weekData.memos.length > 0
      ? weekData.memos.map((m) => `- "${m}"`).join("\n")
      : "(메모 없음)";

  return `${SYSTEM_BASE}

## 분석 유형: 주간 리포트

이번 주 아이의 일정 데이터를 바탕으로 짧고 따뜻한 주간 요약을 작성해주세요.

## 응답 형식 (JSON만)
{
  "title": "이번 주 리포트",
  "message": "요약 내용 (한국어, 2~4문장, 따뜻하고 격려하는 어조)"
}

## 데이터
- 총 일정 수: ${weekData.totalEvents}
- 정시 도착: ${weekData.onTimeCount}회
- 지각: ${weekData.lateCount}회
- 이번 주 메모들:
${memoLines}

## 작성 가이드
- 잘한 점을 먼저 언급합니다.
- 개선이 필요한 부분은 부드럽게 제안합니다.
- 아이를 격려하는 따뜻한 마무리 문장을 넣어주세요.`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRequest(
  body: Record<string, unknown>
): { valid: true; data: AnalysisRequest } | { valid: false; error: string } {
  const { familyId, analysisType } = body;

  if (!familyId || typeof familyId !== "string") {
    return { valid: false, error: "familyId is required" };
  }

  if (
    !analysisType ||
    !["memo_sentiment", "schedule_adherence", "weekly_summary"].includes(
      analysisType as string
    )
  ) {
    return {
      valid: false,
      error:
        "analysisType must be one of: memo_sentiment, schedule_adherence, weekly_summary",
    };
  }

  if (analysisType === "memo_sentiment") {
    if (!body.memoText || typeof body.memoText !== "string") {
      return { valid: false, error: "memoText is required for memo_sentiment" };
    }
    if (!body.childName || typeof body.childName !== "string") {
      return {
        valid: false,
        error: "childName is required for memo_sentiment",
      };
    }
    return { valid: true, data: body as unknown as MemoSentimentRequest };
  }

  if (analysisType === "schedule_adherence") {
    if (!Array.isArray(body.events) || body.events.length === 0) {
      return {
        valid: false,
        error: "events array is required for schedule_adherence",
      };
    }
    return {
      valid: true,
      data: body as unknown as ScheduleAdherenceRequest,
    };
  }

  if (analysisType === "weekly_summary") {
    if (!body.weekData || typeof body.weekData !== "object") {
      return {
        valid: false,
        error: "weekData is required for weekly_summary",
      };
    }
    return { valid: true, data: body as unknown as WeeklySummaryRequest };
  }

  return { valid: false, error: "Unknown analysisType" };
}

// ---------------------------------------------------------------------------
// OpenAI call
// ---------------------------------------------------------------------------

async function callOpenAI(systemPrompt: string): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "위 데이터를 분석하고 JSON으로 응답해주세요." },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(
      "[ai-child-monitor] OpenAI error:",
      response.status,
      errText
    );
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";

  return JSON.parse(content);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  try {
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const validation = validateRequest(body);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const { data } = validation;
    let systemPrompt: string;

    switch (data.analysisType) {
      case "memo_sentiment":
        systemPrompt = buildMemoSentimentPrompt(
          data.memoText,
          data.eventTitle || "",
          data.childName
        );
        break;

      case "schedule_adherence":
        systemPrompt = buildScheduleAdherencePrompt(data.events);
        break;

      case "weekly_summary":
        systemPrompt = buildWeeklySummaryPrompt(data.weekData);
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Unknown analysisType" }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
    }

    const result = await callOpenAI(systemPrompt);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-child-monitor] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
