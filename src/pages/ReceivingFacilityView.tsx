import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { JsonPanel } from "../components/JsonPanel";
import { useAppContext } from "../context/useAppContext";
import { applyTaskTransition } from "../fhir/taskTransitions";
import { hydrateReferral } from "../services/referralRetrieval";
import { putResource, readResource } from "../services/fhirClient";
import type { FhirResource, ReferralAggregate, TaskTransition } from "../types";
import { ClinicalSummary } from "./RetrieveReferral";

export function ReceivingFacilityView() {
  const { taskId } = useParams();
  const { endpoints } = useAppContext();
  const [task, setTask] = useState<FhirResource | null>(null);
  const [aggregate, setAggregate] = useState<ReferralAggregate | null>(null);
  const [transition, setTransition] = useState<TaskTransition>("received");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!taskId) return;
      setLoading(true);
      try {
        const currentTask = await readResource(endpoints.pherefBaseUrl, "Task", taskId);
        const focus = currentTask.focus as { reference?: string } | undefined;
        const serviceId = focus?.reference?.match(/ServiceRequest\/([^/]+)$/)?.[1];
        const serviceRequest = serviceId
          ? await readResource(endpoints.pherefBaseUrl, "ServiceRequest", serviceId)
          : null;
        if (active) {
          setTask(currentTask);
          setAggregate(serviceRequest ? await hydrateReferral(endpoints.pherefBaseUrl, serviceRequest) : null);
        }
      } catch (error) {
        if (active) setMessage(`Unable to load Task: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [endpoints.pherefBaseUrl, taskId]);

  async function updateTask() {
    if (!task) return;
    setLoading(true);
    try {
      const freshTask = await readResource(endpoints.pherefBaseUrl, "Task", task.id ?? "");
      const updated = applyTaskTransition(freshTask, transition, note);
      const saved = await putResource(endpoints.pherefBaseUrl, updated);
      setTask(saved);
      setMessage(`Task updated to ${String(saved.status)}.`);
      setNote("");
    } catch (error) {
      setMessage(`Task update failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Receiving facility</p>
        <h2>Referral workflow update</h2>
        {loading ? <p>Loading current Task and linked referral…</p> : null}
        {message ? <div className="notice">{message}</div> : null}
        {task ? (
          <div className="summary-grid">
            <div><span>Task ID</span><strong>{task.id}</strong></div>
            <div><span>Current status</span><strong>{String(task.status)}</strong></div>
            <div><span>Last modified</span><strong>{String(task.lastModified ?? "—")}</strong></div>
          </div>
        ) : null}
      </section>
      {aggregate ? <ClinicalSummary aggregate={{ ...aggregate, task: task ?? undefined }} /> : null}
      {task ? (
        <section className="card">
          <h2>Update Task.status</h2>
          <div className="form-grid">
            <label className="field"><span>Workflow action</span>
              <select value={transition} onChange={(event) => setTransition(event.target.value as TaskTransition)}>
                <option value="received">Received</option><option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option><option value="referred-onward">Referred onward</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="field"><span>Clinical / operational note</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} required={transition === "rejected" || transition === "referred-onward"} />
              <small>A reason is required for rejection and onward referral.</small>
            </label>
          </div>
          <button type="button" onClick={updateTask} disabled={loading}>GET latest Task, update, and PUT full resource</button>
        </section>
      ) : null}
      {task ? <JsonPanel title="Current Task resource" value={task} /> : null}
    </div>
  );
}
