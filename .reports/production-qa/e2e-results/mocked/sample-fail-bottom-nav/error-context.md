# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical-flows.spec.js >> critical Hyeni flows >> parent bottom navigation opens a stable calendar page with active tab state
- Location: tests\e2e\critical-flows.spec.js:821:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('긴급 알림')
Expected: visible
Error: strict mode violation: getByText('긴급 알림') resolved to 2 elements:
    1) <h2>긴급 알림</h2> aka getByRole('heading', { name: '긴급 알림' })
    2) <div>긴급 알림</div> aka locator('div').filter({ hasText: /^긴급 알림$/ })

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('긴급 알림')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - alertdialog "긴급 알림 팝업" [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e9]:
        - heading "긴급 알림" [level=2] [ref=e10]
        - paragraph [ref=e11]: 바로 확인이 필요한 알림이에요
      - generic [ref=e13]:
        - generic [ref=e15]:
          - generic [ref=e16]: 긴급 미도착
          - generic [ref=e17]: 🚨 긴급! 📚 영어 학원 시간인데 아직 미도착!
        - button "확인" [ref=e18] [cursor=pointer]
  - generic [ref=e20]:
    - generic [ref=e22]:
      - generic [ref=e24]: 긴급 알림
      - generic [ref=e25]: 학부모님, 확인이 필요해요!
    - generic [ref=e26]:
      - generic [ref=e27]:
        - generic [ref=e28]: 📚
        - generic [ref=e29]:
          - generic [ref=e30]: 영어 학원
          - generic [ref=e31]: "예정: ⏰ 01:18"
      - generic [ref=e32]:
        - generic [ref=e33]: ⚠️ 5분 후 시작인데 아직 미도착!
        - generic [ref=e34]: 서울특별시 중구 세종대로 110
    - generic [ref=e35]:
      - button "📞 아이에게 전화" [ref=e36] [cursor=pointer]
      - button "확인했어요" [ref=e37] [cursor=pointer]
  - generic [ref=e38]:
    - generic [ref=e39]:
      - generic "혜니캘린더 로고" [ref=e41] [cursor=pointer]
      - generic [ref=e43] [cursor=pointer]: 혜니캘린더
    - generic [ref=e44]:
      - button "알림" [ref=e45] [cursor=pointer]:
        - img "알림" [ref=e46]
      - button "설정" [ref=e47] [cursor=pointer]:
        - img "설정" [ref=e48]
  - status "친구 만남 진행 중" [ref=e50]:
    - article [ref=e51]:
      - generic [ref=e53]:
        - generic [ref=e54]:
          - generic [ref=e55]: 진행 중
          - generic [ref=e56]: 안전장소에서 친구와 놀고 있어요
        - button "친구 만남 종료" [ref=e57] [cursor=pointer]:
          - generic [ref=e58]: 정지
  - region "혜니 오늘 요약" [ref=e60]:
    - generic [ref=e61]:
      - generic [ref=e62]: 5월 13일 수요일
      - heading "혜니, 오늘은 여유로워요" [level=2] [ref=e63]
      - button "오늘 일정 보기" [ref=e64] [cursor=pointer]:
        - text: 오늘 일정 보기
        - generic [ref=e65]: ›
  - region "부모 메인" [ref=e66]:
    - generic [ref=e67]:
      - generic [ref=e68]: 아이 현황
      - generic [ref=e69]: 실시간 연결
    - button "혜니 오늘 일정 · 다음 일정 · 01:18 · 서울특별시" [ref=e72] [cursor=pointer]:
      - img "혜니 프로필" [ref=e74]:
        - img
      - generic [ref=e76]:
        - generic [ref=e77]: 혜니
        - generic [ref=e78]:
          - generic [ref=e79]: 📍
          - generic [ref=e80]: 서울특별시
        - generic [ref=e81]: 다음 일정 · 01:18
      - generic [ref=e82]: ›
    - region "아이 기기 사용 지표" [ref=e83]:
      - generic [ref=e84]:
        - generic [ref=e86]: 안전 지표
        - button "상세" [ref=e87] [cursor=pointer]
      - generic [ref=e88]:
        - generic [ref=e89]:
          - generic [ref=e90]: 배터리
          - generic [ref=e91]: 확인 중
        - generic [ref=e92]:
          - generic [ref=e93]: 화면 시간
          - generic [ref=e94]: 측정 중
      - generic [ref=e95]:
        - generic [ref=e96]: "마지막 업데이트: 곧 업데이트돼요 · 상태: 양호"
        - button "지금 갱신" [ref=e97] [cursor=pointer]
    - button "오늘의 메모 새 메모 없음 0" [ref=e98] [cursor=pointer]:
      - generic [ref=e100]:
        - generic [ref=e101]: 오늘의 메모
        - generic [ref=e102]: 새 메모 없음
      - generic [ref=e103]: "0"
    - generic [ref=e105]: 바로가기
    - generic "관리 바로가기" [ref=e106]:
      - button "빠른 일정입력" [ref=e107] [cursor=pointer]:
        - generic [ref=e108]: 빠른일정
      - button "꾹 보내기" [ref=e109] [cursor=pointer]:
        - generic [ref=e110]: 꾹
      - button "📍 우리아이" [ref=e111] [cursor=pointer]:
        - generic [ref=e112]: 우리아이
      - button "📍 장소관리" [ref=e113] [cursor=pointer]:
        - generic [ref=e114]: 장소관리
      - button "친구놀이 관리" [ref=e115] [cursor=pointer]:
        - generic [ref=e116]: 친구놀이
      - button "응급 강제 알림" [ref=e117] [cursor=pointer]:
        - generic [ref=e118]: 응급알림
      - button "🏆 스티커" [ref=e119] [cursor=pointer]:
        - generic [ref=e120]: 스티커
      - button "💎 구독" [ref=e121] [cursor=pointer]:
        - generic [ref=e122]: 구독
      - button "📞 연락처" [ref=e123] [cursor=pointer]:
        - generic [ref=e124]: 연락처
      - button "🎙️ 주변소리" [ref=e125] [cursor=pointer]:
        - generic [ref=e126]: 주변소리
      - button "💌 피드백 보내기" [ref=e127] [cursor=pointer]:
        - generic [ref=e128]: 피드백
    - generic [ref=e129]:
      - generic [ref=e130]: 캘린더
      - generic [ref=e131]: 2026년 5월
    - region "캘린더" [ref=e132]:
      - generic [ref=e133]:
        - generic [ref=e134]:
          - generic [ref=e135]:
            - generic [ref=e136]: "2026"
            - generic [ref=e137]: 5월
          - generic [ref=e138]:
            - button "이전 달" [ref=e139] [cursor=pointer]: ‹
            - button "다음 달" [ref=e140] [cursor=pointer]: ›
        - generic [ref=e141]:
          - generic [ref=e142]: 일
          - generic [ref=e143]: 월
          - generic [ref=e144]: 화
          - generic [ref=e145]: 수
          - generic [ref=e146]: 목
          - generic [ref=e147]: 금
          - generic [ref=e148]: 토
        - generic [ref=e149]:
          - button "5월 1일" [ref=e155] [cursor=pointer]:
            - generic [ref=e156]: "1"
          - button "5월 2일" [ref=e157] [cursor=pointer]:
            - generic [ref=e158]: "2"
          - button "5월 3일" [ref=e159] [cursor=pointer]:
            - generic [ref=e160]: "3"
          - button "5월 4일" [ref=e161] [cursor=pointer]:
            - generic [ref=e162]: "4"
          - button "5월 5일" [ref=e163] [cursor=pointer]:
            - generic [ref=e164]: "5"
          - button "5월 6일" [ref=e165] [cursor=pointer]:
            - generic [ref=e166]: "6"
          - button "5월 7일" [ref=e167] [cursor=pointer]:
            - generic [ref=e168]: "7"
          - button "5월 8일" [ref=e169] [cursor=pointer]:
            - generic [ref=e170]: "8"
          - button "5월 9일" [ref=e171] [cursor=pointer]:
            - generic [ref=e172]: "9"
          - button "5월 10일" [ref=e173] [cursor=pointer]:
            - generic [ref=e174]: "10"
          - button "5월 11일" [ref=e175] [cursor=pointer]:
            - generic [ref=e176]: "11"
          - button "5월 12일" [ref=e177] [cursor=pointer]:
            - generic [ref=e178]: "12"
          - button "5월 13일 일정 1개" [ref=e179] [cursor=pointer]:
            - generic [ref=e180]: "13"
          - button "5월 14일" [ref=e183] [cursor=pointer]:
            - generic [ref=e184]: "14"
          - button "5월 15일" [ref=e185] [cursor=pointer]:
            - generic [ref=e186]: "15"
          - button "5월 16일" [ref=e187] [cursor=pointer]:
            - generic [ref=e188]: "16"
          - button "5월 17일" [ref=e189] [cursor=pointer]:
            - generic [ref=e190]: "17"
          - button "5월 18일" [ref=e191] [cursor=pointer]:
            - generic [ref=e192]: "18"
          - button "5월 19일" [ref=e193] [cursor=pointer]:
            - generic [ref=e194]: "19"
          - button "5월 20일" [ref=e195] [cursor=pointer]:
            - generic [ref=e196]: "20"
          - button "5월 21일" [ref=e197] [cursor=pointer]:
            - generic [ref=e198]: "21"
          - button "5월 22일" [ref=e199] [cursor=pointer]:
            - generic [ref=e200]: "22"
          - button "5월 23일" [ref=e201] [cursor=pointer]:
            - generic [ref=e202]: "23"
          - button "5월 24일" [ref=e203] [cursor=pointer]:
            - generic [ref=e204]: "24"
          - button "5월 25일" [ref=e205] [cursor=pointer]:
            - generic [ref=e206]: "25"
          - button "5월 26일" [ref=e207] [cursor=pointer]:
            - generic [ref=e208]: "26"
          - button "5월 27일" [ref=e209] [cursor=pointer]:
            - generic [ref=e210]: "27"
          - button "5월 28일" [ref=e211] [cursor=pointer]:
            - generic [ref=e212]: "28"
          - button "5월 29일" [ref=e213] [cursor=pointer]:
            - generic [ref=e214]: "29"
          - button "5월 30일" [ref=e215] [cursor=pointer]:
            - generic [ref=e216]: "30"
          - button "5월 31일" [ref=e217] [cursor=pointer]:
            - generic [ref=e218]: "31"
    - generic [ref=e219]:
      - generic [ref=e220]: 오늘의 일정
      - generic [ref=e221]:
        - generic [ref=e222]: 5월 13일 수요일
        - generic [ref=e223]: ·
        - strong [ref=e224]: 1개
    - button "영어 학원 편집" [ref=e226] [cursor=pointer]:
      - generic [ref=e227]: 📚
      - generic [ref=e228]:
        - generic [ref=e229]:
          - generic [ref=e230]: 영어 학원
          - generic [ref=e231]: 혜니
        - generic [ref=e232]: 01:18 · 서울특별시 중구 세종대로 110
        - generic [ref=e233]:
          - generic [ref=e234]:
            - img [ref=e235]
            - text: 1.5km
          - generic [ref=e238]: ✏️ 수정
      - generic [ref=e239]: 미도착
      - button "영어 학원 경로 보기" [ref=e240]: 🗺️
    - region "선택한 날짜 이동경로 요약" [ref=e241]:
      - generic [ref=e243]:
        - generic [ref=e244]: 5월 13일 수요일
        - heading "혜니 하루 이동경로" [level=3] [ref=e245]
      - generic [ref=e246]: 선택한 날짜에 혜니 위치 기록이 없어요. 아이 기기의 위치 권한, 네트워크, 배터리 제한 상태를 확인해 주세요.
    - navigation "부모 메인 탭" [ref=e247]:
      - button "홈" [ref=e248] [cursor=pointer]:
        - img [ref=e250]
        - generic [ref=e253]: 홈
      - button "오늘" [ref=e254] [cursor=pointer]:
        - img [ref=e256]
        - generic [ref=e262]: 오늘
      - button "새 항목 추가" [ref=e263] [cursor=pointer]:
        - img [ref=e265]
        - generic [ref=e267]: 일정등록
      - button "장소" [ref=e268] [cursor=pointer]:
        - img [ref=e270]
        - generic [ref=e273]: 장소
      - button "메모" [ref=e274] [cursor=pointer]:
        - img [ref=e276]
        - generic [ref=e278]: 메모
      - button "가족" [ref=e279] [cursor=pointer]:
        - img [ref=e281]
        - generic [ref=e286]: 가족
