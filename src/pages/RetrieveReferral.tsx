import { useState } from "react";
import { JsonPanel } from "../components/JsonPanel";
import { useAppContext } from "../context/useAppContext";
import {
  decodeFirstReadableAttachment,
  downloadDecodedAttachment,
  openDecodedAttachment
} from "../services/attachments";
import { referralFacilityLabels } from "../services/referralDisplay";
import { hydrateReferral, searchRemoteReferrals } from "../services/referralRetrieval";
import type { FhirResource, ReferralAggregate } from "../types";

export function RetrieveReferral() {
  const { currentAccount, endpoints, facilities } = useAppContext();
  const [patientQuery, setPatientQuery] = useState("");
  const [organizationQuery, setOrganizationQuery] = useState(
    currentAccount?.role === "facility_user" ? currentAccount.organizationName : ""
  );
  const [serviceStatus, setServiceStatus] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [results, setResults] = useState<FhirResource[]>([]);
  const [aggregate, setAggregate] = useState<ReferralAggregate | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    setMessage("");
    setAggregate(null);
    try {
      const serviceRequests = await searchRemoteReferrals(
        endpoints.pherefBaseUrl,
        {
          patient: patientQuery,
          organization: organizationQuery,
          serviceStatus,
          taskStatus
        }
      );
      setResults(serviceRequests);
      setMessage(`${serviceRequests.length} server referral result(s) returned.`);
    } catch (error) {
      setMessage(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function openReferral(serviceRequest: FhirResource) {
    setLoading(true);
    try {
      setAggregate(await hydrateReferral(endpoints.pherefBaseUrl, serviceRequest));
    } catch (error) {
      setMessage(`Referral hydration failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Use Case 2</p><h2>Search and retrieve referrals</h2>
        <div className="form-grid">
          <label className="field">
            <span>Patient</span>
            <input
              value={patientQuery}
              onChange={(event) => setPatientQuery(event.target.value)}
              placeholder="Name, PhilSys ID, or PhilHealth ID"
            />
          </label>
          <label className="field">
            <span>Organization</span>
            <input
              list="remote-search-organizations"
              value={organizationQuery}
              onChange={(event) => setOrganizationQuery(event.target.value)}
              placeholder="Facility name or NHFR code"
            />
            <datalist id="remote-search-organizations">
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.name} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>ServiceRequest status</span>
            <select
              value={serviceStatus}
              onChange={(event) => setServiceStatus(event.target.value)}
            >
              <option value="">Any</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="revoked">Revoked</option>
              <option value="entered-in-error">Entered in error</option>
            </select>
          </label>
          <label className="field">
            <span>Task status</span>
            <select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)}>
              <option value="">Any</option>
              <option value="requested">Requested</option>
              <option value="received">Received</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
        <div className="button-row">
          <button type="button" onClick={search} disabled={loading}>
            {loading ? "Loading..." : "Search server referrals"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setPatientQuery("");
              setOrganizationQuery("");
              setServiceStatus("");
              setTaskStatus("");
              setResults([]);
              setAggregate(null);
              setMessage("");
            }}
          >
            Clear filters
          </button>
        </div>
        {message ? <p>{message}</p> : null}
      </section>
      {results.length ? (
        <section className="card">
          <h2>Referral results</h2>
          <div className="result-list">
            {results.map((resource) => {
              const requisition = resource.requisition as { value?: string } | undefined;
              return (
                <article key={resource.id} className="result-card">
                  <div>
                    <strong>{requisition?.value ?? resource.id}</strong>
                    <span>Status: {String(resource.status ?? "unknown")}</span>
                    <span>Patient: {String((resource.subject as { reference?: string } | undefined)?.reference ?? "-")}</span>
                  </div>
                  <button type="button" className="secondary" onClick={() => openReferral(resource)}>Open clinical summary</button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
      {aggregate ? (
        <>
          <ClinicalSummary aggregate={aggregate} />
          {aggregate.task?.id ? (
            <div className="notice">
              Remote retrieval is read-only in this screen. Facility workflow updates
              are performed from locally tracked incoming referrals.
            </div>
          ) : null}
          <JsonPanel title="Retrieved linked FHIR resources" value={aggregate} />
        </>
      ) : null}
    </div>
  );
}

interface ClinicalSummaryProps {
  aggregate: ReferralAggregate;
}

export function ClinicalSummary({ aggregate }: ClinicalSummaryProps) {
  const { endpoints } = useAppContext();
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const patientName = ((aggregate.patient?.name as Array<{ text?: string; given?: string[]; family?: string }> | undefined)?.[0]);
  const displayName =
    patientName?.text ??
    (`${patientName?.given?.join(" ") ?? ""} ${patientName?.family ?? ""}`.trim() || "Patient");
  const facilityLabels = referralFacilityLabels(aggregate);
  const diagnosticAttachment = decodeFirstReadableAttachment(
    aggregate.diagnosticReports.flatMap((report) =>
      Array.isArray(report.presentedForm)
        ? (report.presentedForm as Array<{
            data?: string;
            contentType?: string;
            title?: string;
            url?: string;
          }>)
        : []
    ),
    endpoints.pherefBaseUrl
  );
  const hasDiagnosticAttachment = Boolean(
    diagnosticAttachment.data || diagnosticAttachment.url
  );
  async function openAttachment() {
    setAttachmentMessage("");
    try {
      await openDecodedAttachment(diagnosticAttachment);
    } catch (error) {
      setAttachmentMessage(
        error instanceof Error ? error.message : "Attachment could not be opened."
      );
    }
  }
  async function downloadAttachment() {
    setAttachmentMessage("");
    try {
      await downloadDecodedAttachment(diagnosticAttachment);
    } catch (error) {
      setAttachmentMessage(
        error instanceof Error ? error.message : "Attachment could not be downloaded."
      );
    }
  }
  return (
    <section className="card clinical-summary">
      <p className="eyebrow">Receiving-facility clinical summary</p>
      <h2>{displayName}</h2>
      <div className="summary-grid">
        <div><span>Gender</span><strong>{String(aggregate.patient?.gender ?? "-")}</strong></div>
        <div><span>Birth date</span><strong>{String(aggregate.patient?.birthDate ?? "-")}</strong></div>
        <div><span>Task status</span><strong>{String(aggregate.task?.status ?? "-")}</strong></div>
        <div><span>Referring facility</span><strong>{facilityLabels.referring}</strong></div>
        <div><span>Receiving facility</span><strong>{facilityLabels.receiving}</strong></div>
        <div><span>Conditions</span><strong>{aggregate.conditions.length}</strong></div>
        <div><span>Vital observations</span><strong>{aggregate.observations.length}</strong></div>
        <div><span>Attachments</span><strong>{aggregate.diagnosticReports.length}</strong></div>
      </div>
      <div className="clinical-columns">
        <div>
          <h3>Diagnostic attachment</h3>
          {hasDiagnosticAttachment ? (
            <div className="button-row">
              <span>
                {diagnosticAttachment.title || "Attachment"}{" "}
                {diagnosticAttachment.isExternalUrl
                  ? "linked"
                  : `included (${diagnosticAttachment.contentType || "application/octet-stream"})`}
              </span>
              <button
                type="button"
                className="secondary compact"
                onClick={openAttachment}
              >
                {diagnosticAttachment.isExternalUrl ? "Open link" : "Open attachment"}
              </button>
              {!diagnosticAttachment.isExternalUrl ? (
                <button
                  type="button"
                  className="secondary compact"
                  onClick={downloadAttachment}
                >
                  Download attachment
                </button>
              ) : null}
            </div>
          ) : (
            <p>No attachment data included.</p>
          )}
          {attachmentMessage ? <p className="danger-text">{attachmentMessage}</p> : null}
        </div>
      </div>
      <div className="clinical-columns">
        <div><h3>Clinical reason</h3>{aggregate.conditions.map((condition) => <p key={condition.id}>{String((condition.code as { text?: string } | undefined)?.text ?? condition.id)}</p>)}</div>
        <div>
          <h3>Referral route</h3>
          <p>{facilityLabels.referring}</p>
          <p>{facilityLabels.receiving}</p>
        </div>
      </div>
    </section>
  );
}
