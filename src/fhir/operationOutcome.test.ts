import { describe, expect, it } from "vitest";
import { parseOperationOutcome } from "./operationOutcome";

describe("OperationOutcome parsing", () => {
  it("counts every severity and blocks fatal/error issues", () => {
    const summary = parseOperationOutcome({
      resourceType: "OperationOutcome",
      issue: [
        { severity: "fatal", code: "invalid", diagnostics: "Invalid structure" },
        { severity: "error", code: "code-invalid", diagnostics: "Code is not in value set" },
        { severity: "warning", diagnostics: "Best practice recommendation" },
        { severity: "information", diagnostics: "Informational note" }
      ]
    }, 422);
    expect(summary.counts).toEqual({ fatal: 1, error: 1, warning: 1, information: 1 });
    expect(summary.blocking).toBe(true);
    expect(summary.httpStatus).toBe(422);
    expect(summary.issues[1].category).toBe("terminology");
  });

  it("does not block warnings or information", () => {
    const summary = parseOperationOutcome({
      resourceType: "OperationOutcome",
      issue: [{ severity: "warning", diagnostics: "Recommended narrative" }]
    }, 200);
    expect(summary.validated).toBe(true);
    expect(summary.blocking).toBe(false);
  });

  it("marks malformed responses as unvalidated", () => {
    expect(parseOperationOutcome({ resourceType: "Bundle" }).validated).toBe(false);
  });

  it("deduplicates repeated profile diagnostics while retaining raw counts", () => {
    const summary = parseOperationOutcome({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "warning",
          expression: ["Bundle.entry[0]"],
          diagnostics:
            "Details for urn:uuid:11111111-1111-1111-1111-111111111111 matching against profile https://example/one - Repeated warning"
        },
        {
          severity: "warning",
          expression: ["Bundle.entry[1]"],
          diagnostics:
            "Details for urn:uuid:22222222-2222-2222-2222-222222222222 matching against profile https://example/two - Repeated warning"
        }
      ]
    });
    expect(summary.counts.warning).toBe(2);
    expect(summary.issues).toHaveLength(1);
    expect(summary.issues[0].occurrences).toBe(2);
  });
});
