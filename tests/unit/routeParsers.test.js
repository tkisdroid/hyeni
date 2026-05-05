// tests/unit/routeParsers.test.js
import { describe, it, expect } from "vitest";
import {
    createHttpError,
    parseKakaoWalkingRoute,
    parseOsmFootRoute,
} from "../../src/lib/routeParsers.js";

describe("createHttpError", () => {
    it("Error 인스턴스 + status 속성", () => {
        const err = createHttpError("HTTP 401", 401);
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe("HTTP 401");
        expect(err.status).toBe(401);
    });

    it("status 미지정 시 undefined", () => {
        const err = createHttpError("oops");
        expect(err.status).toBeUndefined();
    });
});

describe("parseKakaoWalkingRoute", () => {
    const validKakaoData = {
        routes: [{
            result_code: 0,
            summary: { distance: 1234, duration: 567 },
            sections: [{
                roads: [{
                    vertexes: [127.0, 37.5, 127.001, 37.501, 127.002, 37.502],
                }],
            }],
        }],
    };

    it("정상 응답 → provider/points/distance/duration", () => {
        const result = parseKakaoWalkingRoute(validKakaoData);
        expect(result.provider).toBe("kakao");
        expect(result.points.length).toBeGreaterThanOrEqual(2);
        expect(result.distance).toBe(1234);
        expect(result.duration).toBe(567);
    });

    it("vertexes는 [lng, lat, lng, lat] 짝으로 파싱", () => {
        const result = parseKakaoWalkingRoute(validKakaoData);
        expect(result.points[0]).toEqual({ lat: 37.5, lng: 127.0 });
    });

    it("result_code !== 0 → throw", () => {
        expect(() => parseKakaoWalkingRoute({
            routes: [{ result_code: 104, result_message: "출발지 목적지 너무 가까움" }],
        })).toThrow("출발지 목적지 너무 가까움");
    });

    it("routes 비면 throw", () => {
        expect(() => parseKakaoWalkingRoute({ routes: [] })).toThrow();
        expect(() => parseKakaoWalkingRoute({})).toThrow();
    });

    it("점 1개 미만이면 throw (no path)", () => {
        expect(() => parseKakaoWalkingRoute({
            routes: [{
                result_code: 0,
                summary: {},
                sections: [{ roads: [{ vertexes: [127, 37.5] }] }],
            }],
        })).toThrow("no path");
    });

    it("summary.distance 없으면 sections.distance 합 사용", () => {
        const result = parseKakaoWalkingRoute({
            routes: [{
                result_code: 0,
                summary: {},
                sections: [
                    { distance: 100, duration: 60, roads: [{ vertexes: [127.0, 37.5, 127.001, 37.501] }] },
                    { distance: 200, duration: 120, roads: [{ vertexes: [127.001, 37.501, 127.002, 37.502] }] },
                ],
            }],
        });
        expect(result.distance).toBe(300);
        expect(result.duration).toBe(180);
    });

    it("duration 0 → null", () => {
        const result = parseKakaoWalkingRoute({
            routes: [{
                result_code: 0,
                summary: { distance: 100, duration: 0 },
                sections: [{ roads: [{ vertexes: [127, 37.5, 127.001, 37.501] }] }],
            }],
        });
        expect(result.duration).toBeNull();
    });
});

describe("parseOsmFootRoute", () => {
    const validOsmData = {
        code: "Ok",
        routes: [{
            distance: 1234,
            duration: 567,
            geometry: {
                coordinates: [[127.0, 37.5], [127.001, 37.501], [127.002, 37.502]],
            },
        }],
    };

    it("정상 응답 파싱", () => {
        const result = parseOsmFootRoute(validOsmData);
        expect(result.provider).toBe("osm-foot");
        expect(result.points.length).toBeGreaterThanOrEqual(2);
        expect(result.distance).toBe(1234);
        expect(result.duration).toBe(567);
    });

    it("coordinates는 [lng, lat] → 내부는 {lat, lng}", () => {
        const result = parseOsmFootRoute(validOsmData);
        expect(result.points[0]).toEqual({ lat: 37.5, lng: 127.0 });
    });

    it("code !== Ok → throw", () => {
        expect(() => parseOsmFootRoute({ code: "Error", message: "no route" })).toThrow("no route");
        expect(() => parseOsmFootRoute({ code: "NoRoute" })).toThrow();
    });

    it("geometry 없으면 throw", () => {
        expect(() => parseOsmFootRoute({
            code: "Ok",
            routes: [{ distance: 100 }],
        })).toThrow("no geometry");
    });

    it("점 부족하면 throw", () => {
        expect(() => parseOsmFootRoute({
            code: "Ok",
            routes: [{ distance: 0, geometry: { coordinates: [[127, 37.5]] } }],
        })).toThrow("no path");
    });

    it("distance/duration null이면 fallback (sumRouteDistance / null)", () => {
        const result = parseOsmFootRoute({
            code: "Ok",
            routes: [{
                geometry: {
                    coordinates: [[127.0, 37.5], [127.001, 37.501]],
                },
            }],
        });
        expect(result.distance).toBeGreaterThan(0);
        expect(result.duration).toBeNull();
    });
});
