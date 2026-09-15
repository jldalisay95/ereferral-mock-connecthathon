import { useState } from "react";
import { useAppContext } from "../context/useAppContext";
import type { FacilityDefinition, FacilityPublishResult } from "../types";
import { JsonPanel } from "./JsonPanel";
import { ValidationPanel } from "./ValidationPanel";

export function FacilityPublishControl({
  facility
}: {
  facility: FacilityDefinition;
}) {
  const { connectathonConfig, endpoints, publishFacility } = useAppContext();
  const [result, setResult] = useState<FacilityPublishResult | null>(null);
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const writesEnabled = connectathonConfig.capabilities.externalWrites;
  const liveReady = writesEnabled && !endpoints.demoMode;

  async function publish() {
    const confirmed = window.confirm(
      `Validate and publish ${facility.name} to ${endpoints.pherefBaseUrl}?`
    );
    if (!confirmed) return;
    setPublishing(true);
    setMessage("");
    setResult(null);
    try {
      const next = await publishFacility(facility.id);
      setResult(next);
      setMessage(
        next.published
          ? `Organization published as ${next.facility.organization.fhirReference}.`
          : "Organization was not published because validation did not pass."
      );
    } catch (error) {
      setMessage(
        `Organization publish failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="page-stack facility-publish-control">
      <div className="summary-grid">
        <div>
          <span>Local facility</span>
          <strong>{facility.name}</strong>
        </div>
        <div>
          <span>FHIR Organization</span>
          <strong>{facility.organization.fhirReference ?? "Not published"}</strong>
        </div>
      </div>
      {!writesEnabled ? (
        <div className="notice warning">
          Organization publishing is locked by the participant preset. The
          facility and account remain available locally when you switch presets.
        </div>
      ) : endpoints.demoMode ? (
        <div className="notice warning">
          Disable Demo mode in Admin Settings before publishing an Organization.
        </div>
      ) : (
        <div className="notice warning">
          Publishing first calls <code>Organization/$validate</code>. A
          non-blocking result is required before the conditional transaction is
          sent.
        </div>
      )}
      <div className="button-row">
        <button type="button" onClick={publish} disabled={!liveReady || publishing}>
          {publishing
            ? "Validating and publishing…"
            : facility.organization.fhirReference
              ? "Validate and republish Organization"
              : "Validate and publish Organization"}
        </button>
      </div>
      {message ? (
        <div className="notice" role="status">
          {message}
        </div>
      ) : null}
      {result ? <ValidationPanel summary={result.validationSummary} /> : null}
      {result?.validationOutcome ? (
        <JsonPanel
          title="Organization validation OperationOutcome"
          value={result.validationOutcome}
        />
      ) : null}
      {result?.response ? (
        <JsonPanel title="Organization transaction response" value={result.response} />
      ) : null}
    </div>
  );
}
