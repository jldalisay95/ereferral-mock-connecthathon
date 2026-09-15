import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrackComparison } from "../components/TrackComparison";
import {
  ENDPOINT_ENV_KEYS,
  endpointValueSource,
  type EndpointConfigKey
} from "../config/connectathon.config";
import { useAppContext } from "../context/useAppContext";
import {
  runRemoteReadinessChecks,
  type ReadinessResult
} from "../services/connectathonReadiness";
import type { AppSettings } from "../types";

const CONFIG_FILE = "src/config/connectathon.config.ts";

const ENDPOINT_FIELDS: Array<{
  key: EndpointConfigKey;
  label: string;
  configKey: string;
  purpose: string;
  request: string;
}> = [
  {
    key: "pherefBaseUrl",
    label: "PHeRef FHIR server URL",
    configKey: "endpoints.pherefBaseUrl",
    purpose:
      "PHeRef metadata, profiles, Bundle $validate, remote referral reads, and the ready track write destination.",
    request: "GET {PHeRef}/metadata"
  },
  {
    key: "phCoreBaseUrl",
    label: "PH Core FHIR server URL",
    configKey: "endpoints.phCoreBaseUrl",
    purpose: "PH Core CapabilityStatement and StructureDefinition discovery.",
    request: "GET {PH Core}/metadata"
  },
  {
    key: "terminologyBaseUrl",
    label: "Terminology server URL",
    configKey: "endpoints.terminologyBaseUrl",
    purpose:
      "Default live ValueSet expansion and PSGC checks. Individual ValueSets may be routed to another configured endpoint.",
    request: "GET {Terminology}/ValueSet/$expand?url={canonical}"
  }
];

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ParticipantSetup() {
  const {
    connectathonConfig,
    currentAccount,
    endpoints,
    setEndpoints,
    resetEndpoints
  } = useAppContext();
  const [editable, setEditable] = useState<AppSettings>(endpoints);
  const [results, setResults] = useState<ReadinessResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setEditable(endpoints), [endpoints]);

  const participantMode = connectathonConfig.preset === "participant";
  const allChecksPass =
    results.length > 0 && results.every((result) => result.status === "pass");

  function normalizedSettings(): AppSettings {
    return {
      ...editable,
      pherefBaseUrl: normalizeBaseUrl(editable.pherefBaseUrl),
      phCoreBaseUrl: normalizeBaseUrl(editable.phCoreBaseUrl),
      terminologyBaseUrl: normalizeBaseUrl(editable.terminologyBaseUrl),
      demoMode: true,
      version: 3
    };
  }

  function invalidKeys(value: AppSettings) {
    return ENDPOINT_FIELDS.filter((field) => !isHttpUrl(value[field.key])).map(
      (field) => field.configKey
    );
  }

  function save() {
    const next = normalizedSettings();
    const invalid = invalidKeys(next);
    if (invalid.length) {
      setMessage(`Enter an HTTP(S) URL for: ${invalid.join(", ")}.`);
      return;
    }
    setEndpoints(next);
    setResults([]);
    setMessage("Browser endpoint overrides saved. Run the server checks next.");
  }

  async function runChecks() {
    const next = normalizedSettings();
    const invalid = invalidKeys(next);
    if (invalid.length) {
      setMessage(`Enter an HTTP(S) URL for: ${invalid.join(", ")}.`);
      return;
    }
    setChecking(true);
    setMessage("");
    try {
      setEndpoints(next);
      setResults(await runRemoteReadinessChecks(connectathonConfig, next));
    } finally {
      setChecking(false);
    }
  }

  function reset() {
    resetEndpoints();
    setResults([]);
    setMessage(
      "Browser overrides removed. Active mode environment values or fork defaults are restored."
    );
  }

  return (
    <main className="registration-shell participant-setup-shell">
      <div className="participant-setup-page page-stack">
        <section className="hero card">
          <div>
            <p className="eyebrow">Safe endpoint configuration</p>
            <h1>Participant Starter Setup</h1>
            <p>
              Configure read and validation servers before registering a synthetic
              facility. This page never enables external writes.
            </p>
          </div>
          <span className={`preset-badge preset-${connectathonConfig.preset}`}>
            {participantMode ? "Participant starter" : "Connectathon ready"}
          </span>
        </section>

        {!participantMode ? (
          <section className="notice warning">
            The ready preset is active. Its behavior has not changed. Sign in as
            Admin to edit browser endpoint overrides in Settings, or restart with{" "}
            <code>npm run dev</code> for the safe Participant Starter setup.
          </section>
        ) : null}

        <section className="card">
          <p className="eyebrow">Step 1</p>
          <h2>Configure the three server base URLs</h2>
          <p>
            These values are stored only in this browser. Do not enter credentials,
            API keys, patient data, or other secrets.
          </p>
          <div className="endpoint-setup-list">
            {ENDPOINT_FIELDS.map((field) => (
              <div className="endpoint-setup-field" key={field.key}>
                <label className="field">
                  <span>{field.label}</span>
                  <input
                    type="url"
                    aria-label={field.label}
                    value={editable[field.key]}
                    disabled={!participantMode}
                    onChange={(event) =>
                      setEditable((current) => ({
                        ...current,
                        [field.key]: event.target.value
                      }))
                    }
                  />
                  <small>{field.purpose}</small>
                </label>
                <dl className="endpoint-source">
                  <div><dt>Configuration key</dt><dd><code>{field.configKey}</code></dd></div>
                  <div><dt>Environment override</dt><dd><code>{ENDPOINT_ENV_KEYS[field.key]}</code></dd></div>
                  <div><dt>Effective source</dt><dd>{endpointValueSource(field.key, endpoints[field.key])}</dd></div>
                  <div><dt>Example check</dt><dd><code>{field.request}</code></dd></div>
                </dl>
              </div>
            ))}
          </div>
          {message ? <div className="notice" role="status">{message}</div> : null}
          <div className="button-row">
            <button type="button" onClick={save} disabled={!participantMode}>
              Save browser endpoints
            </button>
            <button
              type="button"
              className="secondary"
              onClick={runChecks}
              disabled={!participantMode || checking}
            >
              {checking ? "Testing read-only connections..." : "Test servers and terminology"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={reset}
              disabled={!participantMode}
            >
              Reset build defaults
            </button>
          </div>
        </section>

        {results.length ? (
          <section className="card" aria-live="polite">
            <p className="eyebrow">Step 2</p>
            <div className="section-heading">
              <h2>Read-only server checks</h2>
              <span className={`status-badge readiness-${allChecksPass ? "pass" : "fail"}`}>
                {allChecksPass ? "All checks pass" : "Action required"}
              </span>
            </div>
            <div className="result-list">
              {results.map((result) => (
                <article className="result-card" key={result.id}>
                  <div>
                    <strong>{result.label}</strong>
                    <span>{result.detail}</span>
                    <small><code>{result.configKey}</code></small>
                  </div>
                  <span className={`status-badge readiness-${result.status}`}>
                    {result.status}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card">
          <p className="eyebrow">Step 3</p>
          <h2>Register or sign in locally</h2>
          <p>
            Facility registration creates browser-local synthetic data and does
            not publish an Organization.
          </p>
          <div className="button-row">
            <Link className={`button${allChecksPass ? "" : " secondary"}`} to="/register">
              Create a facility account
            </Link>
            <Link className="button secondary" to={currentAccount ? "/dashboard" : "/login"}>
              {currentAccount ? "Open dashboard" : "Return to login"}
            </Link>
          </div>
          {!allChecksPass ? (
            <p className="field-note">
              You may continue with a bundled account, but resolve server failures
              before expecting live terminology, PSGC, profiles, or validation to work.
            </p>
          ) : null}
        </section>

        <section className="card">
          <p className="eyebrow">Fork configuration</p>
          <h2>Values that must be edited in source</h2>
          <p>
            Open <code>{CONFIG_FILE}</code> and search for <code>EDIT FOR YOUR FORK</code>.
            Browser setup intentionally edits endpoints only.
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Edit group</th><th>What to change</th><th>How it is used</th></tr></thead>
              <tbody>
                <tr><td><code>ig.*</code></td><td>IG name, version, FHIR version, and documentation links</td><td>Compatibility checks and participant guidance</td></tr>
                <tr><td><code>profiles.*</code></td><td>Required StructureDefinition canonicals</td><td>Generated <code>meta.profile</code> and profile discovery</td></tr>
                <tr><td><code>extensions.*</code> and <code>identifierSystems.*</code></td><td>Active IG canonical URLs</td><td>Generated extensions and identifiers</td></tr>
                <tr><td><code>terminology.valueSets</code></td><td>Each ValueSet <code>canonical</code> and its endpoint key</td><td>The canonical identifies the ValueSet; the endpoint selects which configured server performs <code>$expand</code></td></tr>
                <tr><td><code>psgc.*</code></td><td>PSGC CodeSystem, release, and ValueSet URLs</td><td>Live address choices and compatibility checks</td></tr>
              </tbody>
            </table>
          </div>
          <p className="field-note">
            For repeatable local endpoint overrides, copy <code>.env.example</code> to{" "}
            <code>.env.participant.local</code>. Vite variables are public browser configuration.
          </p>
        </section>

        <section className="card">
          <p className="eyebrow">Track comparison</p>
          <h2>When to remain in Starter or switch to Ready</h2>
          <TrackComparison />
        </section>
      </div>
    </main>
  );
}
