import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { accessStatus, requireAppAccess } from "./access";
import { proxy } from "../proxy";
import { createApplicationAction, updateApplicationStatusAction } from "../app/applications/actions";
import { extractEmailAction, matchEmailAction, confirmEmailStatusAction } from "../app/applications/import/actions";

const { requestHeaders } = vi.hoisted(() => ({ requestHeaders: vi.fn() }));
vi.mock("next/headers", () => ({ headers: requestHeaders }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
const credential = (password: string) => `Basic ${Buffer.from(`jobtrack:${password}`).toString("base64")}`;

describe("personal app access", () => {
  it("fails closed in production when configuration is absent or blank", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const password of [undefined, "", "  "]) {
      vi.stubEnv("APP_ACCESS_PASSWORD", password);
      expect(accessStatus(null)).toBe(503);
    }
  });
  it("allows unconfigured local development", async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("APP_ACCESS_PASSWORD", "");
    expect(accessStatus(null)).toBe(200);
    await expect(requireAppAccess()).resolves.toBeUndefined();
    expect(requestHeaders).not.toHaveBeenCalled();
  });
  it("accepts only the configured credentials", async () => {
    vi.stubEnv("APP_ACCESS_PASSWORD", "test-password");
    for (const value of [null, "Basic !!!", "Bearer secret", credential("wrong")]) expect(accessStatus(value)).toBe(401);
    expect(accessStatus(credential("test-password"))).toBe(200);
    requestHeaders.mockResolvedValue(new Headers({ authorization: credential("test-password") }));
    await expect(requireAppAccess()).resolves.toBeUndefined();
  });
  it.each(["/", "/applications/new", "/applications/import", "/applications/invalid", "/_next/static/test.js"])("protects GET and POST requests to %s", (path) => {
    vi.stubEnv("APP_ACCESS_PASSWORD", "test-password");
    for (const method of ["GET", "POST"]) {
      const denied = proxy(new NextRequest(`https://example.com${path}`, { method }));
      expect(denied.status).toBe(401);
      expect(denied.headers.get("www-authenticate")).toContain("Basic");
      expect(denied.headers.get("cache-control")).toBe("no-store");
      expect(proxy(new NextRequest(`https://example.com${path}`, { method, headers: { authorization: credential("test-password") } })).status).toBe(200);
    }
  });
  it("blocks every Server Action independently of the proxy", async () => {
    vi.stubEnv("APP_ACCESS_PASSWORD", "test-password");
    requestHeaders.mockResolvedValue(new Headers());
    const data = new FormData();
    for (const action of [() => createApplicationAction({}, data), () => updateApplicationStatusAction("invalid", {}, data), () => extractEmailAction(data), () => matchEmailAction(data), () => confirmEmailStatusAction(data)]) {
      await expect(action()).rejects.toThrow("Application access denied");
    }
  });
});
