// src/components/childTracker/ChildTrackerOverlay.jsx
// 학부모용 자녀 실시간 위치 추적 overlay.
// 다중 자녀 마커 + 시간 그라데이션 trail + 오래 머문 곳 + 일정 마커 + resizable bottom panel.
// Extracted from App.jsx (Phase 5 #4 / B7).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    haversineM,
    sumRouteDistance,
    formatTrailDuration,
    buildSelectedLocationTrail,
    buildTrailHourSegments,
    buildTrailGradientSegments,
    buildSignificantMovementSegments,
    buildTrailDwellPlaces,
    LOCATION_TRAIL_SIGNIFICANT_MOVE_M,
} from "../../lib/trailMath.js";
import { extractPreciseAddressFromKakao, getPositionLocationKey } from "../../lib/placeFormat.js";
import { useReverseGeocodedLabel } from "../../lib/reverseGeocode.js";
import { getStayDisplayParts } from "../../lib/locationTrailDisplay.js";
import { DESIGN, FF } from "../../lib/styleHelpers.js";
import { KAKAO_APP_KEY } from "../../lib/kakaoMap.js";
import { CHILD_MARKER_COLORS } from "../../lib/markerColors.js";
import { escHtml } from "../../lib/htmlEscape.js";
import {
    HYENI_DEFAULT_CHILD_IMAGE_CROP,
    HYENI_DEFAULT_CHILD_IMAGE_STYLE_HTML,
    HYENI_DEFAULT_CHILD_IMAGE_URL,
} from "../../lib/childDefaultImage.js";
import { FallbackMapCanvas } from "../map/FallbackMapCanvas.jsx";
import { MapZoomControls } from "../map/MapZoomControls.jsx";
import { ChildAvatar } from "../multichild/HomeDashboard/ChildAvatar.jsx";
import { deferEffectStateUpdate } from "../../lib/deferEffectStateUpdate.js";
import { useNowMs } from "../../lib/useNowMs.js";

const CHILD_TRACKER_ZOOM_LEVEL = 2;
const CHILD_TRACKER_WALK_RADIUS_M = 30;
const CHILD_TRACKER_DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };
const CHILD_TRACKER_MAP_BASIS = "50dvh";
const CHILD_TRACKER_MAP_MIN_HEIGHT = "clamp(220px, 30dvh, 300px)";
const CHILD_TRACKER_DEFAULT_PANEL_RATIO = 0.34;
const CHILD_TRACKER_DEFAULT_PANEL_MIN_PX = 180;
const CHILD_TRACKER_DEFAULT_PANEL_MAX_PX = 300;
const CHILD_TRACKER_DEFAULT_PANEL_HEIGHT = "clamp(180px, 34dvh, 300px)";
const CHILD_TRACKER_PANEL_COLLAPSED_PX = 110;
const CHILD_TRACKER_PANEL_EXPANDED_RATIO = 0.56;

function getChildTrackerViewportHeight() {
    return typeof window !== "undefined" ? window.innerHeight : 800;
}

function getChildTrackerDefaultPanelPx() {
    return Math.max(
        CHILD_TRACKER_DEFAULT_PANEL_MIN_PX,
        Math.min(CHILD_TRACKER_DEFAULT_PANEL_MAX_PX, Math.round(getChildTrackerViewportHeight() * CHILD_TRACKER_DEFAULT_PANEL_RATIO))
    );
}

function getChildTrackerPanelMaxPx() {
    return Math.round(getChildTrackerViewportHeight() * CHILD_TRACKER_PANEL_EXPANDED_RATIO);
}

function childMarkerImageHtml(child) {
    const photoUrl = typeof child?.photo_url === "string" && child.photo_url.trim() ? child.photo_url : "";
    const src = photoUrl || HYENI_DEFAULT_CHILD_IMAGE_URL;
    const style = photoUrl
        ? "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
        : HYENI_DEFAULT_CHILD_IMAGE_STYLE_HTML;
    const cropAttrs = photoUrl ? "" : ` data-hyeni-default-child-image data-hyeni-default-child-image-crop="${HYENI_DEFAULT_CHILD_IMAGE_CROP}"`;
    return `<img src="${escHtml(src)}" alt="" aria-hidden="true"${cropAttrs} style="${style}" />`;
}