```

# Test source

```ts
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
  823 |     await page.goto("/");
  824 | 
  825 |     await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
> 826 |     await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
      |                                           ^ Error: expect(locator).toBeVisible() failed
  827 |     await page.getByRole("button", { name: "확인했어요" }).click();
  828 | 
  829 |     const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
  830 |     await expect(mainTabbar.getByRole("button", { name: "일정" })).toBeVisible();
  831 | 
  832 |     await mainTabbar.getByRole("button", { name: "일정" }).click();
  833 | 
  834 |     await expect(page.getByRole("region", { name: "부모 캘린더" })).toBeVisible();
  835 |     await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toHaveCount(0);
  836 | 
  837 |     const navState = await page.evaluate(() => {
  838 |       const nav = document.querySelector(".hyeni-v5-tabbar-fixed");
  839 |       const active = nav?.querySelector("button.active");
  840 |       const rect = nav?.getBoundingClientRect();
  841 |       return {
  842 |         activeText: active?.innerText || "",
  843 |         position: nav ? getComputedStyle(nav).position : "",
  844 |         bottomGap: rect ? Math.round(window.innerHeight - rect.bottom) : null,
  845 |         scrollY: Math.round(window.scrollY),
  846 |       };
  847 |     });
  848 |     expect(navState.activeText).toContain("일정");
  849 |     expect(navState.position).toBe("fixed");
  850 |     expect(navState.bottomGap).toBeLessThanOrEqual(16);
  851 |     expect(navState.scrollY).toBe(0);
  852 |   });
  853 | 
  854 |   test("parent calendar page add saves a single-child schedule with a child link", async ({ page }) => {
  855 |     const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
  856 |     await page.goto("/");
  857 | 
  858 |     await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
  859 |     await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
  860 |     await page.getByRole("button", { name: "확인했어요" }).click();
  861 | 
  862 |     const mainTabbar = page.getByRole("navigation", { name: "부모 메인 탭" }).last();
  863 |     await mainTabbar.getByRole("button", { name: "일정" }).click();
  864 |     await expect(page.getByRole("region", { name: "부모 캘린더" })).toBeVisible();
  865 | 
  866 |     await page.locator(".hyeni-v5-page-add").click();
  867 |     const sheet = page.getByRole("dialog", { name: "새 일정" });
  868 |     await expect(sheet.getByLabel("시작 시간 직접 입력")).toHaveValue("09:00");
  869 |     await expect(sheet).toContainText("저장 시 혜니에게만 전송");
  870 |     await expect(sheet).not.toContainText("아래에서 받을 아이를 선택해 주세요");
  871 |     await page.getByPlaceholder("예) 영어 학원, 태권도...").fill("기본 연결 일정");
  872 |     await page.locator("button.sheet-save").click();
  873 | 
  874 |     await expect.poll(() => state.insertedEvents.find((event) => event.title === "기본 연결 일정")?.time).toBe("09:00");
  875 |     await expect.poll(() => state.insertedEventChildren.length).toBeGreaterThan(0);
  876 |     expect(state.insertedEventChildren).toContainEqual(
  877 |       expect.objectContaining({ child_id: "member-child-1" }),
  878 |     );
  879 |   });
  880 | 
  881 |   test("parent child tracker sends a native location refresh push fallback", async ({ page }) => {
  882 |     const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
  883 |     await page.goto("/");
  884 | 
  885 |     await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
  886 |     await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
  887 |     await page.getByRole("button", { name: "확인했어요" }).click();
  888 | 
  889 |     await page.getByRole("button", { name: "📍 우리아이" }).click();
  890 |     await expect(page.getByRole("button", { name: "현재 위치 다시 확인" })).toBeVisible();
  891 | 
  892 |     await expect.poll(() => state.functionCalls.find((call) => call.body?.action === "request_location")?.body).toMatchObject({
  893 |       action: "request_location",
  894 |       familyId: FAMILY_ID,
  895 |       targetRole: "child",
  896 |     });
  897 |   });
  898 | 
  899 |   test("parent dashboard bootstraps child location and device status after reload", async ({ page }) => {
  900 |     const state = await installCriticalMocks(page, { role: "parent", initiallyPaired: true });
  901 |     await page.goto("/");
  902 | 
  903 |     await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
  904 | 
  905 |     await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "request_location")).toBeTruthy();
  906 |     await expect.poll(() => state.functionCalls.some((call) => call.body?.action === "request_device_status")).toBeTruthy();
  907 |   });
  908 | 
  909 |   test("parent dashboard renders persisted child device health before live broadcast refresh", async ({ page }) => {
  910 |     await installCriticalMocks(page, {
  911 |       role: "parent",
  912 |       initiallyPaired: true,
  913 |       childDeviceHealth: {
  914 |         batteryLevel: 42,
  915 |         isCharging: true,
  916 |         connectionType: "wifi",
  917 |         screenOnMs: 65 * 60_000,
  918 |         recentApp: "com.youtube",
  919 |         usagePermission: "granted",
  920 |         updatedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
  921 |       },
  922 |     });
  923 |     await page.goto("/");
  924 | 
  925 |     await expect(page.getByRole("region", { name: "혜니 오늘 요약" })).toBeVisible();
  926 |     await expect(page.getByText("긴급 알림")).toBeVisible({ timeout: 15_000 });
```