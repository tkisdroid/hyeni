// src/components/childTracker/DailyTrailMap.jsx
// 선택한 날짜의 자녀 이동경로를 작은 지도 카드 형태로 시각화.
// 200m+ chunk polyline + dwell 마커 + 시작/끝 시간 마커.
// 기존 timeline 리스트(<ol>) 를 대체.

import { useEffect, useMemo, useRef, useState } from "react";
import {
    buildSelectedLocationTrail,
    buildTrailGradientSegments,
    buildTrailDwellPlaces,
    getTrailTimeBounds,
    formatTrailClock,
    haversineM,
    sumRouteDistance,
} from "../../lib/trailMath.js";
import { KAKAO_APP_KEY, loadKakaoMap } from "../../lib/kakaoMap.js";
import { escHtml } from "../../lib/htmlEscape.js";
import { FallbackMapCanvas } from "../map/FallbackMapCanvas.jsx";
import { deferEffectStateUpdate } from "../../lib/deferEffectStateUpdate.js";

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };

export function DailyTrailMap({ trail = [], child = null, height = 220 }) {
    const mapRef = useRef(null);
    const mapObj = useRef(null);
    const polysRef = useRef([]);
    const markersRef = useRef([]);
    const overlaysRef = useRef([]);
    const hasPreloadedKakao = typeof window !== "undefined" && !!window.kakao?.maps?.LatLng;
    const [mapReady, setMapReady] = useState(hasPreloadedKakao);
    const [loadError, setLoadError] = useState("");

    const points = useMemo(
        () => buildSelectedLocationTrail(trail, child),
        [trail, child]
    );
    const segments = useMemo(
        () => buildTrailGradientSegments(points),
        [points]
    );
    const dwellPlaces = useMemo(() => buildTrailDwellPlaces(points), [points]);

    useEffect(() => {
        if (mapReady) return undefined;
        if (window.kakao?.maps?.LatLng) {
            return deferEffectStateUpdate(() => setMapReady(true));
        }
        if (!KAKAO_APP_KEY) {
            return deferEffectStateUpdate(() => setLoadError("지도 키가 없어 폴백을 표시합니다."));
        }
        let cancelled = false;
        loadKakaoMap(KAKAO_APP_KEY)
            .then(() => { if (!cancelled) setMapReady(true); })
            .catch((err) => { if (!cancelled) setLoadError(err?.message || "지도 로딩 실패"); });
        return () => { cancelled = true; };
    }, [mapReady]);

    useEffect(() => {
        if (!mapReady || !mapRef.current || !window.kakao?.maps?.LatLng) return;

        const validPoints = points.filter(
            (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)
        );

        const center = validPoints[0]
            ? new window.kakao.maps.LatLng(validPoints[0].lat, validPoints[0].lng)
            : new window.kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);

        if (!mapObj.current) {
            mapObj.current = new window.kakao.maps.Map(mapRef.current, { center, level: 5, draggable: true });
        }

        polysRef.current.forEach((poly) => poly.setMap(null));
        polysRef.current = [];
        markersRef.current.forEach((mk) => mk.setMap(null));
        markersRef.current = [];
        overlaysRef.current.forEach((ov) => ov.setMap(null));
        overlaysRef.current = [];

        segments.forEach((segment) => {
            if (segment.points.length < 2) return;
            const path = segment.points.map(
                (pt) => new window.kakao.maps.LatLng(pt.lat, pt.lng)
            );
            const polyline = new window.kakao.maps.Polyline({
                map: mapObj.current,
                path,
                strokeWeight: 5,
                strokeColor: segment.color,
                // Phase C: dashed segment 는 추정 경로 (Kakao API 실패/긴 gap) — 점선으로 표시.
                strokeOpacity: segment.dashed ? 0.55 : 0.86,
                strokeStyle: segment.dashed ? "shortdash" : "solid",
            });
            polysRef.current.push(polyline);
        });

        dwellPlaces.forEach((place) => {
            if (!Number.isFinite(place?.lat) || !Number.isFinite(place?.lng)) return;
            const overlay = new window.kakao.maps.CustomOverlay({
                position: new window.kakao.maps.LatLng(place.lat, place.lng),
                content: `<div style="display:flex;flex-direction:column;align-items:center">
                    <div style="background:var(--status-cautionary);color:white;padding:4px 9px;border-radius:10px;font-size:10px;font-weight:900;font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif;box-shadow:0 4px 12px rgba(245,158,11,0.32);white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis">${escHtml(place.label || "머문 곳")}</div>
                    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid var(--status-cautionary)"></div>
                </div>`,
                yAnchor: 1.25,
                xAnchor: 0.5,
                zIndex: 9,
            });
            overlay.setMap(mapObj.current);
            overlaysRef.current.push(overlay);
        });

        if (validPoints.length > 0) {
            const { firstMs, lastMs } = getTrailTimeBounds(validPoints);
            const startPoint = validPoints[0];
            const endPoint = validPoints[validPoints.length - 1];

            const startLabel = Number.isFinite(firstMs) ? formatTrailClock(firstMs) : "시작";
            const startOverlay = new window.kakao.maps.CustomOverlay({
                position: new window.kakao.maps.LatLng(startPoint.lat, startPoint.lng),
                content: `<div style="background:#22C55E;color:white;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:900;font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif;box-shadow:0 4px 12px rgba(34,197,94,0.32);white-space:nowrap">출발 ${escHtml(startLabel)}</div>`,
                yAnchor: 1.4,
                xAnchor: 0.5,
                zIndex: 8,
            });
            startOverlay.setMap(mapObj.current);
            overlaysRef.current.push(startOverlay);

            if (validPoints.length > 1 && haversineM(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng) > 30) {
                const endLabel = Number.isFinite(lastMs) ? formatTrailClock(lastMs) : "현재";
                const endOverlay = new window.kakao.maps.CustomOverlay({
                    position: new window.kakao.maps.LatLng(endPoint.lat, endPoint.lng),
                    content: `<div style="background:#2563EB;color:white;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:900;font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif;box-shadow:0 4px 12px rgba(37,99,235,0.32);white-space:nowrap">현재 ${escHtml(endLabel)}</div>`,
                    yAnchor: 1.4,
                    xAnchor: 0.5,
                    zIndex: 8,
                });
                endOverlay.setMap(mapObj.current);
                overlaysRef.current.push(endOverlay);
            }
        }

        if (validPoints.length > 1) {
            const bounds = new window.kakao.maps.LatLngBounds();
            validPoints.forEach((p) => bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng)));
            mapObj.current.setBounds(bounds, 32, 32, 32, 32);
        } else if (validPoints.length === 1) {
            mapObj.current.setCenter(new window.kakao.maps.LatLng(validPoints[0].lat, validPoints[0].lng));
            mapObj.current.setLevel(5);
        }
    }, [mapReady, points, segments, dwellPlaces]);

    if (loadError) {
        const fallbackChild = points[points.length - 1] || null;
        return (
            <div className="hyeni-v5-trail-map" style={{ width: "100%", height, borderRadius: 16, overflow: "hidden", border: "1px solid var(--line-soft)" }}>
                <FallbackMapCanvas childPos={fallbackChild} dangerZones={[]} placeMarkers={[]} />
            </div>
        );
    }

    return (
        <div
            ref={mapRef}
            className="hyeni-v5-trail-map"
            style={{
                width: "100%",
                height,
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid var(--line-soft)",
                background: "var(--bg-muted)",
            }}
            aria-label="선택한 날짜 이동경로 지도"
        />
    );
}

export function getTrailDistanceMeters(points) {
    return sumRouteDistance(points);
}
