import { describe, expect, it } from "vitest";
import { assertSafeDevelopmentPublishingDatabase } from "@/lib/admin/supabase-config";

describe("development publishing database safety", () => {
  it("allows local Supabase", () => {
    expect(() => assertSafeDevelopmentPublishingDatabase({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it("blocks an arbitrary remote database", () => {
    expect(() => assertSafeDevelopmentPublishingDatabase({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co" } as NodeJS.ProcessEnv)).toThrow("Publishing mutations are blocked");
  });

  it("allows only the named remote development project", () => {
    expect(() => assertSafeDevelopmentPublishingDatabase({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://devref.supabase.co", ALLOW_REMOTE_DEVELOPMENT_DB: "true", DEV_SUPABASE_PROJECT_REF: "devref" } as NodeJS.ProcessEnv)).not.toThrow();
  });
});