export function ChildTrackerOverlay({ childPos, allChildPositions = [], pairedChildren = [], events, academies = [], childLocationLabels = {}, selectedChildUserId = null, mapReady, arrivedSet, onClose, locationTrail = [], locationHint = "", refreshRequestedAt = null, onRefreshLocation }) {
    const mapRef = useRef();
    const mapObj = useRef();
    const myMarkerRef = useRef();
    // trackerKey -> { overlay, signature } 캐시. 위치만 바뀌면 setPosition,
    // 외형(active/photo/name/시각) 바뀌면 setContent. 매 렌더마다 마커를
    // 통째로 재생성하던 이전 구현이 깜빡임을 만들었기 때문에 캐시 추가.
    const childMarkersByKeyRef = useRef(new Map());
    const walkRadiusCircleRef = useRef(null);
    // refreshRequestedAt 이후 처음 도착하는 selectedChild 위치로 자동 panTo.
    // 같은 요청에 두 번 panTo 되지 않도록 마지막으로 처리한 timestamp 기록.
    const lastAutoFocusRefreshRef = useRef(null);
    const trailPolyRef = useRef(null);
    const trailPolysRef = useRef([]);
    const trailTimeMarkersRef = useRef([]);
    const dwellMarkersRef = useRef([]);
    const expectedPolyRef = useRef(null);
    const eventMarkersRef = useRef([]);
    const initialFocusDoneRef = useRef(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedChildId, setSelectedChildId] = useState(selectedChildUserId || null);
    const [selectedTrailSegmentKey, setSelectedTrailSegmentKey] = useState("");
    const [dwellLocationLabels, setDwellLocationLabels] = useState({});
    // Resizable bottom panel — drag handle to expand/collapse the details panel.
    const [bottomHeight, setBottomHeight] = useState(null); // null = default compact height
    const [isPanelDragging, setIsPanelDragging] = useState(false);
    const panelDragRef = useRef(null);
    const nowMs = useNowMs(60_000);

    useEffect(() => {
        if (!selectedChildUserId) return undefined;
        return deferEffectStateUpdate(() => setSelectedChildId(selectedChildUserId));
    }, [selectedChildUserId]);

    const startPanelDrag = useCallback((clientY) => {
        const current = bottomHeight ?? getChildTrackerDefaultPanelPx();
        panelDragRef.current = { startY: clientY, startHeight: current };
        setIsPanelDragging(true);
    }, [bottomHeight]);
    const movePanelDrag = useCallback((clientY) => {
        const state = panelDragRef.current;
        if (!state) return;
        const delta = state.startY - clientY; // up = bigger details panel (smaller map), down = bigger map
        const next = state.startHeight + delta;
        const max = getChildTrackerPanelMaxPx();
        setBottomHeight(Math.max(CHILD_TRACKER_PANEL_COLLAPSED_PX, Math.min(max, next)));
    }, []);
    const endPanelDrag = useCallback(() => {
        const state = panelDragRef.current;
        panelDragRef.current = null;
        setIsPanelDragging(false);
        if (!state) return;
        setBottomHeight((h) => {
            const max = getChildTrackerPanelMaxPx();
            const current = h ?? getChildTrackerDefaultPanelPx();
            const mid = (CHILD_TRACKER_PANEL_COLLAPSED_PX + max) / 2;
            return current <= mid ? CHILD_TRACKER_PANEL_COLLAPSED_PX : max;
        });
    }, []);

    const childLocations = useMemo(() => {
        const selectedUserId = selectedChildUserId || null;
        const selectedMember = selectedUserId
            ? pairedChildren?.find(member => member?.user_id === selectedUserId)
            : null;
        const fallbackMember = selectedMember || pairedChildren?.[0];
        const source = allChildPositions.length > 0
            ? allChildPositions
            : (childPos ? [{
                user_id: fallbackMember?.user_id || selectedUserId || "default",
                name: fallbackMember?.name || "우리 아이",
                emoji: fallbackMember?.emoji || "🐰",
                photo_url: fallbackMember?.photo_url || null,
                lat: childPos.lat,
                lng: childPos.lng,
                updatedAt: childPos.updatedAt,
            }] : []);
        return source
            .filter(child => !selectedUserId || (child?.user_id || child?.userId) === selectedUserId)
            .filter(child => Number.isFinite(Number(child?.lat)) && Number.isFinite(Number(child?.lng)))
            .map((child, i) => {
                const member = pairedChildren?.find(m => m.user_id && m.user_id === child.user_id) || selectedMember;
                const photoFromMember = member?.photo_url;
                return {
                    ...child,
                    lat: Number(child.lat),
                    lng: Number(child.lng),
                    name: child.name || member?.name || "우리 아이",
                    emoji: child.emoji || member?.emoji || "🐰",
                    photo_url: child.photo_url || photoFromMember || null,
                    trackerKey: child.user_id || child.userId || child.id || `child-${i}`,
                };
            });
    }, [allChildPositions, childPos, pairedChildren, selectedChildUserId]);

    const selectedChild = childLocations.find(child => child.trackerKey === selectedChildId) || childLocations[0] || null;
    const center = selectedChild || CHILD_TRACKER_DEFAULT_CENTER;
    const selectedUpdatedAt = selectedChild?.updatedAt || selectedChild?.updated_at || null;
    const selectedUpdatedMs = selectedUpdatedAt ? new Date(selectedUpdatedAt).getTime() : 0;
    const selectedLocationAgeMs = selectedUpdatedMs ? nowMs - selectedUpdatedMs : null;
    const selectedLocationFresh = selectedLocationAgeMs != null && selectedLocationAgeMs <= 90_000;
    const selectedLocationLabel = !selectedChild
        ? "위치 수신 중"
        : selectedLocationFresh ? "방금 확인" : "마지막 저장 위치";
    const refreshPending = refreshRequestedAt && (!selectedUpdatedMs || selectedUpdatedMs < refreshRequestedAt);
    const selectedTrail = useMemo(
        () => buildSelectedLocationTrail(locationTrail, selectedChild),
        [locationTrail, selectedChild]
    );
    const trailHourSegments = useMemo(() => buildTrailHourSegments(selectedTrail), [selectedTrail]);
    const trailGradientSegments = useMemo(() => buildTrailGradientSegments(selectedTrail), [selectedTrail]);
    const trailMovementSegments = useMemo(
        () => buildSignificantMovementSegments(selectedTrail, LOCATION_TRAIL_SIGNIFICANT_MOVE_M),
        [selectedTrail]
    );
    const trailDwellPlaces = useMemo(() => buildTrailDwellPlaces(selectedTrail), [selectedTrail]);
    const displayTrailDwellPlaces = useMemo(() => {
        return trailDwellPlaces.map((place) => {
            const locationKey = getPositionLocationKey(place);
            const locationInfo = dwellLocationLabels[locationKey] || childLocationLabels[locationKey] || null;
            const displayParts = getStayDisplayParts(place, { academies, locationInfo });
            return {
                ...place,
                locationKey,
                displayTitle: displayParts.title,
                addressLabel: displayParts.addressLabel,
            };
        });
    }, [academies, childLocationLabels, dwellLocationLabels, trailDwellPlaces]);

    const focusChildLocation = useCallback((child, level = CHILD_TRACKER_ZOOM_LEVEL) => {
        if (!mapObj.current || !child || !Number.isFinite(child.lat) || !Number.isFinite(child.lng)) return;
        initialFocusDoneRef.current = true;
        const target = new window.kakao.maps.LatLng(child.lat, child.lng);
        try {
            mapObj.current.setLevel(level, { animate: true });
        } catch {
            mapObj.current.setLevel(level);
        }
        if (typeof mapObj.current.panTo === "function") {
            mapObj.current.panTo(target);
        } else {
            mapObj.current.setCenter(target);
        }
    }, []);
    const focusTrailPoints = useCallback((points, level = CHILD_TRACKER_ZOOM_LEVEL) => {
        if (!mapObj.current || !Array.isArray(points) || points.length === 0) return;
        const validPoints = points.filter(point => Number.isFinite(point?.lat) && Number.isFinite(point?.lng));
        if (validPoints.length === 0) return;
        initialFocusDoneRef.current = true;
        if (validPoints.length === 1) {
            focusChildLocation(validPoints[0], level);
            return;
        }
        const bounds = new window.kakao.maps.LatLngBounds();
        validPoints.forEach(point => bounds.extend(new window.kakao.maps.LatLng(point.lat, point.lng)));
        mapObj.current.setBounds(bounds, 70);
    }, [focusChildLocation]);
    const focusTrailSegment = useCallback((segment) => {
        if (!segment) return;
        setSelectedTrailSegmentKey(segment.key);
        focusTrailPoints(segment.points, Math.max(2, CHILD_TRACKER_ZOOM_LEVEL - 1));
    }, [focusTrailPoints]);

    const now = new Date(nowMs);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const todayLocEvents = useMemo(
        () => (events[todayKey] || []).filter(e => e.location).sort((a, b) => a.time.localeCompare(b.time)),
        [events, todayKey]
    );
    const nextEvent = todayLocEvents.find(e => {
        if (typeof e.time !== "string") return false;
        const [h, m] = e.time.split(":").map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
        return h * 60 + m > nowMin;
    });
    const activeChildLocation = selectedChild || childPos;
    const distToNext = activeChildLocation && nextEvent?.location
        ? haversineM(activeChildLocation.lat, activeChildLocation.lng, nextEvent.location.lat, nextEvent.location.lng)
        : null;

    // 오늘 총 이동거리 (선택한 아이의 실제 이동경로 합산)
    const totalDistM = sumRouteDistance(selectedTrail);
    const trailPointCount = selectedTrail.length;
    const trailLastRecordedAt = selectedTrail[trailPointCount - 1]?.recordedAt || selectedTrail[trailPointCount - 1]?.recorded_at || null;
    const trailLastLabel = trailLastRecordedAt
        ? new Date(trailLastRecordedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
        : "";

    useEffect(() => {
        return deferEffectStateUpdate(() => setSelectedTrailSegmentKey(""));
    }, [selectedChild?.trackerKey]);

    useEffect(() => {
        if (!mapReady || !window.kakao?.maps?.services?.Geocoder || trailDwellPlaces.length === 0) return;
        let cancelled = false;
        const geocoder = new window.kakao.maps.services.Geocoder();

        trailDwellPlaces.forEach((place) => {
            const key = getPositionLocationKey(place);
            if (!key || dwellLocationLabels[key]?.label) return;
            geocoder.coord2Address(place.lng, place.lat, (result, status) => {
                if (cancelled) return;
                if (status !== window.kakao.maps.services.Status.OK || !result?.[0]) return;
                const resolved = extractPreciseAddressFromKakao(result[0], place);
                setDwellLocationLabels(prev => ({
                    ...prev,
                    [key]: { ...resolved, updatedAt: new Date().toISOString() },
                }));
            });
        });

        return () => {
            cancelled = true;
        };
    }, [mapReady, trailDwellPlaces, dwellLocationLabels]);

    // Effect 1: 지도 초기화 (최초 1회)
    useEffect(() => {
        if (!mapReady || !mapRef.current || mapObj.current) return;
        mapObj.current = new window.kakao.maps.Map(mapRef.current, {
            center: new window.kakao.maps.LatLng(center.lat, center.lng),
            level: CHILD_TRACKER_ZOOM_LEVEL
        });
    }, [mapReady, center.lat, center.lng]);

    // Desktop mouse drag fallback for the bottom panel handle
    useEffect(() => {
        if (!isPanelDragging) return;
        const onMove = (e) => movePanelDrag(e.clientY);
        const onUp = () => endPanelDrag();
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isPanelDragging, movePanelDrag, endPanelDrag]);

    // Relayout Kakao map after the bottom panel resizes so tiles render correctly
    useEffect(() => {
        if (!mapObj.current?.relayout) return;
        const id = window.setTimeout(() => {
            try { mapObj.current.relayout(); } catch { /* noop */ }
        }, isPanelDragging ? 30 : 240);
        return () => window.clearTimeout(id);
    }, [bottomHeight, isPanelDragging]);

    // Effect 2: 아이 현재위치 마커 (다중 아이 지원) — 캐시 기반 in-place 업데이트.
    // 위치만 바뀌면 setPosition(), 외형(active/photo/시각) 바뀌면 setContent()만 호출하고
    // overlay 자체는 재생성하지 않는다. 재생성하면 짧은 시간 동안 마커가 사라졌다 다시
    // 그려져 깜빡임으로 보이기 때문.
    useEffect(() => {
        if (!mapObj.current) return;
        const cache = childMarkersByKeyRef.current;

        if (myMarkerRef.current) { myMarkerRef.current.setMap(null); myMarkerRef.current = null; }

        if (!childLocations.length) {
            cache.forEach(({ overlay }) => overlay.setMap(null));
            cache.clear();
            if (walkRadiusCircleRef.current) { walkRadiusCircleRef.current.setMap(null); walkRadiusCircleRef.current = null; }
            return;
        }

        const seenKeys = new Set();
        childLocations.forEach((child, i) => {
            const color = CHILD_MARKER_COLORS[i % CHILD_MARKER_COLORS.length];
            const isActive = child.trackerKey === selectedChild?.trackerKey;
            const ll = new window.kakao.maps.LatLng(child.lat, child.lng);
            const updatedLabel = child.updatedAt ? (() => { const d = new Date(child.updatedAt); return `${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`; })() : "";
            const markerSize = isActive ? 34 : 28;
            const content = `<div style="display:flex;flex-direction:column;align-items:center">
                <div style="width:${markerSize}px;height:${markerSize}px;background:#fff;border:${isActive ? 5 : 4}px solid white;border-radius:50%;box-shadow:0 0 0 ${isActive ? 12 : 8}px ${color}33,0 3px 12px ${color}66;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">${childMarkerImageHtml(child)}</div>
                <div style="margin-top:4px;background:${color};color:white;padding:${isActive ? "5px 14px" : "4px 12px"};border-radius:10px;font-size:11px;font-weight:800;font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2);white-space:nowrap">${escHtml(child.name)}${updatedLabel ? ` · ${updatedLabel}` : ""}</div>
            </div>`;
            const zIndex = isActive ? 20 : 10;
            // signature: 외형이 바뀌었는지 빠르게 비교하기 위한 키. 좌표는 제외.
            const signature = `${isActive ? 1 : 0}|${color}|${child.name || ""}|${child.photo_url || ""}|${updatedLabel}`;
            const key = child.trackerKey;
            seenKeys.add(key);

            const cached = cache.get(key);
            if (cached) {
                cached.overlay.setPosition(ll);
                if (cached.signature !== signature) {
                    cached.overlay.setContent(content);
                    if (typeof cached.overlay.setZIndex === "function") cached.overlay.setZIndex(zIndex);
                    cached.signature = signature;
                }
            } else {
                const overlay = new window.kakao.maps.CustomOverlay({
                    position: ll, content, yAnchor: 1.8, xAnchor: 0.5, zIndex,
                });
                overlay.setMap(mapObj.current);
                cache.set(key, { overlay, signature });
            }
        });

        // 사라진 자녀 마커 제거
        cache.forEach((entry, key) => {
            if (!seenKeys.has(key)) {
                entry.overlay.setMap(null);
                cache.delete(key);
            }
        });

        if (selectedChild) {
            const center = new window.kakao.maps.LatLng(selectedChild.lat, selectedChild.lng);
            if (walkRadiusCircleRef.current) {
                if (typeof walkRadiusCircleRef.current.setPosition === "function") {
                    walkRadiusCircleRef.current.setPosition(center);
                }
            } else if (window.kakao.maps.Circle) {
                walkRadiusCircleRef.current = new window.kakao.maps.Circle({
                    center,
                    radius: CHILD_TRACKER_WALK_RADIUS_M,
                    strokeWeight: 2,
                    strokeColor: "#2563EB",
                    strokeOpacity: 0.72,
                    strokeStyle: "solid",
                    fillColor: "#3B82F6",
                    fillOpacity: 0.12,
                });
                walkRadiusCircleRef.current.setMap(mapObj.current);
            }
        } else if (walkRadiusCircleRef.current) {
            walkRadiusCircleRef.current.setMap(null);
            walkRadiusCircleRef.current = null;
        }

        if (!initialFocusDoneRef.current && selectedChild) {
            focusChildLocation(selectedChild);
        }
    }, [childLocations, selectedChild, focusChildLocation]);

    // unmount 시 캐시된 자녀 마커 정리
    useEffect(() => {
        const cache = childMarkersByKeyRef.current;
        return () => {
            cache.forEach(({ overlay }) => overlay.setMap(null));
            cache.clear();
        };
    }, []);

    // 새로고침(↻) 후 selectedChild 의 fresh 위치가 도착하면 한 번 panTo.
    // refreshRequestedAt 이후 updatedAt 인 위치를 받으면 자동으로 그 위치로 지도 이동.
    useEffect(() => {
        if (!refreshRequestedAt || !mapObj.current || !selectedChild) return;
        if (lastAutoFocusRefreshRef.current === refreshRequestedAt) return;
        const updatedMs = selectedChild.updatedAt ? new Date(selectedChild.updatedAt).getTime() : 0;
        if (!updatedMs || updatedMs < refreshRequestedAt) return;
        lastAutoFocusRefreshRef.current = refreshRequestedAt;
        focusChildLocation(selectedChild);
    }, [refreshRequestedAt, selectedChild, focusChildLocation]);

    // 새로고침 버튼 클릭 즉시 마지막 known 위치로 이동시켜 응답 대기 중에도 시각적 피드백 제공.
    const handleRefreshClick = useCallback(() => {
        if (selectedChild && mapObj.current) {
            focusChildLocation(selectedChild);
        }
        onRefreshLocation?.();
    }, [selectedChild, focusChildLocation, onRefreshLocation]);

    // Effect 3: 이동경로 + 예상경로 + 일정 마커 (locationTrail/events 변경 시 재드로우)
    useEffect(() => {
        if (!mapObj.current) return;

        // Diagnostic: when we have raw trail points but no gradient
        // segments, the polyline won't render and the parent perceives
        // the trail as "직선만 나옴" or empty. Common causes: < 2 unique
        // points after jitter dedupe, or selectedChild filtered every row
        // (e.g. user_id mismatch between location_history and family_members).
        if (selectedTrail.length > 0 && trailGradientSegments.length === 0) {
            console.warn(
                "[trail] selectedTrail has",
                selectedTrail.length,
                "points but trailGradientSegments is empty — likely too few unique points or filter mismatch",
                { selectedChildUserId: selectedChild?.user_id }
            );
        }

        // 기존 폴리라인/마커 제거
        if (trailPolyRef.current) { trailPolyRef.current.setMap(null); trailPolyRef.current = null; }
        trailPolysRef.current.forEach(polyline => polyline.setMap(null));
        trailPolysRef.current = [];
        trailTimeMarkersRef.current.forEach(marker => marker.setMap(null));
        trailTimeMarkersRef.current = [];
        dwellMarkersRef.current.forEach(marker => marker.setMap(null));
        dwellMarkersRef.current = [];
        if (expectedPolyRef.current) { expectedPolyRef.current.setMap(null); expectedPolyRef.current = null; }
        eventMarkersRef.current.forEach(m => m.setMap(null));
        eventMarkersRef.current = [];

        const selectedHourSegment = trailHourSegments.find(segment => segment.key === selectedTrailSegmentKey) || null;

        // 실제 이동경로: 저장된 상세 route point를 그대로 이어 그린다.
        // 이전 구현은 200m chunk를 시작→끝 직선으로 단순화해 도보 동선이
        // 대각선처럼 보였으므로, 상세 기록이 있을 때는 gradient segment를 우선한다.
        const segmentsToDraw = trailGradientSegments.length > 0 ? trailGradientSegments : trailMovementSegments;
        segmentsToDraw.forEach((segment) => {
            if (segment.points.length >= 2) {
                const path = segment.points.map(pt => new window.kakao.maps.LatLng(pt.lat, pt.lng));
                const isSelectedSegment = selectedHourSegment
                    ? segment.points.some(point => selectedHourSegment.points.includes(point))
                    : false;
                const polyline = new window.kakao.maps.Polyline({
                    map: mapObj.current,
                    path,
                    strokeWeight: isSelectedSegment ? 8 : 5,
                    strokeColor: segment.color,
                    strokeOpacity: isSelectedSegment ? 0.96 : 0.82,
                    strokeStyle: "solid"
                });
                trailPolysRef.current.push(polyline);
            }
        });

        trailHourSegments.forEach((segment) => {
            const markerPoint = segment.points.find(point => Number.isFinite(point?.recordedMs));
            if (markerPoint) {
                const isSelectedSegment = selectedTrailSegmentKey && segment.key === selectedTrailSegmentKey;
                const overlay = new window.kakao.maps.CustomOverlay({
                    position: new window.kakao.maps.LatLng(markerPoint.lat, markerPoint.lng),
                    content: `<div style="background:${segment.color};color:white;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:900;font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif;box-shadow:0 4px 12px rgba(15,23,42,0.2);white-space:nowrap;border:${isSelectedSegment ? "2px solid white" : "0"}">${escHtml(segment.label)}</div>`,
                    yAnchor: 1.4,
                    xAnchor: 0.5,
                    zIndex: 8,
                });
                overlay.setMap(mapObj.current);
                trailTimeMarkersRef.current.push(overlay);
            }
        });

        // 오래 머문 곳
        displayTrailDwellPlaces.forEach((place) => {
            const overlay = new window.kakao.maps.CustomOverlay({
                position: new window.kakao.maps.LatLng(place.lat, place.lng),
                content: `<div style="display:flex;flex-direction:column;align-items:center">
                    <div style="background:var(--status-cautionary);color:white;padding:5px 10px;border-radius:12px;font-size:10px;font-weight:900;font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif;box-shadow:0 5px 14px rgba(245,158,11,0.32);white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis">${escHtml(place.displayTitle)}</div>
                    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid var(--status-cautionary)"></div>
                </div>`,
                yAnchor: 1.25,
                xAnchor: 0.5,
                zIndex: 9,
            });
            overlay.setMap(mapObj.current);
            dwellMarkersRef.current.push(overlay);
        });

        // 예상 이동경로: 오늘 일정 장소들을 시간순으로 연결 (회색 점선)
        if (todayLocEvents.length >= 2) {
            const path = todayLocEvents.map(e => new window.kakao.maps.LatLng(e.location.lat, e.location.lng));
            expectedPolyRef.current = new window.kakao.maps.Polyline({
                map: mapObj.current, path,
                strokeWeight: 3, strokeColor: "#9CA3AF",
                strokeOpacity: 0.7, strokeStyle: "shortdash"
            });
        }

        // 일정 마커 (클릭 가능)
        todayLocEvents.forEach(ev => {
            const arrived = arrivedSet.has(ev.id);
            const bg = arrived ? "#059669" : ev.color;
            const el = document.createElement("div");
            el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer";
            const timeLabel = ev.endTime ? `${ev.time}~${ev.endTime}` : ev.time;
            el.innerHTML = `<div style="background:${bg};color:white;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.18);white-space:nowrap;font-family:'Pretendard Variable','Pretendard',system-ui,sans-serif">${escHtml(ev.emoji)} ${escHtml(ev.title)}<span style="font-weight:600;opacity:0.85;margin-left:4px">${escHtml(timeLabel)}</span>${arrived ? " ✅" : ""}</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg}"></div>`;
            el.addEventListener("click", () => setSelectedEvent(prev => prev?.id === ev.id ? null : ev));
            const overlay = new window.kakao.maps.CustomOverlay({
                position: new window.kakao.maps.LatLng(ev.location.lat, ev.location.lng),
                content: el, yAnchor: 1.3, xAnchor: 0.5
            });
            overlay.setMap(mapObj.current);
            eventMarkersRef.current.push(overlay);
        });
    }, [trailGradientSegments, trailMovementSegments, trailHourSegments, displayTrailDwellPlaces, todayLocEvents, arrivedSet, selectedTrailSegmentKey, selectedChild?.user_id, selectedTrail.length]);

    const distLabel = (m) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, height: "100dvh", overflow: "hidden", background: DESIGN.gradients.map, display: "flex", flexDirection: "column", fontFamily: FF }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: 14, padding: "10px 16px", cursor: "pointer", fontWeight: 800, fontSize: 14, fontFamily: FF, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>← 돌아가기</button>
                <div style={{ flex: 1 }} />
                {onRefreshLocation && (
                    <button
                        type="button"
                        onClick={handleRefreshClick}
                        title="현재 위치 다시 확인"
                        aria-label="현재 위치 다시 확인"
                        style={{ width: 42, height: 42, borderRadius: 14, border: "none", background: "white", color: "var(--theme-accent-text)", fontSize: 18, fontWeight: 900, cursor: "pointer", fontFamily: FF, boxShadow: "var(--hyeni-theme-shadow-soft)", flexShrink: 0 }}
                    >
                        ↻
                    </button>
                )}
                {/* 범례 */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 20, height: 3, background: "#3B82F6", borderRadius: 2 }} />
                        <span style={{ fontSize: 10, color: "var(--fg-secondary)" }}>이동</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 20, height: 3, background: "#9CA3AF", borderRadius: 2, borderTop: "2px dashed #9CA3AF" }} />
                        <span style={{ fontSize: 10, color: "var(--fg-secondary)" }}>예상</span>
                    </div>
                </div>
            </div>

            {/* Map */}
            <div style={{ flex: `1 1 ${CHILD_TRACKER_MAP_BASIS}`, margin: "0 16px", borderRadius: 24, overflow: "hidden", boxShadow: "var(--hyeni-theme-shadow-soft)", position: "relative", minHeight: CHILD_TRACKER_MAP_MIN_HEIGHT, border: "2px solid var(--theme-accent-line)" }}>
                {!mapReady && (
                    <FallbackMapCanvas
                        center={center}
                        children={childLocations.map((child, index) => ({ ...child, key: child.trackerKey, color: CHILD_MARKER_COLORS[index % CHILD_MARKER_COLORS.length] }))}
                        eventPlaces={todayLocEvents.map((event) => ({ key: event.id, title: event.title, emoji: event.emoji, color: event.color, location: event.location }))}
                        routePoints={selectedTrail.length >= 2 ? selectedTrail : (selectedChild && nextEvent?.location ? [selectedChild, nextEvent.location] : [])}
                        selectedKey={selectedChild?.trackerKey || ""}
                        onSelect={(marker) => {
                            if (marker.type === "child") setSelectedChildId(marker.key);
                            if (marker.type === "event") {
                                const event = todayLocEvents.find(item => item.id === marker.key);
                                if (event) setSelectedEvent(event);
                            }
                        }}
                        title="오늘 동선"
                        subtitle={KAKAO_APP_KEY ? "Kakao 지도 연결 중" : "Kakao 지도 키가 없어 간이 지도 표시"}
                        showRadius={Boolean(selectedChild)}
                    />
                )}
                <div ref={mapRef} style={{ width: "100%", height: "100%", display: mapReady ? "block" : "none" }} />
                {mapReady && <MapZoomControls mapObj={mapObj} onManualZoom={() => { initialFocusDoneRef.current = true; }} />}
                {selectedChild && (
                    <>
                        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, background: "rgba(255,255,255,0.94)", borderRadius: 999, padding: "8px 14px", boxShadow: "var(--hyeni-theme-shadow-soft)", border: "1px solid var(--theme-accent-line)", maxWidth: "calc(100% - 92px)", display: mapReady ? "block" : "none" }}>
                            <div style={{ fontSize: 12, fontWeight: 900, color: DESIGN.colors.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedChild.name} · {refreshPending ? "현재 위치 확인 중" : selectedLocationLabel}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: DESIGN.colors.muted, marginTop: 2 }}>도보 확인 반경 {CHILD_TRACKER_WALK_RADIUS_M}m</div>
                        </div>
                        <button
                            type="button"
                            aria-label={`${selectedChild.name} 위치로 이동`}
                            title={`${selectedChild.name} 위치로 이동`}
                            onClick={() => focusChildLocation(selectedChild)}
                            style={{ position: "absolute", top: 12, right: 12, zIndex: 10, width: 48, height: 48, borderRadius: 16, border: "none", background: DESIGN.gradients.primary, color: "white", fontSize: 22, fontWeight: 900, cursor: "pointer", boxShadow: "var(--hyeni-theme-shadow-soft)", display: mapReady ? "flex" : "none", alignItems: "center", justifyContent: "center", fontFamily: FF }}
                        >
                            🎯
                        </button>
                    </>
                )}
                {!childLocations.length && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", zIndex: 5 }}>
                        <div style={{ textAlign: "center", padding: 24 }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--fg-primary)", marginBottom: 6 }}>아이 위치를 불러오는 중...</div>
                            <div style={{ fontSize: 12, color: "var(--fg-tertiary)", lineHeight: 1.6 }}>아이 기기에서 위치 권한이<br />허용되어 있는지 확인해 주세요</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom info — resizable: drag handle expands details or gives space back to the map */}
            <div
                style={{
                    flexShrink: 0,
                    height: bottomHeight != null ? bottomHeight : CHILD_TRACKER_DEFAULT_PANEL_HEIGHT,
                    minHeight: CHILD_TRACKER_PANEL_COLLAPSED_PX,
                    maxHeight: `${Math.round(CHILD_TRACKER_PANEL_EXPANDED_RATIO * 100)}vh`,
                    display: "flex",
                    flexDirection: "column",
                    transition: isPanelDragging ? "none" : "height 0.22s ease-out",
                    overflow: "hidden",
                    background: "transparent",
                }}
            >
                <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="패널 크기 조절 (위로 드래그하면 지도는 줄고 상세가 넓어지며, 아래로 드래그하면 지도가 커집니다)"
                    onTouchStart={(e) => { startPanelDrag(e.touches[0].clientY); }}
                    onTouchMove={(e) => { e.preventDefault(); movePanelDrag(e.touches[0].clientY); }}
                    onTouchEnd={endPanelDrag}
                    onTouchCancel={endPanelDrag}
                    onMouseDown={(e) => { e.preventDefault(); startPanelDrag(e.clientY); }}
                    style={{ padding: "8px 0 4px", cursor: "ns-resize", touchAction: "none", flexShrink: 0, userSelect: "none" }}
                >
                    <div style={{ width: 44, height: 5, background: "#D1D5DB", borderRadius: 999, margin: "0 auto" }} />
                </div>
            <div
                data-testid="hyeni-child-tracker-details-scroll"
                style={{
                    padding: "4px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
                    flex: 1,
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    overscrollBehavior: "contain",
                    minHeight: 0,
                }}
            >
                {/* 클릭한 장소 상세 */}
                {selectedEvent && (
                    <div style={{ background: "white", borderRadius: 16, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: selectedEvent.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{selectedEvent.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--fg-primary)" }}>{selectedEvent.title}</div>
                            <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>⏰ {selectedEvent.time} · 📍 {selectedEvent.location.address?.split(" ").slice(0, 3).join(" ")}</div>
                            {arrivedSet.has(selectedEvent.id) && <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 2 }}>✅ 도착 완료</div>}
                            {activeChildLocation && <div style={{ fontSize: 11, color: selectedEvent.color, fontWeight: 700, marginTop: 2 }}>현재위치에서 {distLabel(haversineM(activeChildLocation.lat, activeChildLocation.lng, selectedEvent.location.lat, selectedEvent.location.lng))}</div>}
                        </div>
                        <button onClick={() => setSelectedEvent(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fg-tertiary)", padding: "0 4px" }}>×</button>
                    </div>
                )}

                {childLocations.length > 0 ? (
                    <div style={{ background: "white", borderRadius: 20, padding: "14px 18px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                        {/* 아이별 위치 상태 */}
                        {childLocations.map((child, i) => {
                            const color = CHILD_MARKER_COLORS[i % CHILD_MARKER_COLORS.length];
                            const isActive = selectedChild?.trackerKey === child.trackerKey;
                            const updatedAt = child.updatedAt || child.updated_at;
                            const coordinateLabel = Number.isFinite(child.lat) && Number.isFinite(child.lng)
                                ? `${child.lat.toFixed(5)}, ${child.lng.toFixed(5)}`
                                : "좌표 확인 중";
                            return (
                                <button
                                    key={child.trackerKey}
                                    type="button"
                                    aria-label={`${child.name} 위치 ${coordinateLabel} ${updatedAt ? "업데이트됨" : "수신 중"}`}
                                    onClick={() => {
                                        setSelectedChildId(child.trackerKey);
                                        focusChildLocation(child);
                                    }}
                                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 10px", background: isActive ? `${color}18` : `${color}10`, borderRadius: 14, border: isActive ? `2px solid ${color}` : "2px solid transparent", cursor: "pointer", textAlign: "left", fontFamily: FF, boxShadow: isActive ? `0 4px 14px ${color}22` : "none" }}
                                >
                                    <ChildAvatar child={child} size={36} color={color} radius={12} fontSize={18} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--fg-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{child.name}</div>
                                        <div style={{ fontSize: 10, color: "var(--fg-tertiary)", marginTop: 1 }}>
                                            {updatedAt ? `${new Date(updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ${selectedChild?.trackerKey === child.trackerKey && refreshPending ? "확인 중" : "업데이트"}` : "위치 수신 중..."}
                                        </div>
                                        <div style={{ fontSize: 10, color: "var(--fg-secondary)", marginTop: 1 }}>
                                            <ChildPositionLabel
                                                lat={child.lat}
                                                lng={child.lng}
                                                fallback={childLocationLabels?.[child.user_id] || ""}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ minWidth: 50, borderRadius: 999, padding: "5px 8px", background: isActive ? color : "white", color: isActive ? "white" : color, fontSize: 10, fontWeight: 900, textAlign: "center", boxShadow: isActive ? "none" : "0 1px 6px rgba(0,0,0,0.06)" }}>
                                        {isActive ? `${child.name} 실시간` : "보기"}
                                    </div>
                                </button>
                            );
                        })}
                        {/* 오늘 이동 동선 */}
                        {trailPointCount > 0 && (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 8 }}>
                                    <div style={{ background: "var(--theme-accent-soft)", borderRadius: 12, padding: "8px 10px", textAlign: "center", minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 900, color: "var(--theme-accent-text)" }}>{distLabel(totalDistM)}</div>
                                        <div style={{ fontSize: 10, color: "var(--fg-secondary)", fontWeight: 800, marginTop: 2 }}>오늘 이동</div>
                                    </div>
                                    <div style={{ background: "var(--bg-subtle)", borderRadius: 12, padding: "8px 10px", textAlign: "center", minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 900, color: "var(--fg-primary)" }}>{trailPointCount}개</div>
                                        <div style={{ fontSize: 10, color: "var(--fg-secondary)", fontWeight: 800, marginTop: 2 }}>기록 지점</div>
                                    </div>
                                    <div style={{ background: "var(--bg-subtle)", borderRadius: 12, padding: "8px 10px", textAlign: "center", minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 900, color: "var(--fg-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trailLastLabel || "오늘"}</div>
                                        <div style={{ fontSize: 10, color: "var(--fg-secondary)", fontWeight: 800, marginTop: 2 }}>기준 시각</div>
                                    </div>
                                </div>
                                {trailHourSegments.length > 0 && (
                                    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
                                        {trailHourSegments.map(segment => {
                                            const isSelectedSegment = selectedTrailSegmentKey === segment.key;
                                            return (
                                            <button
                                                key={segment.key}
                                                type="button"
                                                onClick={() => focusTrailSegment(segment)}
                                                aria-label={`${segment.label} 위치를 지도에 표시`}
                                                style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, background: isSelectedSegment ? segment.color : `${segment.color}12`, color: isSelectedSegment ? "white" : segment.color, padding: "5px 8px", fontSize: 10, fontWeight: 900, border: `1px solid ${segment.color}55`, whiteSpace: "nowrap", cursor: "pointer", fontFamily: FF }}
                                            >
                                                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: isSelectedSegment ? "white" : segment.color }} />
                                                {segment.label}
                                            </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {displayTrailDwellPlaces.length > 0 && (
                                    <div style={{ background: "var(--status-cautionary-subtle)", border: "1px solid #FDE68A", borderRadius: 14, padding: "10px 12px", marginBottom: 8 }}>
                                        <div style={{ fontSize: 11, fontWeight: 900, color: "var(--status-cautionary-strong)", marginBottom: 6 }}>오래 머문 곳</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {displayTrailDwellPlaces.slice(0, 3).map((place, index) => (
                                                <button
                                                    key={place.id}
                                                    type="button"
                                                    onClick={() => focusTrailPoints([place], Math.max(2, CHILD_TRACKER_ZOOM_LEVEL - 1))}
                                                    style={{ border: "none", background: "white", borderRadius: 11, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer", fontFamily: FF, boxShadow: "0 1px 6px rgba(180,83,9,0.08)" }}
                                                >
                                                    <span style={{ width: 24, height: 24, borderRadius: 9, background: "var(--status-cautionary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{index + 1}</span>
                                                    <span style={{ flex: 1, minWidth: 0 }}>
                                                        <span style={{ display: "block", fontSize: 12, color: "var(--fg-primary)", fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.displayTitle}</span>
                                                        {place.addressLabel && (
                                                            <span style={{ display: "block", fontSize: 10, color: "#78350F", fontWeight: 800, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {place.addressLabel}</span>
                                                        )}
                                                        <span style={{ display: "block", fontSize: 10, color: "var(--status-cautionary-strong)", fontWeight: 700, marginTop: 1 }}>
                                                            {place.timeRangeLabel ? `${place.timeRangeLabel} · ` : ""}{place.timeLabel || `${formatTrailDuration(place.durationMs)} 머무름`}
                                                        </span>
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {nextEvent && (
                            <div style={{ background: nextEvent.bg, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ fontSize: 22 }}>{nextEvent.emoji}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--fg-primary)" }}>다음 일정: {nextEvent.title}</div>
                                    <div style={{ fontSize: 11, color: "var(--fg-secondary)", marginTop: 2 }}>⏰ {nextEvent.time} · 📍 {nextEvent.location.address?.split(" ").slice(0, 2).join(" ")}</div>
                                </div>
                                {distToNext !== null && (
                                    <div style={{ fontSize: 12, fontWeight: 800, color: nextEvent.color, flexShrink: 0 }}>
                                        {distLabel(distToNext)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ background: "white", borderRadius: 20, padding: "20px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-tertiary)" }}>{locationHint || "아이 기기에서 위치 권한을 허용해 주세요"}</div>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}

function ChildPositionLabel({ lat, lng, fallback = "" }) {
    const label = useReverseGeocodedLabel(lat, lng, fallback);
    return <>{label}</>;
}
