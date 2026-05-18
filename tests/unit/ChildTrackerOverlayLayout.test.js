import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ChildTrackerOverlay } from "../../src/components/childTracker/ChildTrackerOverlay.jsx";

const childTrackerOverlaySource = readFileSync("src/components/childTracker/ChildTrackerOverlay.jsx", "utf8");
const appSource = readFileSync("src/App.jsx", "utf8");

describe("ChildTrackerOverlay layout", () => {
  it("keeps the live tracker map near half of the screen by default", () => {
    expect(childTrackerOverlaySource).toContain('const CHILD_TRACKER_MAP_MIN_HEIGHT = "50dvh";');
    expect(childTrackerOverlaySource).toContain('const CHILD_TRACKER_DEFAULT_PANEL_HEIGHT = "clamp(180px, 34dvh, 300px)";');
    expect(childTrackerOverlaySource).toContain("height: bottomHeight != null ? bottomHeight : CHILD_TRACKER_DEFAULT_PANEL_HEIGHT");
    expect(childTrackerOverlaySource).toContain("minHeight: CHILD_TRACKER_MAP_MIN_HEIGHT");
    expect(childTrackerOverlaySource).not.toContain('height: bottomHeight != null ? bottomHeight : "auto"');
  });

  it("renders the fallback map in the same half-screen tracker slot", () => {
    render(React.createElement(ChildTrackerOverlay, {
      childPos: { lat: 37.5665, lng: 126.9780, updatedAt: new Date().toISOString() },
      allChildPositions: [{
        user_id: "child-1",
        name: "혜니",
        lat: 37.5665,
        lng: 126.9780,
        updatedAt: new Date().toISOString(),
      }],
      pairedChildren: [{ user_id: "child-1", name: "혜니" }],
      events: {},
      mapReady: false,
      arrivedSet: new Set(),
      onClose: () => {},
      locationTrail: [{
        user_id: "child-1",
        lat: 37.5665,
        lng: 126.9780,
        recorded_at: new Date().toISOString(),
      }],
    }));

    const fallbackMap = screen.getByTestId("hyeni-fallback-map");
    const mapPanel = fallbackMap.parentElement;
    const detailsPanel = mapPanel?.nextElementSibling;
    const mapPanelStyle = mapPanel?.getAttribute("style") || "";
    const detailsPanelStyle = detailsPanel?.getAttribute("style") || "";

    expect(mapPanelStyle).toContain("flex: 1 1 50dvh");
    expect(mapPanelStyle).toContain("min-height: 50dvh");
    expect(detailsPanelStyle).toContain("min-height: 110px");
    expect(detailsPanelStyle).toContain("max-height: 62vh");
  });

  it("opens the tracker from a child status card with that child selected", () => {
    const childStatusStart = appSource.indexOf("아이 현황");
    const childStatusEnd = appSource.indexOf("className=\"hyeni-v5-memo-mini\"", childStatusStart);
    const childStatusSource = appSource.slice(childStatusStart, childStatusEnd);

    expect(childStatusSource).toContain("if (child.id) setSelectedChildId(child.id);");
    expect(childStatusSource).toContain("setShowChildTracker(true);");
  });

  it("filters the tracker map and child status list to the selected child", () => {
    const now = new Date();
    render(React.createElement(ChildTrackerOverlay, {
      childPos: { lat: 37.5665, lng: 126.9780, updatedAt: now.toISOString() },
      allChildPositions: [
        { user_id: "child-1", name: "지우", lat: 37.5665, lng: 126.9780, updatedAt: now.toISOString() },
        { user_id: "child-2", name: "민준", lat: 37.5690, lng: 126.9820, updatedAt: now.toISOString() },
      ],
      pairedChildren: [
        { id: "member-1", user_id: "child-1", name: "지우" },
        { id: "member-2", user_id: "child-2", name: "민준" },
      ],
      events: {},
      selectedChildUserId: "child-2",
      mapReady: false,
      arrivedSet: new Set(),
      onClose: () => {},
      locationTrail: [
        { user_id: "child-1", lat: 37.5665, lng: 126.9780, recorded_at: now.toISOString() },
        { user_id: "child-2", lat: 37.5690, lng: 126.9820, recorded_at: now.toISOString() },
      ],
    }));

    expect(screen.queryByText("지우")).not.toBeInTheDocument();
    expect(screen.getAllByText("민준").length).toBeGreaterThan(0);
  });

  it("shows when a dwell happened together with how long it lasted", () => {
    const t0 = new Date(2026, 4, 6, 8, 23).getTime();
    const t1 = t0 + 5 * 60_000;
    const t2 = t0 + 11 * 60_000;
    const startLabel = new Date(t0).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    const endLabel = new Date(t2).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

    render(React.createElement(ChildTrackerOverlay, {
      childPos: { lat: 37.5665, lng: 126.9780, updatedAt: new Date(t2).toISOString() },
      allChildPositions: [{
        user_id: "child-1",
        name: "혜니",
        lat: 37.5665,
        lng: 126.9780,
        updatedAt: new Date(t2).toISOString(),
      }],
      pairedChildren: [{ id: "member-1", user_id: "child-1", name: "혜니" }],
      events: {},
      selectedChildUserId: "child-1",
      mapReady: false,
      arrivedSet: new Set(),
      onClose: () => {},
      locationTrail: [
        { user_id: "child-1", lat: 37.56650, lng: 126.97800, recorded_at: new Date(t0).toISOString() },
        { user_id: "child-1", lat: 37.56662, lng: 126.97804, recorded_at: new Date(t1).toISOString() },
        { user_id: "child-1", lat: 37.56673, lng: 126.97807, recorded_at: new Date(t2).toISOString() },
      ],
    }));

    expect(screen.getByText("오래 머문 곳")).toBeVisible();
    expect(screen.getByText(new RegExp(`${startLabel}.*${endLabel}.*11분 머무름`))).toBeVisible();
  });
});
