import { useState } from "react";
import { JsonPanel } from "../components/JsonPanel";
import { useAppContext } from "../context/useAppContext";
import { hydrateReferral } from "../services/referralRetrieval";
import { searchResources } from "../services/fhirClient";
import type { FhirResource, ReferralAggregate } from "../types";

type SearchMode = "patient-identifier" | "patient-name" | "service-status" | "task-status" | "service-subject" | "task-focus";

export function RetrieveReferral() {
  const { endpoints } = useAppContext();
  const [mode, setMode] = useState<SearchMode>("patient-identifier");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FhirResource[]>([]);
  const [aggregate, setAggregate] = useState<ReferralAggregate | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    setMessage("");
    setAggregate(null);
    try {
      let serviceRequests: FhirResource[] = [];
      if (mode === "patient-identifier" || mode === "patient-name") {
        const patientParam = mode === "patient-identifier" ? "identifier" : "name";
        const patients = await searchResources(
          endpoints.pherefBaseUrl,
          "Patient",
          new URLSearchParams({ [patientParam]: query })
        );
        const batches = await Promise.all(
          patients.flatMap((patient) =>
            patient.id
              ? [
                  searchResources(
                    endpoints.pherefBaseUrl,
                    "ServiceRequest",
                    new URLSearchParams({ subject: `Patient/${patient.id}` })
                  )
                ]
              : []
          )
        );
        serviceRequests = batches.flat();
      } else if (mode === "task-status" || mode === "task-focus") {
        const taskParam = mode === "task-status" ? "status" : "focus";
        const tasks = await searchResources(
          endpoints.pherefBaseUrl,
          "Task",
          new URLSearchParams({ [taskParam]: query })
        );
        serviceRequests = (
          await Promise.all(
            tasks.flatMap((task) => {
              const focus = task.focus as { reference?: string } | undefined;
              const match = focus?.reference?.match(/ServiceRequest\/([^/]+)$/);
              return match
                ? [
                    searchResources(
                      endpoints.pherefBaseUrl,
                      "ServiceRequest",
                      new URLSearchParams({ _id: match[1] })
                    )
                  ]
                : [];
            })
          )
        ).flat();
      } else {
        const param = mode === "service-status" ? "status" : "subject";
        serviceRequests = await searchResources(
          endpoints.pherefBaseUrl,
          "ServiceRequest",
          new URLSearchParams({ [param]: query })
        );
      }
      setResults(
        [...new Map(serviceRequests.map((item) => [item.id ?? JSON.stringify(item), item])).values()]
      );
      setMessage(`${serviceRequests.length} referral result(s) returned.`);
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
        <div className="search-row">
          <select value={mode} onChange={(event) => setMode(event.target.value as SearchMode)} aria-label="Search type">
            <option value="patient-identifier">Patient identifier</option>
            <option value="patient-name">Patient name</option>
            <option value="service-status">ServiceRequest status</option>
            <option value="task-status">Task status</option>
            <option value="service-subject">ServiceRequest subject</option>
            <option value="task-focus">Task focus</option>
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter search value" />
          <button type="button" onClick={search} disabled={!query.trim() || loading}>{loading ? "Loading..." : "Search"}</button>
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
  const patientName = ((aggregate.patient?.name as Array<{ text?: string; given?: string[]; family?: string }> | undefined)?.[0]);
  const displayName =
    patientName?.text ??
    (`${patientName?.given?.join(" ") ?? ""} ${patientName?.family ?? ""}`.trim() || "Patient");
  return (
    <section className="card clinical-summary">
      <p className="eyebrow">Receiving-facility clinical summary</p>
      <h2>{displayName}</h2>
      <div className="summary-grid">
        <div><span>Gender</span><strong>{String(aggregate.patient?.gender ?? "-")}</strong></div>
        <div><span>Birth date</span><strong>{String(aggregate.patient?.birthDate ?? "-")}</strong></div>
        <div><span>Task status</span><strong>{String(aggregate.task?.status ?? "-")}</strong></div>
        <div><span>Conditions</span><strong>{aggregate.conditions.length}</strong></div>
        <div><span>Vital observations</span><strong>{aggregate.observations.length}</strong></div>
        <div><span>Attachments</span><strong>{aggregate.diagnosticReports.length}</strong></div>
      </div>
      <div className="clinical-columns">
        <div><h3>Clinical reason</h3>{aggregate.conditions.map((condition) => <p key={condition.id}>{String((condition.code as { text?: string } | undefined)?.text ?? condition.id)}</p>)}</div>
        <div><h3>Facilities</h3>{aggregate.organizations.map((organization) => <p key={organization.id}>{String(organization.name)}</p>)}</div>
        <div><h3>Practitioners</h3>{aggregate.practitioners.map((practitioner) => <p key={practitioner.id}>{JSON.stringify(practitioner.name)}</p>)}</div>
      </div>
    </section>
  );
}
