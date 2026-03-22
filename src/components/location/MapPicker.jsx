import { useState, useRef, useEffect, useCallback } from "react";
import { loadKakaoMap } from "../../lib/kakaoMaps.js";
import { KAKAO_APP_KEY, FF } from "../../lib/utils.js";
import MapZoomControls from "../common/MapZoomControls.jsx";

export default function MapPicker({ initial, currentPos, title = "\u{1F4CD} 장소 설정", onConfirm, onClose }) {
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
