import { test, expect, type Page } from "@playwright/test";
import { applications, query, seedApplication } from "./helpers/db";

async function analyze(page: Page, kind: "confirmation" | "interview") {
  await page.goto("/applications/import");
  await page.getByLabel("Email (plain text)").fill(`E2E ${kind} email`);
  await page.getByRole("button", { name: "Analyze email", exact: true }).click();
  await expect(page.getByRole("heading", { name: kind === "confirmation" ? "Draft ready for review" : "Review status update: Interview" })).toBeVisible();
}

async function dashboardStatus(page: Page, status: string) {
  await page.goto("/");
  const row = page.getByRole("row").filter({ hasText: "Example Company" });
  await expect(row).toHaveCount(1);
  await expect(row.getByText(status, { exact: true })).toBeVisible();
}

test.beforeEach(async () => { await query("TRUNCATE applications,gmail_connection,gmail_imports"); });

test("create application and retain all fields after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create application", exact: true }).first().click();
  await page.getByLabel("Company", { exact: true }).fill("Example Company");
  await page.getByLabel("Position", { exact: true }).fill("Engineer");
  await page.getByLabel("Applied date", { exact: true }).fill("2026-10-07");
  await page.getByLabel("Job URL").fill("https://example.com/jobs/123");
  await page.getByLabel("Job description").fill("Build useful software");
  await page.getByRole("button", { name: "Create application", exact: true }).click();
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Engineer", exact: true })).toBeVisible();
  await expect(page.getByText("2026-10-07", { exact: true })).toBeVisible();
  await expect(page.getByText("Build useful software", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View job posting" })).toHaveAttribute("href", "https://example.com/jobs/123");
  expect(await applications()).toHaveLength(1);
  await dashboardStatus(page, "Applied");
});

test("update status and persist it without changing application fields", async ({ page }) => {
  const id = await seedApplication();
  const [before] = await applications();
  await page.goto(`/applications/${id}`);
  await page.getByLabel("Update status").selectOption("INTERVIEW");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Status updated.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Update status")).toHaveValue("INTERVIEW");
  const [after] = await applications();
  expect(after).toEqual({ ...before, status: "INTERVIEW", updated_at: expect.any(Date) });
  await dashboardStatus(page, "Interview");
});

test("review confirmation email, edit draft, then explicitly save", async ({ page }) => {
  await analyze(page, "confirmation");
  expect(await applications()).toHaveLength(0);
  await page.getByLabel("Position", { exact: true }).fill("Senior Engineer");
  await page.getByRole("button", { name: "Confirm and save application" }).click();
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Senior Engineer", exact: true })).toBeVisible();
  expect(await applications()).toMatchObject([{ company: "Example Company", position: "Senior Engineer", status: "APPLIED" }]);
  await dashboardStatus(page, "Applied");
});

test("review status email and confirm update to the existing application", async ({ page }) => {
  const id = await seedApplication();
  const before = await applications();
  await analyze(page, "interview");
  await expect(page.getByText("Example Company — Engineer: Applied → Interview", { exact: true })).toBeVisible();
  expect(await applications()).toEqual(before);
  await page.getByRole("button", { name: "Confirm status update" }).click();
  await expect(page.getByRole("heading", { name: "Status update complete" })).toBeVisible();
  await page.getByRole("link", { name: "View updated application" }).click();
  await expect(page).toHaveURL(`/applications/${id}`);
  await page.reload();
  await expect(page.getByLabel("Update status")).toHaveValue("INTERVIEW");
  expect(await applications()).toMatchObject([{ id, status: "INTERVIEW" }]);
  await dashboardStatus(page, "Interview");
});

test("discard and back leave drafts and proposed status changes unsaved", async ({ page }) => {
  await analyze(page, "confirmation");
  await page.getByLabel("Position", { exact: true }).fill("Unsaved edit");
  await page.getByRole("button", { name: "Back to pasted email", exact: true }).click();
  await expect(page.getByLabel("Email (plain text)")).toHaveValue("E2E confirmation email");
  expect(await applications()).toHaveLength(0);
  await page.getByRole("button", { name: "Analyze email", exact: true }).click();
  await page.getByRole("link", { name: "Discard draft" }).click();
  await expect(page).toHaveURL("/");
  await page.reload();
  expect(await applications()).toHaveLength(0);
  const id = await seedApplication();
  const before = await applications();
  await analyze(page, "interview");
  await page.getByRole("button", { name: "Discard / back to pasted email" }).click();
  await expect(page.getByLabel("Email (plain text)")).toHaveValue("E2E interview email");
  await page.goto(`/applications/${id}`);
  await page.reload();
  await expect(page.getByLabel("Update status")).toHaveValue("APPLIED");
  expect(await applications()).toEqual(before);
});

