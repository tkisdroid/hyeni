import { describe, expect, it } from "vitest";
import { ALL_FEATURES, FEATURES } from "../src/lib/features.js";

describe("FEATURES", () => {
  it("keeps the subscription feature keys stable", () => {
    expect(FEATURES.REALTIME_LOCATION).toBe("realtime_location");
    expect(FEATURES.MULTI_CHILD).toBe("multi_child");
    expect(FEATURES.REMOTE_AUDIO).toBe("remote_audio");
    expect(FEATURES.AI_ANALYSIS).toBe("ai_analysis");
    expect(FEATURES.ACADEMY_SCHEDULE).toBe("academy_schedule");
    expect(FEATURES.SAVED_PLACES).toBe("saved_places");
    expect(FEATURES.MULTI_GEOFENCE).toBe("multi_geofence");
    expect(FEATURES.EXTENDED_HISTORY).toBe("extended_history");
    expect(ALL_FEATURES).toHaveLength(8);
  });
});
