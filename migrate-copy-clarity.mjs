// One-shot copy clarity migration: 친구놀이 → 친구 만남 (and related copy fixes).
// User-facing strings only — function/variable/CSS class names preserved.

import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/TK/Desktop/hyeni-1";

const targets = [
  "src/App.jsx",
  "src/components/friendPlaydate/FriendPlaydatePanel.jsx",
  "src/components/friendPlaydate/FriendPlaydateToggle.jsx",
  "src/components/friendPlaydate/PlaydateHistory.jsx",
  "src/components/friendPlaydate/PlaydateSafePlaceList.jsx",
  "src/components/friendPlaydate/ActivePlaydateBanner.jsx",
  "src/components/friendPlaydate/ActivePlaydateCard.jsx",
];

const replacements = [
  ["친구놀이 정보 불러오는 중", "친구 만남 정보 불러오는 중"],
  ["친구놀이 패널", "친구 만남 패널"],
  ['"친구놀이"', '"친구 만남"'],
  [">친구놀이<", ">친구 만남<"],
  ["친구놀이 안전장소", "친구 만남 안전 장소"],
  ["최근 친구놀이", "최근 친구 만남 기록"],
  ["친구놀이 켜기", "친구 만남 알림 켜기"],
  ["친구놀이 끄기", "친구 만남 알림 끄기"],
  ["친구놀이가", "친구 만남이"],
  ["친구놀이를", "친구 만남을"],
  ["친구놀이는", "친구 만남은"],
  ["친구놀이에서", "친구 만남에서"],
  ["친구놀이로", "친구 만남으로"],
  ["{'친구놀이'}", "{'친구 만남'}"],
  [">친구놀이</", ">친구 만남</"],
  ["친구놀이 시작", "친구 만남 시작"],
  ["친구놀이 종료", "친구 만남 종료"],
  ["안전장소 매칭 대기", "친구 자동 매칭 대기 중"],
  ["매칭 꺼짐", "친구 매칭 꺼짐"],
  ["친구놀이 관리", "친구 만남 관리"],
  ["친구놀이 기능", "친구 만남 기능"],
  ["친구놀이 장소", "친구 만남 장소"],
  ["친구놀이 토글", "친구 만남 토글"],
  ["친구놀이 이력", "친구 만남 이력"],
  ["친구놀이 정지", "친구 만남 종료"],
  ["친구놀이 진행 중", "친구 만남 진행 중"],
];

let totalFiles = 0;
for (const rel of targets) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  let src = fs.readFileSync(full, "utf8");
  const orig = src;
  for (const [from, to] of replacements) {
    src = src.split(from).join(to);
  }
  if (src !== orig) {
    fs.writeFileSync(full, src);
    console.log(`[updated] ${rel}`);
    totalFiles += 1;
  }
}
console.log(`Total files updated: ${totalFiles}`);
