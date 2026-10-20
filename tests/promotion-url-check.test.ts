import { beforeEach, describe, expect, it, vi } from "vitest";

const { findConflict } = vi.hoisted(() => ({ findConflict: vi.fn() }));
vi.mock("@/lib/admin/repository", () => ({ findPromotionUrlConflict: findConflict }));
import { POST } from "@/app/api/admin/dramas/promotion-url-check/route";

describe("promotion URL check", () => {
  beforeEach(() => findConflict.mockReset());

  it("returns only the owning drama title when a URL already exists", async () => {
    findConflict.mockResolvedValue({ id: "drama-1", title: "Existing Drama" });
    const response = await POST(new Request("http://local", { method: "POST", body: JSON.stringify({ url: "https://reelslink.com/cps/existing" }) }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ exists: true, dramaTitle: "Existing Drama" });
  });

  it("rejects unsupported promotion URLs before repository access", async () => {
    const response = await POST(new Request("http://local", { method: "POST", body: JSON.stringify({ url: "https://example.com/not-reelshort" }) }) as never);
    expect(response.status).toBe(400);
    expect(findConflict).not.toHaveBeenCalled();
  });
});
