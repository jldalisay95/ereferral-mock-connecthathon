import { useMemo, useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { JsonPanel } from "../components/JsonPanel";
import { ValidationPanel } from "../components/ValidationPanel";
import { useAppContext } from "../context/useAppContext";
import { buildReferralTransactionBundle } from "../fhir/builders";
import { emptyValidationSummary } from "../fhir/operationOutcome";
import { validateBundleDetailed } from "../services/fhirClient";
import { getReferralSubmissionMissing } from "../services/referralValidation";

export function ReferralPreview() {
  const {
    draft,
    activeDraftRecord,
    connectathonConfig,
    endpoints,
    saveValidation,
    submitCurrentReferral
  } = useAppContext();
  const navigate = useNavigate();
  const bundle = useMemo(
    () => (draft ? buildReferralTransactionBundle(draft) : null),
    [draft]
  );
  const [validation, setValidation] = useState(
    activeDraftRecord?.validationSummary ?? emptyValidationSummary()
  );
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  if (!draft || !bundle || !activeDraftRecord) {
    if (submitting) {
      return (
        <div className="page-stack">
          <div className="notice">Submitting referral transaction...</div>
        </div>
      );
    }
    return <Navigate to="/referrals/new" replace />;
  }
  const currentBundle = bundle;

  const requiredMissing = getReferralSubmissionMissing(draft);
  const writeEnabled =
    connectathonConfig.capabilities.externalWrites ||
    connectathonConfig.capabilities.localSimulation;
  const liveMode =
    connectathonConfig.capabilities.externalWrites && !endpoints.demoMode;
  const canSubmit =
    writeEnabled &&
    !submitting &&
    !requiredMissing.length &&
    validation.validated &&
    !validation.blocking;

  async function runValidation() {
    if (requiredMissing.length) {
      setMessage(`Complete required fields: ${requiredMissing.join(", ")}.`);
      return;
    }
    setValidating(true);
    setMessage("");
    try {
      const result = await validateBundleDetailed(
        endpoints.pherefBaseUrl,
        currentBundle
      );
      setValidation(result.summary);
      saveValidation(result.summary, result.outcome);
    } catch (error) {
      setValidation(emptyValidationSummary());
      setMessage(
        `Validation could not be completed: ${
          error instanceof Error ? error.message : "network error"
        }`
      );
    } finally {
      setValidating(false);
    }
  }

  async function submit() {
    if (requiredMissing.length) return;
    if (!writeEnabled) {
      setMessage("Submission is locked by the participant preset. Open the Connectathon Guide for readiness steps.");
      return;
    }
    if (!validation.validated || validation.blocking) {
      setMessage("A successful, non-blocking $validate result is required before submission.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const record = await submitCurrentReferral();
      navigate(`/referrals/${record.id}`, { replace: true, state: { referral: record } });
    } catch (error) {
      setMessage(
        `Submission failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Referral preview</p>
        <h2>{draft.referralId}</h2>
        <div className="summary-grid">
          <div><span>Patient</span><strong>{draft.patient.given} {draft.patient.family}</strong></div>
          <div><span>From</span><strong>{draft.initiatingFacility.name}</strong></div>
          <div><span>To</span><strong>{draft.receivingFacility.name}</strong></div>
          <div><span>Service category</span><strong>{draft.referralCategory.display}</strong></div>
          <div><span>Priority</span><strong>{draft.priority}</strong></div>
          <div><span>Requested service</span><strong>{draft.requestedService.display}</strong></div>
          <div><span>Clinical reason</span><strong>{draft.clinicalReason.display}</strong></div>
          <div><span>Consent</span><strong>{draft.consentGiven ? "Recorded locally" : "Missing"}</strong></div>
          <div><span>Bundle entries</span><strong>{Array.isArray(bundle.entry) ? bundle.entry.length : 0}</strong></div>
        </div>
      </section>

      {requiredMissing.length ? (
        <div className="notice danger">
          Required fields missing: {requiredMissing.join(", ")}.
        </div>
      ) : null}
      {message ? <div className="notice">{message}</div> : null}
      <ValidationPanel summary={validation} />
      <section className="card">
        <div className={writeEnabled ? (liveMode ? "notice warning" : "notice") : "notice warning"}>
          {!writeEnabled ? (
            <>Participant starter is validation-only. External writes are blocked. <Link to="/connectathon-guide">Open the readiness guide</Link>.</>
          ) : liveMode ? (
            `Ready preset is active. Submission will POST this transaction Bundle to ${endpoints.pherefBaseUrl}.`
          ) : (
            "Ready preset is active with local simulation selected."
          )}
        </div>
        <div className="button-row">
          <Link className="button secondary" to="/referrals/new">Back to referral</Link>
          <button
            type="button"
            onClick={runValidation}
            disabled={validating || Boolean(requiredMissing.length)}
          >
            {validating ? "Validating..." : "Validate Bundle"}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
          >
            {submitting
              ? "Submitting..."
              : !writeEnabled
                ? "Submission locked in participant preset"
                : endpoints.demoMode
                ? "Submit to local demo"
                : "Submit to FHIR server"}
          </button>
        </div>
      </section>
      <JsonPanel title="FHIR transaction Bundle JSON" value={bundle} />
    </div>
  );
}
