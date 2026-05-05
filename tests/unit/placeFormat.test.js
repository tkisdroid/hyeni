// tests/unit/placeFormat.test.js
import { describe, it, expect } from "vitest";
import {
    formatLatLngLabel,
    getPositionLocationKey,
    extractNeighborhoodLabel,
    formatCompactPlaceName,
    buildCompactAddressLabel,
    buildReadablePlaceName,
    isDetailedKoreanAddress,
    extractPreciseAddressFromKakao,
    hasPlaceLocation,
    getPlaceLocationKey,
    buildSavedPlaceItems,
    buildSchedulePlaceOptions,
    buildEventPlaceItems,
    eventDateValue,
} from "../../src/lib/placeFormat.js";

describe("formatLatLngLabel", () => {
    it("정상 좌표 → '좌표 lat, lng' (소수점 5자리)", () => {
        expect(formatLatLngLabel({ lat: 37.5665, lng: 126.9780 })).toBe("좌표 37.56650, 126.97800");
    });

    it("invalid 좌표 → 빈 문자열", () => {
        expect(formatLatLngLabel(null)).toBe("");
        expect(formatLatLngLabel({ lat: NaN, lng: 0 })).toBe("");
        expect(formatLatLngLabel({ lat: "abc", lng: 127 })).toBe("");
    });
});

describe("getPositionLocationKey", () => {
    it("좌표 + user_id 모두 있으면 user 키", () => {
        expect(getPositionLocationKey({ lat: 37.5, lng: 127, user_id: "u1" })).toBe("user:u1:37.5000,127.0000");
    });

    it("좌표만 있으면 coord 키", () => {
        expect(getPositionLocationKey({ lat: 37.5, lng: 127 })).toBe("coord:37.5000,127.0000");
    });

    it("좌표 없고 user_id만 → user 키 (좌표 없음)", () => {
        expect(getPositionLocationKey({ user_id: "u1" })).toBe("user:u1");
    });

    it("아무것도 없으면 빈 문자열", () => {
        expect(getPositionLocationKey({})).toBe("");
        expect(getPositionLocationKey(null)).toBe("");
    });

    it("좌표가 ~11m 이동해도 키 변경됨 (4자리 grid)", () => {
        const a = getPositionLocationKey({ lat: 37.5000, lng: 127.0 });
        const b = getPositionLocationKey({ lat: 37.5001, lng: 127.0 });
        expect(a).not.toBe(b);
    });
});

describe("extractNeighborhoodLabel", () => {
    it("source의 region_3depth 우선", () => {
        expect(extractNeighborhoodLabel("아무거나", { region_3depth_h_name: "역삼동" })).toBe("역삼동");
    });

    it("동/읍/면/리 토큰 검출", () => {
        expect(extractNeighborhoodLabel("서울 강남구 역삼동")).toBe("역삼동");
        expect(extractNeighborhoodLabel("경기 광명시 일직동")).toBe("일직동");
    });

    it("동 없으면 구/시/군 fallback", () => {
        expect(extractNeighborhoodLabel("서울 강남구")).toBe("강남구");
        expect(extractNeighborhoodLabel("부산 해운대구")).toBe("해운대구");
    });

    it("좌표 시작 텍스트 → 빈 문자열", () => {
        expect(extractNeighborhoodLabel("좌표 37.5, 127")).toBe("");
    });

    it("빈 입력 → 빈 문자열", () => {
        expect(extractNeighborhoodLabel("")).toBe("");
        expect(extractNeighborhoodLabel(null)).toBe("");
    });
});

describe("formatCompactPlaceName", () => {
    it("'아파트1차' → '아파트 1차' 분리", () => {
        expect(formatCompactPlaceName("롯데아파트1차")).toBe("롯데아파트 1차");
    });

    it("'101동' 동 표기 제거", () => {
        expect(formatCompactPlaceName("롯데아파트 101동")).toBe("롯데아파트");
    });

    it("연속 공백 정규화", () => {
        expect(formatCompactPlaceName("아파트   이름  ")).toBe("아파트 이름");
    });

    it("null/undefined → 빈 문자열", () => {
        expect(formatCompactPlaceName(null)).toBe("");
        expect(formatCompactPlaceName(undefined)).toBe("");
    });
});

describe("buildCompactAddressLabel", () => {
    it("동 + 건물명 우선", () => {
        const result = buildCompactAddressLabel({
            road_address: { building_name: "센트럴타워", region_3depth_h_name: "역삼동" },
        });
        expect(result).toBe("역삼동 센트럴타워");
    });

    it("동만 있으면 동 반환", () => {
        const result = buildCompactAddressLabel({
            address: { region_3depth_h_name: "역삼동" },
        });
        expect(result).toBe("역삼동");
    });

    it("아무것도 없으면 빈 문자열", () => {
        expect(buildCompactAddressLabel({})).toBe("");
    });
});

