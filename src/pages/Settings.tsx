import { useEffect, useState } from "react";
import { useAppContext } from "../context/useAppContext";
import type { AppSettings } from "../types";

export function Settings() {
  const { settings, setEndpoints, resetEndpoints } = useAppContext();
  const [editable, setEditable] = useState(settings);
  useEffect(() => setEditable(settings), [settings]);
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setEditable((current) => ({ ...current, [key]: value }));

  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Administration</p>
        <h2>FHIR and demo settings</h2>
        <div className="form-grid">
          <label className="field"><span>PHeRef CDR URL</span><input value={editable.pherefBaseUrl} onChange={(event) => update("pherefBaseUrl", event.target.value)} /></label>
          <label className="field"><span>PH Core CDR URL</span><input value={editable.phCoreBaseUrl} onChange={(event) => update("phCoreBaseUrl", event.target.value)} /></label>
          <label className="field"><span>Terminology URL</span><input value={editable.terminologyBaseUrl} onChange={(event) => update("terminologyBaseUrl", event.target.value)} /></label>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={editable.demoMode} onChange={(event) => update("demoMode", event.target.checked)} />
          Demo mode: keep transaction submissions and Task updates in local mock persistence
        </label>
        <div className="notice warning">
          Turning Demo mode off allows real POST and PUT requests to the configured PHeRef server.
        </div>
        <div className="button-row">
          <button type="button" onClick={() => setEndpoints(editable)}>Save settings</button>
          <button type="button" className="secondary" onClick={resetEndpoints}>Reset defaults</button>
        </div>
      </section>
    </div>
  );
}
