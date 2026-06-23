import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";
import { checkMetadata, endpointList } from "../services/fhirClient";
import { storage } from "../services/storage";
import type { EndpointConfig } from "../types";

type ConnectionState = Record<string, "checking" | "online" | "offline">;

export function Dashboard() {
  const { endpoints, setEndpoints, resetEndpoints } = useAppContext();
  const [editable, setEditable] = useState(endpoints);
  const [connections, setConnections] = useState<ConnectionState>({});
  const receipts = storage.loadReceipts();

  useEffect(() => setEditable(endpoints), [endpoints]);

  async function checkConnections() {
    const list = endpointList(endpoints);
    setConnections(Object.fromEntries(list.map((item) => [item.key, "checking"])));
    const results = await Promise.all(
      list.map(async (item) => {
        try {
          await checkMetadata(item.url);
          return [item.key, "online"] as const;
        } catch {
          return [item.key, "offline"] as const;
        }
      })
    );
    setConnections(Object.fromEntries(results));
  }

  useEffect(() => {
    void checkConnections();
    // Endpoint changes intentionally trigger a new capability check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoints]);

  const updateEndpoint = (key: keyof EndpointConfig, value: string) =>
    setEditable((current) => ({ ...current, [key]: value }));

  return (
    <div className="page-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">Connectathon demonstration workspace</p>
          <h2>Create, validate, submit, retrieve, and update a synthetic eReferral.</h2>
          <p>
            This browser-only prototype follows the published PHeRef transaction Bundle and uses
            configurable FHIR R4 endpoints.
          </p>
        </div>
        <div className="quick-actions">
          <Link className="button" to="/referrals/new">New referral</Link>
          <Link className="button secondary" to="/referrals/search">Search referral</Link>
          <Link className="button secondary" to="/terminology">Terminology check</Link>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FHIR endpoints</p>
            <h2>Connection status</h2>
          </div>
          <button type="button" className="secondary" onClick={checkConnections}>Check now</button>
        </div>
        <div className="status-grid">
          {endpointList(endpoints).map((item) => (
            <article key={item.key} className="status-card">
              <span className={`status-dot ${connections[item.key] ?? "checking"}`} />
              <div>
                <strong>{item.label}</strong>
                <small>{item.url}</small>
              </div>
              <span>{connections[item.key] ?? "checking"}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Local configuration</p>
        <h2>Endpoint overrides</h2>
        <div className="form-grid">
          <label className="field">
            <span>PHeRef CDR URL</span>
            <input value={editable.pherefBaseUrl} onChange={(event) => updateEndpoint("pherefBaseUrl", event.target.value)} />
          </label>
          <label className="field">
            <span>PH Core CDR URL</span>
            <input value={editable.phCoreBaseUrl} onChange={(event) => updateEndpoint("phCoreBaseUrl", event.target.value)} />
          </label>
          <label className="field">
            <span>Terminology server URL</span>
            <input value={editable.terminologyBaseUrl} onChange={(event) => updateEndpoint("terminologyBaseUrl", event.target.value)} />
          </label>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => setEndpoints(editable)}>Save endpoints</button>
          <button type="button" className="secondary" onClick={resetEndpoints}>Reset defaults</button>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Local receipts</p>
        <h2>Recent synthetic submissions</h2>
        {receipts.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Referral</th><th>Patient</th><th>Submitted</th><th>Task</th></tr></thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td><code>{receipt.referralId}</code></td>
                    <td>{receipt.patientName}</td>
                    <td>{new Date(receipt.submittedAt).toLocaleString()}</td>
                    <td><span className="status-badge">{receipt.taskStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No transaction receipts are stored in this browser yet.</p>}
      </section>
    </div>
  );
}
