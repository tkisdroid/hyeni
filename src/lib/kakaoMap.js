// src/lib/kakaoMap.js
// Kakao Maps SDK loader + env key helpers.
// Extracted from App.jsx (Phase 5 #4 / B5a).

export function normalizeKakaoAppKey(value) {
    return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

export const KAKAO_APP_KEY = normalizeKakaoAppKey(import.meta.env?.VITE_KAKAO_APP_KEY);

let kakaoReady = null; // shared promise

export function loadKakaoMap(appKey) {
    const normalizedKey = normalizeKakaoAppKey(appKey);
    if (kakaoReady) return kakaoReady;
    kakaoReady = new Promise((res, rej) => {
        if (window.kakao?.maps?.LatLng) { res(); return; }
        if (!normalizedKey) {
            kakaoReady = null;
            rej(new Error("missing Kakao app key"));
            return;
        }
        const s = document.createElement("script");
        let settled = false;
        const finish = (callback) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            callback();
        };
        const timer = setTimeout(() => {
            s.remove();
            kakaoReady = null;
            finish(() => rej(new Error("Kakao 지도 SDK 로딩 시간이 초과됐어요")));
        }, 10000);
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(normalizedKey)}&autoload=false&libraries=services`;
        s.onload = () => {
            if (!window.kakao?.maps?.load) {
                kakaoReady = null;
                finish(() => rej(new Error("Kakao 지도 SDK가 초기화되지 않았어요")));
                return;
            }
            try {
                window.kakao.maps.load(() => {
                    console.log("[KakaoMap] SDK ready");
                    finish(res);
                });
            } catch (error) {
                kakaoReady = null;
                finish(() => rej(error));
            }
        };
        s.onerror = () => {
            kakaoReady = null;
            finish(() => rej(new Error("Kakao 지도 SDK 스크립트를 불러오지 못했어요")));
        };
        document.head.appendChild(s);
    });
    return kakaoReady;
}
