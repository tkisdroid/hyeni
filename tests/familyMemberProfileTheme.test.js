import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

// Phase 5 #4 / B9: PairingModal (with profile edit surface) moved to components/pairing/PairingModal.jsx.
// Phase 5 #4 / B24: PROFILE_THEME_RPC_MISSING_MESSAGE + isMissingProfileThemeRpcError moved to lib/errorChecks.js.
const appJsxOnly = readFileSync("src/App.jsx", "utf8");
const pairingModalSource = readFileSync("src/components/pairing/PairingModal.jsx", "utf8");
const errorChecksSource = readFileSync("src/lib/errorChecks.js", "utf8");
const appSource = `${appJsxOnly}\n${pairingModalSource}\n${errorChecksSource}`;
const migrationSource = readFileSync("supabase/migrations/20260504000000_set_family_member_profile_by_id.sql", "utf8");
const downMigrationSource = readFileSync("supabase/migrations/down/20260504000000_set_family_member_profile_by_id.sql", "utf8");
const pairingWizardSource = readFileSync("src/components/multichild/PairingWizard/PairingWizard.jsx", "utf8");
const photoUploadSource = readFileSync("src/components/multichild/PairingWizard/PhotoUpload.jsx", "utf8");

describe("family member profile theme color editing", () => {
  test("profile edit surface lets a parent change the child theme color", () => {
    expect(appSource).toContain('import { ColorPicker } from "./components/multichild/PairingWizard/ColorPicker.jsx"');
    expect(appSource).toContain("onProfileChange");
    expect(appSource).toContain("const [editColor, setEditColor] = useState");
    expect(appSource).toContain("테마 색상");
    expect(appSource).toContain("<ColorPicker");
    expect(appSource).toContain("selected={editColor}");
    expect(appSource).toContain("usedColors={usedChildColors.filter");
    expect(appSource).toContain("applyThemeColor(activeThemeColor || null)");
    expect(appSource).toContain("set_family_member_profile_by_id");
    expect(appSource).toContain("p_color_hex");
  });

  test("profile save explains when the deployed Supabase RPC is missing", () => {
    expect(appSource).toContain("PROFILE_THEME_RPC_MISSING_MESSAGE");
    expect(appSource).toContain("function isMissingProfileThemeRpcError");
    expect(appSource).toContain("PGRST202");
    expect(appSource).toContain("set_family_member_profile_by_id");
    expect(appSource).toContain("테마 색상 저장 서버 함수가 아직 반영되지 않았어요");
  });

  test("profile save disables duplicate clicks and exposes saving or failure state", () => {
    expect(appSource).toContain("profileSavingId");
    expect(appSource).toContain("profileSaveError");
    expect(appSource).toContain("저장 중");
    expect(appSource).toContain('role="status"');
    expect(appSource).toContain("disabled={isSavingProfile}");
  });

  test("profile photo surfaces use the shared fallback avatar instead of raw background URLs", () => {
    expect(appSource).toContain('import { ChildAvatar } from "./components/multichild/HomeDashboard/ChildAvatar.jsx"');
    expect(appSource).toContain("<ChildAvatar");
    expect(appSource).not.toContain("backgroundImage: `url(${child.photo_url})`");
    expect(appSource).not.toContain("? `url(${child.photo_url}) center/cover`");
    expect(appSource).not.toContain("style={child.photo_url ? { backgroundImage");
  });

  test("child photo uploads avoid storing private bucket public URLs", () => {
    expect(pairingWizardSource).not.toContain("getPublicUrl(path)");
    expect(pairingWizardSource).toContain("p_url: path");
    expect(appSource).toContain("await onPhotoChange?.(child.id, path)");
    expect(photoUploadSource).not.toContain("getPublicUrl(path)");
    expect(photoUploadSource).toContain("createSignedUrl(path");
  });

  test("profile color update RPC validates the color and has a paired down migration", () => {
    expect(migrationSource).toContain("BEGIN;");
    expect(migrationSource).toContain("CREATE OR REPLACE FUNCTION public.set_family_member_profile_by_id");
    expect(migrationSource).toContain("families");
    expect(migrationSource).toContain("parent_id = auth.uid()");
    expect(migrationSource).toContain("p_color_hex !~ '^#[0-9A-Fa-f]{6}$'");
    expect(migrationSource).toContain("color_hex = upper(trim(p_color_hex))");
    expect(migrationSource).toContain("COMMIT;");
    expect(downMigrationSource).toContain("DROP FUNCTION IF EXISTS public.set_family_member_profile_by_id(uuid, uuid, text, text);");
  });
});
