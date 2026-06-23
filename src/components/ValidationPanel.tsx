import type { ValidationSummary } from "../types";

interface ValidationPanelProps {
  summary: ValidationSummary;
}

export function ValidationPanel({ summary }: ValidationPanelProps) {
  return (
    <section className={`card validation ${summary.blocking ? "danger" : "success"}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">FHIR validation</p>
          <h2>{summary.validated ? (summary.blocking ? "Blocking issues" : "Validation complete") : "Not validated"}</h2>
        </div>
        <div className="severity-counts">
          {Object.entries(summary.counts).map(([severity, count]) => (
            <span key={severity} className={`severity ${severity}`}>
              {severity}: {count}
            </span>
          ))}
        </div>
      </div>
      {summary.issues.length ? (
        <ul className="issue-list">
          {summary.issues.map((issue, index) => (
            <li key={`${issue.severity}-${issue.message}-${index}`}>
              <strong>{issue.severity}</strong> · {issue.category}: {issue.message}
              {(issue.occurrences ?? 1) > 1 ? (
                <span className="occurrence">Repeated {issue.occurrences} times</span>
              ) : null}
              {issue.expression?.length ? <code>{issue.expression.join(", ")}</code> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>{summary.validated ? "The server returned no validation issues." : "Validation has not been run."}</p>
      )}
    </section>
  );
}
