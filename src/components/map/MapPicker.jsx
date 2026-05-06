// src/components/map/MapPicker.jsx
// Kakao Maps 기반 장소 picker 모달 — 검색·드래그·역지오코딩.
// SDK 로딩 실패 시 FallbackMapCanvas로 우회.
// Extracted from App.jsx (Phase 5 #4 / B5c).

import { useCallback, useEffect, useRef, useState } from "react";
import { DESIGN, FF } from "../../lib/styleHelpers.js";
import { KAKAO_APP_KEY, loadKakaoMap } from "../../lib/kakaoMap.js";
import { FallbackMapCanvas } from "./FallbackMapCanvas.jsx";
import { MapZoomControls } from "./MapZoomControls.jsx";

export function MapPicker({ initial, currentPos, title = "📍 장소 설정", onConfirm, onClose }) {
    const [defaultCenter] = useState(() => initial || currentPos || { lat: 37.5665, lng: 126.9780 });
    const hasPreloadedKakao = typeof window !== "undefined" && !!window.kakao?.maps?.LatLng;
    const mapRef = useRef(), mapObj = useRef(), markerRef = useRef();
    const [pos, setPos] = useState(defaultCenter);
    const [address, setAddress] = useState(defaultCenter?.address || "");
    const [kakaoPlaceId, setKakaoPlaceId] = useState(defaultCenter?.kakao_place_id || null);
    const [loading, setLoading] = useState(() => (hasPreloadedKakao ? false : !!KAKAO_APP_KEY));
    const [err, setErr] = useState(() => (hasPreloadedKakao || KAKAO_APP_KEY ? "" : "카카오 앱 키가 설정되지 않았어요. (.env 파일 확인)"));
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searchMessage, setSearchMessage] = useState("");
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [isClosing, setIsClosing] = useState(false);
    const dragStartYRef = useRef(null);
    const dragOffsetYRef = useRef(0);
    const dragCleanupRef = useRef(null);
    const closeTimerRef = useRef(null);

    const clearDragListeners = useCallback(() => {
        if (typeof dragCleanupRef.current === "function") {
            dragCleanupRef.current();
            dragCleanupRef.current = null;
        }
    }, []);

    const setSheetDragOffset = useCallback((nextOffset) => {
        const safeOffset = Math.max(0, Math.round(nextOffset || 0));
        dragOffsetYRef.current = safeOffset;
        setDragOffsetY(safeOffset);
    }, []);

    const requestClose = useCallback(() => {
        clearDragListeners();
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
        setIsClosing(true);
        closeTimerRef.current = window.setTimeout(() => {
            onClose?.();
        }, 140);
    }, [clearDragListeners, onClose]);

    useEffect(() => () => {
        clearDragListeners();
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    }, [clearDragListeners]);

    const canStartSheetDrag = useCallback((target) => {
        if (!(target instanceof Element)) return false;
        const dragTarget = target.closest(".map-picker-drag-zone, .map-picker-header");
        if (!dragTarget) return false;
        return !target.closest("button, input, textarea, select, a, [role='button']");
    }, []);

    const finishSheetDrag = useCallback(() => {
        const shouldClose = dragOffsetYRef.current >= 120;
        dragStartYRef.current = null;
        clearDragListeners();
        if (shouldClose) {
            requestClose();
            return;
        }
        setSheetDragOffset(0);
    }, [clearDragListeners, requestClose, setSheetDragOffset]);

    const handleDragPointerDown = useCallback((event) => {
        if (!canStartSheetDrag(event.target)) return;
        if (typeof event.button === "number" && event.button !== 0) return;
        event.preventDefault();
        clearDragListeners();
        dragStartYRef.current = event.clientY;
        setSheetDragOffset(0);

        const pointerId = event.pointerId;
        const handlePointerMove = (moveEvent) => {
            if (pointerId !== undefined && moveEvent.pointerId !== pointerId) return;
            moveEvent.preventDefault();
            const startY = dragStartYRef.current;
            if (typeof startY !== "number") return;
            setSheetDragOffset(moveEvent.clientY - startY);
        };
        const handlePointerUp = (upEvent) => {
            if (pointerId !== undefined && upEvent.pointerId !== pointerId) return;
            finishSheetDrag();
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);
        dragCleanupRef.current = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
        };
    }, [canStartSheetDrag, clearDragListeners, finishSheetDrag, setSheetDragOffset]);

    const reverseGeocode = useCallback((lat, lng) => {
        const gc = new window.kakao.maps.services.Geocoder();
        gc.coord2Address(lng, lat, (result, status) => {
            if (status === window.kakao.maps.services.Status.OK && result[0]) {
                setAddress(result[0].road_address?.address_name || result[0].address?.address_name || "");
            }
        });
    }, []);

    useEffect(() => {
        const initMap = () => {
            if (!mapRef.current || !window.kakao?.maps?.LatLng) return;
            const center = new window.kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng);
            if (mapObj.current && markerRef.current) {
                mapObj.current.setCenter(center);
                markerRef.current.setPosition(center);
                setPos({ lat: defaultCenter.lat, lng: defaultCenter.lng });
                if (!defaultCenter?.address) reverseGeocode(center.getLat(), center.getLng());
                return;
            }
            mapObj.current = new window.kakao.maps.Map(mapRef.current, { center, level: 3 });
            markerRef.current = new window.kakao.maps.Marker({ position: center, map: mapObj.current, draggable: true });

            window.kakao.maps.event.addListener(markerRef.current, "dragend", () => {
                const latlng = markerRef.current.getPosition();
                setPos({ lat: latlng.getLat(), lng: latlng.getLng() });
                setKakaoPlaceId(null);
                reverseGeocode(latlng.getLat(), latlng.getLng());
            });
            window.kakao.maps.event.addListener(mapObj.current, "click", (mouseEvent) => {
                const latlng = mouseEvent.latLng;
                markerRef.current.setPosition(latlng);
                setPos({ lat: latlng.getLat(), lng: latlng.getLng() });
                setKakaoPlaceId(null);
                reverseGeocode(latlng.getLat(), latlng.getLng());
            });

            if (!defaultCenter?.address) reverseGeocode(center.getLat(), center.getLng());
        };

        if (window.kakao?.maps?.LatLng) {
            initMap();
            return;
        }

        if (!KAKAO_APP_KEY) return;
        loadKakaoMap(KAKAO_APP_KEY).then(() => {
            setErr("");
            setLoading(false);
            initMap();
        }).catch((e) => { setErr(`지도 로딩 실패: ${e.message}\n\n1. 카카오 개발자 콘솔에서 앱 키 확인\n2. 플랫폼 → Web → ${window.location.origin} 등록 확인`); setLoading(false); });
    }, [defaultCenter.lat, defaultCenter.lng, defaultCenter?.address, reverseGeocode]);

    const doSearch = () => {
        const keyword = query.trim();
        setSearchMessage("");
        if (!keyword) {
            setSearchMessage("검색할 학원 이름이나 주소를 입력해 주세요.");
            return;
        }
        if (!window.kakao?.maps?.services?.Places) {
            setResults([]);
            setSearchMessage("장소 검색을 사용하려면 카카오 지도 앱 키가 필요해요.");
            return;
        }
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(keyword, (data, status) => {
            if (status === window.kakao.maps.services.Status.OK) {
                const nextResults = data.slice(0, 8);
                setResults(nextResults);
                setSearchMessage(nextResults.length ? "" : "검색 결과가 없어요. 다른 이름이나 주소로 다시 검색해 주세요.");
            } else {
                setResults([]);
                setSearchMessage("검색 결과가 없어요. 다른 이름이나 주소로 다시 검색해 주세요.");
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
        setKakaoPlaceId(place.id || null);
        setResults([]);
        setQuery("");
        setSearchMessage("");
    };

    return (
        <div className="map-picker-shell" style={{ fontFamily: FF }}>
            <button type="button" className="map-picker-backdrop" aria-label="지도 닫기" onClick={requestClose} />
            <section
                className={`map-picker-sheet${isClosing ? " is-closing" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                style={{ transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined }}
            >
            <div className="map-picker-drag-zone" onPointerDown={handleDragPointerDown}>
                <span className="map-picker-drag-handle" aria-hidden="true" />
            </div>
            <div className="map-picker-header" onPointerDown={handleDragPointerDown}>
                <button onClick={requestClose} style={{ background: "var(--bg-muted)", border: "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: FF }}>← 닫기</button>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--fg-primary)" }}>{title}</div>
            </div>
            <div className="map-picker-search" style={{ padding: "12px 16px", background: "#FAFAFA", position: "relative", zIndex: 40 }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <input value={query} onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
                        placeholder="🔍 학원 이름이나 주소 검색..."
                        style={{ flex: 1, padding: "12px 16px", border: "2px solid var(--theme-accent-line)", borderRadius: 16, fontSize: 14, fontFamily: FF, outline: "none", boxSizing: "border-box" }} />
                    <button onClick={doSearch} style={{ padding: "10px 16px", background: "var(--hyeni-theme-gradient)", color: "white", border: "none", borderRadius: 16, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FF, flexShrink: 0 }}>검색</button>
                </div>
                {results.length > 0 && (
                    <div style={{ position: "absolute", left: 16, right: 16, top: "100%", background: "white", borderRadius: "0 0 16px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 60, maxHeight: 240, overflowY: "auto" }}>
                        {results.map((r, i) => (
                            <div key={i} onClick={() => pickResult(r)}
                                style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--bg-muted)", fontSize: 13, lineHeight: 1.5 }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--theme-accent-soft)"}
                                onMouseLeave={e => e.currentTarget.style.background = "white"}>
                                <div style={{ fontWeight: 700, color: "var(--fg-primary)" }}>{r.place_name}</div>
                                <div style={{ color: "var(--fg-tertiary)", fontSize: 12 }}>{r.road_address_name || r.address_name}</div>
                            </div>
                        ))}
                    </div>
                )}
                {searchMessage && (
                    <div role="status" style={{ marginTop: 8, color: "var(--theme-accent-text)", fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
                        {searchMessage}
                    </div>
                )}
            </div>
            <div className="map-picker-map" style={{ flex: 1, position: "relative" }}>
                {loading && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--theme-accent-soft)", zIndex: 10, fontSize: 15, fontWeight: 700, color: "var(--theme-accent-text)", fontFamily: FF }}>🗺️ 지도 불러오는 중...</div>}
                {err && (
                    <FallbackMapCanvas
                        center={pos}
                        children={pos ? [{ ...pos, name: "선택 위치", emoji: "📍", color: DESIGN.colors.pink }] : []}
                        title="장소 선택"
                        subtitle={KAKAO_APP_KEY ? "Kakao 지도 연결 실패" : "Kakao 지도 키가 없어 현재 좌표로 설정"}
                        showRadius
                    />
                )}
                <div ref={mapRef} style={{ width: "100%", height: "100%", display: err ? "none" : "block" }} />
                {!err && <MapZoomControls mapObj={mapObj} />}
            </div>
            <div className="map-picker-footer" style={{ padding: "16px 20px", borderTop: "1px solid var(--bg-muted)", fontFamily: FF }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-tertiary)", marginBottom: 4 }}>선택된 장소</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-primary)", marginBottom: 14, minHeight: 20 }}>{address || "지도를 클릭하거나 검색하세요"}</div>
                <button onClick={() => { if (pos) onConfirm({ lat: pos.lat, lng: pos.lng, address, kakao_place_id: kakaoPlaceId }); }}
                    style={{ width: "100%", padding: "15px", background: "var(--hyeni-theme-gradient)", color: "white", border: "none", borderRadius: 18, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FF }}>
                    📍 이 장소로 설정하기
                </button>
            </div>
            </section>
        </div>
    );
}
