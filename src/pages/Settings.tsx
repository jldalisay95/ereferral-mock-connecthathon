import { useEffect, useMemo, useState } from "react";
import { FacilityPublishControl } from "../components/FacilityPublishControl";
import { FacilityRegistrationForm } from "../components/FacilityRegistrationForm";
import { useAppContext } from "../context/useAppContext";
import type { AppSettings } from "../types";

export function Settings() {
  const {
    connectathonConfig,
    facilities,
    registeredFacilities,
    settings,
    setEndpoints,
    resetEndpoints,
    registerFacility
  } = useAppContext();
  const [editable, setEditable] = useState(settings);
  const registeredIds = useMemo(
    () => new Set(registeredFacilities.map((facility) => facility.id)),
    [registeredFacilities]
  );
  useEffect(() => setEditable(settings), [settings]);

  const update = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => setEditable((current) => ({ ...current, [key]: value }));

  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Administration</p>
        <h2>FHIR and demo settings</h2>
        <div className="form-grid">
          <label className="field">
            <span>PHeRef CDR URL</span>
            <input
              value={editable.pherefBaseUrl}
              onChange={(event) => update("pherefBaseUrl", event.target.value)}
            />
          </label>
          <label className="field">
            <span>PH Core CDR URL</span>
            <input
              value={editable.phCoreBaseUrl}
              onChange={(event) => update("phCoreBaseUrl", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Terminology URL</span>
            <input
              value={editable.terminologyBaseUrl}
              onChange={(event) => update("terminologyBaseUrl", event.target.value)}
            />
          </label>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={editable.demoMode}
            disabled={!connectathonConfig.capabilities.externalWrites}
            onChange={(event) => update("demoMode", event.target.checked)}
          />
          Demo mode: keep referral submissions and Task updates in local mock
          persistence
        </label>
        <div className="notice warning">
          {connectathonConfig.capabilities.externalWrites
            ? "The ready preset is active. Facility creation remains local; Organization publishing is a separate confirmed action."
            : "The participant preset is validation-only. Stored Demo mode cannot enable external writes."}
        </div>
        <div className="button-row">
          <button type="button" onClick={() => setEndpoints(editable)}>
            Save settings
          </button>
          <button type="button" className="secondary" onClick={resetEndpoints}>
            Reset defaults
          </button>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Facility registry</p>
        <h2>Create a local facility and account</h2>
        <p>
          Admin creation never changes the active Admin session and never
          publishes automatically.
        </p>
        <FacilityRegistrationForm
          terminologyBaseUrl={editable.terminologyBaseUrl}
          submitLabel="Register facility locally"
          onSubmit={(value) => {
            const { facility } = registerFacility(value);
            return `${facility.name} was registered locally.`;
          }}
        />
      </section>

      <section className="card">
        <p className="eyebrow">Facility directory</p>
        <h2>Configured facilities</h2>
        <div className="result-list">
          {facilities.map((facility) => (
            <article className="facility-result" key={facility.id}>
              <div className="result-card">
                <div>
                  <strong>{facility.name}</strong>
                  <span>NHFR {facility.organization.nhfrCode || "Not set"}</span>
                  <small>
                    {registeredIds.has(facility.id)
                      ? facility.organization.fhirReference
                        ? `Published: ${facility.organization.fhirReference}`
                        : "User-created · local only"
                      : "Bundled synthetic facility"}
                  </small>
                </div>
              </div>
              {registeredIds.has(facility.id) ? (
                <FacilityPublishControl facility={facility} />
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
