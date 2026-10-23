import { afterEach, expect, it, vi } from "vitest";
import { decryptTokens, encryptTokens, messageText, GMAIL_SCOPE, reportGmailCallbackFailure } from "./gmail";

afterEach(() => vi.unstubAllEnvs());
it("encrypts tokens with randomized authenticated encryption", () => {
  vi.stubEnv("GMAIL_TOKEN_KEY", Buffer.alloc(32, 1).toString("base64"));
  const encrypted = encryptTokens("refresh-secret");
  expect(encrypted).not.toContain("refresh-secret");
  expect(encryptTokens("refresh-secret")).not.toBe(encrypted);
  expect(decryptTokens(encrypted)).toBe("refresh-secret");
  const tampered = Buffer.from(encrypted, "base64"); tampered[28] ^= 1;
  expect(() => decryptTokens(tampered.toString("base64"))).toThrow();
  vi.stubEnv("GMAIL_TOKEN_KEY", Buffer.alloc(32, 2).toString("base64"));
  expect(() => decryptTokens(encrypted)).toThrow();
});
it("rejects missing encryption keys", () => {
  vi.stubEnv("GMAIL_TOKEN_KEY", "");
  expect(() => encryptTokens("secret")).toThrow();
});
it("extracts bounded plain text without HTML or attachments", () => {
  expect(GMAIL_SCOPE).toBe("https://www.googleapis.com/auth/gmail.readonly");
  expect(messageText({ parts: [
    { mimeType: "text/plain", filename: "secret.txt", body: { data: Buffer.from("attachment").toString("base64url") } },
    { mimeType: "text/html", body: { data: Buffer.from("HTML").toString("base64url") } },
    { mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: Buffer.from("Interview invitation").toString("base64url") } }] },
  ] }).trim()).toBe("Interview invitation");
  expect(messageText({ mimeType: "text/plain", body: { data: Buffer.from("x".repeat(21000)).toString("base64url") } })).toHaveLength(20000);
});

it("reports only the failing stage in development and stays silent elsewhere", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    for (const environment of ["production", "test"] as const) {
      vi.stubEnv("NODE_ENV", environment);
      reportGmailCallbackFailure("token_encryption");
    }
    expect(log).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "development");
    reportGmailCallbackFailure("token_encryption");
    expect(log.mock.calls).toEqual([["Gmail callback failed", { stage: "token_encryption" }]]);
  } finally { log.mockRestore(); }
});
