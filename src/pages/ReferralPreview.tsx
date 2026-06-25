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
  const [submitAnyway, setSubmitAnyway] = useState(false);
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
  const liveMode = !endpoints.demoMode;
  const canSubmit =
    !submitting &&
    !requiredMissing.length &&
    (liveMode
      ? validation.validated && !validation.blocking
      : !validation.blocking || submitAnyway);

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
    if (!validation.validated && !submitAnyway) {
      setMessage(
        liveMode
          ? "Run validation before submitting to the configured FHIR server."
          : "Run validation or explicitly choose Submit anyway for demo."
      );
      return;
    }
    if (validation.blocking && !submitAnyway) {
      setMessage(
        liveMode
          ? "Resolve blocking validation issues before submitting to the configured FHIR server."
          : "Blocking validation issues require an explicit demo override."
      );
      return;
    }
    if (liveMode && submitAnyway) {
      setMessage("Live server submission requires validation without blocking issues.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const record = await submitCurrentReferral(submitAnyway);
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

      <section className="card">
        <p className="eyebrow">Clinical payload</p>
        <h2>Information to be sent</h2>
        <dl className="detail-list">
          <dt>Chief complaint</dt><dd>{draft.chiefComplaint || "Missing"}</dd>
          <dt>Clinical history</dt><dd>{draft.clinicalHistory || "Not provided"}</dd>
          <dt>Working impression</dt><dd>{draft.workingImpressionText || "Missing"}</dd>
          <dt>Lab report title</dt><dd>{draft.labTitle || "Diagnostic report"}</dd>
          <dt>Lab conclusion</dt><dd>{draft.labConclusion || "Not provided"}</dd>
          <dt>Diagnostic attachment</dt>
          <dd>
            {draft.labAttachmentBase64
              ? `Included in DiagnosticReport.presentedForm (${draft.labAttachmentContentType || "application/octet-stream"}).`
              : "No attachment data included."}
          </dd>
        </dl>
      </section>

      {requiredMissing.length ? (
        <div className="notice danger">
          Required fields missing: {requiredMissing.join(", ")}.
        </div>
      ) : null}
      {message ? <div className="notice">{message}</div> : null}
      <ValidationPanel summary={validation} />
      <section className="card">
        <div className={liveMode ? "notice warning" : "notice"}>
          {liveMode
            ? `Live mode is enabled. Submission will POST this transaction Bundle to ${endpoints.pherefBaseUrl}.`
            : "Demo mode is enabled. Submission will stay in local mock persistence."}
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
              : endpoints.demoMode
                ? "Submit to local demo"
                : "Submit to FHIR server"}
          </button>
        </div>
        {endpoints.demoMode && (validation.blocking || !validation.validated) ? (
          <label className="check-row">
            <input
              type="checkbox"
              checked={submitAnyway}
              onChange={(event) => setSubmitAnyway(event.target.checked)}
            />
            Submit anyway for demo; validation is missing or contains blocking issues.
          </label>
        ) : null}
      </section>
      <JsonPanel title="FHIR transaction Bundle JSON" value={bundle} />
    </div>
  );
}
