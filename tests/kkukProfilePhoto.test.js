import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.jsx", "utf8");

describe("kkuk profile photo payload", () => {
  test("child kkuk sends and renders the child profile photo when available", () => {
    expect(appSource).toContain("kkukPayload.senderPhotoUrl");
    expect(appSource).toContain("payload.senderPhotoUrl");
    expect(appSource).toContain("showKkukReceived.photoUrl");
    expect(appSource).toContain("kkukProfileChild");
    expect(appSource).toContain("<ChildAvatar");
  });
});
