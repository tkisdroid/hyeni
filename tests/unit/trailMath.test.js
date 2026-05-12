// tests/unit/trailMath.test.js
import { describe, it, expect } from "vitest";
import {
    haversineM,
    toRoutePosition,
    finiteNumber,
    compactRoutePoints,
    sumRouteDistance,
    normalizeLocationTrailPoint,
    compactLocationTrailPoints,
    buildSelectedLocationTrail,
    formatTrailClock,
    formatTrailDuration,
    clampTrailProgress,
    hexToRgb,
    rgbToHex,
    interpolateTrailColor,
    getTrailTimeBounds,
    getTrailProgress,
    getTrailHourKey,
    getTrailHourLabel,
    buildTrailHourSegments,
    buildTrailGradientSegments,
    buildDetailedLocationHistoryRows,
    averageTrailPoint,
    buildTrailDwellPlaces,
    LOCATION_TRAIL_JITTER_M,
    LOCATION_TRAIL_DWELL_RADIUS_M,
    LOCATION_TRAIL_DWELL_MIN_MS,
    LOCATION_TRAIL_DWELL_MAX_SAMPLE_GAP_MS,
} from "../../src/lib/trailMath.js";

describe("haversineM", () => {
    it("같은 점 = 0m", () => {
        expect(haversineM(37.5, 127.0, 37.5, 127.0)).toBe(0);
    });

    it("서울→부산 약 325km", () => {
        const m = haversineM(37.5665, 126.9780, 35.1796, 129.0756);
        expect(m).toBeGreaterThan(320_000);
        expect(m).toBeLessThan(330_000);
    });

    it("1° lat ≈ 111km", () => {
        const m = haversineM(0, 0, 1, 0);
        expect(m).toBeGreaterThan(110_000);
        expect(m).toBeLessThan(112_000);
    });
});

describe("toRoutePosition", () => {
    it("정상 좌표 정규화", () => {
        expect(toRoutePosition({ lat: 37.5, lng: 127.0 })).toEqual({ lat: 37.5, lng: 127.0 });
    });

    it("문자열 좌표 Number 변환", () => {
        expect(toRoutePosition({ lat: "37.5", lng: "127.0" })).toEqual({ lat: 37.5, lng: 127.0 });
    });

    it("null/undefined → null", () => {
        expect(toRoutePosition(null)).toBeNull();
        expect(toRoutePosition(undefined)).toBeNull();
    });

    it("NaN/Infinite → null", () => {
        expect(toRoutePosition({ lat: NaN, lng: 127 })).toBeNull();
        expect(toRoutePosition({ lat: Infinity, lng: 127 })).toBeNull();
    });

    it("범위 초과 (lat>90, lng>180) → null", () => {
        expect(toRoutePosition({ lat: 91, lng: 0 })).toBeNull();
        expect(toRoutePosition({ lat: 0, lng: 181 })).toBeNull();
    });
});

describe("finiteNumber", () => {
    it("유한 number → number", () => {
        expect(finiteNumber(42)).toBe(42);
        expect(finiteNumber("3.14")).toBeCloseTo(3.14);
    });

    it("NaN/Infinity/문자열 → null", () => {
        expect(finiteNumber(NaN)).toBeNull();
        expect(finiteNumber(Infinity)).toBeNull();
        expect(finiteNumber(-Infinity)).toBeNull();
        expect(finiteNumber("abc")).toBeNull();
        // 주의: Number(null) === 0 이므로 null 입력은 0을 반환 (JS Number 변환 동작 보존)
        expect(finiteNumber(null)).toBe(0);
    });
});

