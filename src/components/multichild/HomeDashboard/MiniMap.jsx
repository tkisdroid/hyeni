// src/components/multichild/HomeDashboard/MiniMap.jsx
import { useEffect, useRef, useState } from "react";

const KAKAO_APP_KEY = (import.meta.env.VITE_KAKAO_APP_KEY || "").trim();
let kakaoSdkPromise = null;

function ensureKakaoSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.kakao?.maps?.LatLng) return Promise.resolve();
  if (!KAKAO_APP_KEY) return Promise.reject(new Error("missing kakao app key"));
  if (kakaoSdkPromise) return kakaoSdkPromise;
  kakaoSdkPromise = new Promise((resolve, reject) => {
    const onLoad = () => {
      if (!window.kakao?.maps?.load) {
        kakaoSdkPromise = null;
        reject(new Error("kakao sdk init failed"));
        return;
      }
      try {
        window.kakao.maps.load(() => resolve());
      } catch (e) {
        kakaoSdkPromise = null;
        reject(e);
      }
    };
    const existing = document.querySelector('script[data-hyeni-kakao-sdk="1"]');
    if (existing) {
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", () => { kakaoSdkPromise = null; reject(new Error("kakao sdk script error")); }, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.dataset.hyeniKakaoSdk = "1";
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_APP_KEY)}&autoload=false&libraries=services`;
    s.onload = onLoad;
    s.onerror = () => { kakaoSdkPromise = null; reject(new Error("kakao sdk script error")); };
    document.head.appendChild(s);
  });
  return kakaoSdkPromise;
}

export function MiniMap({ children, positions, onTap }) {
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  const pinned = (positions || []).map((p) => {
    const child = children.find((c) => c.user_id === p.user_id);
    return child ? { ...p, color_hex: child.color_hex, name: child.name } : null;
  }).filter(Boolean);

  const depKey = pinned.map((p) => `${p.user_id}:${p.lat}:${p.lng}`).join("|");

  useEffect(() => {
    let cancelled = false;
    const markers = [];
    ensureKakaoSdk()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const valid = pinned.filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
        const fallbackCenter = new window.kakao.maps.LatLng(37.5665, 126.9780); // Seoul
        const firstCenter = valid[0]
          ? new window.kakao.maps.LatLng(Number(valid[0].lat), Number(valid[0].lng))
          : fallbackCenter;
        const map = new window.kakao.maps.Map(mapRef.current, {
          center: firstCenter,
          level: 5,
          draggable: false,
          zoomable: false,
          disableDoubleClick: true,
          disableDoubleClickZoom: true,
        });
        try { map.setDraggable(false); map.setZoomable(false); } catch (e) { void e; }
        const bounds = new window.kakao.maps.LatLngBounds();
        valid.forEach((p) => {
          const ll = new window.kakao.maps.LatLng(Number(p.lat), Number(p.lng));
          markers.push(new window.kakao.maps.Marker({ position: ll, map }));
          bounds.extend(ll);
        });
        if (valid.length > 1) {
          map.setBounds(bounds, 30, 30, 30, 30);
          if (map.getLevel() > 7) map.setLevel(7);
        }
        if (!cancelled) setReady(true);
      })
      .catch(() => { /* fallback to gradient + colored pins */ });
    return () => {
      cancelled = true;
      markers.forEach((m) => { try { m.setMap(null); } catch (e) { void e; } });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return (
    <button
      type="button" onClick={onTap} aria-label="지도 탭으로 이동"
      style={{
        position: "relative", width: "100%", height: 160, borderRadius: 16,
        background: "linear-gradient(135deg, #F0F9FF, #FEF3F8)",
        border: "1.5px solid #E5E7EB", overflow: "hidden", cursor: "pointer", padding: 0,
      }}
    >
      <div ref={mapRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      {pinned.map((p, i) => (
        <div
          key={p.user_id} data-pin
          style={ready ? { display: "none", background: p.color_hex } : {
            position: "absolute",
            top: `${30 + (i * 30) % 80}%`,
            left: `${20 + (i * 40) % 60}%`,
            width: 18, height: 18, borderRadius: "50% 50% 50% 0",
            transform: "rotate(-45deg)",
            background: p.color_hex,
            border: "2px solid white",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        />
      ))}
      <div style={{
        position: "absolute", bottom: 8, right: 12,
        fontSize: 11, color: "#6B7280", fontWeight: 700,
        background: "rgba(255,255,255,0.9)", padding: "2px 8px", borderRadius: 8,
      }}>탭하여 전체 지도 보기</div>
    </button>
  );
}
