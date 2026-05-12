# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical-flows.spec.js >> critical Hyeni flows >> parent mode covers emergency, location, scheduling, AI, notifications, remote audio, and kkuk
- Location: tests\e2e\critical-flows.spec.js:717:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByText('학부모 모드')
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('학부모 모드')
    13 × locator resolved to <button type="button">학부모 모드</button>
       - unexpected value "hidden"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e5]:
    - generic [ref=e7]:
      - generic [ref=e9]: 긴급 알림
      - generic [ref=e10]: 학부모님, 확인이 필요해요!
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]: 📚
        - generic [ref=e14]:
          - generic [ref=e15]: 영어 학원
          - generic [ref=e16]: "예정: ⏰ 01:17"
      - generic [ref=e17]:
        - generic [ref=e18]: ⚠️ 5분 후 시작인데 아직 미도착!
        - generic [ref=e19]: 서울특별시 중구 세종대로 110
    - generic [ref=e20]:
      - button "📞 아이에게 전화" [ref=e21] [cursor=pointer]
      - button "확인했어요" [ref=e22] [cursor=pointer]
  - generic [ref=e23]:
    - generic [ref=e24]:
      - generic "혜니캘린더 로고" [ref=e26] [cursor=pointer]
      - generic [ref=e28] [cursor=pointer]: 혜니캘린더
    - generic [ref=e29]:
      - button "알림" [ref=e30] [cursor=pointer]:
        - img "알림" [ref=e31]
      - button "설정" [ref=e32] [cursor=pointer]:
        - img "설정" [ref=e33]
  - status "친구 만남 진행 중" [ref=e35]:
    - article [ref=e36]:
      - generic [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]: 진행 중
          - generic [ref=e41]: 안전장소에서 친구와 놀고 있어요
        - button "친구 만남 종료" [ref=e42] [cursor=pointer]:
          - generic [ref=e43]: 정지
  - region "혜니 오늘 요약" [ref=e45]:
    - generic [ref=e46]:
      - generic [ref=e47]: 5월 13일 수요일
      - heading "혜니, 오늘은 여유로워요" [level=2] [ref=e48]
      - button "오늘 일정 보기" [ref=e49] [cursor=pointer]:
        - text: 오늘 일정 보기
        - generic [ref=e50]: ›
  - region "부모 메인" [ref=e51]:
    - generic [ref=e52]:
      - generic [ref=e53]: 아이 현황
      - generic [ref=e54]: 실시간 연결
    - button "혜니 오늘 일정 · 다음 일정 · 01:17 · 서울특별시" [ref=e57] [cursor=pointer]:
      - img "혜니 프로필" [ref=e59]:
        - img
      - generic [ref=e61]:
        - generic [ref=e62]: 혜니
        - generic [ref=e63]:
          - generic [ref=e64]: 📍
          - generic [ref=e65]: 서울특별시
        - generic [ref=e66]: 다음 일정 · 01:17
      - generic [ref=e67]: ›
    - region "아이 기기 사용 지표" [ref=e68]:
      - generic [ref=e69]:
        - generic [ref=e71]: 안전 지표
        - button "상세" [ref=e72] [cursor=pointer]
      - generic [ref=e73]:
        - generic [ref=e74]:
          - generic [ref=e75]: 배터리
          - generic [ref=e76]: 확인 중
        - generic [ref=e77]:
          - generic [ref=e78]: 화면 시간
          - generic [ref=e79]: 측정 중
      - generic [ref=e80]:
        - generic [ref=e81]: "마지막 업데이트: 곧 업데이트돼요 · 상태: 양호"
        - button "지금 갱신" [ref=e82] [cursor=pointer]
    - button "오늘의 메모 새 메모 없음 0" [ref=e83] [cursor=pointer]:
      - generic [ref=e85]:
        - generic [ref=e86]: 오늘의 메모
        - generic [ref=e87]: 새 메모 없음
      - generic [ref=e88]: "0"
    - generic [ref=e90]: 바로가기
    - generic "관리 바로가기" [ref=e91]:
      - button "빠른 일정입력" [ref=e92] [cursor=pointer]:
        - generic [ref=e93]: 빠른일정
      - button "꾹 보내기" [ref=e94] [cursor=pointer]:
        - generic [ref=e95]: 꾹
      - button "📍 우리아이" [ref=e96] [cursor=pointer]:
        - generic [ref=e97]: 우리아이
      - button "📍 장소관리" [ref=e98] [cursor=pointer]:
        - generic [ref=e99]: 장소관리
      - button "친구놀이 관리" [ref=e100] [cursor=pointer]:
        - generic [ref=e101]: 친구놀이
      - button "응급 강제 알림" [ref=e102] [cursor=pointer]:
        - generic [ref=e103]: 응급알림
      - button "🏆 스티커" [ref=e104] [cursor=pointer]:
        - generic [ref=e105]: 스티커
      - button "💎 구독" [ref=e106] [cursor=pointer]:
        - generic [ref=e107]: 구독
      - button "📞 연락처" [ref=e108] [cursor=pointer]:
        - generic [ref=e109]: 연락처
      - button "🎙️ 주변소리" [ref=e110] [cursor=pointer]:
        - generic [ref=e111]: 주변소리
      - button "💌 피드백 보내기" [ref=e112] [cursor=pointer]:
        - generic [ref=e113]: 피드백
    - generic [ref=e114]:
      - generic [ref=e115]: 캘린더
      - generic [ref=e116]: 2026년 5월
    - region "캘린더" [ref=e117]:
      - generic [ref=e118]:
        - generic [ref=e119]:
          - generic [ref=e120]:
            - generic [ref=e121]: "2026"
            - generic [ref=e122]: 5월
          - generic [ref=e123]:
            - button "이전 달" [ref=e124] [cursor=pointer]: ‹
            - button "다음 달" [ref=e125] [cursor=pointer]: ›
        - generic [ref=e126]:
          - generic [ref=e127]: 일
          - generic [ref=e128]: 월
          - generic [ref=e129]: 화
          - generic [ref=e130]: 수
          - generic [ref=e131]: 목
          - generic [ref=e132]: 금
          - generic [ref=e133]: 토
        - generic [ref=e134]:
          - button "5월 1일" [ref=e140] [cursor=pointer]:
            - generic [ref=e141]: "1"
          - button "5월 2일" [ref=e142] [cursor=pointer]:
            - generic [ref=e143]: "2"
          - button "5월 3일" [ref=e144] [cursor=pointer]:
            - generic [ref=e145]: "3"
          - button "5월 4일" [ref=e146] [cursor=pointer]:
            - generic [ref=e147]: "4"
          - button "5월 5일" [ref=e148] [cursor=pointer]:
            - generic [ref=e149]: "5"
          - button "5월 6일" [ref=e150] [cursor=pointer]:
            - generic [ref=e151]: "6"
          - button "5월 7일" [ref=e152] [cursor=pointer]:
            - generic [ref=e153]: "7"
          - button "5월 8일" [ref=e154] [cursor=pointer]:
            - generic [ref=e155]: "8"
          - button "5월 9일" [ref=e156] [cursor=pointer]:
            - generic [ref=e157]: "9"
          - button "5월 10일" [ref=e158] [cursor=pointer]:
            - generic [ref=e159]: "10"
          - button "5월 11일" [ref=e160] [cursor=pointer]:
            - generic [ref=e161]: "11"
          - button "5월 12일" [ref=e162] [cursor=pointer]:
            - generic [ref=e163]: "12"
          - button "5월 13일 일정 1개" [ref=e164] [cursor=pointer]:
            - generic [ref=e165]: "13"
          - button "5월 14일" [ref=e168] [cursor=pointer]:
            - generic [ref=e169]: "14"
          - button "5월 15일" [ref=e170] [cursor=pointer]:
            - generic [ref=e171]: "15"
          - button "5월 16일" [ref=e172] [cursor=pointer]:
            - generic [ref=e173]: "16"
          - button "5월 17일" [ref=e174] [cursor=pointer]:
            - generic [ref=e175]: "17"
          - button "5월 18일" [ref=e176] [cursor=pointer]:
            - generic [ref=e177]: "18"
          - button "5월 19일" [ref=e178] [cursor=pointer]:
            - generic [ref=e179]: "19"
          - button "5월 20일" [ref=e180] [cursor=pointer]:
            - generic [ref=e181]: "20"
          - button "5월 21일" [ref=e182] [cursor=pointer]:
            - generic [ref=e183]: "21"
          - button "5월 22일" [ref=e184] [cursor=pointer]:
            - generic [ref=e185]: "22"
          - button "5월 23일" [ref=e186] [cursor=pointer]:
            - generic [ref=e187]: "23"
          - button "5월 24일" [ref=e188] [cursor=pointer]:
            - generic [ref=e189]: "24"
          - button "5월 25일" [ref=e190] [cursor=pointer]:
            - generic [ref=e191]: "25"
          - button "5월 26일" [ref=e192] [cursor=pointer]:
            - generic [ref=e193]: "26"
          - button "5월 27일" [ref=e194] [cursor=pointer]:
            - generic [ref=e195]: "27"
          - button "5월 28일" [ref=e196] [cursor=pointer]:
            - generic [ref=e197]: "28"
          - button "5월 29일" [ref=e198] [cursor=pointer]:
            - generic [ref=e199]: "29"
          - button "5월 30일" [ref=e200] [cursor=pointer]:
            - generic [ref=e201]: "30"
          - button "5월 31일" [ref=e202] [cursor=pointer]:
            - generic [ref=e203]: "31"
    - generic [ref=e204]:
      - generic [ref=e205]: 오늘의 일정
      - generic [ref=e206]:
        - generic [ref=e207]: 5월 13일 수요일
        - generic [ref=e208]: ·
        - strong [ref=e209]: 1개
    - button "영어 학원 편집" [ref=e211] [cursor=pointer]:
      - generic [ref=e212]: 📚
      - generic [ref=e213]:
        - generic [ref=e214]:
          - generic [ref=e215]: 영어 학원
          - generic [ref=e216]: 혜니
        - generic [ref=e217]: 01:17 · 서울특별시 중구 세종대로 110
        - generic [ref=e218]:
          - generic [ref=e219]:
            - img [ref=e220]
            - text: 1.5km
          - generic [ref=e223]: ✏️ 수정
      - generic [ref=e224]: 미도착
      - button "영어 학원 경로 보기" [ref=e225]: 🗺️
    - region "선택한 날짜 이동경로 요약" [ref=e226]:
      - generic [ref=e228]:
        - generic [ref=e229]: 5월 13일 수요일
        - heading "혜니 하루 이동경로" [level=3] [ref=e230]
      - generic [ref=e231]: 선택한 날짜에 혜니 위치 기록이 없어요. 아이 기기의 위치 권한, 네트워크, 배터리 제한 상태를 확인해 주세요.
    - navigation "부모 메인 탭" [ref=e232]:
      - button "홈" [ref=e233] [cursor=pointer]:
        - img [ref=e235]
        - generic [ref=e238]: 홈
      - button "오늘" [ref=e239] [cursor=pointer]:
        - img [ref=e241]
        - generic [ref=e247]: 오늘
      - button "새 항목 추가" [ref=e248] [cursor=pointer]:
        - img [ref=e250]
        - generic [ref=e252]: 일정등록
      - button "장소" [ref=e253] [cursor=pointer]:
        - img [ref=e255]
        - generic [ref=e258]: 장소
      - button "메모" [ref=e259] [cursor=pointer]:
        - img [ref=e261]
        - generic [ref=e263]: 메모
      - button "가족" [ref=e264] [cursor=pointer]:
        - img [ref=e266]
        - generic [ref=e271]: 가족
