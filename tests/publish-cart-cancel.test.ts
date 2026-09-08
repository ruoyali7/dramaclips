import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCartItem, cancelCartItem, getPackage, cancelPackage } = vi.hoisted(() => ({ getCartItem: vi.fn(), cancelCartItem: vi.fn(), getPackage: vi.fn(), cancelPackage: vi.fn() }));
vi.mock("@/lib/admin/publish-cart-repository", () => ({ getPublishCartItem: getCartItem, cancelPublishCartItem: cancelCartItem }));
vi.mock("@/lib/admin/publish-repository", () => ({ getPublishPackage: getPackage, requestCancelYixiaoerPackage: cancelPackage }));

import { POST } from "@/app/api/admin/publish-cart/[id]/route";

const request = () => new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) }) as never;
const context = { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) };

describe("scheduled cart cancellation", () => {
  beforeEach(() => { vi.clearAllMocks(); getCartItem.mockResolvedValue({ id: "cart-1", status: "scheduled", publishPackageId: "package-1" }); getPackage.mockResolvedValue({ id: "package-1", status: "scheduled" }); cancelPackage.mockResolvedValue({ id: "package-1", status: "ready" }); cancelCartItem.mockResolvedValue({ id: "cart-1", status: "canceled" }); });

  it("cancels only a package that has not started", async () => {
    expect((await POST(request(), context)).status).toBe(200);
    expect(cancelPackage).toHaveBeenCalledWith("package-1");
    expect(cancelCartItem).toHaveBeenCalledWith("cart-1");
  });

  it("refuses to cancel after publishing has started", async () => {
    getPackage.mockResolvedValue({ id: "package-1", status: "publishing" });
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(cancelPackage).not.toHaveBeenCalled();
  });
});
