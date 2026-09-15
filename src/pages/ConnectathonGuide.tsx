import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FacilityPublishControl } from "../components/FacilityPublishControl";
import { useAppContext } from "../context/useAppContext";
import {
  checkConfiguredUrls,
  runRemoteReadinessChecks,
  type ReadinessResult
} from "../services/connectathonReadiness";

const CONFIG_FILE = "src/config/connectathon.config.ts";

interface MappingRow {
  key: string;
  value: string;
  usage: string;
}

export function ConnectathonGuide() {
  const {
    connectathonConfig: config,
    currentAccount,
    endpoints,
    activeDraftRecord,
    registeredFacilities
  } = useAppContext();
  const [remoteResults, setRemoteResults] = useState<ReadinessResult[]>([]);
  const [checking, setChecking] = useState(false);
  const currentRegisteredFacility = registeredFacilities.find(
    (facility) => facility.id === currentAccount?.organizationId
  );

  const localResults = useMemo<ReadinessResult[]>(() => {
    const bundleEntries = Array.isArray(activeDraftRecord?.fhirBundle.entry)
      ? activeDraftRecord.fhirBundle.entry.length
      : 0;
    const validation = activeDraftRecord?.validationSummary;
    return [
      checkConfiguredUrls(config, endpoints),
      {
        id: "bundle",
        label: "Bundle construction",
        status: bundleEntries ? "pass" : "warning",
        configKey: "profiles.*, identifierSystems.*, terminology.*",
        detail: bundleEntries
          ? `The active transaction Bundle contains ${bundleEntries} entries.`
          : "Generate or continue a referral to construct a transaction Bundle."
      },
      {
        id: "validation",
        label: "Latest $validate result",
        status:
          validation?.validated && !validation.blocking ? "pass" : "warning",
        configKey: "endpoints.pherefBaseUrl, profiles.*, terminology.*",
        detail: validation?.validated
          ? validation.blocking
            ? "The latest validation has blocking fatal/error issues."
            : "The latest validation completed without blocking issues."
          : "No completed validation exists for the active referral."
      },
      {
        id: "writes",
        label: "External-write capability",
        status: config.capabilities.externalWrites ? "pass" : "warning",
        configKey: "preset (build mode; not localStorage)",
        detail: config.capabilities.externalWrites
          ? "The ready preset permits guarded transaction, PUT, and PATCH requests."
          : "The participant preset blocks all external writes. This is expected while preparing."
      }
    ];
  }, [activeDraftRecord, config, endpoints]);

  const displayedResults = [
    ...localResults,
    ...remoteResults.filter((result) => result.id !== "url-syntax")
  ];
  const requiredResults = displayedResults.filter((result) => result.id !== "writes");
  const checksPassed =
    requiredResults.length >= 9 &&
    requiredResults.every((result) => result.status === "pass");

  const mappingRows = useMemo<MappingRow[]>(
    () => [
      { key: "endpoints.pherefBaseUrl", value: endpoints.pherefBaseUrl, usage: "PHeRef metadata, Bundle $validate, referral transactions, Task reads/updates" },
      { key: "endpoints.phCoreBaseUrl", value: endpoints.phCoreBaseUrl, usage: "PH Core CapabilityStatement and StructureDefinition discovery" },
      { key: "endpoints.terminologyBaseUrl", value: endpoints.terminologyBaseUrl, usage: "ValueSet/$expand and PSGC terminology checks" },
      { key: "ig.version", value: config.ig.version, usage: "Readiness report and terminology cache isolation" },
      { key: "ig.fhirVersion", value: config.ig.fhirVersion, usage: "CapabilityStatement compatibility check" },
      ...Object.entries(config.profiles).map(([key, value]) => ({ key: `profiles.${key}`, value, usage: "Generated resource meta.profile and StructureDefinition readiness check" })),
      ...Object.entries(config.identifierSystems).map(([key, value]) => ({ key: `identifierSystems.${key}`, value, usage: "Generated resource identifier.system" })),
      ...config.terminology.valueSets.map((valueSet) => ({ key: `terminology.valueSets.${valueSet.key}`, value: valueSet.canonical, usage: `Live expansion for ${valueSet.label}; fallback is development-only` })),
      { key: "codeSystems.psgc", value: config.codeSystems.psgc, usage: "Address PSGC Coding.system when optional extensions are enabled" },
      { key: "psgc.version", value: config.psgc.version, usage: "PSGC compatibility checks, Coding.version, and cache isolation" },
      { key: "features.includePsgcExtensions", value: String(config.features.includePsgcExtensions), usage: "Controls optional PH Core geographic Address extensions" }
    ],
    [config, endpoints]
  );

  async function runChecks() {
    setChecking(true);
    try {
      setRemoteResults(await runRemoteReadinessChecks(config, endpoints));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero card">
        <div>
          <p className="eyebrow">Fork configuration and readiness</p>
          <h2>Connectathon Guide</h2>
          <p>
            Active preset: <strong>{config.preset}</strong>. Edit the tracked fork
            defaults, validate against the active IG, then deliberately start the
            ready preset. This page never enables writes automatically.
          </p>
          <p>
            Ready mode populates coded fields only from live, read-only
            <code> ValueSet/$expand</code> requests. It never uploads or changes
            CodeSystem or ValueSet resources on the terminology server.
          </p>
        </div>
        <div className="quick-actions">
          <button type="button" onClick={runChecks} disabled={checking}>
            {checking ? "Checking servers…" : "Run readiness checks"}
          </button>
          <a className="button secondary" href={config.ig.documentationUrl} target="_blank" rel="noreferrer">
            Open active IG
          </a>
        </div>
      </section>

      <section className={`notice ${checksPassed ? "" : "warning"}`} aria-live="polite">
        {checksPassed ? (
          config.preset === "participant" ? (
            <>
              Required checks pass. Stop this development server and run <code>npm run dev:ready</code>.
              Writes remain locked in this session.
            </>
          ) : (
            "Required checks pass and the ready preset is active. Validated referrals may be exchanged."
          )
        ) : (
          "Readiness is incomplete. Resolve every warning/failure below; fallback terminology does not count as a live expansion."
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Facility onboarding</p>
        <h2>Local account and Organization publishing</h2>
        {currentRegisteredFacility ? (
          <FacilityPublishControl facility={currentRegisteredFacility} />
        ) : currentAccount?.role === "admin" ? (
          <p>
            Create and publish user facilities from <Link to="/settings">Admin Settings</Link>.
          </p>
        ) : (
          <div className="notice">
            This is a bundled synthetic facility. Self-registered facilities
            show their explicit Organization publishing controls here.
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-heading">
          <div><p className="eyebrow">Checklist</p><h2>Evidence from this configuration</h2></div>
          <span className={`status-badge status-${checksPassed ? "validated" : "draft"}`}>
            {checksPassed ? "Required checks pass" : "Not ready"}
          </span>
        </div>
        <div className="result-list">
          {displayedResults.map((result) => (
            <article className="result-card" key={result.id}>
              <div>
                <strong>{result.label}</strong>
                <span>{result.detail}</span>
                <small><code>{result.configKey}</code></small>
              </div>
              <span className={`status-badge readiness-${result.status}`}>{result.status}</span>
            </article>
          ))}
        </div>
        {!activeDraftRecord ? (
          <p className="field-note">
            A facility user can <Link to="/referrals/new">generate a referral</Link> to complete the Bundle and validation checks.
          </p>
        ) : null}
      </section>

      <section className="card">
        <p className="eyebrow">Effective conformance map</p>
        <h2>What to edit and where it is used</h2>
        <p>
          Fork defaults come from <code>{CONFIG_FILE}</code>. Admin Settings and
          mode-specific <code>.env.*.local</code> files may override only endpoints.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Configuration key</th><th>Effective value</th><th>FHIR / IG usage</th><th>Edit source</th></tr></thead>
            <tbody>
              {mappingRows.map((row) => (
                <tr key={row.key}>
                  <td><code>{row.key}</code></td>
                  <td><code>{row.value}</code></td>
                  <td>{row.usage}</td>
                  <td><code>{CONFIG_FILE}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
