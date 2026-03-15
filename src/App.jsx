import { useState, useEffect, useRef, useCallback } from "react";
import { kakaoLogin, anonymousLogin, getSession, setupFamily, joinFamily, joinFamilyAsParent, getMyFamily, unpairChild, saveParentPhones, onAuthChange, logout, generateUUID } from "./lib/auth.js";
import { fetchEvents, fetchAcademies, fetchMemos, insertEvent, updateEvent, deleteEvent as dbDeleteEvent, insertAcademy, updateAcademy, deleteAcademy as dbDeleteAcademy, upsertMemo, subscribeFamily, unsubscribe, getCachedEvents, getCachedAcademies, getCachedMemos, cacheEvents, cacheAcademies, cacheMemos, saveChildLocation, fetchChildLocations, addSticker, fetchStickersForDate, fetchStickerSummary, fetchParentAlerts, markAlertRead, fetchMemoReplies, insertMemoReply, markMemoRead } from "./lib/sync.js";
import { registerSW, requestPermission, getPermissionStatus, scheduleNotifications, scheduleNativeAlarms, showArrivalNotification, showEmergencyNotification, showKkukNotification, clearAllScheduled, subscribeToPush, unsubscribeFromPush, getNativeNotificationHealth, openNativeNotificationSettings } from "./lib/pushNotifications.js";
import { supabase } from "./lib/supabase.js";
import "./App.css";

