import { describe, expect, it } from "vitest";
import { parseReference } from "./referralRetrieval";
import { parseTransactionResponse, validateBundleDetailed } from "./fhirClient";
import { buildExpandUrl } from "./terminologyClient";

describe("service helpers", () => {
  it("encodes terminology canonicals safely", () => {
    const url = buildExpandUrl("https://tx.example/fhir/", "https://example.org/ValueSet/a?x=1");
    expect(url).toBe(
      "https://tx.example/fhir/ValueSet/$expand?url=https%3A%2F%2Fexample.org%2FValueSet%2Fa%3Fx%3D1"
    );
  });

  it("extracts resource IDs from transaction response locations", () => {
    const receipt = parseTransactionResponse(
      {
        resourceType: "Bundle",
        type: "transaction-response",
        entry: [
          { response: { location: "Patient/123/_history/1" } },
          { response: { location: "Task/456/_history/1" } }
        ]
      },
      "Synthetic Patient",
      "SYN-1"
    );
    expect(receipt.resourceIds).toEqual({ Patient: ["123"], Task: ["456"] });
  });

  it("parses relative and absolute FHIR references", () => {
    expect(parseReference({ reference: "Patient/123" })).toEqual({
      resourceType: "Patient",
      id: "123"
    });
    expect(parseReference("https://example/fhir/Task/456")).toEqual({
      resourceType: "Task",
      id: "456"
    });
    expect(parseReference("urn:uuid:abc")).toBeNull();
  });

  it("wraps validation payloads in Parameters for HAPI $validate", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body))
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ resourceType: "OperationOutcome", issue: [] })
      } as Response;
    }) as typeof fetch;
    try {
      await validateBundleDetailed("https://server.test/fhir", {
        resourceType: "Bundle",
        type: "transaction",
        entry: []
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(calls[0].url).toBe("https://server.test/fhir/Bundle/$validate");
    expect(calls[0].body).toEqual({
      resourceType: "Parameters",
      parameter: [
        {
          name: "resource",
          resource: {
            resourceType: "Bundle",
            type: "transaction",
            entry: []
          }
        }
      ]
    });
  });
});
