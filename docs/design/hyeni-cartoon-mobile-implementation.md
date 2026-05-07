# 혜니캘린더 카툰 모바일 리디자인 구현 가이드

## 1. 적용 방식

생성 이미지를 앱 화면에 직접 붙이지 않는다. 이미지는 레이아웃과 감성 기준으로 사용하고, 실제 앱은 React 컴포넌트로 구현한다.

```
디자인 이미지
→ 토큰 추출
→ 공통 컴포넌트화
→ 화면별 교체
→ 모바일 뷰포트 검수
```

## 2. 권장 파일 구조

```
src/
  styles/
    hyeni-theme.css
  components/
    hyeni/
      HyPage.jsx
      HyCard.jsx
      HyButton.jsx
      HyBottomNav.jsx
      index.js
```

## 3. 전역 스타일 import

`src/main.jsx` 또는 앱의 최상단 entry에서 다음을 추가한다.

```js
import './styles/hyeni-theme.css';
```

## 4. 페어링 코드 입력 예시

```jsx
function PairCodeInput({ value, onChange }) {
  return (
    <div className="hy-pair-code-input">
      <span className="hy-pair-code-prefix">KID-</span>
      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, 7)
          )
        }
        placeholder="E5O3KW3"
        inputMode="text"
        autoCapitalize="characters"
      />
    </div>
  );
}
```

## 5. 로그인 버튼 예시

```jsx
function SocialLoginButtons() {
  return (
    <div className="hy-social-stack">
      <button className="hy-social-button hy-social-button--kakao">카카오로 시작</button>
      <button className="hy-social-button hy-social-button--google">구글로 시작</button>
      <button className="hy-social-button hy-social-button--naver">네이버로 시작</button>
    </div>
  );
}
```

## 6. 모바일 QA 명령

```bash
npm run build
npm run lint
npm run test:e2e
```

Playwright 수동 캡처 기준:

```ts
test.use({ viewport: { width: 390, height: 844 }, isMobile: true });
```
