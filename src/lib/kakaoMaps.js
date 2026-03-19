// Kakao Maps
let kakaoReady = null; // shared promise
function loadKakaoMap(appKey) {
    if (kakaoReady) return kakaoReady;
    kakaoReady = new Promise((res, rej) => {
        if (window.kakao?.maps?.LatLng) { res(); return; }
        const timeout = setTimeout(() => {
            kakaoReady = null;
            rej(new Error("timeout"));
        }, 15000);
        const s = document.createElement("script");
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
        s.onload = () => {
            try {
                window.kakao.maps.load(() => {
                    clearTimeout(timeout);
                    console.log("[KakaoMap] SDK ready");
                    res();
                });
            } catch (e) {
                clearTimeout(timeout);
                kakaoReady = null;
                rej(new Error(`maps.load error: ${e.message}`));
            }
        };
        s.onerror = () => { clearTimeout(timeout); kakaoReady = null; rej(new Error("script load failed")); };
        document.head.appendChild(s);
    });
    return kakaoReady;
}

export { kakaoReady, loadKakaoMap };
