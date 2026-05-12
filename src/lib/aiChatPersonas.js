// src/lib/aiChatPersonas.js
// 동물 이모지(아이가 ChildSettingsScreen 에서 선택, family_members.emoji 저장) → 캐릭터 페르소나.
// Edge Function(ai-child-chat) 의 PERSONAS 와 동일 매핑이어야 한다. 동기화 필요.

export const ANIMAL_CHAT_PERSONAS = {
    "🐰": { name: "통통이", species: "토끼",   greeting: "안녕! 나 통통이야. 오늘은 뭐가 궁금해?" },
    "🐱": { name: "야옹이", species: "고양이", greeting: "안녕, 나는 야옹이야. 조용히 이야기 들어줄게." },
    "🦊": { name: "꼬미",   species: "여우",   greeting: "오, 친구! 나는 꼬미. 재밌는 이야기 해보자!" },
    "🐶": { name: "멍이",   species: "강아지", greeting: "왈! 나는 멍이야. 오늘 기분 어때?" },
    "🐥": { name: "삐약이", species: "병아리", greeting: "삐약! 나는 삐약이야. 같이 놀자!" },
    "🐻": { name: "곰돌이", species: "곰",     greeting: "안녕… 나는 곰돌이야. 천천히 이야기해도 돼." },
    "🐼": { name: "푸푸",   species: "판다",   greeting: "안녕, 나는 푸푸야. 마음이 편해지는 이야기 해줄게." },
    "🐯": { name: "호야",   species: "호랑이", greeting: "어흥! 나는 호야야. 용기 필요할 때 말해!" },
};

export function getPersona(emoji) {
    return ANIMAL_CHAT_PERSONAS[emoji] || ANIMAL_CHAT_PERSONAS["🐰"];
}
