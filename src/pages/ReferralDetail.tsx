import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { JsonPanel } from "../components/JsonPanel";
import { ReferralTimeline } from "../components/ReferralTimeline";
import { StatusBadge } from "../components/StatusBadge";
import { ValidationPanel } from "../components/ValidationPanel";
import { useAppContext } from "../context/useAppContext";
import { findResource } from "../services/demoFhir";
import type { ReferralRecord, TaskTransition } from "../types";

function formatDateTime(value: unknown) {
  if (typeof value !== "string") return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatReference(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "reference" in value) {
    const reference = (value as { reference?: unknown }).reference;
    return typeof reference === "string" ? reference : "-";
  }
  return "-";
}

function ageFromBirthDate(value: string) {
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return "Not available";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

export function ReferralDetail() {
  const { id } = useParams();
  const location = useLocation();
  const {
    currentAccount,
    facilities,
    getReferral,
    markReferralNotificationsRead,
    transitionReferral,
    refreshReferral
  } = useAppContext();
  const navigatedReferral = (
    location.state as { referral?: ReferralRecord } | null
  )?.referral;
  const referral = id
    ? getReferral(id) ?? (navigatedReferral?.id === id ? navigatedReferral : undefined)
    : undefined;
  const [transition, setTransition] = useState<TaskTransition>("received");
  const [note, setNote] = useState("");
  const [forwardingFacilityId, setForwardingFacilityId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) markReferralNotificationsRead(id);
    // Opening a referral acknowledges notifications for the current facility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentAccount?.organizationId]);

  if (!referral) return <Navigate to="/referrals" replace />;
  const referralRecord = referral;
  const draft = referral.draft;
  const task = findResource(referral.fhirResources, "Task");
  const serviceRequest = findResource(referral.fhirResources, "ServiceRequest");
  const patientResource = findResource(referral.fhirResources, "Patient");
  const canUpdate =
    currentAccount?.role === "facility_user" &&
    referral.receivingOrganizationId === currentAccount.organizationId &&
    !["rejected", "referred-onward", "completed"].includes(referral.status);

  async function updateStatus() {
    if (!note.trim()) {
      setMessage("Remarks are required for every workflow update.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const updated = await transitionReferral(
        referralRecord.id,
        transition,
        note,
        transition === "referred-onward" ? forwardingFacilityId : undefined
      );
      setMessage(`Referral updated to ${updated.careStatus ?? updated.status}.`);
      setNote("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Status update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      await refreshReferral(referralRecord.id);
      setMessage("Referral Task refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="card referral-header">
        <div>
          <p className="eyebrow">Referral detail</p>
          <h2>{referral.patientName}</h2>
          <p>
            <code>{referral.localReferralId}</code> -{" "}
            {new Date(draft.authoredOn || referral.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="header-actions">
          <StatusBadge status={referral.status} />
          <Link className="button secondary compact" to={`/referrals/${referral.id}/print`}>
            Print
          </Link>
        </div>
        <div className="facility-route">
          <span>{referral.referringOrganizationName}</span>
          <strong>to</strong>
          <span>{referral.receivingOrganizationName}</span>
        </div>
      </section>

      {message ? <div className="notice">{message}</div> : null}
      {referral.lastError ? <div className="notice danger">{referral.lastError}</div> : null}

      <div className="detail-grid">
        <section className="card">
          <p className="eyebrow">Patient identity</p>
          <h2>Patient information</h2>
          <dl className="detail-list">
            <dt>Name</dt><dd>{referral.patientName}</dd>
            <dt>Gender</dt><dd>{draft.patient.gender}</dd>
            <dt>Birth date</dt><dd>{draft.patient.birthDate}</dd>
            <dt>Age</dt><dd>{ageFromBirthDate(draft.patient.birthDate)}</dd>
            <dt>PhilSys</dt><dd>{draft.patient.philSysId || "Not recorded"}</dd>
            <dt>PhilHealth</dt><dd>{draft.patient.philHealthId || "Not recorded"}</dd>
            <dt>Address</dt>
            <dd>
              {[draft.patient.address.line, draft.patient.address.city, draft.patient.address.province]
                .filter(Boolean)
                .join(", ") || "Not recorded"}
            </dd>
            <dt>Contact</dt><dd>{draft.patient.phone || "Not recorded"}</dd>
            <dt>Next of kin</dt>
            <dd>
              {[draft.patient.contactName, draft.patient.contactPhone]
                .filter(Boolean)
                .join(" - ") || "Not recorded"}
            </dd>
          </dl>
        </section>
        <section className="card">
          <p className="eyebrow">Referral request</p>
          <h2>Referral information</h2>
          <dl className="detail-list">
            <dt>Category</dt><dd>{draft.referralCategory.display}</dd>
            <dt>Priority</dt><dd>{draft.priority}</dd>
            <dt>Requested service</dt><dd>{draft.requestedService.display}</dd>
            <dt>Clinical reason</dt><dd>{draft.clinicalReason.display}</dd>
            <dt>Time called</dt><dd>{formatDateTime(draft.timeCalled)}</dd>
            <dt>Notes</dt><dd>{draft.referralNarrative}</dd>
            <dt>Remarks</dt><dd>{draft.remarks || "None"}</dd>
            <dt>Consent</dt><dd>{draft.consentGiven ? "Recorded locally" : "Not recorded"}</dd>
          </dl>
        </section>
      </div>

      <section className="card">
        <p className="eyebrow">Clinical context and prior care</p>
        <h2>Clinical information</h2>
        <dl className="detail-list">
          <dt>Chief complaint</dt><dd>{draft.chiefComplaint}</dd>
          <dt>Clinical history</dt><dd>{draft.clinicalHistory}</dd>
          <dt>Working impression</dt><dd>{draft.workingImpressionText}</dd>
          <dt>Vital signs</dt>
          <dd>
            BP {draft.vitals.systolic}/{draft.vitals.diastolic} mmHg - HR{" "}
            {draft.vitals.heartRate}/min - RR {draft.vitals.respiratoryRate}/min -{" "}
            SpO2 {draft.vitals.oxygenSaturation}% - Temp {draft.vitals.temperature} C -{" "}
            Weight {draft.vitals.weight} kg
          </dd>
          <dt>Treatment</dt><dd>{draft.treatment}</dd>
          <dt>Laboratory</dt><dd>{draft.labTitle}: {draft.labConclusion}</dd>
        </dl>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workflow and response</p>
            <h2>Task status</h2>
          </div>
          {referral.liveSubmission ? (
            <button
              type="button"
              className="secondary"
              onClick={refresh}
              disabled={loading}
            >
              Manual refresh
            </button>
          ) : null}
        </div>
        <div className="summary-grid">
          <div><span>Task status</span><strong>{String(task?.status ?? referral.taskStatus)}</strong></div>
          <div><span>Receiving response</span><strong>{referral.businessStatus ?? "Awaiting response"}</strong></div>
          <div><span>Care status</span><strong>{referral.careStatus ?? "Not recorded"}</strong></div>
          <div><span>Authored</span><strong>{formatDateTime(task?.authoredOn ?? draft.authoredOn)}</strong></div>
          <div><span>Last modified</span><strong>{formatDateTime(task?.lastModified ?? referral.updatedAt)}</strong></div>
          <div><span>Requester</span><strong>{formatReference(task?.requester)}</strong></div>
          <div><span>Owner</span><strong>{formatReference(task?.owner)}</strong></div>
        </div>
        {canUpdate ? (
          <div className="workflow-actions">
            <label className="field">
              <span>Action</span>
              <select
                value={transition}
                onChange={(event) =>
                  setTransition(event.target.value as TaskTransition)
                }
              >
                <option value="received">Mark received</option>
                <option value="accepted">Accept referral</option>
                <option value="rejected">Reject referral</option>
                <option value="referred-onward">Refer onward</option>
                <option value="arrived">Mark arrived</option>
                <option value="admitted">Admitted</option>
                <option value="er-observation">ER observation</option>
                <option value="other-care">Other care status</option>
                <option value="discharged">Discharged</option>
                <option value="completed">Complete workflow</option>
              </select>
            </label>
            {transition === "referred-onward" ? (
              <label className="field">
                <span>Onward facility</span>
                <select
                  value={forwardingFacilityId}
                  onChange={(event) => setForwardingFacilityId(event.target.value)}
                >
                  <option value="">Select facility</option>
                  {facilities
                    .filter(
                      (facility) => facility.id !== currentAccount.organizationId
                    )
                    .map((facility) => (
                      <option value={facility.id} key={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <label className="field">
              <span>Remarks</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} />
              <small>Required for every receiving-side update.</small>
            </label>
            <button
              type="button"
              onClick={updateStatus}
              disabled={
                loading ||
                !note.trim() ||
                (transition === "referred-onward" && !forwardingFacilityId)
              }
            >
              {loading ? "Updating..." : "Update referral status"}
            </button>
          </div>
        ) : null}
        {referral.status === "referred-onward" ? (
          <div className="notice warning">
            The onward destination is recorded as a response outcome only. This demo
            does not automatically create a replacement ServiceRequest.
          </div>
        ) : null}
      </section>

      <section className="card">
        <p className="eyebrow">Audit trail</p>
        <h2>Referral timeline</h2>
        <ReferralTimeline events={referral.timeline} />
      </section>

      <ValidationPanel summary={referral.validationSummary} />
      {patientResource ? <JsonPanel title="Patient JSON" value={patientResource} /> : null}
      {serviceRequest ? <JsonPanel title="ServiceRequest JSON" value={serviceRequest} /> : null}
      {task ? <JsonPanel title="Task JSON" value={task} /> : null}
      <JsonPanel title="Transaction Bundle JSON" value={referral.fhirBundle} />
      {referral.validationOutcome ? (
        <JsonPanel title="OperationOutcome JSON" value={referral.validationOutcome} />
      ) : null}
      {referral.transactionResponse ? (
        <JsonPanel title="Transaction response JSON" value={referral.transactionResponse} />
      ) : null}
    </div>
  );
}
