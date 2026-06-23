import { useState } from "react";
import { VALUE_SETS } from "../config/fhir";
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

  async function expand(key: string, canonical: string) {
    setResults((current) => ({ ...current, [key]: { status: "loading", codes: [] } }));
    try {
      const result = await expandValueSet(endpoints.terminologyBaseUrl, canonical);
      setResults((current) => ({
        ...current,
        [key]: { status: "success", codes: result.codes }
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [key]: {
          status: "error",
          codes: [],
          error: error instanceof Error ? error.message : "Expansion failed."
        }
      }));
    }
  }

  async function expandAll() {
    await Promise.all(VALUE_SETS.map((item) => expand(item.key, item.canonical)));
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Use Case 0</p>
            <h2>Terminology preparation</h2>
            <p>Expansions are cached for this browser session.</p>
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
              <button type="button" className="secondary" onClick={() => expand(item.key, item.canonical)}>
                {result.status === "loading" ? "Loading…" : "Expand"}
              </button>
            </div>
            {result.status === "error" ? (
              <div className="notice warning">
                <strong>Non-blocking terminology warning.</strong> {result.error} Manual code entry
                remains available in the referral form and is labeled as manual.
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