test("rejects unauthenticated page and action requests", async ({ playwright }) => {
  const anonymous = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3100", httpCredentials: undefined });
  try {
    for (const path of ["/", "/applications/import"]) {
      const response = await anonymous.get(path);
      expect(response.status()).toBe(401);
      expect(response.headers()["www-authenticate"]).toContain("Basic");
    }
    const response = await anonymous.post("/applications/import", { headers: { "Next-Action": "unauthorized-test" }, form: { emailText: "Must not reach provider" } });
    expect(response.status()).toBe(401);
  } finally { await anonymous.dispose(); }
});

test("Gmail OAuth, manual deduplicated sync, review edits and explicit save", async ({ page }) => {
  await query("TRUNCATE gmail_connection,gmail_imports");
  // Playwright intercepts the first request in a redirect chain, not each hop.
  // Run the real connect handler (including its state cookie), but replace its
  // external redirect so dummy OAuth credentials never reach Google.
  await page.route("**/gmail/connect", async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    expect(response.status()).toBe(303);
    const url = new URL(response.headers().location);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/gmail.readonly");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const callback = new URL(url.searchParams.get("redirect_uri")!);
    callback.searchParams.set("code", "fake-code"); callback.searchParams.set("state", url.searchParams.get("state")!);
    await route.fulfill({ response, headers: { ...response.headers(), location: callback.toString() } });
  });
  await page.goto("/applications/import");
  await page.getByRole("button", { name: "Connect Gmail", exact: true }).click();
  await expect(page.getByText("Connected: fake@example.com", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sync Gmail", exact: true }).click();
  await expect(page.getByText(/Sync complete: 1 new/)).toBeVisible();
  expect(await applications()).toHaveLength(0);
  await page.getByRole("button", { name: "Sync Gmail", exact: true }).click();
  await expect(page.getByText(/Sync complete: 0 new/)).toBeVisible();
  await page.getByText(/Review Gmail draft:/).click();
  const review = page.locator("details");
  await review.getByLabel("Position", { exact: true }).fill("Reviewed Engineer");
  expect(await applications()).toHaveLength(0);
  await review.getByRole("button", { name: "Confirm and save application" }).click();
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
  expect(await applications()).toMatchObject([{ position: "Reviewed Engineer", status: "APPLIED" }]);
  const imports = await query("SELECT * FROM gmail_imports");
  expect(imports.rows).toHaveLength(1);
  expect(JSON.stringify(imports.rows)).not.toContain("E2E confirmation email");
  await page.goto("/applications/import");
  await page.getByRole("button", { name: "Disconnect Gmail", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connect Gmail", exact: true })).toBeVisible();
  expect((await query("SELECT * FROM gmail_connection")).rows).toHaveLength(0);
});

test("Gmail rejects forged OAuth state and cross-origin connect requests", async ({ request }) => {
  await query("TRUNCATE gmail_connection,gmail_imports");
  const forged = await request.get("/gmail/callback?state=forged&code=fake-code");
  expect(forged.url()).toContain("gmail=error");
  expect((await query("SELECT * FROM gmail_connection")).rows).toHaveLength(0);
  const crossOrigin = await request.post("/gmail/connect", { headers: { origin: "https://other.example" } });
  expect(crossOrigin.status()).toBe(403);
});

test("delete only the selected application after checkbox confirmation on details", async ({ page }) => {
  const first = await seedApplication();
  const second = await seedApplication();
  const survivor = (await applications()).find((application) => application.id === first);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Delete application", exact: true })).toHaveCount(0);
  await page.goto(`/applications/${second}`);
  const confirm = page.getByRole("checkbox", { name: "I confirm I want to delete this application." });
  await expect(confirm).not.toBeChecked();
  await page.getByRole("button", { name: "Delete application", exact: true }).click();
  await expect(confirm).toBeFocused();
  expect(await applications()).toHaveLength(2);
  await confirm.check();
  await page.getByRole("button", { name: "Delete application", exact: true }).click();
  await expect(page).toHaveURL("/");
  expect(await applications()).toEqual([survivor]);
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "Example Company" })).toHaveCount(1);
});
