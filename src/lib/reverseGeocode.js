// src/lib/reverseGeocode.js
// 좌표 → 한글 지역명 변환 헬퍼.
// Kakao Geocoder.coord2Address 결과를 단축 주소(예: "서대문구 신촌동")로 정규화.
// 모듈-레벨 cache + in-flight Promise dedup + React hook 제공.

import { useEffect, useRef, useState } from "react";
import { buildCompactAddressLabel, formatLatLngLabel } from "./placeFormat.js";

const cache = new Map();
const inflight = new Map();

function gridKey(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function pickGeocoder() {
    const services = window?.kakao?.maps?.services;
    if (!services?.Geocoder || !services.Status) return null;
    return { Geocoder: services.Geocoder, Status: services.Status };
}

export function reverseGeocodeKorean(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve("");
    const key = gridKey(lat, lng);
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (inflight.has(key)) return inflight.get(key);

    const promise = new Promise((resolve) => {
        const ready = pickGeocoder();
        if (!ready) {
            resolve("");
            return;
        }
        const gc = new ready.Geocoder();
        try {
            gc.coord2Address(lng, lat, (result, status) => {
                if (status === ready.Status.OK && Array.isArray(result) && result[0]) {
                    const label = buildCompactAddressLabel(result[0])
                        || result[0]?.road_address?.address_name
                        || result[0]?.address?.address_name
                        || "";
                    cache.set(key, label);
                    resolve(label);
                } else {
                    resolve("");
                }
            });
        } catch {
            resolve("");
        }
    }).finally(() => {
        inflight.delete(key);
    });
    inflight.set(key, promise);
    return promise;
}

// React hook — 좌표가 바뀌면 자동으로 다시 lookup. fallback 은 사용자에게 보일
// 임시 라벨(주로 placeLabel 이나 "좌표 ...") — geocode 가 실패해도 noise 없이
// fallback 이 유지된다.
export function useReverseGeocodedLabel(lat, lng, fallback = "") {
    const fallbackLabel = fallback || formatLatLngLabel({ lat, lng });
    const [label, setLabel] = useState(() => {
        const key = gridKey(lat, lng);
        return key && cache.has(key) ? cache.get(key) || fallbackLabel : fallbackLabel;
    });
    const lastKey = useRef("");

    useEffect(() => {
        const key = gridKey(lat, lng);
        if (!key) {
            setLabel(fallbackLabel);
            lastKey.current = "";
            return;
        }
        if (key === lastKey.current) return;
        lastKey.current = key;

        if (cache.has(key)) {
            setLabel(cache.get(key) || fallbackLabel);
            return;
        }

        let cancelled = false;
        setLabel(fallbackLabel);
        reverseGeocodeKorean(lat, lng).then((result) => {
            if (cancelled) return;
            setLabel(result || fallbackLabel);
        });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lat, lng, fallbackLabel]);

    return label;
}