describe("compactRoutePoints", () => {
    it("연속 동일 좌표 압축", () => {
        const result = compactRoutePoints([
            { lat: 1, lng: 2 },
            { lat: 1, lng: 2 },
            { lat: 1.001, lng: 2 },
        ]);
        expect(result.length).toBe(2);
    });

    it("invalid 좌표는 무시", () => {
        const result = compactRoutePoints([
            { lat: 1, lng: 2 },
            { lat: NaN, lng: 2 },
            { lat: 3, lng: 4 },
        ]);
        expect(result).toEqual([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
    });
});

describe("sumRouteDistance", () => {
    it("0 또는 1 점이면 0m", () => {
        expect(sumRouteDistance([])).toBe(0);
        expect(sumRouteDistance([{ lat: 0, lng: 0 }])).toBe(0);
    });

    it("연속 거리 합산", () => {
        const m = sumRouteDistance([
            { lat: 0, lng: 0 },
            { lat: 1, lng: 0 },
            { lat: 2, lng: 0 },
        ]);
        expect(m).toBeGreaterThan(220_000);
        expect(m).toBeLessThan(225_000);
    });
});

describe("normalizeLocationTrailPoint", () => {
    it("recorded_at ms 변환", () => {
        const result = normalizeLocationTrailPoint({
            lat: 1, lng: 2,
            recorded_at: "2026-05-05T03:00:00Z",
            user_id: "u1",
        });
        expect(result).toMatchObject({ lat: 1, lng: 2, user_id: "u1" });
        expect(result.recordedMs).toBe(new Date("2026-05-05T03:00:00Z").getTime());
    });

    it("invalid 좌표 → null", () => {
        expect(normalizeLocationTrailPoint({ lat: 200, lng: 0 })).toBeNull();
    });

    it("recordedAt 없으면 recordedMs=null", () => {
        const result = normalizeLocationTrailPoint({ lat: 1, lng: 2 });
        expect(result.recordedMs).toBeNull();
    });
});

describe("compactLocationTrailPoints", () => {
    it("jitter 이내 점은 병합 (위치 유지·시간 갱신)", () => {
        const points = [
            { lat: 37.5, lng: 127, recorded_at: "2026-05-05T01:00:00Z" },
            { lat: 37.50001, lng: 127, recorded_at: "2026-05-05T01:01:00Z" }, // ~1m
        ];
        const result = compactLocationTrailPoints(points);
        expect(result.length).toBe(1);
        expect(result[0].recordedMs).toBe(new Date("2026-05-05T01:01:00Z").getTime());
    });

    it("jitter 넘으면 별도 점", () => {
        const points = [
            { lat: 37.5, lng: 127 },
            { lat: 37.6, lng: 127 }, // ~11km
        ];
        expect(compactLocationTrailPoints(points).length).toBe(2);
    });
});

describe("buildSelectedLocationTrail", () => {
    it("selectedChild의 user_id로 필터링", () => {
        const trail = [
            { lat: 1, lng: 1, user_id: "a", recorded_at: "2026-05-05T01:00:00Z" },
            { lat: 2, lng: 2, user_id: "b", recorded_at: "2026-05-05T01:00:00Z" },
        ];
        const result = buildSelectedLocationTrail(trail, { user_id: "a", lat: 1, lng: 1 });
        expect(result.every(p => p.user_id === "a")).toBe(true);
    });

    it("selectedChild 없으면 전체", () => {
        const trail = [
            { lat: 1, lng: 1 },
            { lat: 2, lng: 2 },
        ];
        expect(buildSelectedLocationTrail(trail, null).length).toBeGreaterThan(0);
    });

    it("저장된 위치 기록보다 오래된 현재 스냅샷은 dwell 계산에 섞지 않는다", () => {
        const trail = [
            { lat: 37.56650, lng: 126.97800, user_id: "a", recorded_at: "2026-05-05T08:23:00+09:00" },
            { lat: 37.56662, lng: 126.97804, user_id: "a", recorded_at: "2026-05-05T08:28:00+09:00" },
            { lat: 37.56673, lng: 126.97807, user_id: "a", recorded_at: "2026-05-05T08:34:00+09:00" },
        ];
        const result = buildSelectedLocationTrail(trail, {
            user_id: "a",
            lat: 37.56650,
            lng: 126.97800,
            updatedAt: "2026-05-05T02:34:00+09:00",
        });
        expect(result).toHaveLength(3);
        expect(result.at(-1).recorded_at).toBe("2026-05-05T08:34:00+09:00");
    });

    it("배열 아니면 빈 배열 반환", () => {
        expect(buildSelectedLocationTrail(null, null)).toEqual([]);
    });
});

describe("formatTrailClock", () => {
    it("ms → ko-KR HH:MM 형식", () => {
        const ms = new Date(2026, 4, 5, 14, 30).getTime();
        const result = formatTrailClock(ms);
        expect(result).toMatch(/14|2/);
        expect(result).toContain("30");
    });

    it("invalid → 빈 문자열", () => {
        expect(formatTrailClock(NaN)).toBe("");
        expect(formatTrailClock(null)).toBe("");
    });
});

describe("formatTrailDuration", () => {
    it("0 또는 음수 → '0분'", () => {
        expect(formatTrailDuration(0)).toBe("0분");
        expect(formatTrailDuration(-100)).toBe("0분");
    });

    it("60초 미만이라도 최소 1분", () => {
        expect(formatTrailDuration(30_000)).toBe("1분");
    });

    it("30분", () => {
        expect(formatTrailDuration(30 * 60_000)).toBe("30분");
    });

    it("정확히 1시간", () => {
        expect(formatTrailDuration(60 * 60_000)).toBe("1시간");
    });

    it("1시간 30분", () => {
        expect(formatTrailDuration(90 * 60_000)).toBe("1시간 30분");
    });
});

describe("clampTrailProgress", () => {
    it("0~1 사이 그대로", () => {
        expect(clampTrailProgress(0.5)).toBe(0.5);
    });

    it("음수 → 0", () => {
        expect(clampTrailProgress(-1)).toBe(0);
    });

    it("1 초과 → 1", () => {
        expect(clampTrailProgress(2)).toBe(1);
    });

    it("invalid → 0", () => {
        expect(clampTrailProgress(NaN)).toBe(0);
    });
});

describe("hexToRgb / rgbToHex", () => {
    it("#FF0000 → r:255 g:0 b:0", () => {
        expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("# 없어도 OK", () => {
        expect(hexToRgb("00FF00")).toEqual({ r: 0, g: 255, b: 0 });
    });

    it("길이 6 아니면 default 파랑", () => {
        expect(hexToRgb("#abc")).toEqual({ r: 37, g: 99, b: 235 });
    });

    it("rgbToHex roundtrip", () => {
        expect(rgbToHex({ r: 255, g: 100, b: 50 })).toBe("#FF6432");
    });

    it("rgb clamp [0,255]", () => {
        expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe("#FF0080");
    });
});

describe("interpolateTrailColor", () => {
    it("0/1 progress가 첫/마지막 stop 반환 (or 그 근방)", () => {
        const start = interpolateTrailColor(0);
        const end = interpolateTrailColor(1);
        expect(start).toMatch(/^#[0-9A-F]{6}$/);
        expect(end).toMatch(/^#[0-9A-F]{6}$/);
        expect(start).not.toBe(end);
    });

    it("invalid progress도 결정적 hex 반환", () => {
        expect(interpolateTrailColor(NaN)).toMatch(/^#[0-9A-F]{6}$/);
    });
});

describe("getTrailTimeBounds", () => {
    it("recordedMs 없으면 firstMs/lastMs 둘 다 null", () => {
        expect(getTrailTimeBounds([{ lat: 1, lng: 1 }])).toEqual({ firstMs: null, lastMs: null });
    });

    it("min/max ms", () => {
        const points = [{ recordedMs: 100 }, { recordedMs: 50 }, { recordedMs: 200 }];
        expect(getTrailTimeBounds(points)).toEqual({ firstMs: 50, lastMs: 200 });
    });
});

describe("getTrailProgress", () => {
    it("ms 기반 progress", () => {
        const point = { recordedMs: 150 };
        expect(getTrailProgress(point, 0, 3, 100, 200)).toBe(0.5);
    });

    it("ms 없으면 index 기반", () => {
        expect(getTrailProgress({}, 0, 3, null, null)).toBe(0);
        expect(getTrailProgress({}, 2, 3, null, null)).toBe(1);
    });

    it("총 1점이면 0", () => {
        expect(getTrailProgress({}, 0, 1, null, null)).toBe(0);
    });
});

describe("getTrailHourKey / getTrailHourLabel", () => {
    it("recordedMs 없으면 unknown / 시간 미상", () => {
        expect(getTrailHourKey({})).toBe("unknown");
        expect(getTrailHourLabel({})).toBe("시간 미상");
    });

    it("같은 시간대는 같은 key", () => {
        const a = new Date(2026, 4, 5, 14, 0).getTime();
        const b = new Date(2026, 4, 5, 14, 30).getTime();
        expect(getTrailHourKey({ recordedMs: a })).toBe(getTrailHourKey({ recordedMs: b }));
    });

    it("hour label은 2자리 + '시'", () => {
        const ms = new Date(2026, 4, 5, 9, 0).getTime();
        expect(getTrailHourLabel({ recordedMs: ms })).toBe("09시");
    });
});

describe("buildTrailHourSegments", () => {
    it("같은 시간대는 한 segment, 시간 바뀌면 새 segment", () => {
        const t1 = new Date(2026, 4, 5, 9, 0).getTime();
        const t2 = new Date(2026, 4, 5, 9, 30).getTime();
        const t3 = new Date(2026, 4, 5, 10, 0).getTime();
        const segments = buildTrailHourSegments([
            { lat: 1, lng: 1, recordedMs: t1 },
            { lat: 1, lng: 1, recordedMs: t2 },
            { lat: 1, lng: 1, recordedMs: t3 },
        ]);
        expect(segments.length).toBe(2);
    });
});

describe("buildTrailGradientSegments", () => {
    it("점이 2 미만이면 빈 배열", () => {
        expect(buildTrailGradientSegments([])).toEqual([]);
        expect(buildTrailGradientSegments([{ lat: 1, lng: 1 }])).toEqual([]);
    });

    it("N 점이면 N-1 segments", () => {
        const points = [
            { lat: 1, lng: 1, recordedMs: 100 },
            { lat: 2, lng: 2, recordedMs: 200 },
            { lat: 3, lng: 3, recordedMs: 300 },
        ];
        expect(buildTrailGradientSegments(points).length).toBe(2);
    });
});

describe("averageTrailPoint", () => {
    it("빈 배열 → null", () => {
        expect(averageTrailPoint([])).toBeNull();
    });

    it("두 점 평균", () => {
        const result = averageTrailPoint([
            { lat: 0, lng: 0 },
            { lat: 2, lng: 4 },
        ]);
        expect(result).toEqual({ lat: 1, lng: 2 });
    });
});

describe("buildDetailedLocationHistoryRows", () => {
    it("도보 경로의 중간 좌표를 recorded_at 순서로 history row로 만든다", () => {
        const rows = buildDetailedLocationHistoryRows({
            userId: "child-1",
            familyId: "family-1",
            previousPoint: {
                lat: 37.5665,
                lng: 126.9780,
                recordedAt: "2026-05-06T01:00:00.000Z",
            },
            currentPoint: {
                lat: 37.5685,
                lng: 126.9800,
                recordedAt: "2026-05-06T01:10:00.000Z",
            },
            routePoints: [
                { lat: 37.5665, lng: 126.9780 },
                { lat: 37.5670, lng: 126.9785 },
                { lat: 37.5680, lng: 126.9794 },
                { lat: 37.5685, lng: 126.9800 },
            ],
        });

        expect(rows).toHaveLength(3);
        expect(rows.map((row) => row.user_id)).toEqual(["child-1", "child-1", "child-1"]);
        expect(rows.map((row) => row.family_id)).toEqual(["family-1", "family-1", "family-1"]);
        expect(rows[0]).toMatchObject({ lat: 37.5670, lng: 126.9785 });
        expect(rows[2]).toMatchObject({ lat: 37.5685, lng: 126.9800 });
        expect(Date.parse(rows[0].recorded_at)).toBeGreaterThan(Date.parse("2026-05-06T01:00:00.000Z"));
        expect(Date.parse(rows[2].recorded_at)).toBe(Date.parse("2026-05-06T01:10:00.000Z"));
    });

    it("도보 경로가 없으면 현재 위치 1개만 저장한다", () => {
        const rows = buildDetailedLocationHistoryRows({
            userId: "child-1",
            familyId: "family-1",
            previousPoint: null,
            currentPoint: {
                lat: 37.5685,
                lng: 126.9800,
                recordedAt: "2026-05-06T01:10:00.000Z",
            },
            routePoints: [],
        });

        expect(rows).toEqual([
            {
                user_id: "child-1",
                family_id: "family-1",
                lat: 37.5685,
                lng: 126.98,
                recorded_at: "2026-05-06T01:10:00.000Z",
            },
        ]);
    });
});

describe("buildTrailDwellPlaces", () => {
    it("dwell 시간 미만은 무시", () => {
        const t0 = Date.now();
        const result = buildTrailDwellPlaces([
            { lat: 37.5, lng: 127, recordedMs: t0 },
            { lat: 37.5, lng: 127, recordedMs: t0 + 60_000 }, // 1분만
        ]);
        expect(result).toEqual([]);
    });

    it("같은 자리 10분 이상 머물면 dwell", () => {
        const t0 = new Date(2026, 4, 6, 8, 23).getTime();
        const result = buildTrailDwellPlaces([
            { lat: 37.5, lng: 127, recordedMs: t0 },
            { lat: 37.50005, lng: 127, recordedMs: t0 + 5 * 60_000 },
            { lat: 37.5, lng: 127.0001, recordedMs: t0 + 11 * 60_000 },
        ]);
        expect(result.length).toBe(1);
        expect(result[0].pointCount).toBe(3);
        expect(result[0].durationMs).toBeGreaterThanOrEqual(LOCATION_TRAIL_DWELL_MIN_MS);
        expect(result[0].timeLabel).toBe("11분 머무름");
        expect(result[0].label).toBe("11분 머무름");
        expect(result[0].timeLabel).not.toContain("08:23");
    });

    it("같은 장소라도 히스토리 간격이 크게 끊기면 현재 스냅샷을 체류시간에 합산하지 않는다", () => {
        const t0 = new Date(2026, 4, 6, 8, 23).getTime();
        const result = buildTrailDwellPlaces([
            { lat: 37.56650, lng: 126.97800, recordedMs: t0 },
            { lat: 37.56662, lng: 126.97804, recordedMs: t0 + 5 * 60_000 },
            { lat: 37.56673, lng: 126.97807, recordedMs: t0 + 11 * 60_000 },
            { lat: 37.56650, lng: 126.97800, recordedMs: t0 + 3 * 60 * 60_000 },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].timeLabel).toBe("11분 머무름");
    });

    it("recordedMs 없으면 무시", () => {
        const result = buildTrailDwellPlaces([
            { lat: 1, lng: 1 },
            { lat: 1, lng: 1 },
        ]);
        expect(result).toEqual([]);
    });
});

describe("constants", () => {
    it("LOCATION_TRAIL_JITTER_M = 8m", () => {
        expect(LOCATION_TRAIL_JITTER_M).toBe(8);
    });

    it("LOCATION_TRAIL_DWELL_RADIUS_M = 50m", () => {
        expect(LOCATION_TRAIL_DWELL_RADIUS_M).toBe(50);
    });

    it("LOCATION_TRAIL_DWELL_MIN_MS = 10분", () => {
        expect(LOCATION_TRAIL_DWELL_MIN_MS).toBe(10 * 60_000);
    });

    it("LOCATION_TRAIL_DWELL_MAX_SAMPLE_GAP_MS = 15분", () => {
        expect(LOCATION_TRAIL_DWELL_MAX_SAMPLE_GAP_MS).toBe(15 * 60_000);
    });
});

describe("is_estimated 플래그 (Phase D)", () => {
    it("normalizeLocationTrailPoint 가 is_estimated 를 isEstimated 로 보존", () => {
        const out = normalizeLocationTrailPoint({
            lat: 37.5, lng: 127.0,
            recorded_at: "2026-05-07T03:14:15.000Z",
            is_estimated: true,
        });
        expect(out.isEstimated).toBe(true);
    });

    it("normalizeLocationTrailPoint 는 플래그 없으면 isEstimated=false", () => {
        const out = normalizeLocationTrailPoint({
            lat: 37.5, lng: 127.0,
            recorded_at: "2026-05-07T03:14:15.000Z",
        });
        expect(out.isEstimated).toBe(false);
    });

    it("normalizeLocationTrailPoint 는 camelCase isEstimated 도 인식", () => {
        const out = normalizeLocationTrailPoint({
            lat: 37.5, lng: 127.0,
            recorded_at: "2026-05-07T03:14:15.000Z",
            isEstimated: true,
        });
        expect(out.isEstimated).toBe(true);
    });

    it("compactLocationTrailPoints 는 jitter 합칠 때 estimated 플래그 보존(OR)", () => {
        const out = compactLocationTrailPoints([
            { lat: 37.5, lng: 127.0, recorded_at: "2026-05-07T03:14:15.000Z", is_estimated: true },
            { lat: 37.50001, lng: 127.00001, recorded_at: "2026-05-07T03:14:20.000Z" },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].isEstimated).toBe(true);
    });

    it("buildTrailGradientSegments — estimated 끝점이 있으면 거리 무관 dashed=true", () => {
        const points = [
            { lat: 37.5, lng: 127.0, recordedMs: 1715000000000, isEstimated: true },
            { lat: 37.50011, lng: 127.0, recordedMs: 1715000005000, isEstimated: true },
        ];
        const segments = buildTrailGradientSegments(points);
        expect(segments).toHaveLength(1);
        expect(segments[0].dashed).toBe(true);
    });

    it("buildTrailGradientSegments — 정상 매칭 row 는 가까운 거리에서 solid", () => {
        const points = [
            { lat: 37.5, lng: 127.0, recordedMs: 1715000000000, isEstimated: false },
            { lat: 37.50011, lng: 127.0, recordedMs: 1715000005000, isEstimated: false },
        ];
        const segments = buildTrailGradientSegments(points);
        expect(segments[0].dashed).toBe(false);
    });

    it("buildTrailGradientSegments — estimated 와 정상 점이 인접해도 segment 가 dashed", () => {
        const points = [
            { lat: 37.5, lng: 127.0, recordedMs: 1715000000000, isEstimated: false },
            { lat: 37.50011, lng: 127.0, recordedMs: 1715000005000, isEstimated: true },
        ];
        const segments = buildTrailGradientSegments(points);
        expect(segments[0].dashed).toBe(true);
    });
});
