import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { JsonPanel } from "../components/JsonPanel";
import { ValidationPanel } from "../components/ValidationPanel";
import { useAppContext } from "../context/useAppContext";
import { buildReferralTransactionBundle } from "../fhir/builders";
import { emptyValidationSummary } from "../fhir/operationOutcome";
import { validateBundleDetailed } from "../services/fhirClient";

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
    return <Navigate to="/referrals/new" replace />;
  }
  const currentBundle = bundle;

  const requiredMissing = [
    !draft.patient.given && "Patient given name",
    !draft.patient.family && "Patient family name",
    !draft.patient.birthDate && "Patient birth date",
    !draft.patient.philSysId && "PhilSys ID",
    !draft.initiatingFacility.nhfrCode && "Initiating facility NHFR code",
    !draft.receivingFacility.nhfrCode && "Receiving facility NHFR code",
    !draft.chiefComplaint && "Chief complaint",
    !draft.workingImpression.code && "Working impression code"
  ].filter(Boolean) as string[];

  async function runValidation() {
    if (requiredMissing.length) {
      setMessage(`Complete required fields: ${requiredMissing.join(", ")}.`);
      return;
    }
    setValidating(true);
    setMessage("");
    try {
      const result = await validateBundleDetailed(endpoints.pherefBaseUrl, currentBundle);
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
      setMessage("Run validation or explicitly choose Submit anyway for demo.");
      return;
    }
    if (validation.blocking && !submitAnyway) {
      setMessage("Blocking validation issues require explicit demo override.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const record = await submitCurrentReferral(submitAnyway);
      navigate(`/referrals/${record.id}`, { replace: true });
    } catch (error) {
      setMessage(
        `Submission failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
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
          <div><span>Category</span><strong>{draft.referralCategory.display}</strong></div>
          <div><span>Service type</span><strong>{draft.serviceType.display}</strong></div>
          <div><span>Bundle entries</span><strong>{Array.isArray(bundle.entry) ? bundle.entry.length : 0}</strong></div>
        </div>
      </section>

      {requiredMissing.length ? (
        <div className="notice danger">Required fields missing: {requiredMissing.join(", ")}.</div>
      ) : null}
      {message ? <div className="notice">{message}</div> : null}
      <ValidationPanel summary={validation} />
      <section className="card">
        <div className="button-row">
          <button type="button" onClick={runValidation} disabled={validating || Boolean(requiredMissing.length)}>
            {validating ? "Validating…" : "Validate Bundle"}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={
              submitting ||
              Boolean(requiredMissing.length) ||
              (validation.blocking && !submitAnyway)
            }
          >
            {submitting
              ? "Submitting…"
              : endpoints.demoMode
                ? "Submit to local demo"
                : "Submit live transaction"}
          </button>
        </div>
        {validation.blocking || !validation.validated ? (
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
