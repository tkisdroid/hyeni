import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sendSmsSource = readFileSync("supabase/functions/send-sms/index.ts", "utf8");

describe("send-sms edge function contract", () => {
  it("returns a JSON success response so Supabase Auth receives Content-Type", () => {
    expect(sendSmsSource).toContain("return jsonResponse({ ok: true })");
    expect(sendSmsSource).not.toContain("return new Response(null, { status: 200 })");
  });
});