```

# Test source

```ts
  622 |           read_by: [],
  623 |           ...(Array.isArray(body) ? body[0] : body),
  624 |         };
  625 |         state.insertedMemoReplies.push(row);
  626 |         return fulfillJson(row);
  627 |       }
  628 |       return fulfillJson(method === "GET" ? state.insertedMemoReplies : []);
  629 |     }
  630 | 
  631 |     if (table === "saved_places") {
  632 |       return fulfillJson(
  633 |         method === "GET"
  634 |           ? [
  635 |               {
  636 |                 id: "place-1",
  637 |                 family_id: FAMILY_ID,
  638 |                 name: "영어 학원",
  639 |                 location: TEST_PLACE,
  640 |                 created_at: new Date().toISOString(),
  641 |                 updated_at: new Date().toISOString(),
  642 |               },
  643 |             ]
  644 |           : [],
  645 |       );
  646 |     }
  647 | 
  648 |     if (table === "child_locations") {
  649 |       const useRefreshedLocation = refreshLocationAfterRequest
  650 |         && state.enableRefreshedLocation
  651 |         && state.locationRefreshRequests > 0
  652 |         && ++state.childLocationGetsAfterRefresh >= refreshLocationAfterGets;
  653 |       if (method !== "GET") return fulfillJson([]);
  654 |       const locations = [
  655 |         {
  656 |           user_id: CHILD_ID,
  657 |           lat: useRefreshedLocation ? 37.5699 : 37.5665,
  658 |           lng: useRefreshedLocation ? 126.9822 : 126.978,
  659 |           updated_at: useRefreshedLocation
  660 |             ? new Date(Date.now() + 5000).toISOString()
  661 |             : (initialLocationUpdatedAt || new Date().toISOString()),
  662 |         },
  663 |       ];
  664 |       if (extraChild) {
  665 |         locations.push({
  666 |           user_id: SECOND_CHILD_ID,
  667 |           lat: 37.5702,
  668 |           lng: 126.9828,
  669 |           updated_at: new Date(Date.now() + 2000).toISOString(),
  670 |         });
  671 |       }
  672 |       return fulfillJson(locations);
  673 |     }
  674 | 
  675 |     if (table === "location_history") {
  676 |       if (method !== "GET") return fulfillJson([]);
  677 |       const userIdsParam = query.get("user_id") || "";
  678 |       const selectedUserIds = userIdsParam.match(/in\.\(([^)]*)\)/)?.[1]
  679 |         ?.split(",")
  680 |         .map((value) => value.trim())
  681 |         .filter(Boolean) || [];
  682 |       const recordedFilters = query.getAll("recorded_at");
  683 |       const gte = recordedFilters.find((value) => value.startsWith("gte."))?.slice(4);
  684 |       const lt = recordedFilters.find((value) => value.startsWith("lt."))?.slice(3);
  685 |       const rows = locationHistoryRows.filter((row) => {
  686 |         if (selectedUserIds.length && !selectedUserIds.includes(row.user_id)) return false;
  687 |         const recordedMs = Date.parse(row.recorded_at);
  688 |         if (gte && recordedMs < Date.parse(gte)) return false;
  689 |         if (lt && recordedMs >= Date.parse(lt)) return false;
  690 |         return true;
  691 |       });
  692 |       return fulfillJson(rows);
  693 |     }
  694 | 
  695 |     if (
  696 |       [
  697 |         "academies",
  698 |         "memos",
  699 |         "danger_zones",
  700 |         "parent_alerts",
  701 |         "remote_listen_sessions",
  702 |         "push_subscriptions",
  703 |         "fcm_tokens",
  704 |         "sos_events",
  705 |       ].includes(table)
  706 |     ) {
  707 |       return fulfillJson([]);
  708 |     }
  709 | 
  710 |     return fulfillJson([]);
  711 |   });
  712 | 
  713 |   return state;
  714 | }
  715 | 
  716 | test.describe("critical Hyeni flows", () => {
  717 |   test("parent mode covers emergency, location, scheduling, AI, notifications, remote audio, and kkuk", async ({ page }, testInfo) => {
  718 |     const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
  719 |     await page.goto("/");
  720 | 
  721 |     await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
> 722 |     await expect(page.getByText("학부모 모드")).toBeVisible();
      |                                            ^ Error: expect(locator).toBeVisible() failed
  723 |     await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
  724 |     await page.getByRole("button", { name: "확인했어요" }).click();
  725 | 
  726 |     await expect(page.getByRole("button", { name: "연동 (1명)" })).toBeVisible();
  727 |     const managementRail = page.locator('[aria-label="관리 바로가기"]');
  728 |     await expect(managementRail.locator("button").first()).toHaveAttribute("aria-label", "빠른 일정입력");
  729 |     await expect(page.getByText("관리 바로가기", { exact: true })).toHaveCount(0);
  730 |     await expect(page.getByText("필요한 기능만 빠르게", { exact: true })).toHaveCount(0);
  731 |     await expect(page.locator(".hyeni-v5-add-row")).toHaveCount(0);
  732 |     const firstManagementButtonLayout = await managementRail.locator("button").first().evaluate((button) => {
  733 |       const styles = getComputedStyle(button);
  734 |       return {
  735 |         gridColumnEnd: styles.gridColumnEnd,
  736 |         flexDirection: styles.flexDirection,
  737 |       };
  738 |     });
  739 |     expect(firstManagementButtonLayout.gridColumnEnd).toBe("span 2");
  740 |     expect(firstManagementButtonLayout.flexDirection).toBe("row");
  741 |     await managementRail.getByRole("button", { name: "빠른 일정입력" }).click();
  742 |     await expect(page.getByText("일정 빠른 입력")).toBeVisible();
  743 |     await expect(page.getByRole("button", { name: "말하기" })).toBeVisible();
  744 |     await expect(page.getByRole("button", { name: "이미지" })).toBeVisible();
  745 |     await expect(page.getByRole("button", { name: "텍스트" })).toBeVisible();
  746 |     await page.getByRole("button", { name: "닫기" }).click();
  747 |     await page.getByRole("button", { name: "📍 우리아이" }).click();
  748 |     await expect(page.getByRole("button", { name: "현재 위치 다시 확인" })).toBeVisible();
  749 |     await expect(page.getByText("혜니 실시간")).toBeVisible();
  750 |     await page.getByRole("button", { name: "← 돌아가기" }).click();
  751 | 
  752 |     const now = new Date();
  753 |     const mainCalendar = page.getByRole("region", { name: "캘린더" }).first();
  754 |     await mainCalendar.getByRole("button", { name: new RegExp(`${now.getMonth() + 1}월 ${now.getDate()}일`) }).click();
  755 |     await page.getByPlaceholder("예) 영어 학원, 태권도...").fill("피아노 연습");
  756 |     const timePicker = page.locator(".hyeni-schedule-time-card").first();
  757 |     await expect(timePicker).toBeVisible();
  758 |     await timePicker.getByRole("button", { name: "오후 3:00 시작 시간 선택" }).click();
  759 |     await timePicker.getByRole("button", { name: "오후 4:30 종료 시간 선택" }).click();
  760 |     const timeSummary = timePicker.locator(".hyeni-time-summary");
  761 |     await expect(timeSummary.getByText("오후 3:00 ~ 오후 4:30")).toBeVisible();
  762 |     await expect(timeSummary.getByText("1시간 30분")).toBeVisible();
  763 |     const themedTimePickerStyles = await timePicker.evaluate((element) => {
  764 |       const styles = getComputedStyle(element);
  765 |       const selectedSlot = element.querySelector(".hyeni-time-slot.is-start");
  766 |       const selectedStyles = selectedSlot ? getComputedStyle(selectedSlot) : null;
  767 |       return {
  768 |         borderRadius: styles.borderRadius,
  769 |         selectedSlotBackground: selectedStyles?.backgroundColor || "",
  770 |       };
  771 |     });
  772 |     expect(themedTimePickerStyles.borderRadius).toBe("16px");
  773 |     expect(themedTimePickerStyles.selectedSlotBackground).toMatch(/^rgb\(/);
  774 |     expect(themedTimePickerStyles.selectedSlotBackground).not.toBe("rgb(255, 255, 255)");
  775 |     const timePickerScreenshot = testInfo.outputPath("time-picker-theme.png");
  776 |     await timePicker.screenshot({ path: timePickerScreenshot });
  777 |     await testInfo.attach("time-picker-theme", { path: timePickerScreenshot, contentType: "image/png" });
  778 |     await page.getByRole("button", { name: "🗺️ 지도에서 장소 선택" }).click();
  779 |     await page.getByPlaceholder("🔍 학원 이름이나 주소 검색...").fill("세종대로");
  780 |     await page.getByRole("button", { name: "검색" }).click();
  781 |     await page.getByText("세종대로", { exact: true }).click();
  782 |     await page.getByRole("button", { name: "📍 이 장소로 설정하기" }).click();
  783 |     await expect(page.getByText("서울특별시 중구 세종대로 110").first()).toBeVisible();
  784 |     await page.locator("button.sheet-save").click();
  785 |     await expect(page.getByRole("button", { name: "피아노 연습 편집" })).toBeVisible();
  786 | 
  787 |     await managementRail.getByRole("button", { name: "빠른 일정입력" }).click();
  788 |     await page.locator("#ai-text-input").fill("오늘 4시 반 수학 학원, 교재 챙기기");
  789 |     await page.getByRole("button", { name: "✅ 다 입력했어요^^" }).click();
  790 |     await expect(page.getByText("수학 학원", { exact: true }).first()).toBeVisible();
  791 |     await page.getByRole("button", { name: "모두 등록" }).click();
  792 |     await expect(page.getByText("수학 학원", { exact: true }).first()).toBeVisible();
  793 | 
  794 |     // The "🔔 일정알림" quick-action was removed when notification settings
  795 |     // moved into the per-event detail / global push permission gate flow.
  796 |     // Coverage for the new flow lives in subscription-flow.spec.js
  797 |     // ("parent can configure reminder times without duplicate minute entries").
  798 |     await page.getByRole("button", { name: "🎙️ 주변소리" }).click();
  799 |     await expect(page.getByText("주변 소리 듣기")).toBeVisible();
  800 |     await page.getByRole("button", { name: "🎙️ 듣기 시작" }).click();
  801 |     // The remote-listen connect status surfaces one of the per-status copy
  802 |     // strings from the connection state machine (idle → connecting →
  803 |     // listening). Match the umbrella substring "연결" + the noun phrase
  804 |     // "아이 기기" so the test tolerates either "아이 기기 자동 연결 시도 중"
  805 |     // or future copy variants.
  806 |     await expect(page.getByText("아이 기기 자동 연결 시도 중")).toBeVisible();
  807 |     await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "remote_listen")).toBeTruthy();
  808 |     await page.getByRole("button", { name: "⏹️ 중지" }).click();
  809 |     await page.getByRole("button", { name: "닫기" }).click();
  810 | 
  811 |     await page.getByRole("button", { name: "꾹 보내기" }).click();
  812 |     await expect(page.getByText("꾹을 보냈어요!")).toBeVisible();
  813 | 
  814 |     const appFont = await page.locator(".hyeni-app-shell").first().evaluate((element) => getComputedStyle(element).fontFamily);
  815 |     expect(appFont).toContain("Pretendard");
  816 |     expect(state.insertedEvents.length).toBeGreaterThanOrEqual(2);
  817 |     expect(state.functionCalls.some((call) => call.name === "ai-voice-parse")).toBeTruthy();
  818 |     await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "remote_listen")).toBeTruthy();
  819 |   });
  820 | 
  821 |   test("parent bottom navigation opens a stable calendar page with active tab state", async ({ page }) => {
  822 |     await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
```