describe("buildReadablePlaceName", () => {
    it("road building_name 우선", () => {
        expect(buildReadablePlaceName({ road_address: { building_name: "센트럴타워" } })).toBe("센트럴타워");
    });

    it("building_name 없으면 buildCompactAddressLabel fallback", () => {
        expect(buildReadablePlaceName({
            address: { region_3depth_h_name: "역삼동" },
        })).toBe("역삼동");
    });
});

describe("isDetailedKoreanAddress", () => {
    it("road_name 있으면 true", () => {
        expect(isDetailedKoreanAddress("서울", { road_name: "테헤란로" })).toBe(true);
    });

    it("숫자 포함하면 true", () => {
        expect(isDetailedKoreanAddress("서울 강남구 123")).toBe(true);
    });

    it("숫자 없고 source 비면 false", () => {
        expect(isDetailedKoreanAddress("서울", {})).toBe(false);
    });

    it("빈 입력 → false", () => {
        expect(isDetailedKoreanAddress("", {})).toBe(false);
    });
});

describe("extractPreciseAddressFromKakao", () => {
    it("정확한 도로명 주소 → precise=true", () => {
        const result = extractPreciseAddressFromKakao({
            road_address: {
                address_name: "서울 강남구 테헤란로 123",
                road_name: "테헤란로",
                building_name: "센트럴타워",
            },
        });
        expect(result.precise).toBe(true);
        expect(result.label).toContain("테헤란로 123");
        expect(result.label).toContain("센트럴타워");
    });

    it("주소 없으면 fallbackPosition으로 좌표 라벨", () => {
        const result = extractPreciseAddressFromKakao({}, { lat: 37.5, lng: 127 });
        expect(result.precise).toBe(false);
        expect(result.label).toContain("37.50000");
    });

    it("주소도 fallback도 없으면 '정확한 위치 확인 중'", () => {
        const result = extractPreciseAddressFromKakao({}, null);
        expect(result.label).toBe("정확한 위치 확인 중");
    });
});

describe("hasPlaceLocation", () => {
    it("정상 좌표 → true", () => {
        expect(hasPlaceLocation({ lat: 37.5, lng: 127 })).toBe(true);
    });

    it("문자열 좌표도 OK", () => {
        expect(hasPlaceLocation({ lat: "37.5", lng: "127" })).toBe(true);
    });

    it("null/NaN → false", () => {
        expect(hasPlaceLocation(null)).toBe(false);
        expect(hasPlaceLocation({ lat: NaN, lng: 127 })).toBe(false);
        expect(hasPlaceLocation({ lat: "abc", lng: 127 })).toBe(false);
    });
});

describe("getPlaceLocationKey", () => {
    it("address 있으면 addr 키", () => {
        expect(getPlaceLocationKey({ lat: 37.5, lng: 127, address: "서울 강남구" })).toBe("addr:서울 강남구");
    });

    it("address 없으면 coord 키 (5자리)", () => {
        expect(getPlaceLocationKey({ lat: 37.5, lng: 127 })).toBe("coord:37.50000:127.00000");
    });

    it("좌표 없으면 빈 문자열", () => {
        expect(getPlaceLocationKey({})).toBe("");
    });

    it("address 대소문자/공백 정규화", () => {
        const a = getPlaceLocationKey({ lat: 37.5, lng: 127, address: "  Seoul  " });
        expect(a).toBe("addr:seoul");
    });
});

describe("buildSavedPlaceItems", () => {
    it("같은 키 중복 제거", () => {
        const result = buildSavedPlaceItems([
            { id: "a", location: { lat: 37.5, lng: 127, address: "서울" } },
            { id: "b", location: { lat: 37.5, lng: 127, address: "서울" } },
        ]);
        expect(result.length).toBe(1);
    });

    it("좌표 없는 항목 무시", () => {
        const result = buildSavedPlaceItems([
            { id: "a", location: { lat: 37.5, lng: 127 } },
            { id: "b", location: null },
        ]);
        expect(result.length).toBe(1);
    });

    it("undefined → 빈 배열", () => {
        expect(buildSavedPlaceItems(undefined)).toEqual([]);
    });
});

