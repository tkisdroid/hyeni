import { FEATURES } from "./features.js";

export const EARLY_ADOPTER_BADGE = "Early Adopter";

export const PRICING = Object.freeze({
  monthlyLabel: "월 1,500원",
  yearlyLabel: "연 15,000원",
  dailyLabel: "하루 50원",
  monthlyProductId: "premium_monthly",
  yearlyProductId: "premium_yearly",
});

export const TRIAL_INVITE = Object.freeze({
  title: "7일 무료 체험으로 프리미엄 기능을 열어보세요",
  body: "실시간 위치, 주변 소리 듣기, AI 분석, 학원 일정, 다자녀 연동까지 모두 바로 사용할 수 있어요.",
  highlight: "첫 일정 등록을 시작하셨네요. 지금 체험을 켜두면 이후 기능 잠금 없이 바로 이어서 사용할 수 있어요.",
  ctaPrimary: "7일 무료 체험 시작",
  ctaSecondary: "나중에",
});

export const TRIAL_ENDING = Object.freeze({
  d3: "D-3 · 무료 체험이 3일 뒤 종료돼요",
  d2: "D-2 · 프리미엄 기능을 계속 쓰려면 구독을 이어주세요",
  d1: "내일 체험 종료 · 실시간 위치와 원격 소리듣기가 다시 잠겨요",
  today: "오늘 체험 종료 · 계속 이용하려면 지금 구독을 이어주세요",
  cta: "계속 이용하기",
});

export const AUTO_RENEWAL_DISCLOSURE = Object.freeze({
  title: "자동 갱신 안내",
  items: [
    "7일 무료 체험 후 Google Play 구독이 자동으로 시작됩니다.",
    "체험 종료 24시간 전까지 해지하지 않으면 다음 결제 주기로 갱신됩니다.",
    "구독 관리는 Google Play 구독 관리 화면에서 언제든지 변경할 수 있습니다.",
  ],
  confirm: "안내를 확인했고 계속할게요",
  cancel: "취소",
});

export const CHILD_DEVICE_NOTE = "아이 기기에서는 직접 결제할 수 없어요. 부모 기기에서 체험 또는 구독을 시작해주세요.";

export const FEATURE_LOCK = Object.freeze({
  [FEATURES.MULTI_CHILD]: {
    emoji: "👨‍👩‍👧‍👦",
    title: "두 번째 아이 연동은 프리미엄 전용이에요",
    body: "무료 플랜은 아이 1명까지 연결할 수 있어요. 프리미엄으로 업그레이드하면 여러 아이를 한 가족에서 함께 관리할 수 있어요.",
  },
  [FEATURES.MULTI_GEOFENCE]: {
    emoji: "⚠️",
    title: "추가 위험지역은 프리미엄 전용이에요",
    body: "무료 플랜은 위험지역 1개까지 등록할 수 있어요. 프리미엄에서는 여러 장소를 동시에 관리할 수 있어요.",
  },
  [FEATURES.ACADEMY_SCHEDULE]: {
    emoji: "🏫",
    title: "학원 일정은 프리미엄 전용이에요",
    body: "프리미엄을 시작하면 학원 위치와 반복 일정을 등록하고 길찾기와 함께 관리할 수 있어요.",
  },
  [FEATURES.AI_ANALYSIS]: {
    emoji: "🤖",
    title: "AI 일정 분석은 프리미엄 전용이에요",
    body: "AI 음성 일정 추가와 메모 감정 분석은 프리미엄에서 사용할 수 있어요.",
  },
  [FEATURES.REMOTE_AUDIO]: {
    emoji: "🎙️",
    title: "주변 소리 듣기는 프리미엄 전용이에요",
    body: "부모 기기에서 아이 기기의 주변 소리를 원격으로 확인하려면 프리미엄 체험 또는 구독이 필요해요.",
  },
  [FEATURES.REALTIME_LOCATION]: {
    emoji: "📍",
    title: "실시간 위치는 프리미엄 전용이에요",
    body: "무료 플랜에서는 5분 지난 위치만 보여드려요. 프리미엄을 시작하면 바로 지금 위치를 확인할 수 있어요.",
  },
  [FEATURES.EXTENDED_HISTORY]: {
    emoji: "🗂️",
    title: "장기 위치 이력은 프리미엄 전용이에요",
    body: "30일 이후 위치 이력과 확장 기록은 프리미엄에서 유지돼요.",
  },
});
