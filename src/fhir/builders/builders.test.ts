import { describe, expect, it } from "vitest";
import { IDENTIFIER_SYSTEMS, PROFILES } from "../../config/fhir";
import { createDemoDraft } from "../../data/demo";
import {
  buildBloodPressureObservation,
  buildDiagnosticReport,
  buildPatient,
  buildReferralTransactionBundle
} from ".";

describe("PHeRef builders", () => {
  it("builds a profiled synthetic Patient with official identifier systems", () => {
    const patient = buildPatient(createDemoDraft());
    expect(patient.resourceType).toBe("Patient");
    expect(patient.meta?.profile).toContain(PROFILES.patient);
    expect(patient.identifier).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ system: IDENTIFIER_SYSTEMS.philSys }),
        expect.objectContaining({ system: IDENTIFIER_SYSTEMS.philHealth })
      ])
    );
    expect(JSON.stringify(patient)).toContain("SYN-");
  });

  it("adds the exact nested PWD extension only when enabled", () => {
    const draft = createDemoDraft();
    expect(buildPatient(draft).extension).toBeUndefined();
    draft.patient.pwdEnabled = true;
    draft.patient.pwdId = "SYN-PWD-1";
    draft.patient.pwdExpirationDate = "2028-01-01";
    const patient = buildPatient(draft);
    expect(patient.extension).toEqual([
      expect.objectContaining({
        url: PROFILES.pwdDisability,
        extension: expect.arrayContaining([
          { url: "pwdId", valueString: "SYN-PWD-1" },
          expect.objectContaining({ url: "disabilityType" }),
          { url: "idExpirationDate", valueDate: "2028-01-01" }
        ])
      })
    ]);
  });

  it("builds blood pressure with published LOINC and UCUM codes", () => {
    const draft = createDemoDraft();
    const bundle = buildReferralTransactionBundle(draft);
    const encounterEntry = (bundle.entry as Array<Record<string, unknown>>).find(
      (entry) => (entry.resource as { resourceType?: string }).resourceType === "Encounter"
    );
    const refs = {
      patient: "urn:uuid:patient",
      encounter: String(encounterEntry?.fullUrl),
      referringPractitioner: "",
      receivingPractitioner: "",
      initiatingOrganization: "",
      receivingOrganization: "",
      referringRole: "",
      receivingRole: "",
      serviceRequest: "",
      chiefComplaint: "",
      workingImpression: "",
      observations: [],
      procedure: "",
      diagnosticReport: "",
      task: "",
      provenance: ""
    };
    const observation = buildBloodPressureObservation(draft, refs);
    expect((observation.code as { coding: Array<{ code: string }> }).coding[0].code).toBe("85354-9");
    expect(JSON.stringify(observation)).toContain("mm[Hg]");
  });

  it("uses the current Connectathon PSGC canonical", () => {
    expect(JSON.stringify(buildPatient(createDemoDraft()))).toContain(
      "https://fhir.doh.gov.ph/phcore/CodeSystem/PSGC"
    );
  });

  it("omits an unconfirmed profile from DiagnosticReport", () => {
    const draft = createDemoDraft();
    const bundle = buildReferralTransactionBundle(draft);
    const diagnosticReport = (bundle.entry as Array<{ resource: { resourceType: string; meta?: unknown } }>).find(
      (entry) => entry.resource.resourceType === "DiagnosticReport"
    )?.resource;
    expect(diagnosticReport?.meta).toBeUndefined();
    expect(buildDiagnosticReport).toBeTypeOf("function");
  });

  it("builds 21 entries with seven conditional PUTs, fourteen POSTs, and valid urn references", () => {
    const bundle = buildReferralTransactionBundle(createDemoDraft());
    const entries = bundle.entry as Array<{
      fullUrl: string;
      request: { method: string; url: string };
      resource: unknown;
    }>;
    expect(entries).toHaveLength(21);
    expect(new Set(entries.map((entry) => entry.fullUrl)).size).toBe(21);
    expect(entries.filter((entry) => entry.request.method === "PUT")).toHaveLength(7);
    expect(entries.filter((entry) => entry.request.method === "POST")).toHaveLength(14);

    const fullUrls = new Set(entries.map((entry) => entry.fullUrl));
    const references = JSON.stringify(entries.map((entry) => entry.resource)).match(/urn:uuid:[a-f0-9-]+/g) ?? [];
    expect(references.length).toBeGreaterThan(10);
    for (const reference of references) expect(fullUrls.has(reference)).toBe(true);

    const serviceRequest = entries.find(
      (entry) => (entry.resource as { resourceType: string }).resourceType === "ServiceRequest"
    )?.resource as Record<string, unknown>;
    expect(serviceRequest.category).toBeDefined();
    expect(serviceRequest.reasonCode).toBeDefined();
    expect(serviceRequest.priority).toBeUndefined();
  });
});