const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_APP_KEY;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PARENT_PAIRING_INTENT_KEY = "kids-app:parent-pairing-intent";
const PUSH_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/push-notify` : "";
const AI_PARSE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-voice-parse` : "";
const AI_MONITOR_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/ai-child-monitor` : "";

function getNativeSetupAction(health) {
    if (!health) return null;
    if (!health.postPermissionGranted || !health.notificationsEnabled || !health.channelsEnabled) {
        return { target: "notifications", label: "알림 권한 열기" };
    }
    if (!health.fullScreenIntentAllowed) {
        return { target: "fullScreen", label: "전체화면 알림 허용" };
    }
    if (!health.batteryOptimizationsIgnored) {
        return { target: "battery", label: "배터리 예외 허용" };
    }
    if (!health.exactAlarmAllowed) {
        return { target: "exactAlarm", label: "정확한 알림 허용" };
    }
    return null;
}

// Send instant push notification via Edge Function
async function sendInstantPush({ action, familyId, senderUserId, title, message }) {
    if (!PUSH_FUNCTION_URL || !familyId) return;
    try {
        const session = await getSession();
        const token = session?.access_token || "";
        const response = await fetch(PUSH_FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "apikey": SUPABASE_KEY,
            },
            body: JSON.stringify({ action, familyId, senderUserId, title, message }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("[Push] instant push failed:", response.status, errText);
        }
    } catch (e) {
        console.log("[Push] instant push failed:", e.message);
    }
}

// Native background location (Capacitor plugin)
async function startNativeLocationService(userId, familyId, accessToken, role) {
    try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
            const { registerPlugin } = await import("@capacitor/core");
            const BackgroundLocation = registerPlugin("BackgroundLocation");
            await BackgroundLocation.startService({
                userId, familyId,
                supabaseUrl: SUPABASE_URL,
                supabaseKey: SUPABASE_KEY,
                accessToken: accessToken || "",
                role: role || "child"
            });
            console.log("[Native] Background location service started");
            return true;
        }
    } catch (e) {
        console.log("[Native] Not available (web mode):", e.message);
    }
    return false;
}

async function stopNativeLocationService() {
    try {
        const { Capacitor, registerPlugin } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
            const BackgroundLocation = registerPlugin("BackgroundLocation");
            await BackgroundLocation.stopService();
            console.log("[Native] Background location service stopped");
        }
    } catch { /* web mode */ }
}

function rememberParentPairingIntent() {
    if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PARENT_PAIRING_INTENT_KEY, "1");
    }
}

function clearParentPairingIntent() {
    if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PARENT_PAIRING_INTENT_KEY);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mascot
// ─────────────────────────────────────────────────────────────────────────────
const BunnyMascot = ({ size = 80 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <ellipse cx="33" cy="22" rx="9" ry="18" fill="#FFD6E8" />
        <ellipse cx="67" cy="22" rx="9" ry="18" fill="#FFD6E8" />
        <ellipse cx="33" cy="22" rx="5" ry="13" fill="#FFB3D1" />
        <ellipse cx="67" cy="22" rx="5" ry="13" fill="#FFB3D1" />
        <ellipse cx="50" cy="65" rx="26" ry="22" fill="#FFF0F7" />
        <circle cx="50" cy="48" r="24" fill="#FFF0F7" />
        <path d="M38 44 Q40 41 42 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M58 44 Q60 41 62 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="50" cy="51" rx="3" ry="2" fill="#FFB3D1" />
        <path d="M45 54 Q50 58 55 54" stroke="#FF7BAC" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="37" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
        <circle cx="63" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
        <ellipse cx="28" cy="68" rx="7" ry="10" fill="#FFF0F7" transform="rotate(-20 28 68)" />
        <ellipse cx="72" cy="68" rx="7" ry="10" fill="#FFF0F7" transform="rotate(20 72 68)" />
    </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Parent Setup Screen (extracted component – hooks must be at top level)
// ─────────────────────────────────────────────────────────────────────────────
const FF = "'Noto Sans KR','Apple SD Gothic Neo',sans-serif";

function ParentSetupScreen({ onCreateFamily, onJoinAsParent }) {
    const [joinCode, setJoinCode] = useState("");
    const [mode, setMode] = useState(null); // null | "create" | "join"
    const [busy, setBusy] = useState(false);
    return (
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#FFF0F7,#E8F4FD)", fontFamily: FF, padding: 20 }}>
            <div style={{ background: "white", borderRadius: 28, padding: "40px 28px", maxWidth: 380, width: "100%", boxShadow: "0 12px 40px rgba(232,121,160,0.15)", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍👩‍👧</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#E879A0", marginBottom: 6 }}>환영합니다!</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 28 }}>
                    처음이시면 가족을 만들고,<br/>배우자가 이미 만들었다면 코드로 합류하세요
                </div>

                {!mode && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <button onClick={() => setMode("create")}
                            style={{ padding: "16px", background: "linear-gradient(135deg,#E879A0,#FF6B9D)", color: "white", border: "none", borderRadius: 16, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            🏠 새 가족 만들기
                        </button>
                        <button onClick={() => setMode("join")}
                            style={{ padding: "16px", background: "linear-gradient(135deg,#60A5FA,#3B82F6)", color: "white", border: "none", borderRadius: 16, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            🔗 기존 가족에 합류
                        </button>
                    </div>
                )}

                {mode === "create" && (
                    <div>
                        <div style={{ fontSize: 14, color: "#374151", marginBottom: 16, fontWeight: 600 }}>
                            새 가족을 만들면 연동코드가 생성됩니다.<br/>이 코드로 배우자와 아이가 합류할 수 있어요.
                        </div>
                        <button disabled={busy} onClick={async () => { setBusy(true); await onCreateFamily(); setBusy(false); }}
                            style={{ padding: "14px 32px", background: "#E879A0", color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", fontFamily: FF, opacity: busy ? 0.6 : 1 }}>
                            {busy ? "생성 중..." : "가족 만들기"}
                        </button>
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, cursor: "pointer", fontFamily: FF }}>← 뒤로</button>
                        </div>
                    </div>
                )}

                {mode === "join" && (
                    <div>
                        <div style={{ fontSize: 14, color: "#374151", marginBottom: 12, fontWeight: 600 }}>
                            배우자에게 받은 연동코드를 입력하세요
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: "#9CA3AF", lineHeight: "44px" }}>KID-</span>
                            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                                placeholder="코드 8자리"
                                style={{ flex: 1, padding: "10px 14px", border: "2px solid #E5E7EB", borderRadius: 12, fontSize: 16, fontWeight: 800, fontFamily: "monospace", textAlign: "center", letterSpacing: 2 }} />
                        </div>
                        <button disabled={busy || joinCode.length < 4} onClick={async () => { setBusy(true); await onJoinAsParent("KID-" + joinCode); setBusy(false); }}
                            style={{ padding: "14px 32px", background: "#3B82F6", color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: (busy || joinCode.length < 4) ? "default" : "pointer", fontFamily: FF, opacity: (busy || joinCode.length < 4) ? 0.6 : 1 }}>
                            {busy ? "합류 중..." : "합류하기"}
                        </button>
                        <div style={{ marginTop: 12 }}>
                            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, cursor: "pointer", fontFamily: FF }}>← 뒤로</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
    { id: "school", label: "학원", emoji: "📚", color: "#A78BFA", bg: "#EDE9FE" },
    { id: "sports", label: "운동", emoji: "⚽", color: "#34D399", bg: "#D1FAE5" },
    { id: "hobby", label: "취미", emoji: "🎨", color: "#F59E0B", bg: "#FEF3C7" },
    { id: "family", label: "가족", emoji: "👨‍👩‍👧", color: "#F87171", bg: "#FEE2E2" },
    { id: "friend", label: "친구", emoji: "👫", color: "#60A5FA", bg: "#DBEAFE" },
    { id: "other", label: "기타", emoji: "🌟", color: "#EC4899", bg: "#FCE7F3" },
];

const ACADEMY_PRESETS = [
    { label: "영어학원", emoji: "🔤", category: "school" },
    { label: "수학학원", emoji: "🔢", category: "school" },
    { label: "피아노", emoji: "🎹", category: "school" },
    { label: "태권도", emoji: "🥋", category: "sports" },
    { label: "축구교실", emoji: "⚽", category: "sports" },
    { label: "수영", emoji: "🏊", category: "sports" },
    { label: "미술학원", emoji: "🎨", category: "hobby" },
    { label: "코딩학원", emoji: "💻", category: "school" },
    { label: "무용", emoji: "💃", category: "hobby" },
    { label: "독서논술", emoji: "📖", category: "school" },
];

const SCHEDULE_PRESETS = [
    { label: "피아노", emoji: "🎹", category: "school" },
    { label: "태권도", emoji: "🥋", category: "sports" },
    { label: "연기학원", emoji: "🎭", category: "hobby" },
    { label: "중국어", emoji: "🇨🇳", category: "school" },
    { label: "방과후 영어", emoji: "🔤", category: "school" },
    { label: "방과후 과학실험", emoji: "🔬", category: "school" },
    { label: "방과후 3D펜", emoji: "🖊️", category: "hobby" },
];

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
// HTML escape to prevent XSS in Kakao CustomOverlay template literals
function escHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

const ARRIVAL_R = 50; // metres (geo-fence radius)
const DEPARTURE_TIMEOUT_MS = 90_000; // 1.5 minutes outside = departure alert
const DEFAULT_NOTIF = { childEnabled: true, parentEnabled: true, minutesBefore: [15, 5] };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function haversineM(la1, lo1, la2, lo2) {
    const R = 6371000, p1 = la1 * Math.PI / 180, p2 = la2 * Math.PI / 180;
    const dp = (la2 - la1) * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const getDIM = (y, m) => new Date(y, m + 1, 0).getDate();
const getFD = (y, m) => new Date(y, m, 1).getDay();
const fmtT = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// Kakao Maps
let kakaoReady = null; // shared promise
function loadKakaoMap(appKey) {
    if (kakaoReady) return kakaoReady;
    kakaoReady = new Promise((res, rej) => {
        if (window.kakao?.maps?.LatLng) { res(); return; }
        const s = document.createElement("script");
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
        s.onload = () => {
            window.kakao.maps.load(() => {
                console.log("[KakaoMap] SDK ready");
                res();
            });
        };
        s.onerror = () => { kakaoReady = null; rej(new Error("script load failed")); };
        document.head.appendChild(s);
    });
    return kakaoReady;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kakao Static Map (thumbnail)
// ─────────────────────────────────────────────────────────────────────────────
function KakaoStaticMap({ lat, lng, width = "100%", height = 120 }) {
    const ref = useRef();
    useEffect(() => {
        if (!window.kakao?.maps || !ref.current) return;
        new window.kakao.maps.StaticMap(ref.current, {
            center: new window.kakao.maps.LatLng(lat, lng),
            level: 3,
            marker: { position: new window.kakao.maps.LatLng(lat, lng) }
        });
    }, [lat, lng]);
    return <div ref={ref} style={{ width, height, borderRadius: 14, overflow: "hidden" }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Map Zoom Controls (아이용 큰 버튼)
// ─────────────────────────────────────────────────────────────────────────────
function MapZoomControls({ mapObj, style }) {
    const zoom = (delta) => {
        if (!mapObj?.current) return;
        const lv = mapObj.current.getLevel();
        mapObj.current.setLevel(lv + delta, { animate: true });
    };
    const btnSt = { width: 48, height: 48, borderRadius: 14, border: "none", fontSize: 24, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(0,0,0,0.15)", fontFamily: FF };
    return (
        <div style={{ position: "absolute", bottom: 16, right: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 10, ...style }}>
            <button onClick={() => zoom(-1)} style={{ ...btnSt, background: "white", color: "#E879A0" }}>+</button>
            <button onClick={() => zoom(1)} style={{ ...btnSt, background: "white", color: "#9CA3AF" }}>−</button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Map Picker (Kakao Maps)
// ─────────────────────────────────────────────────────────────────────────────
function MapPicker({ initial, currentPos, title = "📍 장소 설정", onConfirm, onClose }) {
    const defaultCenter = initial || currentPos || { lat: 37.5665, lng: 126.9780 };
    const mapRef = useRef(), mapObj = useRef(), markerRef = useRef();
    const [pos, setPos] = useState(defaultCenter);
    const [address, setAddress] = useState(initial?.address || "");
    const [loading, setLoading] = useState(!!KAKAO_APP_KEY);
    const [err, setErr] = useState(KAKAO_APP_KEY ? "" : "카카오 앱 키가 설정되지 않았어요. (.env 파일 확인)");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);

    const reverseGeocode = useCallback((lat, lng) => {
        const gc = new window.kakao.maps.services.Geocoder();
        gc.coord2Address(lng, lat, (result, status) => {
            if (status === window.kakao.maps.services.Status.OK && result[0]) {
                setAddress(result[0].road_address?.address_name || result[0].address?.address_name || "");
            }
        });
    }, []);

    useEffect(() => {
        if (!KAKAO_APP_KEY) return;
        loadKakaoMap(KAKAO_APP_KEY).then(() => {
            setLoading(false);
            if (!mapRef.current) return;
            const center = new window.kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng);
            mapObj.current = new window.kakao.maps.Map(mapRef.current, { center, level: 3 });
            markerRef.current = new window.kakao.maps.Marker({ position: center, map: mapObj.current, draggable: true });

            // Marker drag → reverse geocode
            window.kakao.maps.event.addListener(markerRef.current, "dragend", () => {
                const latlng = markerRef.current.getPosition();
                setPos({ lat: latlng.getLat(), lng: latlng.getLng() });
                reverseGeocode(latlng.getLat(), latlng.getLng());
            });
            // Map click → move marker + reverse geocode
            window.kakao.maps.event.addListener(mapObj.current, "click", (mouseEvent) => {
                const latlng = mouseEvent.latLng;
                markerRef.current.setPosition(latlng);
                setPos({ lat: latlng.getLat(), lng: latlng.getLng() });
                reverseGeocode(latlng.getLat(), latlng.getLng());
            });

            if (!initial?.address) reverseGeocode(center.getLat(), center.getLng());
        }).catch((e) => { setErr(`지도 로딩 실패: ${e.message}\n\n1. 카카오 개발자 콘솔에서 앱 키 확인\n2. 플랫폼 → Web → ${window.location.origin} 등록 확인`); setLoading(false); });
    }, []);

    const doSearch = () => {
        if (!query.trim() || !window.kakao?.maps) return;
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(query.trim(), (data, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
                setResults(data.slice(0, 8));
            } else {
                setResults([]);
            }
        });
    };

    const pickResult = (place) => {
        const lat = parseFloat(place.y), lng = parseFloat(place.x);
        const latlng = new window.kakao.maps.LatLng(lat, lng);
        mapObj.current.setCenter(latlng);
        mapObj.current.setLevel(3);
        markerRef.current.setPosition(latlng);
        setPos({ lat, lng });
        setAddress(place.road_address_name || place.address_name);
        setResults([]);
        setQuery("");
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", background: "white", fontFamily: FF }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FF }}>← 닫기</button>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#374151" }}>{title}</div>
            </div>
            <div style={{ padding: "12px 16px", background: "#FAFAFA", position: "relative" }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <input value={query} onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
                        placeholder="🔍 학원 이름이나 주소 검색..."
                        style={{ flex: 1, padding: "12px 16px", border: "2px solid #F9A8D4", borderRadius: 16, fontSize: 14, fontFamily: FF, outline: "none", boxSizing: "border-box" }} />
                    <button onClick={doSearch} style={{ padding: "10px 16px", background: "#E879A0", color: "white", border: "none", borderRadius: 16, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF, flexShrink: 0 }}>검색</button>
                </div>
                {results.length > 0 && (
                    <div style={{ position: "absolute", left: 16, right: 16, top: "100%", background: "white", borderRadius: "0 0 16px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 20, maxHeight: 240, overflowY: "auto" }}>
                        {results.map((r, i) => (
                            <div key={i} onClick={() => pickResult(r)}
                                style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #F3F4F6", fontSize: 13, lineHeight: 1.5 }}
                                onMouseEnter={e => e.currentTarget.style.background = "#FFF0F7"}
                                onMouseLeave={e => e.currentTarget.style.background = "white"}>
                                <div style={{ fontWeight: 700, color: "#374151" }}>{r.place_name}</div>
                                <div style={{ color: "#9CA3AF", fontSize: 12 }}>{r.road_address_name || r.address_name}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div style={{ flex: 1, position: "relative" }}>
                {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF0F7", zIndex: 10, fontSize: 15, fontWeight: 700, color: "#E879A0", fontFamily: FF }}>🗺️ 지도 불러오는 중...</div>}
                {err && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#FFF0F7", zIndex: 10, gap: 12, padding: 24, fontFamily: FF }}><div style={{ fontSize: 36 }}>😢</div><div style={{ fontSize: 14, fontWeight: 700, color: "#E879A0", textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.8 }}>{err}</div></div>}
                <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
                <MapZoomControls mapObj={mapObj} />
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid #F3F4F6", fontFamily: FF }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 4 }}>선택된 장소</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 14, minHeight: 20 }}>{address || "지도를 클릭하거나 검색하세요"}</div>
                <button onClick={() => { if (pos) onConfirm({ lat: pos.lat, lng: pos.lng, address }); }}
                    style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 18, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                    📍 이 장소로 설정하기
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Banner
// ─────────────────────────────────────────────────────────────────────────────
function AlertBanner({ alerts, onDismiss }) {
    if (!alerts.length) return null;
    const BG = { parent: "linear-gradient(135deg,#1E40AF,#2563EB)", child: "linear-gradient(135deg,#7C3AED,#A78BFA)", friend: "linear-gradient(135deg,#059669,#10B981)", emergency: "linear-gradient(135deg,#DC2626,#EF4444)", sync: "linear-gradient(135deg,#0369A1,#0EA5E9)" };
    const ICON = { parent: "👨‍👩‍👧", child: "🐰", friend: "👫", emergency: "🚨", sync: "📅" };
    const LABEL = { parent: "부모님 알림", child: "아이 알림", friend: "친구 알림", emergency: "⚠️ 긴급 미도착", sync: "📅 일정 동기화" };
    return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 350, display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px", pointerEvents: "none" }}>
            {alerts.map(a => (
                <div key={a.id} style={{ background: BG[a.type] || BG.parent, color: "white", borderRadius: 20, padding: "14px 18px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12, animation: "slideDownFull 0.4s ease", pointerEvents: "all", fontFamily: FF }}>
                    <div style={{ fontSize: 26 }}>{ICON[a.type] || "🔔"}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 1 }}>{LABEL[a.type] || "알림"}</div>
                        <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>{a.msg}</div>
                    </div>
                    <button onClick={() => onDismiss(a.id)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, padding: "6px 10px", color: "white", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>확인</button>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Emergency Modal
// ─────────────────────────────────────────────────────────────────────────────
function EmergencyBanner({ emergencies, onDismiss }) {
    if (!emergencies.length) return null;
    const em = emergencies[0];
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", fontFamily: FF }}>
            <div style={{ background: "white", borderRadius: 28, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(220,38,38,0.4)", animation: "emergencyPulse 0.6s ease" }}>
                <div style={{ height: 8, borderRadius: 8, background: "linear-gradient(90deg,#EF4444,#DC2626,#EF4444)", backgroundSize: "200% 100%", animation: "shimmer 1s linear infinite", marginBottom: 20 }} />
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 56, marginBottom: 8, animation: "shake 0.5s ease infinite" }}>🚨</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#DC2626" }}>긴급 알림</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginTop: 4 }}>학부모님, 확인이 필요해요!</div>
                </div>
                <div style={{ background: "#FEF2F2", border: "2px solid #FECACA", borderRadius: 18, padding: "16px 18px", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 28 }}>{em.emoji}</div>
                        <div><div style={{ fontWeight: 800, fontSize: 16, color: "#1F2937" }}>{em.title}</div><div style={{ fontSize: 13, color: "#6B7280" }}>예정: ⏰ {em.time}</div></div>
                    </div>
                    <div style={{ background: "#DC2626", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ color: "white", fontWeight: 800, fontSize: 14 }}>⚠️ 5분 후 시작인데 아직 미도착!</div>
                        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 3 }}>{em.location}</div>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => onDismiss(em.id, "contact")} style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg,#DC2626,#B91C1C)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FF }}>📞 아이에게 전화</button>
                    <button onClick={() => onDismiss(em.id, "ok")} style={{ flex: 1, padding: "14px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 16, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>확인했어요</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Role Setup Modal  (first launch)
// ─────────────────────────────────────────────────────────────────────────────
function RoleSetupModal({ onSelect, loading }) {
    const [busy, setBusy] = useState(false);
    const isReturning = (() => {
        try { return !!localStorage.getItem("hyeni-has-visited"); } catch { return false; }
    })();

    // Mark as visited on first render
    useEffect(() => {
        try { localStorage.setItem("hyeni-has-visited", "1"); } catch { /* intentionally empty */ }
    }, []);

    const handleParent = async () => {
        setBusy(true);
        rememberParentPairingIntent();
        try { await kakaoLogin(); } catch (e) { clearParentPairingIntent(); console.error(e); setBusy(false); }
        // After OAuth redirect, auth listener in main component handles the rest
    };

    const handleChild = () => { onSelect("child"); };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "linear-gradient(135deg,#FFF0F7,#E8F4FD)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF }}>
            <BunnyMascot size={90} />
            <div style={{ fontSize: 32, fontWeight: 900, color: "#E879A0", marginTop: 20, marginBottom: 4, letterSpacing: -1, textAlign: "center" }}>
                혜니캘린더
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F9A8D4", marginBottom: 24, letterSpacing: 2 }}>HYENI CALENDAR</div>
            <div style={{ fontSize: 15, color: "#6B7280", marginBottom: 36, textAlign: "center", lineHeight: 1.6 }}>
                {loading ? "로딩 중..." : isReturning ? "다시 오셨군요! 반가워요 😊" : "처음 사용하시는군요!"}
                <br />사용자 유형을 선택해 주세요
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 340 }}>
                <button onClick={handleParent} disabled={busy}
                    style={{ padding: "22px", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "white", border: "none", borderRadius: 24, cursor: busy ? "wait" : "pointer", fontFamily: FF, textAlign: "left", boxShadow: "0 8px 24px rgba(37,99,235,0.35)", opacity: busy ? 0.7 : 1 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍👩‍👧</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{busy ? "카카오 로그인 중..." : "학부모"}</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, lineHeight: 1.5 }}>카카오 계정으로 로그인하여<br />아이 일정을 관리해요</div>
                </button>
                <button onClick={handleChild}
                    style={{ padding: "22px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 24, cursor: "pointer", fontFamily: FF, textAlign: "left", boxShadow: "0 8px 24px rgba(232,121,160,0.35)" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🐰</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>아이</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, lineHeight: 1.5 }}>부모님 코드로 연결하고<br />내 일정을 확인해요</div>
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pair Code Section (shows code prominently or in collapsible after pairing)
// ─────────────────────────────────────────────────────────────────────────────
function PairCodeSection({ pairCode, childrenCount, maxChildren }) {
    const [showCode, setShowCode] = useState(childrenCount === 0);
    const canAddMore = childrenCount < maxChildren;

    if (childrenCount === 0) {
        return (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 6 }}>📋 아이에게 공유할 연동 코드</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", letterSpacing: 2, flex: 1, fontFamily: "monospace" }}>{pairCode}</div>
                    <button onClick={() => navigator.clipboard?.writeText(pairCode)}
                        style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>복사</button>
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>아이 기기에서 이 코드를 입력하면 자동 연결돼요</div>
            </div>
        );
    }

    return (
        <div style={{ background: showCode ? "#F0FDF4" : "#F9FAFB", border: showCode ? "1.5px solid #86EFAC" : "1.5px solid #E5E7EB", borderRadius: 16, padding: "12px 16px", marginBottom: 20 }}>
            <button onClick={() => setShowCode(v => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, fontFamily: FF }}>
                <span style={{ fontSize: 14 }}>{showCode ? "🔓" : "🔑"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", flex: 1, textAlign: "left" }}>연동 코드 확인</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{showCode ? "접기" : "펼치기"}</span>
            </button>
            {showCode && (
                <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontWeight: 900, fontSize: 22, color: "#059669", letterSpacing: 2, flex: 1, fontFamily: "monospace" }}>{pairCode}</div>
                        <button onClick={() => navigator.clipboard?.writeText(pairCode)}
                            style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF }}>복사</button>
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 8 }}>
                        {canAddMore ? "추가 아이 기기에서 이 코드를 입력하면 연결돼요" : "최대 연동 수에 도달했어요. 기존 연동을 해제하면 새로 추가할 수 있어요"}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pairing Modal
// ─────────────────────────────────────────────────────────────────────────────
function PairingModal({ myRole, pairCode, pairedMembers, familyId: _familyId, onUnpair, onClose }) {
    const isParent = myRole === "parent";
    const children = pairedMembers?.filter(m => m.role === "child") || [];
    const parent = pairedMembers?.find(m => m.role === "parent") || null;
    const MAX_CHILDREN = 2;

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "white", borderRadius: "28px 28px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 460, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#374151" }}>🔗 {isParent ? "아이 연동 관리" : "부모님 연동"}</div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>닫기</button>
                </div>

                {/* Pair code display (parent) */}
                {isParent && (
                    pairCode ? (
                        <PairCodeSection pairCode={pairCode} childrenCount={children.length} maxChildren={MAX_CHILDREN} />
                    ) : children.length === 0 ? (
                        <div style={{ background: "#FEF3C7", border: "1.5px solid #FCD34D", borderRadius: 16, padding: "16px", marginBottom: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>카카오 로그인이 필요해요</div>
                            <div style={{ fontSize: 12, color: "#A16207", lineHeight: 1.6 }}>로그인하면 연동 코드가 생성되고<br/>아이 기기와 연결할 수 있어요</div>
                        </div>
                    ) : null
                )}

                {/* Connected children (parent view) */}
                {isParent && children.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 10 }}>연동된 아이 ({children.length}/{MAX_CHILDREN})</div>
                        {children.map((child, i) => (
                            <div key={child.user_id || i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F0FDF4", borderRadius: 16, padding: "14px 16px", marginBottom: 8, border: "1.5px solid #BBF7D0" }}>
                                <div style={{ fontSize: 28 }}>{child.emoji || "🐰"}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: "#065F46" }}>{child.name}</div>
                                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>아이 {i + 1}</div>
                                </div>
                                <button onClick={() => { if (window.confirm(`${child.name} 연동을 해제할까요?`)) onUnpair(child.user_id); }}
                                    style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>
                                    연동 해제
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Child view: show parent */}
                {!isParent && parent && (
                    <div style={{ background: "#D1FAE5", border: "2px solid #6EE7B7", borderRadius: 20, padding: "20px", marginBottom: 20, textAlign: "center" }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>👨‍👩‍👧</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: "#065F46" }}>연동 완료</div>
                        <div style={{ fontSize: 14, color: "#047857", marginTop: 4 }}>{parent.name} (부모님)</div>
                    </div>
                )}

                {/* Empty state */}
                {isParent && children.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF", fontSize: 14 }}>
                        아직 연결된 아이가 없어요
                    </div>
                )}
                {!isParent && !parent && (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF", fontSize: 14 }}>
                        부모님과 아직 연동되지 않았어요
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Child Pair Input (full-screen overlay for first-time child pairing)
// ─────────────────────────────────────────────────────────────────────────────
function ChildPairInput({ userId, onPaired }) {
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const handleJoin = async () => {
        if (!code.trim() || code.length < 4) { setError("코드를 정확히 입력해 주세요"); return; }
        const fullCode = "KID-" + code.trim();
        setBusy(true); setError("");
        try {
            const result = await joinFamily(fullCode, userId, "아이");
            console.log("[ChildPairInput] joinFamily result:", result);
            await onPaired();
        } catch (err) {
            console.error("[ChildPairInput] error:", err);
            setError(err.message?.includes("Too many") ? "시도 횟수 초과. 1시간 후 다시 시도해 주세요" : "잘못된 코드예요. 부모님께 확인해 주세요");
        } finally { setBusy(false); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "linear-gradient(135deg,#FFF0F7,#E8F4FD)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FF }}>
            <BunnyMascot size={70} />
            <div style={{ fontSize: 24, fontWeight: 900, color: "#E879A0", marginTop: 16, marginBottom: 8 }}>부모님과 연결하기</div>
            <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, textAlign: "center", lineHeight: 1.6 }}>부모님 앱에 있는<br />연동 코드에서 KID- 뒤의 코드를 입력해 주세요</div>
            <div style={{ position: "relative", width: "100%", maxWidth: 320, marginBottom: 8 }}>
                <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 20, fontFamily: "monospace", fontWeight: 700, color: "#E879A0", pointerEvents: "none", zIndex: 1 }}>KID-</div>
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    placeholder="XXXXXXXX" maxLength={8}
                    style={{ width: "100%", padding: "16px 16px 16px 76px", border: "2px solid #F3E8F0", borderRadius: 20, fontSize: 20, fontFamily: "monospace", outline: "none", boxSizing: "border-box", letterSpacing: 3, fontWeight: 700, color: "#374151", background: "white", boxShadow: "0 2px 8px rgba(232,121,160,0.1)" }} />
            </div>
            {error && <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 700, marginBottom: 8 }}>{error}</div>}
            <button onClick={handleJoin} disabled={busy}
                style={{ width: "100%", maxWidth: 320, padding: "16px", background: "linear-gradient(135deg,#A78BFA,#7C3AED)", color: "white", border: "none", borderRadius: 20, fontSize: 16, fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: FF, marginTop: 8, opacity: busy ? 0.7 : 1 }}>
                {busy ? "연결 중..." : "🔗 연결하기"}
            </button>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Academy Manager
// ─────────────────────────────────────────────────────────────────────────────
function AcademyManager({ academies, onSave, onClose, currentPos }) {
    const [list, setList] = useState(academies);
    const [showForm, setShowForm] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [editIdx, setEditIdx] = useState(null);
    const [form, setForm] = useState({ name: "", category: "school", emoji: "📚", location: null, schedule: null });
    const DAYS_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

    const openNew = (preset = null) => {
        setForm(preset ? { name: preset.label, category: preset.category, emoji: preset.emoji, location: null, schedule: null } : { name: "", category: "school", emoji: "📚", location: null, schedule: null });
        setEditIdx(null); setShowForm(true);
    };
    const openEdit = (idx) => { setForm({ ...list[idx], schedule: list[idx].schedule || null }); setEditIdx(idx); setShowForm(true); };
    const saveForm = () => {
        if (!form.name.trim()) return;
        const cat = CATEGORIES.find(c => c.id === form.category);
        const item = { ...form, color: cat.color, bg: cat.bg };
        if (editIdx !== null) { const nl = [...list]; nl[editIdx] = item; setList(nl); }
        else setList(p => [...p, item]);
        setShowForm(false);
    };
    const removeItem = (idx) => setList(p => p.filter((_, i) => i !== idx));

    if (showMap) return (
        <MapPicker initial={form.location} currentPos={currentPos} title="📍 학원 위치 설정"
            onClose={() => setShowMap(false)}
            onConfirm={loc => { setForm(p => ({ ...p, location: loc })); setShowMap(false); }} />
    );

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "white", display: "flex", flexDirection: "column", fontFamily: FF }}>
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => { onSave(list); onClose(); }} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FF }}>← 저장</button>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#374151" }}>🏫 학원 목록 관리</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

                {/* Quick presets */}
                {!showForm && (
                    <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 10 }}>빠른 추가</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                            {ACADEMY_PRESETS.filter(p => !list.some(a => a.name === p.label)).map(p => (
                                <button key={p.label} onClick={() => openNew(p)}
                                    style={{ padding: "8px 14px", borderRadius: 16, border: "2px dashed #E5E7EB", background: "#FAFAFA", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#6B7280" }}>
                                    {p.emoji} {p.label}
                                </button>
                            ))}
                            <button onClick={() => openNew()}
                                style={{ padding: "8px 14px", borderRadius: 16, border: "2px dashed #F9A8D4", background: "#FFF0F7", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, color: "#E879A0" }}>
                                + 직접 입력
                            </button>
                        </div>
                    </>
                )}

                {/* Form */}
                {showForm && (
                    <div style={{ background: "#FAFAFA", borderRadius: 20, padding: "18px", marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 14 }}>{editIdx !== null ? "✏️ 학원 수정" : "➕ 학원 추가"}</div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>학원 이름</label>
                            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예) 영어학원, 수학왕..."
                                style={{ width: "100%", padding: "12px 14px", border: "2px solid #F3F4F6", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>카테고리</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {CATEGORIES.map(cat => (
                                    <button key={cat.id} onClick={() => setForm(p => ({ ...p, category: cat.id, emoji: cat.emoji }))}
                                        style={{ padding: "7px 12px", borderRadius: 14, border: `2px solid ${form.category === cat.id ? cat.color : "#E5E7EB"}`, background: form.category === cat.id ? cat.color : "white", color: form.category === cat.id ? "white" : cat.color, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: FF }}>
                                        {cat.emoji} {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>📍 위치 (GPS)</label>
                            {form.location ? (
                                <div style={{ background: "#FFF0F7", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 13, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {form.location.address}</div>
                                    <button onClick={() => setShowMap(true)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid #E879A0", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                </div>
                            ) : (
                                <button onClick={() => setShowMap(true)}
                                    style={{ width: "100%", padding: "12px", border: "2px dashed #F9A8D4", borderRadius: 14, background: "#FFF0F7", color: "#E879A0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                                    🗺️ 지도에서 위치 선택
                                </button>
                            )}
                        </div>
                        {/* Schedule (days + time) */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" }}>📅 수업 요일 & 시간</label>
                            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                {DAYS_LABEL.map((d, i) => {
                                    const active = form.schedule?.days?.includes(i);
                                    return (
                                        <button key={i} onClick={() => {
                                            const days = form.schedule?.days || [];
                                            const newDays = active ? days.filter(x => x !== i) : [...days, i].sort();
                                            setForm(p => ({ ...p, schedule: { ...(p.schedule || { startTime: "15:00", endTime: "16:00" }), days: newDays } }));
                                        }}
                                            style={{ flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FF, border: active ? "2px solid #E879A0" : "2px solid #F3F4F6", background: active ? "#FFF0F7" : "#FAFAFA", color: active ? "#E879A0" : i === 0 ? "#F87171" : i === 6 ? "#60A5FA" : "#6B7280", transition: "all 0.15s" }}>
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                            {form.schedule?.days?.length > 0 && (
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input type="time" value={form.schedule?.startTime || "15:00"} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, startTime: e.target.value } }))}
                                        style={{ flex: 1, padding: "10px 12px", border: "2px solid #F3F4F6", borderRadius: 12, fontSize: 15, fontFamily: FF, outline: "none" }} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF" }}>~</span>
                                    <input type="time" value={form.schedule?.endTime || "16:00"} onChange={e => setForm(p => ({ ...p, schedule: { ...p.schedule, endTime: e.target.value } }))}
                                        style={{ flex: 1, padding: "10px 12px", border: "2px solid #F3F4F6", borderRadius: 12, fontSize: 15, fontFamily: FF, outline: "none" }} />
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={saveForm} style={{ flex: 1, padding: "13px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 16, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>저장</button>
                            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "13px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 16, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>취소</button>
                        </div>
                    </div>
                )}

                {/* Registered academies list */}
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 10 }}>등록된 학원 ({list.length})</div>
                {list.length === 0 && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#D1D5DB" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🏫</div>
                        <div style={{ fontSize: 14 }}>등록된 학원이 없어요</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>위에서 추가해 보세요!</div>
                    </div>
                )}
                {list.map((a, i) => (
                    <div key={i} style={{ background: a.bg || "#F9FAFB", borderRadius: 18, padding: "14px 16px", marginBottom: 10, borderLeft: `4px solid ${a.color || "#E5E7EB"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontSize: 26 }}>{a.emoji}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: "#1F2937" }}>{a.name}</div>
                                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{CATEGORIES.find(c => c.id === a.category)?.label}</div>
                                {a.location && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>📍 {a.location.address?.split(" ").slice(0, 3).join(" ")}</div>}
                                {!a.location && <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 2 }}>📍 위치 미등록</div>}
                                {a.schedule?.days?.length > 0 && <div style={{ fontSize: 11, color: "#E879A0", fontWeight: 700, marginTop: 3 }}>📅 {a.schedule.days.map(d => DAYS_LABEL[d]).join(", ")} {a.schedule.startTime}~{a.schedule.endTime}</div>}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => openEdit(i)} style={{ background: "rgba(255,255,255,0.8)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontFamily: FF }}>✏️</button>
                                <button onClick={() => removeItem(i)} style={{ background: "rgba(255,255,255,0.8)", border: "none", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "#EF4444", fontFamily: FF }}>✕</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Overlay (current position → destination with OSRM walking route)
// ─────────────────────────────────────────────────────────────────────────────
function RouteOverlay({ ev, childPos, mapReady, onClose, isChildMode = false }) {
    const mapRef = useRef();
    const mapInst = useRef();
    const myMarkerRef = useRef(null);
    const polylineRef = useRef(null);
    const routePathRef = useRef(null); // cached route coords for re-render
    const [routeInfo, setRouteInfo] = useState(null);
    const [livePos, setLivePos] = useState(childPos); // real-time GPS tracking
    const [isTracking, setIsTracking] = useState(false);
    const [centered, setCentered] = useState(true);
    const [mapType, setMapType] = useState("roadmap"); // "hybrid" or "roadmap"
    const [heading, setHeading] = useState(null); // device compass heading in degrees
    const watchIdRef = useRef(null);

    // Compute live distance/time
    const currentPos = livePos || childPos;
    const liveDist = currentPos && ev.location
        ? haversineM(currentPos.lat, currentPos.lng, ev.location.lat, ev.location.lng)
        : null;
    const displayDist = routeInfo?.distance ?? liveDist;
    const displayMin = routeInfo?.duration != null
        ? Math.round(routeInfo.duration / 60)
        : (liveDist != null ? Math.round(liveDist / 67) : null);
    const distLabel = displayDist != null
        ? displayDist >= 1000 ? `${(displayDist / 1000).toFixed(1)}km` : `${Math.round(displayDist)}m`
        : null;

    // Start real-time GPS tracking
    useEffect(() => {
        if (!navigator.geolocation) return;
        const wid = navigator.geolocation.watchPosition(
            (pos) => {
                const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setLivePos(newPos);
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        );
        watchIdRef.current = wid;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsTracking(true);
        return () => {
            navigator.geolocation.clearWatch(wid);
            setIsTracking(false);
        };
    }, []);

    // Compass heading via DeviceOrientationEvent
    useEffect(() => {
        let handler;
        const startListening = () => {
            handler = (e) => {
                // iOS provides webkitCompassHeading, Android uses alpha
                const h = e.webkitCompassHeading != null
                    ? e.webkitCompassHeading
                    : (e.alpha != null ? (360 - e.alpha) : null);
                if (h != null) setHeading(h);
            };
            window.addEventListener("deviceorientation", handler, true);
        };
        // iOS 13+ requires permission request
        if (typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission()
                .then(state => { if (state === "granted") startListening(); })
                .catch(() => {});
        } else {
            startListening();
        }
        return () => {
            if (handler) window.removeEventListener("deviceorientation", handler, true);
        };
    }, []);

    // Update my-marker position in real-time
    useEffect(() => {
        if (!livePos || !mapInst.current || !myMarkerRef.current) return;
        const newLL = new window.kakao.maps.LatLng(livePos.lat, livePos.lng);
        myMarkerRef.current.setPosition(newLL);
        if (centered) mapInst.current.panTo(newLL);
    }, [livePos, centered]);

    // Re-fetch route when position changes significantly (>50m)
    const lastRoutePosRef = useRef(null);
    useEffect(() => {
        if (!livePos || !ev.location || !mapInst.current || routeInfo?.loading) return;
        if (lastRoutePosRef.current) {
            const moved = haversineM(livePos.lat, livePos.lng, lastRoutePosRef.current.lat, lastRoutePosRef.current.lng);
            if (moved < 50) return;
        }
        lastRoutePosRef.current = { ...livePos };
        const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${livePos.lng},${livePos.lat};${ev.location.lng},${ev.location.lat}?overview=full&geometries=geojson`;
        fetch(osrmUrl).then(r => r.json()).then(data => {
            if (data.code !== "Ok" || !data.routes?.length) return;
            const route = data.routes[0];
            const coords = route.geometry.coordinates;
            const path = coords.map(([lng, lat]) => new window.kakao.maps.LatLng(lat, lng));
            // Update polyline
            if (polylineRef.current) polylineRef.current.setPath(path);
            setRouteInfo({ distance: route.distance, duration: route.duration, loading: false, error: false });
        }).catch(() => {});
    }, [livePos, ev.location]);

    // Initialize map + route
    useEffect(() => {
        if (!mapReady || !mapRef.current || !ev.location) return;
        let cancelled = false;

        const destLL = new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng);
        const startPos = currentPos || { lat: ev.location.lat, lng: ev.location.lng };
        const myLL = new window.kakao.maps.LatLng(startPos.lat, startPos.lng);

        mapInst.current = new window.kakao.maps.Map(mapRef.current, {
            center: destLL, level: 4,
            mapTypeId: window.kakao.maps.MapTypeId.ROADMAP
        });

        // Destination marker — flag style
        new window.kakao.maps.CustomOverlay({
            map: mapInst.current, position: destLL, yAnchor: 1.4,
            content: `<div style="display:flex;flex-direction:column;align-items:center">
                <div style="background:${ev.color};color:white;padding:8px 14px;border-radius:16px;font-size:13px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:'Noto Sans KR',sans-serif">🏁 ${escHtml(ev.title)}</div>
                <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid ${ev.color}"></div>
            </div>`
        });

        if (!currentPos) return;

        // My location marker (movable) — cute bunny face with heading arrow
        const bunnySvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72">
          <!-- pulse ring -->
          <circle cx="28" cy="36" r="27" fill="rgba(244,114,182,0.15)" stroke="none"><animate attributeName="r" values="24;28;24" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite"/></circle>
          <!-- left ear -->
          <ellipse cx="16" cy="12" rx="7" ry="16" fill="#F9A8D4" stroke="#EC4899" stroke-width="1.5"/>
          <ellipse cx="16" cy="12" rx="4" ry="12" fill="#FBCFE8"/>
          <!-- right ear -->
          <ellipse cx="40" cy="12" rx="7" ry="16" fill="#F9A8D4" stroke="#EC4899" stroke-width="1.5"/>
          <ellipse cx="40" cy="12" rx="4" ry="12" fill="#FBCFE8"/>
          <!-- head -->
          <circle cx="28" cy="36" r="20" fill="#FBCFE8" stroke="#EC4899" stroke-width="2"/>
          <!-- blush left -->
          <ellipse cx="14" cy="40" rx="5" ry="3" fill="#F9A8D4" opacity="0.5"/>
          <!-- blush right -->
          <ellipse cx="42" cy="40" rx="5" ry="3" fill="#F9A8D4" opacity="0.5"/>
          <!-- left eye -->
          <circle cx="20" cy="33" r="3.5" fill="#1F2937"/>
          <circle cx="21.2" cy="31.5" r="1.2" fill="white"/>
          <!-- right eye -->
          <circle cx="36" cy="33" r="3.5" fill="#1F2937"/>
          <circle cx="37.2" cy="31.5" r="1.2" fill="white"/>
          <!-- nose -->
          <ellipse cx="28" cy="40" rx="3" ry="2.2" fill="#EC4899"/>
          <!-- mouth -->
          <path d="M24 43 Q28 47 32 43" stroke="#EC4899" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <!-- label -->
          <rect x="14" y="58" width="28" height="14" rx="7" fill="#EC4899"/>
          <text x="28" y="68" text-anchor="middle" font-size="9" font-weight="800" fill="white" font-family="sans-serif">나</text>
        </svg>`)}`;
        const myOverlay = new window.kakao.maps.CustomOverlay({
            map: mapInst.current, position: myLL, yAnchor: 0.85,
            content: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 8px rgba(236,72,153,0.4))">
                <img src="${bunnySvg}" width="52" height="66" style="display:block" />
            </div>`
        });
        myMarkerRef.current = myOverlay;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRouteInfo({ loading: true });
        lastRoutePosRef.current = { ...startPos };

        const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${startPos.lng},${startPos.lat};${ev.location.lng},${ev.location.lat}?overview=full&geometries=geojson&steps=true`;

        fetch(osrmUrl)
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route");

                const route = data.routes[0];
                const coords = route.geometry.coordinates;
                const path = coords.map(([lng, lat]) => new window.kakao.maps.LatLng(lat, lng));
                routePathRef.current = path;

                // Walking route — dashed blue/pink line
                const pl = new window.kakao.maps.Polyline({
                    map: mapInst.current, path,
                    strokeWeight: 7, strokeColor: ev.color,
                    strokeOpacity: 0.85, strokeStyle: "solid"
                });
                polylineRef.current = pl;

                // Shadow polyline underneath
                new window.kakao.maps.Polyline({
                    map: mapInst.current, path,
                    strokeWeight: 11, strokeColor: "#00000015",
                    strokeOpacity: 1, strokeStyle: "solid"
                });

                // Fit route bounds
                const bounds = new window.kakao.maps.LatLngBounds();
                path.forEach(p => bounds.extend(p));
                bounds.extend(myLL);
                bounds.extend(destLL);
                mapInst.current.setBounds(bounds, 80);

                setRouteInfo({
                    distance: route.distance,
                    duration: route.duration,
                    loading: false,
                    error: false
                });
            })
            .catch(() => {
                if (cancelled) return;
                const pl = new window.kakao.maps.Polyline({
                    map: mapInst.current,
                    path: [myLL, destLL],
                    strokeWeight: 4, strokeColor: ev.color,
                    strokeOpacity: 0.7, strokeStyle: "shortdash"
                });
                polylineRef.current = pl;

                const bounds = new window.kakao.maps.LatLngBounds();
                bounds.extend(myLL);
                bounds.extend(destLL);
                mapInst.current.setBounds(bounds, 80);

                setRouteInfo({ loading: false, error: true });
            });

        return () => { cancelled = true; };
    }, [mapReady, ev]);

    const recenterMap = () => {
        if (!mapInst.current || !currentPos) return;
        setCentered(true);
        mapInst.current.panTo(new window.kakao.maps.LatLng(currentPos.lat, currentPos.lng));
    };

    const toggleMapType = () => {
        if (!mapInst.current) return;
        const next = mapType === "hybrid" ? "roadmap" : "hybrid";
        setMapType(next);
        mapInst.current.setMapTypeId(
            next === "hybrid" ? window.kakao.maps.MapTypeId.HYBRID : window.kakao.maps.MapTypeId.ROADMAP
        );
    };

    const fitFullRoute = () => {
        if (!mapInst.current || !currentPos || !ev.location) return;
        setCentered(false);
        const bounds = new window.kakao.maps.LatLngBounds();
        bounds.extend(new window.kakao.maps.LatLng(currentPos.lat, currentPos.lng));
        bounds.extend(new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng));
        if (routePathRef.current) routePathRef.current.forEach(p => bounds.extend(p));
        mapInst.current.setBounds(bounds, 60);
    };

    // Arrived check
    const arrived = liveDist != null && liveDist < 100;

    // Child-friendly bunny encouragement messages
    const bunnyEncouragement = (() => {
        if (!isChildMode || liveDist == null) return null;
        if (arrived) return { emoji: "🎉", msg: "도착이야! 잘했어! 🐰💕" };
        if (liveDist < 200) return { emoji: "🐰", msg: "거의 다 왔어! 조금만 더!" };
        if (liveDist < 500) return { emoji: "🏃", msg: "잘 가고 있어! 화이팅~!" };
        if (displayMin != null && displayMin <= 5) return { emoji: "🐰", msg: "금방 도착해! 힘내!" };
        return { emoji: "🐰", msg: "천천히 안전하게 가자~!" };
    })();

    const sheetCardStyle = {
        background: "rgba(255,255,255,0.92)",
        borderRadius: 26,
        padding: "14px 14px 16px",
        boxShadow: "0 18px 48px rgba(15, 23, 42, 0.16)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.8)",
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#F0F4F8", display: "flex", flexDirection: "column", fontFamily: FF }}>
            {/* Navigation Header */}
            <div style={{ padding: "12px 16px", paddingTop: "max(12px, env(safe-area-inset-top))", background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, zIndex: 2 }}>
                <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 12, width: 40, height: 40, cursor: "pointer", fontWeight: 800, fontSize: 18, fontFamily: FF, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", flexShrink: 0 }}>←</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.emoji} {ev.title}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                        ⏰ {ev.time} {ev.location?.address ? `· 📍 ${ev.location.address.split(" ").slice(0, 3).join(" ")}` : ""}
                    </div>
                </div>
                {isTracking && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#3B82F6", background: "#DBEAFE", padding: "4px 8px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6", animation: "pulse 1.5s infinite" }} />
                        GPS
                    </div>
                )}
            </div>

            {/* Route info bar */}
            {!routeInfo?.loading && distLabel && (
                <div style={{
                    margin: "0 16px", marginTop: 10, background: arrived ? "#D1FAE5" : "white",
                    borderRadius: 20, padding: "14px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    display: "flex", alignItems: "center", gap: 14, zIndex: 2
                }}>
                    <div style={{ width: 48, height: 48, borderRadius: 16, background: arrived ? "#ECFDF5" : ev.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                        {arrived ? "🎉" : "🚶"}
                    </div>
                    <div style={{ flex: 1 }}>
                        {arrived ? (
                            <>
                                <div style={{ fontWeight: 900, fontSize: 18, color: "#059669" }}>{isChildMode ? "도착이야! 잘했어! 🐰" : "도착했어요!"}</div>
                                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{isChildMode ? "목적지에 잘 도착했어! 💕" : "목적지 근처에 있어요"}</div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontWeight: 900, fontSize: 20, color: ev.color }}>{distLabel}</div>
                                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                                    도보 약 {displayMin}분
                                    {routeInfo?.error && " (직선거리)"}
                                </div>
                                {bunnyEncouragement && (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#E879A0", marginTop: 4 }}>
                                        {bunnyEncouragement.emoji} {bunnyEncouragement.msg}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    {!arrived && displayMin != null && (
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>도착 예정</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#374151", marginTop: 2 }}>
                                {(() => {
                                    const now = new Date();
                                    const eta = new Date(now.getTime() + displayMin * 60000);
                                    return `${String(eta.getHours()).padStart(2, "0")}:${String(eta.getMinutes()).padStart(2, "0")}`;
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {routeInfo?.loading && (
                <div style={{ margin: "0 16px", marginTop: 10, background: "white", borderRadius: 20, padding: "14px 20px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", textAlign: "center", zIndex: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280" }}>🔍 경로 검색 중...</div>
                </div>
            )}

            {/* Map */}
            <div style={{ flex: 1, margin: "10px 16px", borderRadius: 24, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", position: "relative", minHeight: 0 }}>
                <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
                <MapZoomControls mapObj={mapInst} />

                {/* Heading compass indicator (top-right) */}
                {heading != null && (
                    <div style={{ position: "absolute", right: 14, top: 14, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: "50%", background: "white",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
                            position: "relative"
                        }}>
                            <div style={{ position: "absolute", top: 3, fontSize: 8, fontWeight: 800, color: "#EF4444", fontFamily: FF }}>N</div>
                            <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: `rotate(${heading}deg)`, transition: "transform 0.3s ease-out" }}>
                                <polygon points="16,4 12,20 16,17 20,20" fill="#EC4899" stroke="#BE185D" strokeWidth="1" />
                                <polygon points="16,28 12,20 16,17 20,20" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="0.5" />
                            </svg>
                        </div>
                        <div style={{ fontSize: 8, fontWeight: 700, color: "#6B7280", marginTop: 2, fontFamily: FF }}>
                            {Math.round(heading)}°
                        </div>
                    </div>
                )}

                {/* Map overlay buttons */}
                <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 8, zIndex: 5 }}>
                    <button onClick={toggleMapType} title="지도 타입"
                        style={{ width: 44, height: 44, borderRadius: 14, background: "white", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#6B7280", fontFamily: FF }}>
                        {mapType === "hybrid" ? "🛣️" : "🛰️"}
                    </button>
                    <button onClick={recenterMap} title="내 위치"
                        style={{
                            minWidth: 44, height: 44, borderRadius: 14, padding: "0 14px",
                            background: centered ? "linear-gradient(135deg, #EC4899, #F472B6)" : "white",
                            border: centered ? "none" : "2px solid #F9A8D4",
                            cursor: "pointer", boxShadow: centered ? "0 4px 14px rgba(236,72,153,0.4)" : "0 2px 8px rgba(0,0,0,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                            fontSize: 12, fontWeight: 800, color: centered ? "white" : "#EC4899", fontFamily: FF,
                            transition: "all 0.2s ease"
                        }}>
                        🐰 내 위치
                    </button>
                    <button onClick={fitFullRoute} title="전체 경로"
                        style={{ width: 44, height: 44, borderRadius: 14, background: "white", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#6B7280" }}>
                        🗺️
                    </button>
                </div>
            </div>

            {/* Bottom route sheet */}
            <div style={{ padding: "0 16px max(16px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
                <div style={sheetCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 0.2 }}>{isChildMode ? "🐰 길찾기" : "ROUTE"}</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginTop: 2 }}>
                                {arrived
                                    ? (isChildMode ? "도착! 잘했어! 💕" : "도착 완료")
                                    : (isChildMode ? "토끼가 길 안내 중~ 🐰" : "앱 안에서 길찾기 안내 중")}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <div style={{ padding: "7px 10px", borderRadius: 999, background: arrived ? "#DCFCE7" : ev.bg, color: arrived ? "#166534" : ev.color, fontSize: 11, fontWeight: 800 }}>
                                {arrived ? "근처 도착" : distLabel || "경로 확인"}
                            </div>
                            {displayMin != null && (
                                <div style={{ padding: "7px 10px", borderRadius: 999, background: "#EEF2FF", color: "#4338CA", fontSize: 11, fontWeight: 800 }}>
                                    도보 {displayMin}분
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            onClick={fitFullRoute}
                            style={{ flex: 1, padding: "15px 14px", borderRadius: 18, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800, fontFamily: FF, color: "white", background: "linear-gradient(135deg, #EC4899, #BE185D)", boxShadow: "0 12px 24px rgba(236,72,153,0.26)" }}
                        >
                            전체 경로 보기
                        </button>
                        <button
                            onClick={onClose}
                            style={{ padding: "15px 16px", borderRadius: 18, border: "1px solid #E5E7EB", cursor: "pointer", fontSize: 14, fontWeight: 800, fontFamily: FF, color: "#4B5563", background: "#FFFFFF" }}
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Memo Section with send, replies, read indicator
// ─────────────────────────────────────────────────────────────────────────────
function MemoSection({ memoValue, onMemoChange, onMemoBlur, onMemoSend, replies, onReplySubmit, readBy, myUserId, isParentMode }) {
    const [inputText, setInputText] = useState("");

    const handleSend = () => {
        if (!inputText.trim()) return;
        const text = inputText.trim();
        setInputText("");
        if (onReplySubmit) onReplySubmit(text);
    };

    const othersRead = (readBy || []).filter(id => id !== myUserId).length > 0;
    const hasMessages = (replies && replies.length > 0);

    return (
        <div style={{ marginTop: 18, background: "white", borderRadius: 20, padding: 0, border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "12px 16px", background: "#FAFAFA", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>💬 오늘의 메모</div>
                {hasMessages && othersRead && <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>✓ 읽음</div>}
            </div>

            {/* Chat area */}
            <div style={{ padding: "12px 16px", minHeight: 60 }}>
                {hasMessages ? replies.map(r => {
                    const isMe = r.user_id === myUserId;
                    return (
                        <div key={r.id} style={{ display: "flex", gap: 8, marginBottom: 8, flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-start" }}>
                            <div style={{ width: 28, height: 28, borderRadius: 14, background: r.user_role === "parent" ? "#DBEAFE" : "#FCE7F3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{r.user_role === "parent" ? "👩" : "🐰"}</div>
                            <div style={{ maxWidth: "75%" }}>
                                <div style={{ background: isMe ? "#E879A0" : "#F3F4F6", color: isMe ? "white" : "#374151", borderRadius: isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px", padding: "10px 14px", fontSize: 14, lineHeight: 1.5, fontFamily: FF }}>{r.content}</div>
                                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3, textAlign: isMe ? "right" : "left" }}>
                                    {new Date(r.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div style={{ textAlign: "center", padding: "12px 0", color: "#D1D5DB", fontSize: 13 }}>{isParentMode ? "메모를 남겨보세요" : "오늘 하루 어땠어? 🐰"}</div>
                )}
            </div>

            {/* Input bar */}
            <div style={{ padding: "10px 12px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8, alignItems: "center", background: "#FAFAFA" }}>
                <input
                    type="text"
                    placeholder={isParentMode ? "메시지를 입력하세요..." : "여기에 써봐~ 🐰"}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
                    style={{ flex: 1, border: "1.5px solid #E5E7EB", borderRadius: 20, padding: "10px 16px", fontSize: 16, fontFamily: FF, outline: "none", background: "white", boxSizing: "border-box" }}
                />
                <button onClick={handleSend}
                    style={{ width: 40, height: 40, borderRadius: 20, background: inputText.trim() ? "linear-gradient(135deg,#E879A0,#BE185D)" : "#E5E7EB", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    ↑
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Timetable (kid-friendly)
// ─────────────────────────────────────────────────────────────────────────────
function DayTimetable({ events, dateLabel, childPos, mapReady: _mapReady, arrivedSet, firedEmergencies, onRoute, onDelete, onEditLoc, memoValue, onMemoChange, onMemoBlur, onMemoSend, stickers, memoReplies, onReplySubmit, memoReadBy, myUserId, isParentMode }) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    if (events.length === 0) return (
        <div style={{ fontFamily: FF }}>
            <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>{isParentMode ? "🌙" : "🎉"}</div>
                <div style={{ fontSize: isParentMode ? 16 : 18, fontWeight: 800, color: isParentMode ? "#D1D5DB" : "#F9A8D4" }}>{isParentMode ? "아직 일정이 없어요" : "오늘은 자유시간이야!"}</div>
                <div style={{ fontSize: isParentMode ? 13 : 14, color: "#E5E7EB", marginTop: 4 }}>{isParentMode ? "위에서 추가해 보세요!" : "신나게 놀자~ 🐰"}</div>
            </div>
            <MemoSection memoValue={memoValue} onMemoChange={onMemoChange} onMemoBlur={onMemoBlur} onMemoSend={onMemoSend} replies={memoReplies} onReplySubmit={onReplySubmit} readBy={memoReadBy} myUserId={myUserId} isParentMode={isParentMode} />
        </div>
    );

    return (
        <div style={{ fontFamily: FF }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#374151" }}>{dateLabel}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{events.length}개 일정</div>
                </div>
                {childPos
                    ? <div style={{ fontSize: 11, fontWeight: 700, color: "#34D399", background: "#D1FAE5", padding: "5px 12px", borderRadius: 12 }}>💕 엄마가 항상 함께하고 있어요</div>
                    : <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", background: "#F3F4F6", padding: "5px 12px", borderRadius: 12 }}>위치 없음</div>}
            </div>

            {/* Timeline */}
            <div style={{ position: "relative", paddingLeft: 28 }}>
                {/* Vertical line */}
                <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 3, background: "linear-gradient(to bottom, #F9A8D4, #A78BFA, #60A5FA)", borderRadius: 4 }} />

                {events.map((ev, i) => {
                    const [h, m] = ev.time.split(":").map(Number);
                    const evMin = h * 60 + m;
                    const isPast = nowMin > evMin + 60;
                    const isCurrent = nowMin >= evMin - 10 && nowMin <= evMin + 60;
                    const arrived = arrivedSet.has(ev.id);
                    const emergency = ev.location && !arrived && firedEmergencies.has(ev.id);
                    const friendlyTime = isParentMode ? ev.time : `${h >= 12 ? "오후" : "오전"} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")}`;

                    const dist = childPos && ev.location
                        ? haversineM(childPos.lat, childPos.lng, ev.location.lat, ev.location.lng)
                        : null;
                    const distLabel = dist !== null
                        ? dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${Math.round(dist)}m`
                        : null;

                    return (
                        <div key={ev.id} style={{ position: "relative", marginBottom: i < events.length - 1 ? 16 : 0 }}>
                            {/* Dot on timeline */}
                            <div style={{
                                position: "absolute", left: -22, top: 14, width: 14, height: 14, borderRadius: "50%",
                                background: isCurrent ? ev.color : arrived ? "#059669" : isPast ? "#D1D5DB" : "white",
                                border: `3px solid ${isCurrent ? ev.color : arrived ? "#059669" : isPast ? "#D1D5DB" : ev.color}`,
                                boxShadow: isCurrent ? `0 0 0 4px ${ev.color}33` : "none",
                                zIndex: 2
                            }} />

                            {/* Event card */}
                            <div
                                onClick={() => ev.location ? onRoute(ev) : null}
                                style={{
                                    background: isCurrent ? `linear-gradient(135deg,${ev.bg},white)` : "white",
                                    borderRadius: 20, padding: "14px 16px",
                                    border: isCurrent ? `2px solid ${ev.color}` : "2px solid #F3F4F6",
                                    cursor: ev.location ? "pointer" : "default",
                                    transition: "all 0.2s",
                                    opacity: isPast && !isCurrent ? 0.6 : 1,
                                    position: "relative"
                                }}>

                                {/* Time badge */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <div style={{
                                        background: isCurrent ? ev.color : ev.bg,
                                        color: isCurrent ? "white" : ev.color,
                                        padding: isParentMode ? "4px 12px" : "6px 14px", borderRadius: 12, fontSize: isParentMode ? 13 : 15, fontWeight: 800
                                    }}>
                                        {friendlyTime}
                                    </div>
                                    {isCurrent && (isParentMode
                                        ? <span style={{ fontSize: 11, fontWeight: 700, color: ev.color, animation: "pulse 1.5s infinite" }}>지금!</span>
                                        : <span style={{ fontSize: 13, fontWeight: 800, color: "white", background: ev.color, padding: "3px 10px", borderRadius: 10, animation: "pulse 1.5s infinite" }}>지금 갈 시간! 🏃</span>
                                    )}
                                    {arrived && <span style={{ fontSize: isParentMode ? 11 : 13, fontWeight: 700, color: "#059669" }}>✅ 도착</span>}
                                    {emergency && isParentMode && <span style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", animation: "pulse 1s infinite" }}>🚨 미도착</span>}
                                </div>

                                {/* Content */}
                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                    <div style={{ width: isParentMode ? 44 : 50, height: isParentMode ? 44 : 50, borderRadius: isParentMode ? 14 : 16, background: ev.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isParentMode ? 24 : 28, flexShrink: 0 }}>{ev.emoji}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: isParentMode ? 16 : 18, fontWeight: 800, color: "#1F2937" }}>{ev.title}</div>
                                        {ev.location && (
                                            <div style={{ fontSize: isParentMode ? 12 : 13, color: "#6B7280", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                                                <span>📍</span>
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.location.address}</span>
                                            </div>
                                        )}
                                        {ev.memo && <div style={{ fontSize: isParentMode ? 11 : 12, color: "#9CA3AF", marginTop: 2 }}>📝 {ev.memo}</div>}
                                    </div>
                                </div>

                                {/* Distance + action row */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                                    {ev.location && distLabel && (
                                        <div style={{ fontSize: isParentMode ? 11 : 13, fontWeight: 700, color: ev.color, background: ev.bg, padding: isParentMode ? "4px 10px" : "6px 12px", borderRadius: 10, display: "flex", alignItems: "center", gap: 4 }}>
                                            🚶 {distLabel}
                                        </div>
                                    )}
                                    {ev.location && (
                                        <button onClick={(e) => { e.stopPropagation(); onRoute(ev); }}
                                            style={{ fontSize: isParentMode ? 12 : 14, fontWeight: 800, color: "white", background: `linear-gradient(135deg, ${ev.color}, ${ev.color}cc)`, padding: isParentMode ? "6px 14px" : "8px 16px", borderRadius: isParentMode ? 12 : 14, border: "none", cursor: "pointer", fontFamily: FF, boxShadow: `0 2px 8px ${ev.color}44`, display: "flex", alignItems: "center", gap: 4 }}>
                                            🧭 길찾기
                                        </button>
                                    )}
                                    {!ev.location && isParentMode && (
                                        <button onClick={(e) => { e.stopPropagation(); onEditLoc(ev.id); }}
                                            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 10, background: "#FFF0F7", border: "1.5px dashed #F9A8D4", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF }}>
                                            📍 장소 추가
                                        </button>
                                    )}
                                </div>

                                {/* Delete button - parent only */}
                                {isParentMode && (
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }}
                                        style={{ position: "absolute", right: 10, top: 10, background: "rgba(0,0,0,0.04)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 12, color: "#D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FF }}>✕</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Stickers earned today */}
            {stickers && stickers.length > 0 && (
                <div style={{ marginTop: 16, background: "linear-gradient(135deg, #FEF3C7, #FDE68A22)", borderRadius: 20, padding: 14, border: "2px solid #FCD34D" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", marginBottom: 8 }}>🏆 오늘 받은 칭찬스티커</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {stickers.map((s, i) => (
                            <div key={s.id || i} style={{
                                background: "white", borderRadius: 12, padding: "6px 10px",
                                display: "flex", alignItems: "center", gap: 4,
                                border: "1.5px solid #FCD34D", boxShadow: "0 2px 4px rgba(252,211,77,0.2)",
                            }}>
                                <span style={{ fontSize: 16 }}>{s.emoji}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Memo */}
            <MemoSection
                memoValue={memoValue}
                onMemoChange={onMemoChange}
                onMemoBlur={onMemoBlur}
                onMemoSend={onMemoSend}
                replies={memoReplies}
                onReplySubmit={onReplySubmit}
                readBy={memoReadBy}
                myUserId={myUserId}
                isParentMode={isParentMode}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticker Book Modal
// ─────────────────────────────────────────────────────────────────────────────
function StickerBookModal({ stickers, summary, dateLabel, onClose }) {
    const stickerLabels = { early: "일찍 도착", on_time: "정시 도착", completed: "완료" };
    const totalCount = summary?.total_count || 0;
    const earlyCount = summary?.early_count || 0;
    const onTimeCount = summary?.on_time_count || 0;

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, fontFamily: FF }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "white", borderRadius: 28, width: "90%", maxWidth: 400, maxHeight: "80vh", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "24px 20px 0", overflowY: "auto", flex: 1 }}>
                    <div style={{ textAlign: "center", marginBottom: 20 }}>
                        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#374151" }}>칭찬 스티커북</div>
                        <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>{dateLabel}</div>
                    </div>

                    {/* Summary */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 20, justifyContent: "center" }}>
                        <div style={{ background: "#FEF3C7", borderRadius: 16, padding: "12px 16px", textAlign: "center", flex: 1 }}>
                            <div style={{ fontSize: 24 }}>🌟</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "#F59E0B" }}>{earlyCount}</div>
                            <div style={{ fontSize: 10, color: "#92400E", fontWeight: 700 }}>일찍 도착</div>
                        </div>
                        <div style={{ background: "#EDE9FE", borderRadius: 16, padding: "12px 16px", textAlign: "center", flex: 1 }}>
                            <div style={{ fontSize: 24 }}>⭐</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "#7C3AED" }}>{onTimeCount}</div>
                            <div style={{ fontSize: 10, color: "#5B21B6", fontWeight: 700 }}>정시 도착</div>
                        </div>
                        <div style={{ background: "#DBEAFE", borderRadius: 16, padding: "12px 16px", textAlign: "center", flex: 1 }}>
                            <div style={{ fontSize: 24 }}>🏆</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "#2563EB" }}>{totalCount}</div>
                            <div style={{ fontSize: 10, color: "#1E40AF", fontWeight: 700 }}>총 스티커</div>
                        </div>
                    </div>

                    {/* Today's stickers */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 10 }}>오늘 모은 스티커</div>
                    {stickers.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px 0", color: "#D1D5DB" }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>🌙</div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>아직 스티커가 없어요</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>일정 장소에 시간 맞춰 도착하면 받을 수 있어요!</div>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 10 }}>
                            {stickers.map((s, i) => (
                                <div key={s.id || i} style={{
                                    background: s.sticker_type === "early" ? "#FEF3C7" : "#EDE9FE",
                                    borderRadius: 16, padding: "12px 8px", textAlign: "center",
                                    border: `2px solid ${s.sticker_type === "early" ? "#FCD34D" : "#C4B5FD"}`,
                                }}>
                                    <div style={{ fontSize: 28 }}>{s.emoji}</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                                    <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 2 }}>{stickerLabels[s.sticker_type] || s.sticker_type}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Progress bar */}
                    {totalCount > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                                <span style={{ color: "#6B7280" }}>스티커 모으기</span>
                                <span style={{ color: "#E879A0" }}>{totalCount}개 달성!</span>
                            </div>
                            <div style={{ height: 12, background: "#F3F4F6", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{
                                    height: "100%", borderRadius: 8,
                                    background: "linear-gradient(90deg, #FCD34D, #F59E0B, #EF4444, #EC4899)",
                                    width: `${Math.min(100, totalCount * 10)}%`,
                                    transition: "width 0.5s ease",
                                }} />
                            </div>
                            {totalCount >= 10 && <div style={{ fontSize: 12, fontWeight: 800, color: "#E879A0", textAlign: "center", marginTop: 8 }}>🎉 10개 달성! 최고야! 🎉</div>}
                        </div>
                    )}
                </div>

                <div style={{ padding: "16px 20px 20px", flexShrink: 0 }}>
                    <button onClick={onClose}
                        style={{ width: "100%", padding: "14px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Recorder (ambient sound for safety)
// ─────────────────────────────────────────────────────────────────────────────
function AmbientAudioRecorder({ onRecorded, onClose }) {
    const [recording, setRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioUrl, setAudioUrl] = useState(null);
    const recRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) { console.warn("[Audio] mediaDevices not available"); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const RecorderClass = typeof MediaRecorder !== "undefined" ? MediaRecorder : null;
            if (!RecorderClass) { stream.getTracks().forEach(t => t.stop()); console.warn("[Audio] MediaRecorder not available"); return; }
            const recorder = new RecorderClass(stream, { mimeType: "audio/webm;codecs=opus" });
            chunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                stream.getTracks().forEach(t => t.stop());
                if (onRecorded) onRecorded(blob, url);
            };
            recRef.current = recorder;
            recorder.start(1000);
            setRecording(true);
            setDuration(0);
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
            // Auto-stop after 60 seconds
            setTimeout(() => { if (recRef.current?.state === "recording") stopRecording(); }, 60000);
        } catch (e) {
            console.error("[Audio] permission denied:", e);
        }
    };

    const stopRecording = () => {
        if (recRef.current?.state === "recording") recRef.current.stop();
        setRecording(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, fontFamily: FF }}
            onClick={e => { if (e.target === e.currentTarget && !recording) onClose(); }}>
            <div style={{ background: "white", borderRadius: 28, padding: "24px 20px", width: "90%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{recording ? "🎙️" : audioUrl ? "🔊" : "🎤"}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#374151", marginBottom: 8 }}>
                    {recording ? "주변 소리 녹음 중..." : audioUrl ? "녹음 완료" : "주변 소리 듣기"}
                </div>
                {recording && (
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#DC2626", marginBottom: 16 }}>
                        {String(Math.floor(duration / 60)).padStart(2, "0")}:{String(duration % 60).padStart(2, "0")}
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#DC2626", display: "inline-block", marginLeft: 8, animation: "pulse 1s infinite" }} />
                    </div>
                )}
                {audioUrl && !recording && (
                    <div style={{ marginBottom: 16 }}>
                        <audio src={audioUrl} controls style={{ width: "100%", borderRadius: 12 }} />
                    </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                    {!recording && !audioUrl && (
                        <button onClick={startRecording}
                            style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #DC2626, #B91C1C)", color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            🎙️ 녹음 시작
                        </button>
                    )}
                    {recording && (
                        <button onClick={stopRecording}
                            style={{ flex: 1, padding: "14px", background: "#374151", color: "white", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            ⏹️ 녹음 중지
                        </button>
                    )}
                    {audioUrl && !recording && (
                        <button onClick={() => { setAudioUrl(null); startRecording(); }}
                            style={{ flex: 1, padding: "14px", background: "#EDE9FE", color: "#7C3AED", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                            🔄 다시 녹음
                        </button>
                    )}
                    <button onClick={() => { if (recording) stopRecording(); onClose(); }}
                        style={{ padding: "14px 20px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 18, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>
                        닫기
                    </button>
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 12 }}>최대 60초 녹음 · 아이의 안전을 위해 사용해주세요</div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Location Map View (interactive map + card list)
// ─────────────────────────────────────────────────────────────────────────────
function LocationMapView({ events, childPos, mapReady, arrivedSet }) {
    const mapRef = useRef();
    const mapObj = useRef();
    const markersRef = useRef([]);
    const myMarkerRef = useRef();
    const [selected, setSelected] = useState(null);

    const locEvents = Object.values(events).flat().filter(e => e.location);
    const center = childPos || (locEvents[0]?.location) || { lat: 37.5665, lng: 126.9780 };

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        if (!mapObj.current) {
            mapObj.current = new window.kakao.maps.Map(mapRef.current, {
                center: new window.kakao.maps.LatLng(center.lat, center.lng),
                level: 5
            });
        } else {
            mapObj.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
        }
        mapObj.current.relayout();

        // Clear old markers
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        if (myMarkerRef.current) { myMarkerRef.current.setMap(null); myMarkerRef.current = null; }

        // My location marker (blue dot)
        if (childPos) {
            const myOverlay = new window.kakao.maps.CustomOverlay({
                position: new window.kakao.maps.LatLng(childPos.lat, childPos.lng),
                content: '<div style="width:18px;height:18px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.5)"></div>',
                yAnchor: 0.5, xAnchor: 0.5
            });
            myOverlay.setMap(mapObj.current);
            myMarkerRef.current = myOverlay;
        }

        // Event location markers
        const bounds = new window.kakao.maps.LatLngBounds();
        if (childPos) bounds.extend(new window.kakao.maps.LatLng(childPos.lat, childPos.lng));

        locEvents.forEach(ev => {
            const pos = new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng);
            bounds.extend(pos);

            const arrived = arrivedSet.has(ev.id);
            const overlay = new window.kakao.maps.CustomOverlay({
                position: pos,
                content: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer" data-evid="${ev.id}">
                    <div style="background:${arrived ? '#059669' : ev.color};color:white;padding:6px 10px;border-radius:14px;font-size:12px;font-weight:800;box-shadow:0 3px 12px rgba(0,0,0,0.2);white-space:nowrap;font-family:'Noto Sans KR',sans-serif">
                        ${escHtml(ev.emoji)} ${escHtml(ev.title)}${arrived ? ' ✅' : ''}
                    </div>
                    <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${arrived ? '#059669' : ev.color}"></div>
                </div>`,
                yAnchor: 1.3, xAnchor: 0.5
            });
            overlay.setMap(mapObj.current);
            markersRef.current.push(overlay);

        });

        // Fit bounds if multiple points
        if (locEvents.length > 0) {
            mapObj.current.setBounds(bounds, 60);
        }
    }, [mapReady, childPos, events, arrivedSet]);

    // Handle click on overlay via map container click delegation
    useEffect(() => {
        if (!mapRef.current) return;
        const handler = (e) => {
            const target = e.target.closest('[data-evid]');
            if (target) {
                const id = parseInt(target.dataset.evid);
                setSelected(prev => prev === id ? null : id);
            }
        };
        mapRef.current.addEventListener('click', handler);
        return () => mapRef.current?.removeEventListener('click', handler);
    }, []);

    const selectedEv = selected ? locEvents.find(e => e.id === selected) : null;

    return (
        <div style={{ width: "100%", maxWidth: 420, marginBottom: 0 }}>
            {/* Map */}
            <div style={{ width: "100%", height: 300, borderRadius: 24, overflow: "hidden", boxShadow: "0 8px 32px rgba(232,121,160,0.12)", marginBottom: 14, position: "relative", background: "#F3F4F6" }}>
                {!mapReady && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#9CA3AF", fontFamily: FF }}>🗺️ 지도 로딩 중...</div>}
                <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
                <MapZoomControls mapObj={mapObj} />
                {childPos && (
                    <div style={{ position: "absolute", top: 12, left: 12, background: "white", borderRadius: 12, padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "#3B82F6", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", fontFamily: FF, display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6" }} /> 내 위치
                    </div>
                )}
                <div style={{ position: "absolute", top: 12, right: 12, background: "white", borderRadius: 12, padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "#6B7280", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", fontFamily: FF }}>
                    📍 {locEvents.length}개 장소
                </div>
            </div>

            {/* Selected card */}
            {selectedEv && (
                <div style={{ background: selectedEv.bg, borderRadius: 20, padding: 16, marginBottom: 12, borderLeft: `4px solid ${selectedEv.color}`, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ fontSize: 28 }}>{selectedEv.emoji}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: "#1F2937", fontFamily: FF }}>{selectedEv.title}</div>
                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, fontFamily: FF }}>⏰ {selectedEv.time}</div>
                            <div style={{ fontSize: 12, color: selectedEv.color, marginTop: 3, fontWeight: 600, fontFamily: FF }}>📍 {selectedEv.location.address}</div>
                        </div>
                        {arrivedSet.has(selectedEv.id)
                            ? <span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 12, background: "#D1FAE5", color: "#065F46", fontWeight: 700, fontFamily: FF }}>✅ 도착</span>
                            : <span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 12, background: "#FEF3C7", color: "#92400E", fontWeight: 700, fontFamily: FF }}>대기</span>}
                    </div>
                </div>
            )}

            {/* Card list */}
            <div style={{ background: "white", borderRadius: 24, boxShadow: "0 8px 32px rgba(232,121,160,0.12)", padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#374151", marginBottom: 12, fontFamily: FF }}>📍 등록된 장소</div>
                {locEvents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#D1D5DB", fontFamily: FF }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
                        <div style={{ fontSize: 14 }}>장소가 등록된 일정이 없어요</div>
                    </div>
                ) : locEvents.map(ev => (
                    <div key={ev.id}
                        onClick={() => {
                            setSelected(ev.id);
                            if (mapObj.current) {
                                mapObj.current.setCenter(new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng));
                                mapObj.current.setLevel(3);
                            }
                        }}
                        style={{
                            display: "flex", gap: 10, alignItems: "center", padding: "12px", borderRadius: 16, marginBottom: 8, cursor: "pointer", fontFamily: FF,
                            background: selected === ev.id ? ev.bg : "#F9FAFB", borderLeft: `3px solid ${ev.color}`,
                            transition: "all 0.15s"
                        }}>
                        <div style={{ fontSize: 22 }}>{ev.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#1F2937" }}>{ev.title}</div>
                            <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {ev.location.address}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, flexShrink: 0 }}>⏰ {ev.time}</div>
                        {arrivedSet.has(ev.id) ? <span style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>✅</span> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Child Tracker Overlay (학부모용 - 아이 실시간 위치)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Phone Settings Modal (parent)
// ─────────────────────────────────────────────────────────────────────────────
function PhoneSettingsModal({ phones, onSave, onClose }) {
    const [mom, setMom] = useState(phones.mom || "");
    const [dad, setDad] = useState(phones.dad || "");
    const inputSt = { width: "100%", padding: "14px 16px", border: "2px solid #F3F4F6", borderRadius: 14, fontSize: 16, color: "#374151", fontFamily: FF, outline: "none", boxSizing: "border-box", letterSpacing: 1 };
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
            <div style={{ background: "white", borderRadius: 28, padding: "28px 24px", width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#374151", textAlign: "center", marginBottom: 20 }}>📞 비상 연락처 설정</div>
                <div style={{ fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 20 }}>아이 화면에서 바로 전화할 수 있어요</div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E879A0", marginBottom: 6 }}>👩 엄마 전화번호</div>
                    <input value={mom} onChange={e => setMom(e.target.value)} placeholder="010-0000-0000" type="tel" style={inputSt}
                        onFocus={e => { e.target.style.borderColor = "#E879A0"; }} onBlur={e => { e.target.style.borderColor = "#F3F4F6"; }} />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6", marginBottom: 6 }}>👨 아빠 전화번호</div>
                    <input value={dad} onChange={e => setDad(e.target.value)} placeholder="010-0000-0000" type="tel" style={inputSt}
                        onFocus={e => { e.target.style.borderColor = "#3B82F6"; }} onBlur={e => { e.target.style.borderColor = "#F3F4F6"; }} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "#F3F4F6", color: "#6B7280", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>취소</button>
                    <button onClick={() => onSave({ mom: mom.trim(), dad: dad.trim() })} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF }}>저장</button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Child Call Buttons (floating, child view only)
// ─────────────────────────────────────────────────────────────────────────────
function ChildCallButtons({ phones }) {
    const [expanded, setExpanded] = useState(false);
    const cleanNumber = (num) => (num || "").replace(/[^0-9+]/g, "");
    const hasMom = phones.mom && phones.mom.length >= 8;
    const hasDad = phones.dad && phones.dad.length >= 8;
    if (!hasMom && !hasDad) return null;
    const btnSt = { width: 56, height: 56, borderRadius: "50%", border: "none", fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(0,0,0,0.25)", transition: "all 0.2s" };
    return (
        <div style={{ position: "fixed", bottom: 100, right: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 200 }}>
            {expanded && hasMom && (
                <a href={`tel:${cleanNumber(phones.mom)}`} style={{ textDecoration: "none", animation: "kkukFadeIn 0.2s ease" }}>
                    <div style={{ ...btnSt, background: "linear-gradient(135deg,#F9A8D4,#E879A0)" }}>👩</div>
                    <div style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#E879A0", marginTop: 2 }}>엄마</div>
                </a>
            )}
            {expanded && hasDad && (
                <a href={`tel:${cleanNumber(phones.dad)}`} style={{ textDecoration: "none", animation: "kkukFadeIn 0.2s ease" }}>
                    <div style={{ ...btnSt, background: "linear-gradient(135deg,#93C5FD,#3B82F6)" }}>👨</div>
                    <div style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: "#3B82F6", marginTop: 2 }}>아빠</div>
                </a>
            )}
            <button onClick={() => setExpanded(p => !p)}
                style={{ ...btnSt, width: 52, height: 52, background: expanded ? "#F3F4F6" : "linear-gradient(135deg,#34D399,#059669)", color: expanded ? "#6B7280" : "white", fontSize: 22 }}>
                {expanded ? "✕" : "📞"}
            </button>
        </div>
    );
}

function ChildTrackerOverlay({ childPos, events, mapReady, arrivedSet, onClose }) {
    const mapRef = useRef();
    const mapObj = useRef();
    const myMarkerRef = useRef();

    const locEvents = Object.values(events).flat().filter(e => e.location);
    const center = childPos || { lat: 37.5665, lng: 126.9780 };

    // 가장 가까운 다음 일정 찾기
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const todayEvents = (events[todayKey] || []).filter(e => e.location);
    const nextEvent = todayEvents.find(e => {
        const [h, m] = e.time.split(":").map(Number);
        return h * 60 + m > nowMin;
    });

    const distToNext = childPos && nextEvent?.location
        ? haversineM(childPos.lat, childPos.lng, nextEvent.location.lat, nextEvent.location.lng)
        : null;

    useEffect(() => {
        if (!mapReady || !mapRef.current) return;

        if (!mapObj.current) {
            mapObj.current = new window.kakao.maps.Map(mapRef.current, {
                center: new window.kakao.maps.LatLng(center.lat, center.lng),
                level: 4
            });
        }

        // 아이 위치 마커 (큰 파란 점 + 펄스)
        if (myMarkerRef.current) myMarkerRef.current.setMap(null);
        if (childPos) {
            const overlay = new window.kakao.maps.CustomOverlay({
                position: new window.kakao.maps.LatLng(childPos.lat, childPos.lng),
                content: `<div style="display:flex;flex-direction:column;align-items:center">
                    <div style="width:24px;height:24px;background:#3B82F6;border:4px solid white;border-radius:50%;box-shadow:0 0 0 8px rgba(59,130,246,0.2),0 3px 12px rgba(59,130,246,0.4)"></div>
                    <div style="margin-top:4px;background:#3B82F6;color:white;padding:3px 10px;border-radius:8px;font-size:11px;font-weight:800;font-family:'Noto Sans KR',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.15)">우리 아이</div>
                </div>`,
                yAnchor: 1.6, xAnchor: 0.5
            });
            overlay.setMap(mapObj.current);
            myMarkerRef.current = overlay;
            mapObj.current.setCenter(new window.kakao.maps.LatLng(childPos.lat, childPos.lng));
        }

        // 학원/일정 마커들
        locEvents.forEach(ev => {
            const pos = new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng);
            const arrived = arrivedSet.has(ev.id);
            const o = new window.kakao.maps.CustomOverlay({
                position: pos,
                content: `<div style="display:flex;flex-direction:column;align-items:center">
                    <div style="background:${arrived ? '#059669' : ev.color};color:white;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;font-family:'Noto Sans KR',sans-serif">${escHtml(ev.emoji)} ${escHtml(ev.title)}${arrived ? ' ✅' : ''}</div>
                    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${arrived ? '#059669' : ev.color}"></div>
                </div>`,
                yAnchor: 1.3, xAnchor: 0.5
            });
            o.setMap(mapObj.current);
        });
    }, [mapReady, childPos, events, arrivedSet]);

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", display: "flex", flexDirection: "column", fontFamily: FF }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: 14, padding: "10px 16px", cursor: "pointer", fontWeight: 800, fontSize: 14, fontFamily: FF, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>← 돌아가기</button>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1D4ED8" }}>📍 지금 우리 아이는?</div>
            </div>

            {/* Map */}
            <div style={{ flex: 1, margin: "0 16px", borderRadius: 24, overflow: "hidden", boxShadow: "0 8px 32px rgba(59,130,246,0.15)", position: "relative", minHeight: 0 }}>
                {!mapReady && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#3B82F6", fontFamily: FF, background: "#EFF6FF" }}>🗺️ 지도 불러오는 중...</div>}
                <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
                <MapZoomControls mapObj={mapObj} />
                {!childPos && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", zIndex: 5 }}>
                        <div style={{ textAlign: "center", padding: 24 }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#374151", marginBottom: 6 }}>아이 위치를 불러오는 중...</div>
                            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>아이 기기에서 위치 권한이<br />허용되어 있는지 확인해 주세요</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom info */}
            <div style={{ padding: "16px 20px", flexShrink: 0 }}>
                {childPos ? (
                    <div style={{ background: "white", borderRadius: 20, padding: "16px 20px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: nextEvent ? 12 : 0 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📍</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: "#1F2937" }}>위치 확인됨</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                                    {childPos.updatedAt
                                        ? `마지막 업데이트: ${new Date(childPos.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`
                                        : `위도 ${childPos.lat.toFixed(4)}, 경도 ${childPos.lng.toFixed(4)}`}
                                </div>
                            </div>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 0 4px rgba(34,197,94,0.2)" }} />
                        </div>
                        {nextEvent && (
                            <div style={{ background: nextEvent.bg, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ fontSize: 22 }}>{nextEvent.emoji}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>다음 일정: {nextEvent.title}</div>
                                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>⏰ {nextEvent.time} · 📍 {nextEvent.location.address?.split(" ").slice(0, 2).join(" ")}</div>
                                </div>
                                {distToNext !== null && (
                                    <div style={{ fontSize: 12, fontWeight: 800, color: nextEvent.color, flexShrink: 0 }}>
                                        {distToNext < 1000 ? `${Math.round(distToNext)}m` : `${(distToNext / 1000).toFixed(1)}km`}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ background: "white", borderRadius: 20, padding: "20px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF" }}>아이 기기에서 위치 권한을 허용해 주세요</div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function KidsScheduler() {
    const today = new Date();

    // ── Auth & family state (Supabase) ──────────────────────────────────────────
    const [authUser, setAuthUser] = useState(null);       // supabase auth user
    const [familyInfo, setFamilyInfo] = useState(null);   // { familyId, pairCode, myRole, myName, members }
    const [authLoading, setAuthLoading] = useState(true);
    const [myRole, setMyRole] = useState(() => {
        try { return localStorage.getItem("hyeni-my-role") || null; } catch { return null; }
    });           // "parent" | "child" | null (role selection)
    const [showPairing, setShowPairing] = useState(false);

    // Persist myRole to localStorage for session continuity
    useEffect(() => {
        try {
            if (myRole) localStorage.setItem("hyeni-my-role", myRole);
            else localStorage.removeItem("hyeni-my-role");
        } catch { /* ignored */ }
    }, [myRole]);

    const isParent = familyInfo?.myRole === "parent" || myRole === "parent";
    const isNativeApp = typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
    const familyId = familyInfo?.familyId;
    const pairCode = familyInfo?.pairCode || "";
    const pairedChildren = familyInfo?.members?.filter(m => m.role === "child") || [];
    const _pairedDevice = pairedChildren[0] || null; // 첫 번째 아이 (하위호환)

    // ── Academy, calendar, memo state ───────────────────────────────────────────
    const [academies, setAcademies] = useState(() => getCachedAcademies());
    const [showAcademyMgr, setShowAcademyMgr] = useState(false);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState(today.getDate());
    const [events, setEvents] = useState(() => getCachedEvents());
    const [memos, setMemos] = useState(() => getCachedMemos());
    const [memoReplies, setMemoReplies] = useState([]);
    const [memoReadBy, setMemoReadBy] = useState([]);
    const [globalNotif, _setGlobalNotif] = useState(DEFAULT_NOTIF);
    const [parentPhones, setParentPhones] = useState({ mom: "", dad: "" });
    const [showPhoneSettings, setShowPhoneSettings] = useState(false);
    const [showParentSetup, setShowParentSetup] = useState(false);

    // ── UI state ───────────────────────────────────────────────────────────────
    const [showAddModal, setShowAddModal] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [showChildTracker, setShowChildTracker] = useState(false);
    const [listening, setListening] = useState(false);
    const [notification, setNotification] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [emergencies, setEmergencies] = useState([]);
    const [bounce, setBounce] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [activeView, setActiveView] = useState("calendar");
    const [editingLocForEvent, setEditingLocForEvent] = useState(null);
    const [showKkukReceived, setShowKkukReceived] = useState(null); // { from: "엄마"|"아이", timestamp }
    const [kkukCooldown, setKkukCooldown] = useState(false);

    // ── Arrival tracking ───────────────────────────────────────────────────────
    const [arrivedSet, setArrivedSet] = useState(new Set());
    const [firedNotifs, setFiredNotifs] = useState(new Set());
    const [firedEmergencies, setFiredEmergencies] = useState(new Set());
    const [childPos, setChildPos] = useState(null);
    const [pushPermission, setPushPermission] = useState(() => getPermissionStatus());
    const [nativeNotifHealth, setNativeNotifHealth] = useState(null);
    // ── Stickers ────────────────────────────────────────────────────────────────
    const [stickers, setStickers] = useState([]);
    const [stickerSummary, setStickerSummary] = useState(null);
    const [showStickerBook, setShowStickerBook] = useState(false);
    // ── Departure detection ─────────────────────────────────────────────────────
    const departureTimers = useRef({}); // { eventId: { timer, leftAt } }
    const [departedAlerts, setDepartedAlerts] = useState(new Set());
    // ── Audio recording ─────────────────────────────────────────────────────────
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);

    // ── Voice ──────────────────────────────────────────────────────────────────
    const [voicePreview, setVoicePreview] = useState(null);
    const [routeEvent, setRouteEvent] = useState(null);

    // ── AI Alerts (parent only) ──────────────────────────────────────────────
    const [parentAlerts, setParentAlerts] = useState([]);
    const [showAlertPanel, setShowAlertPanel] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(() => {
        try { return localStorage.getItem("hyeni-ai-enabled") !== "false"; } catch { return true; }
    });

    // ── Refs ────────────────────────────────────────────────────────────────────
    const realtimeChannel = useRef(null);

    // ── Add form ───────────────────────────────────────────────────────────────
    const [newTitle, setNewTitle] = useState("");
    const [newTime, setNewTime] = useState("09:00");
    const [newCategory, setNewCategory] = useState("school");
    const [newMemo, setNewMemo] = useState("");
    const [newLocation, setNewLocation] = useState(null);
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [weeklyRepeat, setWeeklyRepeat] = useState(false);
    const [repeatWeeks, setRepeatWeeks] = useState(4);

    // 프리셋별 마지막 시간/위치를 기존 이벤트에서 찾기
    const findLastEventByTitle = (title) => {
        let found = null;
        for (const evs of Object.values(events)) {
            for (const e of evs) {
                if (e.title === title) found = e;
            }
        }
        return found;
    };

    const notifTimer = useRef(null);
    const memoSaveTimer = useRef(null);
    const memoDirty = useRef(false);       // true when memo has unsent push
    const memoLastValue = useRef("");       // last memo value for push
    const dateKey = `${currentYear}-${currentMonth}-${selectedDate}`;

    // ── Load memo replies & mark as read when viewing a date with memo ────────
    const currentMemo = memos[dateKey] || "";
    const hasMemo = currentMemo.length > 0;
    useEffect(() => {
        if (!familyId || !dateKey) return;
        fetchMemoReplies(familyId, dateKey).then(setMemoReplies).catch(() => {});
        // Mark memo as read by this user
        if (hasMemo && authUser?.id) {
            markMemoRead(familyId, dateKey, authUser.id).catch(() => {});
        }
        // Fetch read_by from memos table
        supabase.from("memos").select("read_by").eq("family_id", familyId).eq("date_key", dateKey).maybeSingle()
            .then(({ data }) => setMemoReadBy(data?.read_by || []));
    }, [familyId, dateKey, hasMemo]);

    // ── Load Kakao Maps SDK on mount ────────────────────────────────────────────
    useEffect(() => {
        if (!KAKAO_APP_KEY) return;
        loadKakaoMap(KAKAO_APP_KEY).then(() => setMapReady(true)).catch(() => {});
    }, []);

    // ── Send memo push when app goes to background / closes ─────────────────────
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "hidden" && memoDirty.current && familyId && authUser && memoLastValue.current.trim()) {
                memoDirty.current = false;
                // Flush DB save
                if (memoSaveTimer.current) { clearTimeout(memoSaveTimer.current); memoSaveTimer.current = null; }
                upsertMemo(familyId, dateKey, memoLastValue.current).catch(() => {});
                // Use sendBeacon for reliability when app is closing
                const payload = JSON.stringify({
                    action: "new_memo",
                    familyId,
                    senderUserId: authUser.id,
                    title: `📒 ${myRole === "parent" ? "부모님" : "아이"}이 메모를 남겼어요`,
                    message: memoLastValue.current.length > 50 ? memoLastValue.current.substring(0, 50) + "..." : memoLastValue.current,
                });
                if (navigator.sendBeacon && PUSH_FUNCTION_URL) {
                    navigator.sendBeacon(PUSH_FUNCTION_URL, new Blob([payload], { type: "application/json" }));
                } else {
                    sendInstantPush({ action: "new_memo", familyId, senderUserId: authUser.id, title: `📒 메모`, message: memoLastValue.current });
                }
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [familyId, authUser?.id, myRole, dateKey]);

    // ── Sync parent phones from familyInfo ─────────────────────────────────────
    useEffect(() => {
        if (familyInfo?.phones) {
            setParentPhones(familyInfo.phones);
        }
    }, [familyInfo]);

    // ── Register Service Worker for push notifications ──────────────────────────
    useEffect(() => {
        registerSW();
    }, []);

    // ── Native notification health (Android Capacitor) ─────────────────────────
    useEffect(() => {
        if (!isNativeApp) return;
        let cancelled = false;

        const refresh = async () => {
            const health = await getNativeNotificationHealth();
            if (!health || cancelled) return;
            setNativeNotifHealth(health);
            setPushPermission(
                health.postPermissionGranted && health.notificationsEnabled ? "granted" : "denied"
            );
        };

        refresh();

        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                refresh();
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [isNativeApp]);

    // ── Subscribe to server-side Web Push when permission + family are ready ────
    useEffect(() => {
        if (pushPermission === "granted" && authUser?.id && familyId) {
            subscribeToPush(authUser.id, familyId);
        }
    }, [pushPermission, authUser, familyId]);

    // ── Register FCM token (Android only) ───────────────────────────────────────
    useEffect(() => {
        if (!authUser?.id || !familyId) return;
        let cancelled = false;

        (async () => {
            try {
                const { Capacitor, registerPlugin } = await import("@capacitor/core");
                if (!Capacitor.isNativePlatform()) return;

                const BackgroundLocation = registerPlugin("BackgroundLocation");
                const session = await getSession();

                await BackgroundLocation.setPushContext({
                    userId: authUser.id,
                    familyId,
                    supabaseUrl: SUPABASE_URL,
                    supabaseKey: SUPABASE_KEY,
                    accessToken: session?.access_token || "",
                });

                const { token } = await BackgroundLocation.getFcmToken();
                if (!token || cancelled) return;

                const { error } = await supabase.from("fcm_tokens").upsert(
                    { user_id: authUser.id, family_id: familyId, fcm_token: token, updated_at: new Date().toISOString() },
                    { onConflict: "user_id,fcm_token" }
                );
                if (error) {
                    console.error("[FCM] Token registration failed:", error);
                    return;
                }
                console.log("[FCM] Token registered:", token.substring(0, 20) + "...");
            } catch (e) {
                console.warn("[FCM] Token registration skipped:", e.message);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [authUser, familyId]);

    // ── Shared auth handler (used by both init and onAuthChange) ────────────────
    const handleAuthUser = useCallback(async (user) => {
        setAuthUser(user);

        let fam = null;
        try {
            fam = await getMyFamily(user.id);
        } catch (err) {
            console.error("[getMyFamily]", err);
        }

        if (fam) {
            setFamilyInfo(fam);
            setMyRole(fam.myRole);
            return;
        }

        // Kakao user with no family → show parent setup choice (don't auto-create)
        const isKakao = user.app_metadata?.provider === "kakao"
            || user.identities?.some(i => i.provider === "kakao")
            || user.user_metadata?.provider === "kakao";
        if (isKakao) {
            setMyRole("parent");
            setShowParentSetup(true); // Show "새 가족 만들기 / 기존 가족 합류" choice
        }
    }, []);

    // ── Auth: check session on mount ────────────────────────────────────────────
    const authInitDone = useRef(false);
    const authUserRef = useRef(null);
    const myRoleRef = useRef(myRole);
    const familyInfoRef = useRef(familyInfo);
    // Keep refs in sync with state (avoids stale closure in visibility handler)
    useEffect(() => { authUserRef.current = authUser; }, [authUser]);
    useEffect(() => { myRoleRef.current = myRole; }, [myRole]);
    useEffect(() => { familyInfoRef.current = familyInfo; }, [familyInfo]);

    useEffect(() => {
        const init = async () => {
            try {
                const session = await getSession();
                if (session?.user) {
                    await handleAuthUser(session.user);
                }
            } catch (err) {
                console.error("[auth init] error:", err);
            }
            authInitDone.current = true;
            setAuthLoading(false);
        };

        // Safety timeout: never hang on loading screen
        const safetyTimer = setTimeout(() => {
            if (!authInitDone.current) {
                authInitDone.current = true;
                setAuthLoading(false);
            }
        }, 5000);

        init();

        const sub = onAuthChange(async (session, event) => {
            // Skip if init() hasn't finished yet (avoid double-run on mount)
            if (!authInitDone.current) return;
            if (session?.user) {
                await handleAuthUser(session.user);
            } else if (event === "SIGNED_OUT") {
                // Only reset role on explicit sign-out, not on token refresh failures
                setAuthUser(null);
                setFamilyInfo(null);
                setMyRole(null);
            }
        });

        // Re-check session when app comes back from background
        const handleVisibility = async () => {
            if (document.visibilityState === "visible" && authInitDone.current) {
                try {
                    const session = await getSession();
                    if (session?.user) {
                        if (!authUserRef.current || !myRoleRef.current) {
                            await handleAuthUser(session.user);
                        }
                        // Update native service token + ensure service is running
                        if (session.access_token) {
                            try {
                                const { Capacitor, registerPlugin } = await import("@capacitor/core");
                                if (Capacitor.isNativePlatform()) {
                                    const BackgroundLocation = registerPlugin("BackgroundLocation");
                                    // Check if service is still running, restart if dead
                                    const { running } = await BackgroundLocation.isRunning();
                                    const curRole = myRoleRef.current;
                                    const curFamilyId = familyInfoRef.current?.familyId;
                                    if (!running && curRole === "child" && curFamilyId) {
                                        console.log("[Resume] LocationService was dead, restarting...");
                                        await BackgroundLocation.startService({
                                            userId: session.user.id, familyId: curFamilyId,
                                            supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY,
                                            accessToken: session.access_token
                                        });
                                    } else {
                                        await BackgroundLocation.updateToken({ accessToken: session.access_token });
                                    }
                                }
                            } catch { /* ignored */ }
                        }
                    }
                } catch { /* ignored */ }
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            sub?.unsubscribe();
            clearTimeout(safetyTimer);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [handleAuthUser]);

    // ── Fetch data + subscribe when familyId is available ───────────────────────
    useEffect(() => {
        if (!familyId) return;

        // Fetch fresh data from Supabase
        fetchEvents(familyId).then(map => setEvents(map));
        fetchAcademies(familyId).then(list => setAcademies(list));
        fetchMemos(familyId).then(map => setMemos(map));

        // Subscribe to realtime changes
        realtimeChannel.current = subscribeFamily(familyId, {
            onEventsChange: (type, newRow, oldRow) => {
                setEvents(prev => {
                    const updated = { ...prev };
                    if (type === "INSERT" && newRow) {
                        const dk = newRow.date_key;
                        const ev = { id: newRow.id, title: newRow.title, time: newRow.time, category: newRow.category, emoji: newRow.emoji, color: newRow.color, bg: newRow.bg, memo: newRow.memo || "", location: newRow.location, notifOverride: newRow.notif_override };
                        updated[dk] = [...(updated[dk] || []), ev].sort((a, b) => a.time.localeCompare(b.time));
                        // Deduplicate by id
                        updated[dk] = updated[dk].filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i);
                    } else if (type === "UPDATE" && newRow) {
                        const dk = newRow.date_key;
                        const ev = { id: newRow.id, title: newRow.title, time: newRow.time, category: newRow.category, emoji: newRow.emoji, color: newRow.color, bg: newRow.bg, memo: newRow.memo || "", location: newRow.location, notifOverride: newRow.notif_override };
                        // Remove from old date_key if changed, add to new
                        Object.keys(updated).forEach(k => { updated[k] = (updated[k] || []).filter(e => e.id !== newRow.id); if (updated[k].length === 0) delete updated[k]; });
                        updated[dk] = [...(updated[dk] || []), ev].sort((a, b) => a.time.localeCompare(b.time));
                    } else if (type === "DELETE" && oldRow) {
                        Object.keys(updated).forEach(k => { updated[k] = (updated[k] || []).filter(e => e.id !== oldRow.id); if (updated[k].length === 0) delete updated[k]; });
                    }
                    cacheEvents(updated);
                    return updated;
                });
            },
            onAcademiesChange: (type, newRow, oldRow) => {
                const CAT_COLORS = { school: { color: "#A78BFA", bg: "#EDE9FE" }, sports: { color: "#34D399", bg: "#D1FAE5" }, hobby: { color: "#F59E0B", bg: "#FEF3C7" }, family: { color: "#F87171", bg: "#FEE2E2" }, friend: { color: "#60A5FA", bg: "#DBEAFE" }, other: { color: "#EC4899", bg: "#FCE7F3" } };
                setAcademies(prev => {
                    let updated = [...prev];
                    if (type === "INSERT" && newRow) {
                        const cat = CAT_COLORS[newRow.category] || CAT_COLORS.other;
                        const ac = { id: newRow.id, name: newRow.name, emoji: newRow.emoji, category: newRow.category, color: cat.color, bg: cat.bg, location: newRow.location };
                        if (!updated.find(a => a.id === ac.id)) updated.push(ac);
                    } else if (type === "UPDATE" && newRow) {
                        const cat = CAT_COLORS[newRow.category] || CAT_COLORS.other;
                        updated = updated.map(a => a.id === newRow.id ? { ...a, name: newRow.name, emoji: newRow.emoji, category: newRow.category, color: cat.color, bg: cat.bg, location: newRow.location } : a);
                    } else if (type === "DELETE" && oldRow) {
                        updated = updated.filter(a => a.id !== oldRow.id);
                    }
                    cacheAcademies(updated);
                    return updated;
                });
            },
            onMemosChange: (type, newRow, _oldRow) => {
                if (type === "DELETE") {
                    // For DELETE, newRow may be empty; refetch to ensure consistency
                    fetchMemos(familyId).then(map => setMemos(map));
                    return;
                }
                if (!newRow?.date_key) return;
                setMemos(prev => {
                    const updated = { ...prev };
                    updated[newRow.date_key] = newRow.content;
                    cacheMemos(updated);
                    return updated;
                });
            },
            onLocationChange: (payload) => {
                setChildPos(payload);
            },
            onKkuk: (payload) => {
                // Received '꾹' from the other party
                if (payload.senderId !== authUser?.id) {
                    const senderLabel = payload.senderRole === "parent" ? "엄마" : "아이";
                    setShowKkukReceived({ from: senderLabel, timestamp: Date.now() });
                    // Vibrate if supported
                    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
                    // Native notification (wakes screen on Android)
                    showKkukNotification(senderLabel);
                }
            }
        });

        return () => { unsubscribe(realtimeChannel.current); };
    }, [familyId]);

    // ── Polling fallback: refetch every 30s in case Realtime misses changes ──
    useEffect(() => {
        if (!familyId) return;
        const poll = setInterval(() => {
            fetchEvents(familyId).then(map => setEvents(prev => {
                // Only update if data actually changed
                const prevJson = JSON.stringify(prev);
                const newJson = JSON.stringify(map);
                if (prevJson !== newJson) { cacheEvents(map); return map; }
                return prev;
            }));
            fetchMemos(familyId).then(map => setMemos(prev => {
                const prevJson = JSON.stringify(prev);
                const newJson = JSON.stringify(map);
                if (prevJson !== newJson) { cacheMemos(map); return map; }
                return prev;
            }));
        }, 30000);
        return () => clearInterval(poll);
    }, [familyId]);

    // ── 꾹 (emergency ping) ────────────────────────────────────────────────────
    const sendKkuk = useCallback(async () => {
        if (kkukCooldown || !familyId || !authUser) return;
        setKkukCooldown(true);
        setTimeout(() => setKkukCooldown(false), 5000); // 5s cooldown

        const senderRole = isParent ? "parent" : "child";
        const senderLabel = isParent ? "엄마" : "아이";

        // 1. Realtime broadcast (instant, if other party has app open)
        if (realtimeChannel.current && realtimeChannel.current.state === "joined") {
            realtimeChannel.current.send({
                type: "broadcast",
                event: "kkuk",
                payload: { senderId: authUser.id, senderRole, timestamp: Date.now() }
            });
        }

        // 2. Push notification + pending_notifications (works when app is closed)
        try {
            await sendInstantPush({
                action: "kkuk",
                familyId,
                senderUserId: authUser.id,
                title: "💗 꾹!",
                message: `${senderLabel}가 꾹을 보냈어요!`,
            });
        } catch (e) {
            console.error("[kkuk] push failed:", e);
        }

        // Vibrate own device as feedback
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        showNotif("💗 꾹을 보냈어요!");
    }, [familyId, authUser, isParent, kkukCooldown]);

    // ── Helpers ────────────────────────────────────────────────────────────────
    const showNotif = useCallback((msg, type = "success") => {
        setNotification({ msg, type });
        if (notifTimer.current) clearTimeout(notifTimer.current);
        notifTimer.current = setTimeout(() => setNotification(null), 3500);
    }, []);

    const nativeSetupAction = getNativeSetupAction(nativeNotifHealth);

    const addAlert = useCallback((msg, type = "parent") => {
        const id = Date.now() + Math.random();
        setAlerts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 9000);
    }, []);

    // ── GPS watch (child: native service + web fallback) ──────────────────────
    useEffect(() => {
        if (myRole !== "child" || !authUser?.id || !familyId) return;
        let wid = null;
        let iv = null;

        // Try to start native background service (APK only)
        getSession().then(session => {
            const token = session?.access_token || "";
            startNativeLocationService(authUser.id, familyId, token, myRole).then(started => {
                if (started) {
                    console.log("[GPS] Native service running, web GPS as supplement");
                }
            });
        });

        // Web GPS as supplement (updates UI in real-time when app is visible)
        if (navigator.geolocation) {
            let lastSave = 0;
            wid = navigator.geolocation.watchPosition(
                p => {
                    const newPos = { lat: p.coords.latitude, lng: p.coords.longitude };
                    setChildPos(newPos);
                    if (realtimeChannel.current && realtimeChannel.current.state === "joined") {
                        realtimeChannel.current.send({ type: "broadcast", event: "child_location", payload: newPos });
                    }
                    const now = Date.now();
                    if (now - lastSave >= 10000) {
                        lastSave = now;
                        saveChildLocation(authUser.id, familyId, newPos.lat, newPos.lng);
                    }
                },
                (err) => {
                    if (err.code === 1) showNotif("📍 위치 권한이 꺼져 있어요. 설정에서 켜주세요!", "error");
                    else if (err.code === 2) showNotif("📍 위치를 찾을 수 없어요. GPS를 확인해주세요", "error");
                    else showNotif("📍 위치 추적 오류가 발생했어요", "error");
                },
                { enableHighAccuracy: true, maximumAge: 5000 }
            );
        }

        return () => {
            if (wid !== null) navigator.geolocation.clearWatch(wid);
            if (iv) clearInterval(iv);
        };
    }, [myRole, authUser?.id, familyId]);

    // ── Parent: fetch child's last known location from DB ─────────────────────
    useEffect(() => {
        if (myRole !== "parent" || !familyId) return;
        let cancelled = false;
        const load = () => {
            fetchChildLocations(familyId).then(locs => {
                if (cancelled || !locs.length) return;
                // use the most recently updated child location
                const latest = locs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
                setChildPos({ lat: latest.lat, lng: latest.lng, updatedAt: latest.updated_at });
            });
        };
        load(); // initial fetch
        const iv = setInterval(load, 10000); // poll every 10s
        return () => { cancelled = true; clearInterval(iv); };
    }, [myRole, familyId]);

    // ── Load stickers for selected date ─────────────────────────────────────────
    useEffect(() => {
        if (!familyId) return;
        fetchStickersForDate(familyId, dateKey).then(s => setStickers(s));
    }, [familyId, dateKey]);

    // ── Geofencing: arrival + departure detection ───────────────────────────────
    useEffect(() => {
        if (!childPos) return;
        const iv = setInterval(() => {
            const now = new Date();
            const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            (events[key] || []).forEach(ev => {
                if (!ev.location) return;
                const dist = haversineM(childPos.lat, childPos.lng, ev.location.lat, ev.location.lng);
                const inside = dist <= ARRIVAL_R;

                // ── Arrival detection ──
                if (inside && !arrivedSet.has(ev.id)) {
                    const [h, m] = ev.time.split(":").map(Number);
                    const diff = Math.round((now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime()) / 60000);
                    const isEarly = diff < -1;
                    const isOnTime = diff >= -1 && diff <= 5;
                    const msg = isEarly ? `${Math.abs(diff)}분 일찍 도착` : isOnTime ? "정시 도착" : `${diff}분 늦게 도착`;

                    setArrivedSet(prev => new Set([...prev, ev.id]));

                    // Role-based arrival messages
                    if (!isParent && globalNotif.childEnabled) {
                        addAlert(`🎉 ${ev.title}에 도착했어요! (${msg})`, "child");
                        showNotif(`🎉 ${ev.title}에 잘 도착했어! ${isEarly ? "일찍 왔네~ 대단해! ⭐" : isOnTime ? "딱 맞춰 왔구나! 👏" : "조금 늦었지만 괜찮아! 💪"}`, "child");
                    }

                    if (isParent && globalNotif.parentEnabled) {
                        addAlert(`✅ 혜니가 ${ev.title}에 잘 도착했어요 (${msg})`, "parent");
                    }
                    sendInstantPush({
                        action: "new_event",
                        familyId, senderUserId: authUser?.id,
                        title: `✅ ${ev.emoji} 도착 알림`,
                        message: `혜니가 ${ev.title}에 잘 도착했어요! (${msg})`,
                    });
                    showArrivalNotification(ev, msg, myRole);

                    // Award sticker if arrived early or on time
                    if (authUser && familyId && (isEarly || isOnTime)) {
                        const stickerType = isEarly ? "early" : "on_time";
                        const stickerEmoji = isEarly ? "🌟" : "⭐";
                        addSticker(authUser.id, familyId, String(ev.id), key, stickerType, stickerEmoji, ev.title);
                        showNotif(`${stickerEmoji} 칭찬스티커를 받았어요! ${isEarly ? "일찍 도착 보너스!" : "시간 잘 지켰어요!"}`, "child");
                        // Refresh stickers
                        setTimeout(() => fetchStickersForDate(familyId, key).then(s => setStickers(s)), 1000);
                    }

                    // Clear departure timer if any
                    if (departureTimers.current[ev.id]) {
                        clearTimeout(departureTimers.current[ev.id].timer);
                        delete departureTimers.current[ev.id];
                    }
                }

                // ── Departure detection (left 50m zone after arriving) ──
                if (!inside && arrivedSet.has(ev.id) && !departedAlerts.has(ev.id)) {
                    // Child left the zone — start countdown
                    if (!departureTimers.current[ev.id]) {
                        departureTimers.current[ev.id] = {
                            leftAt: Date.now(),
                            timer: setTimeout(() => {
                                // Still outside after DEPARTURE_TIMEOUT (1.5 min)?
                                setDepartedAlerts(prev => new Set([...prev, ev.id]));
                                if (isParent) addAlert(`🚨 긴급! 혜니가 ${ev.title} 장소를 벗어났어요!`, "emergency");
                                sendInstantPush({
                                    action: "new_event",
                                    familyId, senderUserId: authUser?.id,
                                    title: `🚨 이탈 알림`,
                                    message: `혜니가 ${ev.title} 장소에서 벗어났어요! 확인해주세요.`,
                                });
                                delete departureTimers.current[ev.id];
                            }, DEPARTURE_TIMEOUT_MS),
                        };
                    }
                } else if (inside && departureTimers.current[ev.id]) {
                    // Came back — cancel departure timer
                    clearTimeout(departureTimers.current[ev.id].timer);
                    delete departureTimers.current[ev.id];
                }
            });
        }, 10000); // check every 10s
        return () => clearInterval(iv);
    }, [childPos, events, arrivedSet, globalNotif, addAlert, familyId, authUser, departedAlerts, isParent]);

    // ── Advance notifications (friendly messages) ─────────────────────────────
    useEffect(() => {
        const friendlyChildMsg = (ev, mins) => {
            if (mins === 15) return `🐰 ${ev.emoji} ${ev.title} 가기 15분 전이야! 준비물 챙겼니? 🎒`;
            if (mins === 5) return `🏃 ${ev.emoji} ${ev.title} 곧 시작이야! 출발~ 화이팅! 💪`;
            if (mins >= 60) return `🐰 ${ev.emoji} ${ev.title} ${mins / 60}시간 후에 시작해요!`;
            return `🐰 ${ev.emoji} ${ev.title} ${mins}분 후에 시작해요!`;
        };
        const check = () => {
            const now = new Date(); const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            (events[key] || []).forEach(ev => {
                const [h, m] = ev.time.split(":").map(Number);
                const evMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
                const eff = ev.notifOverride || globalNotif;
                eff.minutesBefore.forEach(mins => {
                    const fireKey = `${ev.id}-${mins}`;
                    if (Math.abs(now.getTime() - (evMs - mins * 60000)) <= 35000 && !firedNotifs.has(fireKey)) {
                        setFiredNotifs(prev => new Set([...prev, fireKey]));
                        const label = mins >= 60 ? `${mins / 60}시간` : `${mins}분`;
                        if (!isParent && eff.childEnabled) { showNotif(friendlyChildMsg(ev, mins), "child"); setBounce(true); setTimeout(() => setBounce(false), 800); }
                        if (isParent && eff.parentEnabled) addAlert(`${ev.emoji} ${ev.title} ${label} 전 알림 — ${ev.time} 시작`, "parent");
                    }
                });
            });
        };
        check(); const id = setInterval(check, 30000); return () => clearInterval(id);
    }, [events, globalNotif, firedNotifs, showNotif, addAlert, isParent]);

    // ── Push notification scheduling ────────────────────────────────────────────
    useEffect(() => {
        if (pushPermission === "granted") {
            scheduleNotifications(events, globalNotif, myRole);
        }
        // Always schedule native AlarmManager alarms (persistent, works when app killed)
        scheduleNativeAlarms(events, globalNotif, myRole);
        return () => clearAllScheduled();
    }, [events, globalNotif, pushPermission, myRole]);

    // ── Emergency check ────────────────────────────────────────────────────────
    useEffect(() => {
        const check = () => {
            const now = new Date(); const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
            (events[key] || []).forEach(ev => {
                if (!ev.location || arrivedSet.has(ev.id) || firedEmergencies.has(ev.id)) return;
                const [h, m] = ev.time.split(":").map(Number);
                const minsUntil = (new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime() - now.getTime()) / 60000;
                if (minsUntil <= 5 && minsUntil > -1) {
                    setFiredEmergencies(prev => new Set([...prev, ev.id]));
                    if (isParent) {
                        const shortAddr = (ev.location.address || "").split(" ").slice(0, 4).join(" ");
                        setEmergencies(prev => [...prev, { id: Date.now() + Math.random(), emoji: ev.emoji, title: ev.title, time: ev.time, location: shortAddr, eventId: ev.id }]);
                        addAlert(`🚨 긴급! ${ev.emoji} ${ev.title} 5분 후인데 아직 미도착!`, "emergency");
                        showEmergencyNotification(ev);
                    }
                }
            });
        };
        check(); const id = setInterval(check, 30000); return () => clearInterval(id);
    }, [events, arrivedSet, firedEmergencies, addAlert, isParent]);

    // ── Voice NLP parser ───────────────────────────────────────────────────────
    // ── AI Voice: parse text via Edge Function, fallback to regex ────────────
    const aiParseVoice = async (text) => {
        if (!AI_PARSE_URL) return null;
        try {
            const session = await getSession();
            const token = session?.access_token || "";
            const todayKey = dateKey;
            const todayEvs = (events[todayKey] || []).map(e => ({ id: e.id, title: e.title, time: e.time, memo: e.memo || "" }));

            const resp = await fetch(AI_PARSE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "apikey": SUPABASE_KEY,
                },
                body: JSON.stringify({
                    text,
                    academies: academies.map(a => ({ name: a.name, category: a.category })),
                    todayEvents: todayEvs,
                    currentDate: { year: currentYear, month: currentMonth, day: selectedDate },
                }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (err) {
            console.warn("[AI] parse failed, using regex fallback:", err.message);
            return null;
        }
    };

    const parseVoiceInputRegex = (text) => {
        let remaining = text.trim();
        // Check for navigation intent first
        if (/길\s*(알려|안내|찾|보여)|다음\s*일정.*길|네비|내비|길찾기/.test(remaining)) {
            return { action: "navigate" };
        }
        let matchedAcademy = null;
        for (const ac of academies) {
            if (remaining.includes(ac.name)) { matchedAcademy = ac; remaining = remaining.replace(ac.name, "").trim(); break; }
        }
        let hour = null, minute = 0;
        const pmM = remaining.match(/오후\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
        const amM = remaining.match(/오전\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
        const pM = remaining.match(/(\d{1,2})시(?:\s*(\d{1,2})분|반)?/);
        const cM = remaining.match(/(\d{1,2}):(\d{2})/);
        if (pmM) { hour = parseInt(pmM[1]); minute = parseInt(pmM[2] || "0"); if (hour < 12) hour += 12; remaining = remaining.replace(pmM[0], "").trim(); }
        else if (amM) { hour = parseInt(amM[1]); minute = parseInt(amM[2] || "0"); if (hour === 12) hour = 0; remaining = remaining.replace(amM[0], "").trim(); }
        else if (cM) { hour = parseInt(cM[1]); minute = parseInt(cM[2]); remaining = remaining.replace(cM[0], "").trim(); }
        else if (pM) { hour = parseInt(pM[1]); const mp = pM[2]; minute = mp === "반" ? 30 : parseInt(mp || "0"); if (hour < 7) hour += 12; remaining = remaining.replace(pM[0], "").trim(); }
        const now = new Date();
        let tY = currentYear, tM = currentMonth, tD = selectedDate;
        const datePs = [
            { re: /내일/, fn: () => { const d = new Date(now); d.setDate(d.getDate() + 1); return d; } },
            { re: /모레/, fn: () => { const d = new Date(now); d.setDate(d.getDate() + 2); return d; } },
            { re: /오늘/, fn: () => new Date(now) },
            { re: /다음\s*주\s*(월|화|수|목|금|토|일)요일/, fn: (m) => { const dm = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }; const d = new Date(now); d.setDate(d.getDate() + (dm[m[1]] - d.getDay() + 7) % 7 + 7); return d; } },
            { re: /(월|화|수|목|금|토|일)요일/, fn: (m) => { const dm = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }; const d = new Date(now); let df = (dm[m[1]] - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + df); return d; } },
            { re: /(\d{1,2})월\s*(\d{1,2})일/, fn: (m) => new Date(now.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2])) },
        ];
        for (const { re, fn } of datePs) {
            const m = remaining.match(re); if (m) { const d = fn(m); tY = d.getFullYear(); tM = d.getMonth(); tD = d.getDate(); remaining = remaining.replace(m[0], "").trim(); break; }
        }
        let guessedCat = matchedAcademy?.category || "other";
        if (!matchedAcademy) {
            const kws = { school: ["학원", "영어", "수학", "피아노", "바이올린", "코딩", "논술", "한자", "미술"], sports: ["태권도", "축구", "수영", "농구", "야구", "배드민턴", "체육"], hobby: ["취미", "그림", "독서", "댄스", "발레"], family: ["가족", "엄마", "아빠", "할머니", "여행"], friend: ["친구", "생일", "파티", "약속"] };
            for (const [cat, ks] of Object.entries(kws)) { if (ks.some(k => remaining.includes(k))) { guessedCat = cat; break; } }
        }
        const stopW = ["에", "을", "를", "이", "가", "은", "는", "추가", "일정", "저장", "등록", "해줘", "해", "좀", "가요", "갈게"];
        let title = matchedAcademy ? matchedAcademy.name : remaining;
        if (!matchedAcademy) stopW.forEach(w => { title = title.replace(new RegExp(w + "$"), "").trim(); });
        title = title.replace(/\s+/g, " ").trim() || text;
        const timeStr = hour !== null ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` : fmtT(now);
        return { action: "add_event", title, time: timeStr, category: guessedCat, year: tY, month: tM, day: tD, academyName: matchedAcademy?.name || null };
    };

    // ── AI: Fetch parent alerts ─────────────────────────────────────────────
    const loadParentAlerts = useCallback(async () => {
        if (!familyId || myRole !== "parent") return;
        try {
            const alerts = await fetchParentAlerts(familyId);
            setParentAlerts(alerts);
        } catch (err) { console.error("[alerts]", err); }
    }, [familyId, myRole]);

    useEffect(() => { loadParentAlerts(); }, [loadParentAlerts]);

    // Poll alerts every 60 seconds for parents
    useEffect(() => {
        if (!familyId || myRole !== "parent") return;
        const interval = setInterval(loadParentAlerts, 60000);
        return () => clearInterval(interval);
    }, [familyId, myRole, loadParentAlerts]);

    // ── AI: Analyze memo sentiment ───────────────────────────────────────────
    const analyzeMemoSentiment = async (memoText, eventTitle) => {
        if (!aiEnabled || !AI_MONITOR_URL || !familyId || !memoText.trim()) return;
        try {
            const session = await getSession();
            const token = session?.access_token || "";
            const resp = await fetch(AI_MONITOR_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "apikey": SUPABASE_KEY,
                },
                body: JSON.stringify({
                    familyId,
                    analysisType: "memo_sentiment",
                    memoText,
                    eventTitle: eventTitle || "",
                    childName: familyInfo?.members?.find(m => m.role === "child")?.name || "아이",
                }),
            });
            if (!resp.ok) return;
            const result = await resp.json();
            if (result.action === "alert") {
                // Store alert in DB
                const { error } = await supabase.rpc("insert_parent_alert", {
                    p_family_id: familyId,
                    p_alert_type: "memo_" + (result.category || "emotional"),
                    p_title: "🤖 AI: " + result.title,
                    p_message: result.message,
                    p_severity: result.severity || "info",
                });
                if (!error) loadParentAlerts();
            }
        } catch (err) { console.warn("[AI memo analysis]", err.message); }
    };

    // ── AI settings toggle ───────────────────────────────────────────────────
    const toggleAiEnabled = (val) => {
        setAiEnabled(val);
        try { localStorage.setItem("hyeni-ai-enabled", val ? "true" : "false"); } catch { /* ignored */ }
    };

    // ── Process AI/regex result → create event or add memo ────────────────────
    const handleVoiceResult = async (parsed, rawText) => {
        if (!parsed || parsed.action === "unknown") {
            showNotif(parsed?.message || "음성을 이해하지 못했어요", "error");
            return;
        }

        // "다음일정까지 길 알려줘" — navigate to next event
        if (parsed.action === "navigate") {
            const todayEvs = (events[dateKey] || []).sort((a, b) => a.time.localeCompare(b.time));
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const nextEv = todayEvs.find(ev => {
                const [h, m] = ev.time.split(":").map(Number);
                return (h * 60 + m) >= nowMin && ev.location;
            }) || todayEvs.find(ev => ev.location);

            if (!nextEv || !nextEv.location) {
                showNotif("길 안내할 일정이 없어요 (위치가 설정된 일정이 필요해요)", "error");
                return;
            }
            setRouteEvent(nextEv);
            showNotif(`🗺️ "${nextEv.title}" 길찾기를 시작할게요!`);
            return;
        }

        if (parsed.action === "add_memo") {
            // Find target event and append memo
            const targetId = parsed.targetEventId;
            const memoText = parsed.memoText || "";
            if (!targetId || !memoText) { showNotif("어떤 일정에 메모할지 모르겠어요", "error"); return; }

            // Find event in today's events
            const todayEvs = events[dateKey] || [];
            const target = todayEvs.find(e => e.id === targetId);
            if (!target) { showNotif("해당 일정을 찾지 못했어요", "error"); return; }

            const newMemoVal = target.memo ? target.memo + "\n" + memoText : memoText;
            setEvents(prev => {
                const updated = { ...prev };
                updated[dateKey] = (updated[dateKey] || []).map(e =>
                    e.id === targetId ? { ...e, memo: newMemoVal } : e
                );
                return updated;
            });

            if (familyId && authUser) {
                try {
                    await updateEvent(targetId, { memo: newMemoVal });
                    await upsertMemo(targetId, dateKey, newMemoVal, familyId);
                } catch (err) { console.error("[voiceMemo] save error:", err); }
            }

            showNotif(`✏️ "${target.title}" 메모에 추가했어요: ${memoText}`);
            setBounce(true); setTimeout(() => setBounce(false), 800);
            return;
        }

        // action === "add_event"
        const matchedAcademy = parsed.academyName
            ? academies.find(a => a.name === parsed.academyName) : null;
        const catId = parsed.category || "other";
        const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES.find(c => c.id === "other");
        const evYear = parsed.year ?? currentYear;
        const evMonth = parsed.month ?? currentMonth;
        const evDay = parsed.day ?? selectedDate;
        const dk = `${evYear}-${evMonth}-${evDay}`;
        const timeStr = parsed.time || fmtT(new Date());

        const ev = {
            id: generateUUID(), title: parsed.title, time: timeStr,
            category: catId, emoji: matchedAcademy?.emoji || cat.emoji,
            color: cat.color, bg: cat.bg, memo: parsed.memo || "",
            location: matchedAcademy?.location || null, notifOverride: null,
        };

        setEvents(prev => ({ ...prev, [dk]: [...(prev[dk] || []), ev].sort((a, b) => a.time.localeCompare(b.time)) }));
        const dateLabel = `${evMonth + 1}월 ${evDay}일`;
        setVoicePreview({ ev, dateKey: dk, dateLabel, rawText, academyMatched: !!matchedAcademy, aiParsed: true });
        showNotif(!isParent ? "🐰 알겠어! 일정 추가했어!" : `${ev.emoji} ${parsed.title} 추가 완료`);
        setBounce(true); setTimeout(() => setBounce(false), 800);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => setVoicePreview(null), 8000);

        if (familyId && authUser) {
            try {
                await insertEvent(ev, familyId, dk, authUser.id);
                sendInstantPush({
                    action: "new_event", familyId, senderUserId: authUser.id,
                    title: `🤖 새 일정: ${ev.emoji} ${parsed.title}`,
                    message: `${dateLabel} ${ev.time}에 "${parsed.title}" 일정이 추가됐어요 (AI 음성)`,
                });
            } catch (err) {
                console.error("[voiceEvent] Supabase error:", err);
                // Rollback
                setEvents(prev => {
                    const updated = { ...prev };
                    updated[dk] = (updated[dk] || []).filter(e => e.id !== ev.id);
                    if (updated[dk].length === 0) delete updated[dk];
                    return updated;
                });
                showNotif("서버 저장 실패", "error");
            }
        }
    };

    const undoVoiceEvent = () => {
        if (!voicePreview) return;
        setEvents(prev => ({ ...prev, [voicePreview.dateKey]: (prev[voicePreview.dateKey] || []).filter(e => e.id !== voicePreview.ev.id) }));
        if (familyId && voicePreview.ev?.id) {
            dbDeleteEvent(voicePreview.ev.id).catch(() => {});
        }
        setVoicePreview(null); showNotif("↩ 일정을 취소했어요");
    };

    const startVoice = async () => {
        let transcript = null;

        // Try native Capacitor SpeechRecognition first (Android WebView)
        try {
            const { Capacitor, registerPlugin } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const SpeechRecognition = registerPlugin("SpeechRecognition");
                setListening(true);
                try {
                    const result = await SpeechRecognition.start({ language: "ko-KR" });
                    setListening(false);
                    transcript = result?.transcript || null;
                } catch (err) {
                    setListening(false);
                    showNotif(err?.message || "음성 인식 실패", "error");
                    return;
                }
                if (!transcript) { showNotif("음성을 인식하지 못했어요", "error"); return; }
            }
        } catch { /* not native */ }

        // Fallback: Web Speech API (Chrome browser)
        if (!transcript) {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (isIOS) {
                    showNotif("아이폰 Safari에서는 음성인식이 지원되지 않아요. 텍스트로 입력해주세요!", "error");
                } else {
                    showNotif("음성인식을 지원하지 않아요 (Chrome 브라우저를 사용해주세요)", "error");
                }
                return;
            }
            transcript = await new Promise((resolve) => {
                const rec = new SR(); rec.lang = "ko-KR"; rec.interimResults = false;
                rec.onresult = (e) => { setListening(false); resolve(e.results[0][0].transcript); };
                rec.onerror = () => { setListening(false); resolve(null); };
                rec.onend = () => setListening(false);
                rec.start(); setListening(true);
            });
            if (!transcript) { showNotif("음성 인식 실패", "error"); return; }
        }

        // Try AI parsing first (if enabled), fall back to regex
        let parsed;
        if (aiEnabled) {
            showNotif("🤖 AI 분석 중...");
            parsed = await aiParseVoice(transcript);
        }
        if (!parsed || parsed.error) {
            parsed = parseVoiceInputRegex(transcript);
        }

        await handleVoiceResult(parsed, transcript);
    };

    // ── dateKey helper: add N days to a dateKey string ─────────────────────────
    const addDaysToDateKey = (dk, days) => {
        const [y, m, d] = dk.split("-").map(Number);
        const date = new Date(y, m, d + days);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    };

    // ── Add event (manual) ─────────────────────────────────────────────────────
    const addEvent = async () => {
        const title = newTitle.trim() || (selectedPreset ? selectedPreset.label : "");
        if (!title) { showNotif("일정 이름을 입력해 줘요! 🐰", "error"); return; }
        const cat = CATEGORIES.find(c => c.id === newCategory);
        const emoji = selectedPreset ? selectedPreset.emoji : cat.emoji;

        const totalWeeks = weeklyRepeat ? repeatWeeks : 1;
        const allEvents = [];
        for (let w = 0; w < totalWeeks; w++) {
            const dk = w === 0 ? dateKey : addDaysToDateKey(dateKey, w * 7);
            allEvents.push({ ev: { id: generateUUID(), title, time: newTime, category: newCategory, emoji, color: cat.color, bg: cat.bg, memo: newMemo.trim(), location: newLocation, notifOverride: null }, dateKey: dk });
        }

        // Optimistic local update
        setEvents(prev => {
            const updated = { ...prev };
            for (const { ev, dateKey: dk } of allEvents) {
                updated[dk] = [...(updated[dk] || []), ev].sort((a, b) => a.time.localeCompare(b.time));
            }
            return updated;
        });
        setNewTitle(""); setNewTime("09:00"); setNewCategory("school"); setNewMemo(""); setNewLocation(null); setSelectedPreset(null); setWeeklyRepeat(false); setRepeatWeeks(4);
        setShowAddModal(false);
        showNotif(weeklyRepeat ? `✨ ${totalWeeks}주 반복 일정이 추가됐어요!` : "✨ 일정이 추가됐어요!");
        setBounce(true); setTimeout(() => setBounce(false), 800);

        // Persist to Supabase (Realtime will sync to other device)
        if (familyId && authUser) {
            try {
                for (const { ev, dateKey: dk } of allEvents) {
                    await insertEvent(ev, familyId, dk, authUser.id);
                }
                sendInstantPush({
                    action: "new_event",
                    familyId,
                    senderUserId: authUser.id,
                    title: `📅 새 일정: ${emoji} ${title}`,
                    message: weeklyRepeat
                        ? `${dateKey.replace(/-/g, "/")}부터 매주 ${totalWeeks}주간 "${title}" 일정이 추가됐어요`
                        : `${dateKey.replace(/-/g, "/")} ${newTime}에 "${title}" 일정이 추가됐어요`,
                });
            } catch (err) {
                console.error("[addEvent] Supabase error:", err);
                setEvents(prev => {
                    const updated = { ...prev };
                    for (const { ev, dateKey: dk } of allEvents) {
                        updated[dk] = (updated[dk] || []).filter(e => e.id !== ev.id);
                        if (updated[dk].length === 0) delete updated[dk];
                    }
                    return updated;
                });
                showNotif("서버 저장에 실패했어요. 다시 시도해주세요", "error");
            }
        }
    };

    const handleDeleteEvent = async (id) => {
        setEvents(prev => ({ ...prev, [dateKey]: (prev[dateKey] || []).filter(e => e.id !== id) }));
        showNotif("🗑️ 일정을 지웠어요");
        if (familyId) {
            try { await dbDeleteEvent(id); } catch (err) { console.error("[deleteEvent]", err); }
        }
    };

    const updateEvField = async (id, field, value) => {
        setEvents(prev => { const out = {}; Object.entries(prev).forEach(([k, evs]) => { out[k] = evs.map(e => e.id === id ? { ...e, [field]: value } : e); }); return out; });
        if (familyId) {
            try { await updateEvent(id, { [field]: value }); } catch (err) { console.error("[updateEvField]", err); }
        }
    };

    const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); };
    const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); };
    const getDays = getDIM(currentYear, currentMonth);
    const firstDay = getFD(currentYear, currentMonth);
    const getEvs = (d) => events[`${currentYear}-${currentMonth}-${d}`] || [];
    const selectedEvs = events[dateKey] || [];

    // CSS helpers
    const inputSt = { width: "100%", padding: "12px 14px", border: "2px solid #F3F4F6", borderRadius: 14, fontSize: 15, color: "#374151", fontFamily: FF, outline: "none", boxSizing: "border-box" };
    const labelSt = { fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, display: "block" };
    const cardSt = { width: "100%", maxWidth: 420, background: "white", borderRadius: 28, boxShadow: "0 8px 32px rgba(232,121,160,0.12)", padding: 20, marginBottom: 14 };
    const primBtn = { width: "100%", padding: "15px", background: "linear-gradient(135deg,#E879A0,#BE185D)", color: "white", border: "none", borderRadius: 20, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FF, marginTop: 16 };
    const secBtn = { width: "100%", padding: "12px", background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8, fontFamily: FF };

    const TABS = [["calendar", "📅 달력"], ["maplist", "📍 장소"]];

    // ── Handle child role selection (anonymous login + pair code input) ────────
    const handleChildSelect = async () => {
        try {
            const user = await anonymousLogin();
            setAuthUser(user);
            setMyRole("child");
            // ChildPairInput overlay will show automatically (myRole=child + !familyId)
        } catch (err) {
            console.error("[child login]", err);
        }
    };

    // ── Handle parent setup: create new family or join existing ────────────────
    const handleCreateFamily = async () => {
        if (!authUser) return;
        try {
            await setupFamily(authUser.id, authUser.user_metadata?.name || "부모");
            const fam = await getMyFamily(authUser.id);
            if (fam) {
                setFamilyInfo(fam);
                setMyRole(fam.myRole);
                setShowParentSetup(false);
                setShowPairing(true);
                showNotif("가족이 생성되었어요! 아래 연동코드를 공유해 주세요 🎉");
            }
        } catch (err) {
            console.error("[createFamily]", err);
            showNotif("가족 생성 실패: " + (err.message || ""), "error");
        }
    };

    const handleJoinAsParent = async (code) => {
        if (!authUser || !code.trim()) return;
        try {
            await joinFamilyAsParent(code.trim(), authUser.id, authUser.user_metadata?.name || "부모");
            const fam = await getMyFamily(authUser.id);
            if (fam) {
                setFamilyInfo(fam);
                setMyRole(fam.myRole);
                setShowParentSetup(false);
                showNotif("가족에 합류했어요! 🎉");
            }
        } catch (err) {
            console.error("[joinAsParent]", err);
            showNotif("합류 실패: 코드를 확인해주세요", "error");
        }
    };

    useEffect(() => {
        // Show pairing modal if parent is logged in but no other family members exist
        if (familyInfo?.myRole === "parent" && familyInfo?.members?.length === 1) {
            setShowPairing(true);
        }
    }, [familyInfo]);

    // ── Render ─────────────────────────────────────────────────────────────────
    if (authLoading) return (
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#FFF0F7,#E8F4FD)", fontFamily: FF }}>
            <div style={{ textAlign: "center" }}>
                <BunnyMascot size={80} />
                <div style={{ fontSize: 20, fontWeight: 900, color: "#E879A0", marginTop: 16 }}>혜니캘린더</div>
                <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 8 }}>로딩 중...</div>
            </div>
        </div>
    );

    // Auth guard: if role exists but no session, force re-login
    if (!myRole || (!authUser && !authLoading)) return <RoleSetupModal onSelect={r => { if (r === "child") handleChildSelect(); }} loading={authLoading} />;

    // ── Parent first login: choose "새 가족 만들기" or "기존 가족 합류" ────────
    if (showParentSetup && !familyInfo) return (
        <ParentSetupScreen onCreateFamily={handleCreateFamily} onJoinAsParent={handleJoinAsParent} />
    );

    if (showAcademyMgr) return (
        <AcademyManager academies={academies} currentPos={childPos}
            onSave={async (newList) => {
                // Diff old vs new to determine DB operations
                const oldMap = new Map(academies.filter(a => a.id).map(a => [a.id, a]));
                const newMap = new Map(newList.filter(a => a.id).map(a => [a.id, a]));

                // Deleted: in old but not in new
                for (const [id] of oldMap) {
                    if (!newMap.has(id)) {
                        try { await dbDeleteAcademy(id); } catch (e) { console.error("[academy] delete error:", e); }
                    }
                }

                // New items (no id) → generate UUID and insert
                const finalList = [];
                for (const a of newList) {
                    if (!a.id) {
                        const ac = { ...a, id: generateUUID() };
                        finalList.push(ac);
                        if (familyId) {
                            try { await insertAcademy(ac, familyId); } catch (e) { console.error("[academy] insert error:", e); }
                        }
                    } else if (!oldMap.has(a.id)) {
                        // Has id but wasn't in old list (shouldn't happen, but handle)
                        finalList.push(a);
                        if (familyId) {
                            try { await insertAcademy(a, familyId); } catch (e) { console.error("[academy] insert error:", e); }
                        }
                    } else {
                        // Existing item — check for updates
                        finalList.push(a);
                        const old = oldMap.get(a.id);
                        if (old && (old.name !== a.name || old.emoji !== a.emoji || old.category !== a.category || JSON.stringify(old.location) !== JSON.stringify(a.location) || JSON.stringify(old.schedule) !== JSON.stringify(a.schedule))) {
                            try { await updateAcademy(a.id, { name: a.name, emoji: a.emoji, category: a.category, location: a.location || null, schedule: a.schedule || null }); } catch (e) { console.error("[academy] update error:", e); }
                        }
                    }
                }

                // Auto-generate events for academies with schedule (4 weeks ahead)
                if (familyId && authUser) {
                    const today = new Date();
                    const newEvents = {};
                    for (const ac of finalList) {
                        if (!ac.schedule?.days?.length || !ac.schedule.startTime) continue;
                        const cat = CATEGORIES.find(c => c.id === ac.category);
                        for (let d = 0; d < 28; d++) {
                            const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
                            if (!ac.schedule.days.includes(date.getDay())) continue;
                            const dk = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                            const existing = events[dk] || [];
                            const alreadyExists = existing.some(e => e.title === ac.name && e.time === ac.schedule.startTime);
                            if (alreadyExists) continue;
                            const ev = { id: generateUUID(), title: ac.name, time: ac.schedule.startTime, category: ac.category, emoji: ac.emoji, color: cat?.color || "#A78BFA", bg: cat?.bg || "#EDE9FE", memo: ac.schedule.endTime ? `~${ac.schedule.endTime}` : "", location: ac.location || null, notifOverride: null };
                            if (!newEvents[dk]) newEvents[dk] = [];
                            newEvents[dk].push(ev);
                            try { await insertEvent(ev, familyId, dk, authUser.id); } catch (e) { console.error("[academy-event]", e); }
                        }
                    }
                    if (Object.keys(newEvents).length > 0) {
                        setEvents(prev => {
                            const updated = { ...prev };
                            for (const [dk, evs] of Object.entries(newEvents)) {
                                updated[dk] = [...(updated[dk] || []), ...evs].sort((a, b) => a.time.localeCompare(b.time));
                            }
                            return updated;
                        });
                    }
                }

                setAcademies(finalList);
                cacheAcademies(finalList);
                showNotif("🏫 학원 목록이 저장됐어요!");
            }}
            onClose={() => setShowAcademyMgr(false)} />
    );

    return (
        <div style={{ minHeight: "100dvh", background: "linear-gradient(135deg,#FFF0F7 0%,#E8F4FD 50%,#FFF8E7 100%)", fontFamily: FF, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)", position: "relative", overflow: "hidden", width: "100%", boxSizing: "border-box" }}>
            <style>{`
        *,*::before,*::after{box-sizing:border-box}
        html,body,#root{margin:0;padding:0;width:100%;min-height:100vh}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-16px)}70%{transform:translateY(-8px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
        @keyframes slideDown{from{transform:translateX(-50%) translateY(-20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        @keyframes slideDownFull{from{transform:translateY(-30px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes slideUpCard{from{transform:translateX(-50%) translateY(40px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        @keyframes shrinkBar{from{width:100%}to{width:0%}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes emergencyPulse{0%{transform:scale(0.9);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes shake{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
        @media(hover:hover){button:hover{transform:scale(1.03)!important}}
        button:active{transform:scale(0.97)!important}
        input:focus,textarea:focus{border-color:#F9A8D4!important}
        ::-webkit-scrollbar{display:none}
        *{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}
      `}</style>


            {/* Toast */}
            {notification && (
                <div style={{
                    position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
                    background: notification.type === "error" ? "#FEE2E2" : notification.type === "child" ? "#EDE9FE" : notification.type === "parent" ? "#DBEAFE" : "#D1FAE5",
                    color: notification.type === "error" ? "#DC2626" : notification.type === "child" ? "#6D28D9" : notification.type === "parent" ? "#1D4ED8" : "#065F46",
                    borderRadius: 20, padding: "12px 20px", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 250, maxWidth: "calc(100vw - 32px)", textAlign: "center", animation: "slideDown 0.3s ease", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                    {notification.msg}
                </div>
            )}

            {/* AI Alert Panel (parent only) */}
            {showAlertPanel && isParent && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 500, fontFamily: FF, paddingTop: 60 }}
                    onClick={e => { if (e.target === e.currentTarget) setShowAlertPanel(false); }}>
                    <div style={{ background: "white", borderRadius: 24, width: "92%", maxWidth: 420, maxHeight: "75vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
                        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 900, color: "#1F2937" }}>🤖 AI 알림</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>아이 활동 분석 리포트</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, color: aiEnabled ? "#10B981" : "#9CA3AF" }}>
                                    <input type="checkbox" checked={aiEnabled} onChange={e => toggleAiEnabled(e.target.checked)}
                                        style={{ width: 14, height: 14, accentColor: "#10B981" }} />
                                    AI {aiEnabled ? "ON" : "OFF"}
                                </label>
                                <button onClick={() => setShowAlertPanel(false)}
                                    style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>×</button>
                            </div>
                        </div>
                        <div style={{ overflowY: "auto", maxHeight: "calc(75vh - 80px)", padding: "12px 16px" }}>
                            {!aiEnabled && (
                                <div style={{ textAlign: "center", padding: "30px 20px", color: "#9CA3AF" }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>AI 기능이 꺼져 있어요</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>위 토글을 켜면 아이 활동을 AI가 분석합니다</div>
                                </div>
                            )}
                            {aiEnabled && parentAlerts.length === 0 && (
                                <div style={{ textAlign: "center", padding: "30px 20px", color: "#9CA3AF" }}>
                                    <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>아직 알림이 없어요</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>아이가 일정 장소에 도착/출발하면 AI가 알려드려요</div>
                                </div>
                            )}
                            {aiEnabled && parentAlerts.map(alert => {
                                const severityColors = {
                                    urgent: { bg: "#FEE2E2", border: "#EF4444", icon: "🚨" },
                                    warning: { bg: "#FEF3C7", border: "#F59E0B", icon: "⚠️" },
                                    info: { bg: "#DBEAFE", border: "#3B82F6", icon: "ℹ️" },
                                };
                                const sc = severityColors[alert.severity] || severityColors.info;
                                const timeAgo = (() => {
                                    const diff = Date.now() - new Date(alert.created_at).getTime();
                                    const m = Math.floor(diff / 60000);
                                    if (m < 1) return "방금";
                                    if (m < 60) return `${m}분 전`;
                                    const h = Math.floor(m / 60);
                                    if (h < 24) return `${h}시간 전`;
                                    return `${Math.floor(h / 24)}일 전`;
                                })();
                                return (
                                    <div key={alert.id}
                                        onClick={async () => { if (!alert.read) { await markAlertRead(alert.id); setParentAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, read: true } : a)); } }}
                                        style={{ background: alert.read ? "#F9FAFB" : sc.bg, borderLeft: `4px solid ${sc.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10, cursor: "pointer", opacity: alert.read ? 0.7 : 1 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: "#1F2937" }}>
                                                {alert.title.startsWith("🤖") ? "" : sc.icon + " "}{alert.title}
                                            </div>
                                            <div style={{ fontSize: 10, color: "#9CA3AF" }}>{timeAgo}</div>
                                        </div>
                                        <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5 }}>{alert.message}</div>
                                        {!alert.read && <div style={{ fontSize: 9, color: sc.border, fontWeight: 700, marginTop: 4 }}>탭하여 읽음 표시</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Voice preview card */}
            {voicePreview && (
                <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 260, width: "calc(100% - 32px)", maxWidth: 400, animation: "slideUpCard 0.35s cubic-bezier(.34,1.56,.64,1)" }}>
                    <div style={{ background: "white", borderRadius: 24, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
                        <div style={{ height: 4, background: "#10B981", animation: "shrinkBar 8s linear forwards" }} />
                        <div style={{ padding: "16px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#10B981", background: "#D1FAE5", padding: "4px 10px", borderRadius: 8 }}>{voicePreview.aiParsed ? "🤖 AI 저장 완료" : "🎤 음성 저장 완료"}</div>
                                {voicePreview.academyMatched && <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "4px 10px", borderRadius: 8 }}>🏫 학원 자동 매칭</div>}
                                <div style={{ fontSize: 11, color: "#9CA3AF", flex: 1, textAlign: "right" }}>8초 후 닫힘</div>
                            </div>
                            <div style={{ background: voicePreview.ev.bg, borderRadius: 16, padding: "12px 14px", borderLeft: `4px solid ${voicePreview.ev.color}`, marginBottom: 12 }}>
                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <div style={{ fontSize: 26 }}>{voicePreview.ev.emoji}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 800, fontSize: 15, color: "#1F2937" }}>{voicePreview.ev.title}</div>
                                        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>📅 {voicePreview.dateLabel} &nbsp;⏰ {voicePreview.ev.time}</div>
                                        {voicePreview.ev.location && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>📍 {voicePreview.ev.location.address?.split(" ").slice(0, 3).join(" ")}</div>}
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 12, padding: "6px 10px", background: "#F9FAFB", borderRadius: 8 }}>🎙 인식: "{voicePreview.rawText}"</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => { setVoicePreview(null); setCurrentYear(parseInt(voicePreview.dateKey.split("-")[0])); setCurrentMonth(parseInt(voicePreview.dateKey.split("-")[1])); setSelectedDate(parseInt(voicePreview.dateKey.split("-")[2])); setActiveView("calendar"); }}
                                    style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#10B981,#059669)", color: "white", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>✅ 달력에서 보기</button>
                                <button onClick={() => { setVoicePreview(null); setNewTitle(voicePreview.ev.title); setNewTime(voicePreview.ev.time); setNewCategory(voicePreview.ev.category); setNewLocation(voicePreview.ev.location); setEvents(prev => ({ ...prev, [voicePreview.dateKey]: (prev[voicePreview.dateKey] || []).filter(e => e.id !== voicePreview.ev.id) })); setShowAddModal(true); }}
                                    style={{ flex: 1, padding: "11px", background: "#EDE9FE", color: "#7C3AED", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>✏️ 수정</button>
                                <button onClick={undoVoiceEvent} style={{ padding: "11px 14px", background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF }}>↩</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AlertBanner alerts={alerts} onDismiss={id => setAlerts(p => p.filter(a => a.id !== id))} />
            <EmergencyBanner emergencies={emergencies} onDismiss={(id, action) => { setEmergencies(p => p.filter(e => e.id !== id)); if (action === "contact") showNotif("📞 전화 앱을 열어주세요", "child"); }} />

            {/* ── Push notification permission banner ── */}
            {isNativeApp && !isParent && nativeSetupAction && (
                <div style={{ width: "100%", maxWidth: 420, marginBottom: 8, padding: "12px 14px", borderRadius: 18, background: "linear-gradient(135deg, #FFF7ED, #FEF3C7)", border: "1px solid #FCD34D", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(245,158,11,0.12)" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🔔</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#9A3412" }}>앱이 꺼져도 알림이 바로 보이도록 설정이 더 필요해요</div>
                        <div style={{ fontSize: 11, color: "#7C2D12", marginTop: 3, lineHeight: 1.45 }}>
                            알림 권한, 전체화면 알림, 배터리 예외, 정확한 알림 중 일부가 아직 꺼져 있어요.
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await openNativeNotificationSettings(nativeSetupAction.target);
                        }}
                        style={{ padding: "9px 13px", borderRadius: 12, background: "#EA580C", color: "white", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(234,88,12,0.2)" }}
                    >
                        {nativeSetupAction.label}
                    </button>
                </div>
            )}
            {!isNativeApp && pushPermission !== "granted" && pushPermission !== "unsupported" && pushPermission !== "denied" && (
                <div style={{ width: "100%", maxWidth: 420, marginBottom: 8, padding: "10px 14px", borderRadius: 14, background: "linear-gradient(135deg, #DBEAFE, #EDE9FE)", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🔔</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>푸시 알림을 켜주세요!</div>
                        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>일정 시작 전 알림을 받을 수 있어요</div>
                    </div>
                    <button onClick={async () => {
                        const result = await requestPermission();
                        setPushPermission(result);
                        if (result === "granted") {
                            showNotif("푸시 알림이 켜졌어요!");
                            scheduleNotifications(events, globalNotif, myRole);
                            scheduleNativeAlarms(events, globalNotif, myRole);
                            if (authUser?.id && familyId) {
                                subscribeToPush(authUser.id, familyId);
                            }
                        } else if (result === "denied") {
                            showNotif("알림이 차단되었어요. 브라우저 설정에서 허용해주세요.", "error");
                        }
                    }}
                        style={{ padding: "8px 14px", borderRadius: 10, background: "#3B82F6", color: "white", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: FF, whiteSpace: "nowrap" }}>
                        허용하기
                    </button>
                </div>
            )}
            {!isNativeApp && pushPermission === "denied" && (
                <div style={{ width: "100%", maxWidth: 420, marginBottom: 8, padding: "8px 14px", borderRadius: 14, background: "#FEF3C7", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🔕</span>
                    <div style={{ fontSize: 11, color: "#92400E", fontWeight: 600 }}>푸시 알림이 차단됨 — 브라우저 설정에서 이 사이트의 알림을 허용해주세요</div>
                </div>
            )}

            {/* ── Header Row 1: Logo + 꾹 + 로그아웃 ── */}
            <div style={{ width: "100%", maxWidth: 420, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ animation: bounce ? "bounce 0.4s ease" : "float 3s ease-in-out infinite", cursor: "pointer", flexShrink: 0 }} onClick={() => { setBounce(true); setTimeout(() => setBounce(false), 800); showNotif("안녕! 나는 뽀짝이야 🐰"); }}>
                        <BunnyMascot size={isParent ? 36 : 44} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div onClick={() => setActiveView("calendar")} style={{ fontSize: isParent ? 16 : 18, fontWeight: 900, color: "#E879A0", letterSpacing: -0.5, whiteSpace: "nowrap", cursor: "pointer" }}>혜니캘린더</div>
                            {isParent && (
                                <span onClick={() => { if (window.confirm("역할을 다시 선택할까요?")) { setMyRole(null); setFamilyInfo(null); } }}
                                    style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, fontWeight: 700, cursor: "pointer", background: "#DBEAFE", color: "#1D4ED8", whiteSpace: "nowrap", flexShrink: 0 }}>
                                    학부모
                                </span>
                            )}
                        </div>
                        {isParent && (
                            <button onClick={() => setShowPairing(true)}
                                style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 5, border: "none", cursor: "pointer", fontFamily: FF, background: pairedChildren.length > 0 ? "#D1FAE5" : "#FEF3C7", color: pairedChildren.length > 0 ? "#065F46" : "#92400E", marginTop: 1, whiteSpace: "nowrap" }}>
                                {pairedChildren.length > 0 ? `🔗 연동 (${pairedChildren.length}명)` : "🔗 연동하기"}
                            </button>
                        )}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                    {isParent && (
                        <button onClick={() => { setShowAlertPanel(true); loadParentAlerts(); }}
                            style={{ position: "relative", fontSize: 18, padding: "6px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: "#F3F4F6", lineHeight: 1 }}>
                            🔔
                            {parentAlerts.filter(a => !a.read).length > 0 && (
                                <span style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "#EF4444", color: "white", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {Math.min(parentAlerts.filter(a => !a.read).length, 9)}
                                </span>
                            )}
                        </button>
                    )}
                    <button onClick={sendKkuk} disabled={kkukCooldown}
                        style={{
                            fontSize: isParent ? 13 : 15, padding: isParent ? "8px 14px" : "10px 18px", borderRadius: 16, border: "none", cursor: kkukCooldown ? "default" : "pointer",
                            fontWeight: 900, fontFamily: FF, whiteSpace: "nowrap",
                            background: kkukCooldown ? "#E5E7EB" : "linear-gradient(135deg, #FF6B9D, #FF4081)",
                            color: "white", boxShadow: kkukCooldown ? "none" : "0 3px 12px rgba(255,64,129,0.4)",
                            transition: "all 0.2s", transform: kkukCooldown ? "scale(0.95)" : "scale(1)",
                        }}>
                        💗 꾹
                    </button>
                    {isParent && (
                        <button onClick={async () => {
                            if (!window.confirm("로그아웃 하시겠어요?")) return;
                            try {
                                await stopNativeLocationService();
                                await unsubscribeFromPush();
                                await logout();
                                setMyRole(null);
                                setFamilyInfo(null);
                                setAuthUser(null);
                                setEvents({});
                                setAcademies([]);
                                setMemos({});
                                setParentPhones({ mom: "", dad: "" });
                                showNotif("로그아웃 되었어요");
                            } catch (err) {
                                console.error("[logout]", err);
                                showNotif("로그아웃 실패");
                            }
                        }}
                            style={{ fontSize: 10, padding: "6px 8px", borderRadius: 8, background: "#F3F4F6", color: "#9CA3AF", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: FF, whiteSpace: "nowrap" }}>
                            로그아웃
                        </button>
                    )}
                </div>
            </div>

            {/* ── Header Row 2: Quick action buttons ── */}
            <div style={{ width: "100%", maxWidth: 420, display: "flex", gap: isParent ? 6 : 10, marginBottom: 10, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {activeView !== "calendar" && (
                    <button onClick={() => setActiveView("calendar")}
                        style={{ fontSize: isParent ? 11 : 13, padding: isParent ? "7px 12px" : "10px 16px", borderRadius: isParent ? 12 : 16, background: "linear-gradient(135deg,#FFF0F7,#FCE7F3)", color: "#E879A0", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        🏠 홈
                    </button>
                )}
                {isParent && (
                    <button onClick={() => setShowChildTracker(true)}
                        style={{ fontSize: 11, padding: "7px 12px", borderRadius: 12, background: "#DBEAFE", color: "#1D4ED8", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        📍 우리아이
                    </button>
                )}
                {isParent && (
                    <button onClick={() => setShowAcademyMgr(true)}
                        style={{ fontSize: 11, padding: "7px 12px", borderRadius: 12, background: "#FEF3C7", color: "#92400E", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        🏫 학원관리
                    </button>
                )}
                <button onClick={() => {
                        setShowStickerBook(true);
                        if (familyId) {
                            fetchStickersForDate(familyId, dateKey).then(s => setStickers(s));
                            fetchStickerSummary(familyId).then(s => setStickerSummary(s?.[0] || null));
                        }
                    }}
                    style={{ fontSize: isParent ? 11 : 13, padding: isParent ? "7px 12px" : "10px 16px", borderRadius: isParent ? 12 : 16, background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", color: "#92400E", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                    🏆 스티커
                </button>
                {isParent && (
                    <button onClick={() => setShowPhoneSettings(true)}
                        style={{ fontSize: 11, padding: "7px 12px", borderRadius: 12, background: "#FCE7F3", color: "#BE185D", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        📞 연락처
                    </button>
                )}
                {isParent && (
                    <button onClick={() => setIsRecordingAudio(true)}
                        style={{ fontSize: 11, padding: "7px 12px", borderRadius: 12, background: "#FEE2E2", color: "#DC2626", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0 }}>
                        🎙️ 주변소리
                    </button>
                )}
                {TABS.map(([v, l]) => (
                    <button key={v} onClick={() => setActiveView(v)}
                        style={{
                            padding: isParent ? "7px 14px" : "10px 16px", borderRadius: isParent ? 12 : 16, border: "none", cursor: "pointer", fontWeight: 700, fontSize: isParent ? 11 : 13, fontFamily: FF, whiteSpace: "nowrap", flexShrink: 0,
                            background: activeView === v ? "linear-gradient(135deg,#E879A0,#BE185D)" : "#F9FAFB", color: activeView === v ? "white" : "#6B7280",
                            boxShadow: activeView === v ? "0 3px 12px rgba(232,121,160,0.3)" : "0 1px 4px rgba(0,0,0,0.06)"
                        }}>
                        {l}
                    </button>
                ))}
            </div>

            {/* ── CALENDAR VIEW ── */}
            {activeView === "calendar" && <>
                <div style={cardSt}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: "50%", background: "#FFF0F7", border: "none", fontSize: 18, cursor: "pointer", color: "#E879A0", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#374151" }}>{currentYear}년 {MONTHS_KO[currentMonth]}</div>
                        <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: "50%", background: "#FFF0F7", border: "none", fontSize: 18, cursor: "pointer", color: "#E879A0", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                        {DAYS_KO.map((d, i) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, padding: "4px 0", color: i === 0 ? "#F87171" : i === 6 ? "#60A5FA" : "#9CA3AF" }}>{d}</div>)}
                        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                        {Array(getDays).fill(null).map((_, i) => {
                            const day = i + 1, isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                            const isSel = day === selectedDate, isSun = (firstDay + i) % 7 === 0, isSat = (firstDay + i) % 7 === 6;
                            const dayEvs = getEvs(day);
                            return (
                                <div key={day} onClick={() => setSelectedDate(day)}
                                    style={{
                                        aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 14, cursor: "pointer", transition: "all 0.15s",
                                        background: isSel ? "#E879A0" : isToday ? "#FFF0F7" : "transparent", border: isToday && !isSel ? "2px solid #F9A8D4" : "2px solid transparent"
                                    }}>
                                    <span style={{ fontSize: 16, fontWeight: isSel ? 800 : 600, color: isSel ? "white" : isSun ? "#F87171" : isSat ? "#60A5FA" : "#374151" }}>{day}</span>
                                    {dayEvs.length > 0 && <div style={{ display: "flex", gap: 3, marginTop: 2 }}>{dayEvs.slice(0, 3).map(e => <div key={e.id} style={{ width: 6, height: 6, borderRadius: "50%", background: isSel ? "rgba(255,255,255,0.8)" : e.color }} />)}</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Academy quick pick */}
                {academies.length > 0 && (
                    <div style={{ width: "100%", maxWidth: 420, marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, paddingLeft: 4 }}>🏫 학원 빠른 추가</div>
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                            {academies.map((ac, i) => (
                                <button key={i} onClick={() => {
                                    const cat = CATEGORIES.find(c => c.id === ac.category);
                                    const _ev = { id: Date.now(), title: ac.name, time: "15:00", category: ac.category, emoji: ac.emoji || cat.emoji, color: ac.color || cat.color, bg: ac.bg || cat.bg, memo: "", location: ac.location || null, notifOverride: null };
                                    setNewTitle(ac.name); setNewCategory(ac.category); setNewLocation(ac.location || null);
                                    setShowAddModal(true);
                                }}
                                    style={{ flexShrink: 0, padding: "9px 14px", borderRadius: 16, border: `2px solid ${ac.color || "#E5E7EB"}`, background: ac.bg || "white", color: ac.color || "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>{ac.emoji}</span><span>{ac.name}</span>
                                    {ac.location && <span style={{ fontSize: 10, opacity: 0.7 }}>📍</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Voice + Add */}
                <div style={{ width: "100%", maxWidth: 420, display: "flex", gap: 8, marginBottom: 14 }}>
                    <button onClick={startVoice}
                        style={{
                            flex: 1, padding: "10px 16px", height: 44, color: "white", border: "none", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: FF,
                            background: listening ? "#E879A0" : "linear-gradient(135deg,#F9A8D4,#E879A0)", animation: listening ? "pulse 1s infinite" : "none", boxShadow: "0 3px 12px rgba(232,121,160,0.25)"
                        }}>
                        {listening ? "🎤 듣는 중..." : "🎤 음성으로 일정등록"}
                    </button>
                    <button onClick={() => setShowAddModal(true)}
                        style={{ minWidth: isParent ? 44 : 56, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#A78BFA,#7C3AED)", color: "white", border: "none", fontSize: isParent ? 22 : 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 12px rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: FF, gap: 2, padding: isParent ? 0 : "0 12px" }}>{isParent ? "+" : "✏️ 추가"}</button>
                </div>

                {/* Day Timetable */}
                <div style={{ ...cardSt, marginBottom: 0 }}>
                    <DayTimetable
                        events={selectedEvs}
                        dateLabel={`${currentMonth + 1}월 ${selectedDate}일`}
                        childPos={childPos}
                        mapReady={mapReady}
                        stickers={stickers}
                        arrivedSet={arrivedSet}
                        firedEmergencies={firedEmergencies}
                        onRoute={ev => setRouteEvent(ev)}
                        onDelete={handleDeleteEvent}
                        onEditLoc={id => { setEditingLocForEvent(id); setShowMapPicker(true); }}
                        isParentMode={isParent}
                        memoValue={memos[dateKey] || ""}
                        onMemoChange={val => {
                            setMemos(prev => ({ ...prev, [dateKey]: val }));
                            memoDirty.current = true;
                            memoLastValue.current = val;
                            // Save to DB quickly (500ms debounce)
                            if (memoSaveTimer.current) clearTimeout(memoSaveTimer.current);
                            memoSaveTimer.current = setTimeout(() => {
                                if (familyId) {
                                    upsertMemo(familyId, dateKey, val).catch(err => console.error("[memo save]", err));
                                    cacheMemos({ ...memos, [dateKey]: val });
                                }
                            }, 500);
                        }}
                        onMemoBlur={() => {
                            if (memoDirty.current && familyId && memoLastValue.current.trim()) {
                                memoDirty.current = false;
                                if (memoSaveTimer.current) { clearTimeout(memoSaveTimer.current); memoSaveTimer.current = null; }
                                upsertMemo(familyId, dateKey, memoLastValue.current).catch(err => console.error("[memo save]", err));
                                if (authUser) {
                                    sendInstantPush({
                                        action: "new_memo",
                                        familyId,
                                        senderUserId: authUser.id,
                                        title: `📒 ${myRole === "parent" ? "부모님" : "아이"}이 메모를 남겼어요`,
                                        message: memoLastValue.current.length > 50 ? memoLastValue.current.substring(0, 50) + "..." : memoLastValue.current,
                                    });
                                }
                            }
                        }}
                        onMemoSend={() => {
                            if (familyId && authUser && memoLastValue.current.trim()) {
                                memoDirty.current = false;
                                if (memoSaveTimer.current) { clearTimeout(memoSaveTimer.current); memoSaveTimer.current = null; }
                                upsertMemo(familyId, dateKey, memoLastValue.current).catch(err => console.error("[memo save]", err));
                                sendInstantPush({
                                    action: "new_memo",
                                    familyId,
                                    senderUserId: authUser.id,
                                    title: `📒 ${myRole === "parent" ? "부모님" : "아이"}이 메모를 남겼어요`,
                                    message: memoLastValue.current.length > 50 ? memoLastValue.current.substring(0, 50) + "..." : memoLastValue.current,
                                });
                                if (myRole === "child" && aiEnabled) {
                                    const evForMemo = selectedEvs[0];
                                    analyzeMemoSentiment(memoLastValue.current, evForMemo?.title);
                                }
                            }
                        }}
                        memoReplies={memoReplies}
                        onReplySubmit={content => {
                            if (!familyId || !authUser) return;
                            // Optimistic update - show immediately
                            const optimisticReply = { id: "temp-" + Date.now(), user_id: authUser.id, user_role: myRole, content, created_at: new Date().toISOString() };
                            setMemoReplies(prev => [...(prev || []), optimisticReply]);
                            // Ensure memo exists first, then insert reply
                            const ensureMemo = memos[dateKey]?.trim() ? Promise.resolve() : upsertMemo(familyId, dateKey, "💬");
                            ensureMemo.then(() => insertMemoReply(familyId, dateKey, authUser.id, myRole, content))
                                .then(() => fetchMemoReplies(familyId, dateKey).then(setMemoReplies))
                                .catch(err => console.error("[reply]", err));
                            if (!memos[dateKey]?.trim()) setMemos(prev => ({ ...prev, [dateKey]: "💬" }));
                            sendInstantPush({
                                action: "new_memo",
                                familyId,
                                senderUserId: authUser.id,
                                title: `💬 ${myRole === "parent" ? "부모님" : "아이"}이 답글을 남겼어요`,
                                message: content.length > 50 ? content.substring(0, 50) + "..." : content,
                            });
                        }}
                        memoReadBy={memoReadBy}
                        myUserId={authUser?.id}
                    />
                </div>
            </>}

            {/* ── MAP LIST VIEW ── */}
            {activeView === "maplist" && <LocationMapView
                events={events} childPos={childPos} mapReady={mapReady}
                arrivedSet={arrivedSet} />}

            {/* ── ADD MODAL ── */}
            {showAddModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }} onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
                    <div style={{ background: "white", borderRadius: "28px 28px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 460, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#374151", marginBottom: 4 }}>✨ 새 일정 추가</div>
                        {isParent && pairedChildren.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", borderRadius: 10, padding: "6px 12px", marginBottom: 14, display: "inline-block" }}>📡 저장 시 {pairedChildren.map(c => c.name).join(", ")}에게 자동 전송</div>}

                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>⚡ 빠른 선택</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {SCHEDULE_PRESETS.map(p => {
                                    const active = selectedPreset?.label === p.label;
                                    return (
                                        <button key={p.label} onClick={() => {
                                            setSelectedPreset(p);
                                            setNewCategory(p.category);
                                            const last = findLastEventByTitle(p.label);
                                            if (last) { setNewTime(last.time); if (last.location) setNewLocation(last.location); }
                                        }}
                                            style={{ padding: "6px 12px", borderRadius: 16, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, border: active ? "2px solid #E879A0" : "2px solid #F3F4F6", background: active ? "#FFF0F7" : "#F9FAFB", color: active ? "#E879A0" : "#6B7280", transition: "all 0.15s" }}>
                                            {p.emoji} {p.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>📌 일정 이름 {selectedPreset && <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>(비워두면 "{selectedPreset.label}")</span>}</label>
                            <input style={inputSt} placeholder={selectedPreset ? `${selectedPreset.emoji} ${selectedPreset.label}` : "예) 영어 학원, 태권도..."} value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>⏰ 시간 {selectedPreset && findLastEventByTitle(selectedPreset.label) && <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>(지난번 시간)</span>}</label>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ padding: "12px 14px", border: "2px solid #F3F4F6", borderRadius: 14, fontSize: 15, fontFamily: FF, outline: "none", flex: 1 }} />
                                <div style={{ display: "flex", gap: 4 }}>
                                    <button onClick={() => { const [h, m] = newTime.split(":").map(Number); const nh = m > 0 ? h : Math.max(0, h - 1); const nm = m > 0 ? 0 : 30; setNewTime(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`); }}
                                        style={{ width: 36, height: 36, borderRadius: 10, border: "2px solid #F3F4F6", background: "#FAFAFA", cursor: "pointer", fontWeight: 800, fontSize: 16, fontFamily: FF, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                                    <button onClick={() => { const [h, m] = newTime.split(":").map(Number); const nm = m >= 30 ? 0 : 30; const nh = m >= 30 ? Math.min(23, h + 1) : h; setNewTime(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`); }}
                                        style={{ width: 36, height: 36, borderRadius: 10, border: "2px solid #F3F4F6", background: "#FAFAFA", cursor: "pointer", fontWeight: 800, fontSize: 16, fontFamily: FF, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {["13:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "18:00"].map(t => (
                                    <button key={t} onClick={() => setNewTime(t)}
                                        style={{ padding: "5px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FF, border: newTime === t ? "2px solid #E879A0" : "1.5px solid #F3F4F6", background: newTime === t ? "#FFF0F7" : "#FAFAFA", color: newTime === t ? "#E879A0" : "#9CA3AF", transition: "all 0.15s" }}>
                                        {parseInt(t) > 12 ? `오후 ${parseInt(t) - 12}` : `오전 ${parseInt(t)}`}:{t.split(":")[1]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={labelSt}>🏷️ 종류 {selectedPreset && <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>(자동 매칭됨)</span>}</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {CATEGORIES.map(cat => <button key={cat.id} onClick={() => setNewCategory(cat.id)} style={{ padding: "8px 14px", borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FF, background: newCategory === cat.id ? cat.color : cat.bg, color: newCategory === cat.id ? "white" : cat.color, border: `2px solid ${cat.color}` }}>{cat.emoji} {cat.label}</button>)}
                            </div>
                        </div>
                        {isParent && (
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelSt}>📍 학원/장소 위치 {newLocation && <span style={{ fontSize: 11, color: "#059669", fontWeight: 500 }}>(다음에도 자동 적용)</span>}</label>
                                {newLocation ? (
                                    <div style={{ background: "#FFF0F7", borderRadius: 14, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                        <div style={{ fontSize: 13, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {newLocation.address}</div>
                                        <button onClick={() => { setEditingLocForEvent(null); setShowMapPicker(true); }} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 10, background: "white", border: "1.5px solid #E879A0", color: "#E879A0", cursor: "pointer", fontWeight: 700, fontFamily: FF, flexShrink: 0 }}>변경</button>
                                    </div>
                                ) : (
                                    <button onClick={() => { setEditingLocForEvent(null); setShowMapPicker(true); }} style={{ width: "100%", padding: "12px 14px", border: "2px dashed #F9A8D4", borderRadius: 14, background: "#FFF0F7", color: "#E879A0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>🗺️ 지도에서 장소 선택</button>
                                )}
                            </div>
                        )}
                        <div style={{ marginBottom: 14 }}><label style={labelSt}>📝 메모 (선택)</label><input style={inputSt} placeholder="준비물, 장소 등..." value={newMemo} onChange={e => setNewMemo(e.target.value)} /></div>
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <label style={{ ...labelSt, marginBottom: 0, flex: 1 }}>🔁 매주 같은 날에 반복</label>
                                <div onClick={() => setWeeklyRepeat(p => !p)} style={{ width: 52, height: 30, borderRadius: 15, background: weeklyRepeat ? "#E879A0" : "#E5E7EB", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                                    <div style={{ width: 24, height: 24, borderRadius: 12, background: "white", position: "absolute", top: 3, left: weeklyRepeat ? 25 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                                </div>
                            </div>
                            {weeklyRepeat && (
                                <>
                                    <div style={{ display: "flex", gap: 6, animation: "kkukFadeIn 0.2s ease", marginBottom: 8 }}>
                                        {[{ w: 4, label: "📅 1개월" }, { w: 8, label: "📅 2개월" }, { w: 12, label: "📅 3개월" }].map(({ w, label }) => (
                                            <button key={w} onClick={() => setRepeatWeeks(w)}
                                                style={{ flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FF, border: repeatWeeks === w ? "2px solid #E879A0" : "2px solid #F3F4F6", background: repeatWeeks === w ? "#FFF0F7" : "#F9FAFB", color: repeatWeeks === w ? "#E879A0" : "#6B7280", transition: "all 0.15s" }}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, textAlign: "center" }}>
                                        {(() => { const [y, m, d] = dateKey.split("-").map(Number); const end = new Date(y, m, d + (repeatWeeks - 1) * 7); return `${m + 1}/${d} ~ ${end.getMonth() + 1}/${end.getDate()} 매주 ${["일","월","화","수","목","금","토"][new Date(y, m, d).getDay()]}요일`; })()}
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={addEvent} style={primBtn}>{weeklyRepeat ? `🐰 앞으로 ${repeatWeeks === 4 ? "1개월" : repeatWeeks === 8 ? "2개월" : "3개월"}간 매주 추가!` : "🐰 일정 추가하기!"}</button>
                        <button onClick={() => { setShowAddModal(false); setNewTitle(""); setNewLocation(null); setSelectedPreset(null); setWeeklyRepeat(false); setRepeatWeeks(4); }} style={secBtn}>취소</button>
                    </div>
                </div>
            )}

            {/* Route Overlay */}
            {routeEvent && (
                <RouteOverlay ev={routeEvent} childPos={childPos} mapReady={mapReady} isChildMode={!isParent} onClose={() => setRouteEvent(null)} />
            )}

            {/* Map Picker */}
            {showMapPicker && (
                <MapPicker
                    initial={editingLocForEvent ? Object.values(events).flat().find(e => e.id === editingLocForEvent)?.location : newLocation}
                    currentPos={childPos}
                    onClose={() => setShowMapPicker(false)}
                    onConfirm={loc => { if (editingLocForEvent) updateEvField(editingLocForEvent, "location", loc); else setNewLocation(loc); setShowMapPicker(false); }} />
            )}

            {/* Pairing Modal (only when family exists) */}
            {showPairing && familyId && (
                <PairingModal myRole={familyInfo?.myRole || myRole} pairCode={pairCode} pairedMembers={familyInfo?.members}
                    familyId={familyId}
                    onUnpair={async (childUserId) => {
                        try {
                            await unpairChild(familyId, childUserId);
                            const fam = await getMyFamily(authUser.id);
                            if (fam) setFamilyInfo(fam);
                            showNotif("연동이 해제됐어요");
                        } catch (err) { console.error("[unpair]", err); showNotif("해제 실패", "error"); }
                    }}
                    onClose={() => setShowPairing(false)} />
            )}

            {/* Child pairing input (shown when child first logs in anonymously, no family yet) */}
            {myRole === "child" && authUser && !familyId && (
                <ChildPairInput userId={authUser.id} onPaired={async () => {
                    try {
                        const fam = await getMyFamily(authUser.id);
                        if (fam) {
                            setFamilyInfo(fam);
                            setMyRole(fam.myRole || "child");
                            showNotif("🎉 부모님과 연동됐어요!", "success");
                        } else {
                            showNotif("연동은 됐지만 정보 로딩에 실패했어요. 앱을 다시 열어주세요", "error");
                        }
                    } catch (err) {
                        console.error("[onPaired] getMyFamily failed:", err);
                        showNotif("연동 완료! 앱을 다시 열어주세요", "success");
                        // Force reload to get clean state
                        setTimeout(() => window.location.reload(), 1500);
                    }
                }} />
            )}

            {/* ── Child Tracker (학부모 전용) ── */}
            {showChildTracker && <ChildTrackerOverlay
                childPos={childPos} events={events} mapReady={mapReady}
                arrivedSet={arrivedSet} onClose={() => setShowChildTracker(false)}
            />}

            {/* ── Phone Settings Modal (학부모 전용) ── */}
            {showPhoneSettings && <PhoneSettingsModal
                phones={parentPhones}
                onSave={async (phones) => {
                    setParentPhones(phones);
                    setShowPhoneSettings(false);
                    showNotif("📞 연락처가 저장됐어요!");
                    if (familyId) {
                        try {
                            await saveParentPhones(familyId, phones.mom, phones.dad);
                        } catch (err) {
                            console.error("[savePhones]", err);
                        }
                    }
                }}
                onClose={() => setShowPhoneSettings(false)}
            />}

            {/* ── Child Call Buttons (아이 전용, 화면 우하단 플로팅) ── */}
            {!isParent && <ChildCallButtons phones={parentPhones} />}

            {/* ── Sticker Book Modal ── */}
            {showStickerBook && <StickerBookModal
                stickers={stickers}
                summary={stickerSummary}
                dateLabel={`${currentMonth + 1}월 ${selectedDate}일`}
                onClose={() => setShowStickerBook(false)}
            />}

            {/* ── Audio Recorder Modal (학부모 전용) ── */}
            {isRecordingAudio && <AmbientAudioRecorder
                onRecorded={(blob, _url) => {
                    console.log("[Audio] recorded", blob.size, "bytes");
                }}
                onClose={() => setIsRecordingAudio(false)}
            />}

            {/* ── 꾹 수신 전체화면 오버레이 ── */}
            {showKkukReceived && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    background: "linear-gradient(135deg, #FFF0F5, #FFE4EC, #FFF0F7)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    fontFamily: FF, animation: "kkukFadeIn 0.3s ease"
                }}
                    onClick={() => setShowKkukReceived(null)}>
                    <style>{`
                        @keyframes kkukFadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
                        @keyframes kkukPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
                        @keyframes kkukFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
                    `}</style>
                    <div style={{ animation: "kkukPulse 1.2s ease-in-out infinite", marginBottom: 20 }}>
                        <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
                            <ellipse cx="33" cy="22" rx="9" ry="18" fill="#FFD6E8" />
                            <ellipse cx="67" cy="22" rx="9" ry="18" fill="#FFD6E8" />
                            <ellipse cx="33" cy="22" rx="5" ry="13" fill="#FFB3D1" />
                            <ellipse cx="67" cy="22" rx="5" ry="13" fill="#FFB3D1" />
                            <ellipse cx="50" cy="65" rx="26" ry="22" fill="#FFF0F7" />
                            <circle cx="50" cy="48" r="24" fill="#FFF0F7" />
                            <path d="M38 44 Q40 41 42 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            <path d="M58 44 Q60 41 62 44" stroke="#FF7BAC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                            <ellipse cx="50" cy="51" rx="3" ry="2" fill="#FFB3D1" />
                            <path d="M45 54 Q50 58 55 54" stroke="#FF7BAC" strokeWidth="2" strokeLinecap="round" fill="none" />
                            <circle cx="37" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
                            <circle cx="63" cy="52" r="5" fill="#FFB3D1" opacity="0.5" />
                        </svg>
                    </div>
                    <div style={{ fontSize: 56, marginBottom: 16, animation: "kkukFloat 2s ease-in-out infinite" }}>💗</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#E879A0", marginBottom: 8, textAlign: "center" }}>
                        꾹!
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#BE185D", marginBottom: 32, textAlign: "center" }}>
                        {showKkukReceived.from}가 꾹을 보냈어요
                    </div>
                    <div style={{
                        fontSize: 14, color: "#9CA3AF", padding: "12px 24px",
                        background: "rgba(255,255,255,0.6)", borderRadius: 20, fontWeight: 600,
                    }}>
                        화면을 터치하면 닫혀요
                    </div>
                </div>
            )}

        </div>
    );
}
