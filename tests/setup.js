import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { supabase } from "../src/lib/supabase.js";

beforeEach(() => {
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    // ignore storage reset failures
  }

  if (supabase.__mock?.reset) {
    supabase.__mock.reset();
  }
});