describe("buildSchedulePlaceOptions", () => {
    it("학원 + 저장장소 모두 포함, 학원 먼저", () => {
        const result = buildSchedulePlaceOptions(
            [{ id: "a1", name: "영어학원", location: { lat: 1, lng: 1, address: "addr1" } }],
            [{ id: "p1", name: "공원", location: { lat: 2, lng: 2, address: "addr2" } }]
        );
        expect(result.length).toBe(2);
        expect(result[0].source).toBe("academy");
        expect(result[1].source).toBe("saved_place");
    });

    it("동일 위치는 하나만 (학원 우선)", () => {
        const result = buildSchedulePlaceOptions(
            [{ id: "a1", name: "영어학원", location: { lat: 1, lng: 1, address: "addr1" } }],
            [{ id: "p1", name: "공원", location: { lat: 1, lng: 1, address: "addr1" } }]
        );
        expect(result.length).toBe(1);
        expect(result[0].source).toBe("academy");
    });

    it("playdate_safe 장소는 안전 뱃지", () => {
        const result = buildSchedulePlaceOptions([], [
            { id: "p1", name: "안전공원", location: { lat: 1, lng: 1, address: "x" }, is_playdate_safe: true },
        ]);
        expect(result[0].badge).toBe("안전장소");
        expect(result[0].emoji).toBe("🛡️");
    });
});

describe("eventDateValue", () => {
    it("정상 dateKey + time → ms timestamp", () => {
        const ms = eventDateValue("2026-04-05", "14:30");
        expect(ms).toBe(new Date(2026, 4, 5, 14, 30).getTime());
    });

    it("non-numeric 문자열 → POSITIVE_INFINITY (Number.isNaN 가드)", () => {
        expect(eventDateValue("not-a-date", "abc")).toBe(Number.POSITIVE_INFINITY);
        expect(eventDateValue("2026-aa-bb", "10:00")).toBe(Number.POSITIVE_INFINITY);
    });

    it("non-string → POSITIVE_INFINITY", () => {
        expect(eventDateValue(null, null)).toBe(Number.POSITIVE_INFINITY);
        expect(eventDateValue(undefined, "10:00")).toBe(Number.POSITIVE_INFINITY);
    });
});

describe("buildEventPlaceItems", () => {
    it("같은 위치 이벤트는 그룹화", () => {
        const events = {
            "2026-05-05": [
                { id: "e1", title: "영어", time: "10:00", location: { lat: 1, lng: 1, address: "x" } },
                { id: "e2", title: "수학", time: "14:00", location: { lat: 1, lng: 1, address: "x" } },
            ],
        };
        const result = buildEventPlaceItems(events);
        expect(result.length).toBe(1);
        expect(result[0].eventCount).toBe(2);
    });

    it("excludedKeys 제외", () => {
        const events = {
            "2026-05-05": [
                { id: "e1", time: "10:00", location: { lat: 1, lng: 1, address: "x" } },
                { id: "e2", time: "11:00", location: { lat: 2, lng: 2, address: "y" } },
            ],
        };
        const excluded = new Set(["addr:x"]);
        const result = buildEventPlaceItems(events, excluded);
        expect(result.length).toBe(1);
        expect(result[0].location.address).toBe("y");
    });

    it("arrivedSet 카운트 반영", () => {
        const events = {
            "2026-05-05": [
                { id: "e1", title: "T1", time: "10:00", location: { lat: 1, lng: 1, address: "x" } },
                { id: "e2", title: "T1", time: "11:00", location: { lat: 1, lng: 1, address: "x" } },
            ],
        };
        const arrived = new Set(["e1"]);
        const result = buildEventPlaceItems(events, new Set(), arrived);
        expect(result[0].arrivedCount).toBe(1);
    });

    it("좌표 없는 이벤트 무시", () => {
        const events = {
            "2026-05-05": [
                { id: "e1", time: "10:00", location: null },
                { id: "e2", time: "11:00", location: { lat: 1, lng: 1, address: "x" } },
            ],
        };
        const result = buildEventPlaceItems(events);
        expect(result.length).toBe(1);
        expect(result[0].nextEvent.id).toBe("e2");
    });

    it("이벤트 없으면 빈 배열", () => {
        expect(buildEventPlaceItems({})).toEqual([]);
        expect(buildEventPlaceItems(null)).toEqual([]);
    });

    it("그룹 정렬: 가장 가까운 nextEvent 먼저", () => {
        const events = {
            "2026-05-05": [
                { id: "e1", time: "14:00", location: { lat: 1, lng: 1, address: "later" } },
                { id: "e2", time: "10:00", location: { lat: 2, lng: 2, address: "earlier" } },
            ],
        };
        const result = buildEventPlaceItems(events);
        expect(result[0].location.address).toBe("earlier");
    });

    it("같은 그룹 내 이벤트 시간순 정렬", () => {
        const events = {
            "2026-05-05": [
                { id: "e1", time: "14:00", location: { lat: 1, lng: 1, address: "x" } },
                { id: "e2", time: "10:00", location: { lat: 1, lng: 1, address: "x" } },
            ],
        };
        const result = buildEventPlaceItems(events);
        expect(result[0].events[0].id).toBe("e2");
        expect(result[0].events[1].id).toBe("e1");
    });
});
