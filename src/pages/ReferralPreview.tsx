import { useMemo, useState } from "react";
import { JsonPanel } from "../components/JsonPanel";
import { ValidationPanel } from "../components/ValidationPanel";
import { useAppContext } from "../context/useAppContext";
import { buildReferralTransactionBundle } from "../fhir/builders";
import {
  parseTransactionResponse,
  submitBundle,
  validateBundle
} from "../services/fhirClient";
import { storage } from "../services/storage";
import type { ValidationSummary } from "../types";

const initialValidation: ValidationSummary = {
  counts: { fatal: 0, error: 0, warning: 0, information: 0 },
  issues: [],
  blocking: false,
  validated: false
};

export function ReferralPreview() {
  const { draft, endpoints } = useAppContext();
  const bundle = useMemo(() => buildReferralTransactionBundle(draft), [draft]);
  const [validation, setValidation] = useState(initialValidation);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledgeUnvalidated, setAcknowledgeUnvalidated] = useState(false);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<unknown>(null);

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
      const summary = await validateBundle(endpoints.pherefBaseUrl, bundle);
      setValidation(summary);
    } catch (error) {
      setValidation(initialValidation);
      setMessage(
        `Validation could not be completed: ${error instanceof Error ? error.message : "network error"}`
      );
    } finally {
      setValidating(false);
    }
  }

  async function submit() {
    if (requiredMissing.length || validation.blocking) return;
    if (!validation.validated && !acknowledgeUnvalidated) {
      setMessage("Run validation or acknowledge the unvalidated demo submission.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const transactionResponse = await submitBundle(endpoints.pherefBaseUrl, bundle);
      setResponse(transactionResponse);
      const patientName = `${draft.patient.given} ${draft.patient.family}`;
      storage.saveReceipt(
        parseTransactionResponse(transactionResponse, patientName, draft.referralId)
      );
      setMessage("Referral transaction submitted. Server-assigned resource IDs were saved locally.");
    } catch (error) {
      setResponse(error);
      setMessage(`Submission failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
            disabled={submitting || validation.blocking || Boolean(requiredMissing.length)}
          >
            {submitting ? "Submitting…" : "Submit transaction"}
          </button>
        </div>
        {!validation.validated ? (
          <label className="check-row">
            <input
              type="checkbox"
              checked={acknowledgeUnvalidated}
              onChange={(event) => setAcknowledgeUnvalidated(event.target.checked)}
            />
            I understand this is an unvalidated synthetic demo submission.
          </label>
        ) : null}
      </section>
      <JsonPanel title="FHIR transaction Bundle JSON" value={bundle} />
      {response ? <JsonPanel title="FHIR server response" value={response} /> : null}
    </div>
  );
}
