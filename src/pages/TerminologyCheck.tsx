import { useState } from "react";
import { VALUE_SETS } from "../config/fhir";
import { CONNECTATHON_CONFIG } from "../config/connectathon.config";
import { useAppContext } from "../context/useAppContext";
import { expandValueSet } from "../services/terminologyClient";
import type { CodingInput } from "../types";

interface TerminologyState {
  status: "idle" | "loading" | "success" | "error";
  codes: CodingInput[];
  error?: string;
}

export function TerminologyCheck() {
  const { endpoints } = useAppContext();
  const [results, setResults] = useState<Record<string, TerminologyState>>({});

  async function expand(
    key: string,
    canonical: string,
    fallbackOptions: readonly CodingInput[]
  ) {
    setResults((current) => ({ ...current, [key]: { status: "loading", codes: [] } }));
    try {
      const result = await expandValueSet(endpoints.terminologyBaseUrl, canonical);
      setResults((current) => ({
        ...current,
        [key]: { status: "success", codes: result.codes }
      }));
    } catch (error) {
      const fallbackAllowed = CONNECTATHON_CONFIG.preset === "participant";
      setResults((current) => ({
        ...current,
        [key]: {
          status: "error",
          codes: fallbackAllowed
            ? fallbackOptions.map((code) => ({ ...code }))
            : [],
          error: error instanceof Error ? error.message : "Expansion failed."
        }
      }));
    }
  }

  async function expandAll() {
    await Promise.all(
      VALUE_SETS.map((item) =>
        expand(item.key, item.canonical, item.fallbackOptions)
      )
    );
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Use Case 0</p>
            <h2>Terminology preparation</h2>
            <p>Expansions are cached for this browser session.</p>
            <p>
              Requests are read-only FHIR <code>ValueSet/$expand</code> calls.
              This application never creates, updates, or deletes terminology
              server resources.
            </p>
          </div>
          <button type="button" onClick={expandAll}>Expand all value sets</button>
        </div>
      </section>
      {VALUE_SETS.map((item) => {
        const result = results[item.key] ?? { status: "idle", codes: [] };
        return (
          <section className="card" key={item.key}>
            <div className="section-heading">
              <div>
                <h3>{item.label}</h3>
                <code>{item.canonical}</code>
              </div>
              <button type="button" className="secondary" onClick={() => expand(item.key, item.canonical, item.fallbackOptions)}>
                {result.status === "loading" ? "Loading..." : "Expand"}
              </button>
            </div>
            {result.status === "error" ? (
              <div className="notice warning">
                <strong>Terminology server unavailable for this expansion.</strong>{" "}
                {result.error}{" "}
                {CONNECTATHON_CONFIG.preset === "participant"
                  ? "Participant mode is showing its bundled development options; manual code entry is not enabled."
                  : "Ready mode does not permit bundled terminology. Resolve the configured terminology endpoint or canonical URL before continuing."}
              </div>
            ) : null}
            {result.codes.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Code</th><th>Display</th><th>System</th></tr></thead>
                  <tbody>
                    {result.codes.map((code) => (
                      <tr key={`${code.system}-${code.code}`}>
                        <td><code>{code.code}</code></td><td>{code.display}</td><td><code>{code.system}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : result.status === "idle" ? <p>Not expanded yet.</p> : null}
          </section>
        );
      })}
    </div>
  );
}
