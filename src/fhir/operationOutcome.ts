import type { FhirResource, ValidationIssue, ValidationSummary } from "../types";

const emptyCounts = () => ({ fatal: 0, error: 0, warning: 0, information: 0 });

export function emptyValidationSummary(): ValidationSummary {
  return {
    counts: emptyCounts(),
    fatalCount: 0,
    errorCount: 0,
    warningCount: 0,
    informationCount: 0,
    issues: [],
    blocking: false,
    validated: false
  };
}

function categorize(message: string, code?: string): ValidationIssue["category"] {
  const text = `${code ?? ""} ${message}`.toLowerCase();
  if (text.includes("code") || text.includes("value set") || text.includes("terminolog")) {
    return "terminology";
  }
  if (text.includes("not supported") || text.includes("capability")) return "capability";
  if (text.includes("best practice") || text.includes("recommended")) return "best-practice";
  return "structural";
}

function isMimeTypeValidatorInfrastructureIssue(
  message: string,
  expression?: string[],
  location?: string[]
) {
  const text = message.toLowerCase();
  const path = [...(expression ?? []), ...(location ?? [])]
    .join(" ")
    .toLowerCase();
  return (
    path.includes("presentedform") &&
    path.includes("contenttype") &&
    (text.includes("urn:ietf:bcp:13") || text.includes("valueset/mimetypes"))
  );
}

export function parseOperationOutcome(
  resource: FhirResource | null | undefined,
  httpStatus?: number
): ValidationSummary {
  const counts = emptyCounts();
  if (!resource || resource.resourceType !== "OperationOutcome" || !Array.isArray(resource.issue)) {
    return { ...emptyValidationSummary(), httpStatus };
  }

  const rawIssues = resource.issue
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => {
      const severity =
        item.severity === "fatal" ||
        item.severity === "error" ||
        item.severity === "warning" ||
        item.severity === "information"
          ? item.severity
          : "information";
      const details = item.details as { text?: string } | undefined;
      const message =
        (typeof item.diagnostics === "string" && item.diagnostics) ||
        details?.text ||
        "FHIR validation issue";
      const expression = Array.isArray(item.expression)
        ? item.expression.filter((value): value is string => typeof value === "string")
        : undefined;
      const location = Array.isArray(item.location)
        ? item.location.filter((value): value is string => typeof value === "string")
        : undefined;
      const adjustedSeverity =
        severity === "error" &&
        isMimeTypeValidatorInfrastructureIssue(message, expression, location)
          ? "warning"
          : severity;
      counts[adjustedSeverity] += 1;
      return {
        severity: adjustedSeverity,
        code: typeof item.code === "string" ? item.code : undefined,
        message,
        diagnostics: message,
        expression,
        location,
        category: categorize(message, typeof item.code === "string" ? item.code : undefined)
      } satisfies ValidationIssue;
    });

  const grouped = new Map<string, ValidationIssue>();
  for (const issue of rawIssues) {
    const normalizedMessage = issue.message
      .replace(
        /^Details for urn:uuid:[a-f0-9-]+ matching against profile \S+ - /i,
        ""
      )
      .replace(/urn:uuid:[a-f0-9-]+/gi, "urn:uuid:[resource]");
    const key = `${issue.severity}|${issue.category}|${normalizedMessage}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.occurrences = (existing.occurrences ?? 1) + 1;
    } else {
      grouped.set(key, { ...issue, message: normalizedMessage, occurrences: 1 });
    }
  }
  const issues = [...grouped.values()];

  return {
    counts,
    fatalCount: counts.fatal,
    errorCount: counts.error,
    warningCount: counts.warning,
    informationCount: counts.information,
    issues,
    blocking: counts.fatal > 0 || counts.error > 0,
    validated: true,
    httpStatus
  };
}

export const isValidationBlocking = (summary: ValidationSummary) => summary.blocking;
