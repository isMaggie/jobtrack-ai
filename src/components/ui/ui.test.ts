import { createElement } from "react";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applicationStatusSchema } from "../../lib/application";
import { FormField } from "./form-field";
import { FormFeedback } from "./form-feedback";
import { StatusBadge, statusLabels } from "./status-badge";

describe("shared application UI", () => {
  it.each(applicationStatusSchema.options)("renders a readable label for %s", (status) => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status }));
    expect(html).toContain(statusLabels[status]);
    expect(html).not.toContain(`>${status}<`);
  });

  it("connects the field label, helper text, and validation error to the input", () => {
    const html = renderToStaticMarkup(jsx(FormField, {
      id: "company", label: "Company", hint: "Use the company name", errors: ["Company is required"],
      children: createElement("input", { id: "company", "aria-invalid": true, "aria-describedby": "company-hint company-error" }),
    }));
    expect(html).toContain('for="company"');
    expect(html).toContain('id="company-hint"');
    expect(html).toContain('id="company-error"');
    expect(html).toContain('aria-describedby="company-hint company-error"');
    expect(html).toContain("Company is required");
  });

  it("announces errors assertively and progress politely", () => {
    const error = renderToStaticMarkup(createElement(FormFeedback, { message: "Please try again", error: true }));
    const progress = renderToStaticMarkup(createElement(FormFeedback, { message: "Extracting draft…" }));
    expect(error).toContain('role="alert"');
    expect(error).toContain('aria-live="assertive"');
    expect(progress).toContain('role="status"');
    expect(progress).toContain('aria-live="polite"');
  });
});
