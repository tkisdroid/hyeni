import { describe, expect, test } from "vitest";
import { buildHomeRouteEvent, findHomeSavedPlace } from "../src/lib/navigationTargets.js";

describe("navigation target helpers", () => {
  test("finds the explicit home saved place before other places containing 집", () => {
    const places = [
      { id: "grandma", name: "할머니 집", location: { lat: 37.1, lng: 127.1, address: "할머니집" } },
      { id: "home", name: "우리 집", location: { lat: 37.5, lng: 127.0, address: "우리집" } },
    ];

    expect(findHomeSavedPlace(places)?.id).toBe("home");
  });

  test("ignores home-like names without valid coordinates", () => {
    const places = [
      { id: "bad", name: "집", location: { lat: null, lng: 127.0 } },
      { id: "fallback", name: "우리집", location: { lat: 37.5, lng: 127.0 } },
    ];

    expect(findHomeSavedPlace(places)?.id).toBe("fallback");
  });

  test("builds a route event that RouteOverlay can consume", () => {
    const event = buildHomeRouteEvent({
      id: "home",
      name: "우리 집",
      location: { lat: 37.5, lng: 127.0, address: "서울 집" },
    });

    expect(event).toMatchObject({
      id: "home-route:home",
      title: "집으로 가기",
      emoji: "🏠",
      time: "지금",
      location: { lat: 37.5, lng: 127.0, address: "서울 집" },
    });
  });
});
