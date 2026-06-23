import { describe, expect, it } from "vitest";
import { parseReference } from "./referralRetrieval";
import { parseTransactionResponse } from "./fhirClient";
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
});
