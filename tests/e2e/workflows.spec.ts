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

test.beforeEach(async () => { await query("DELETE FROM applications"); });

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
