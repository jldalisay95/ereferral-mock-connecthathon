import { describe, expect, it } from "vitest";
import {
  IDENTIFIER_SYSTEMS,
  PWD_DISABILITY_OPTIONS,
  PROFILES,
  PSGC_SYSTEM,
  PSGC_VERSION
} from "../../config/fhir";
import { createDemoDraft } from "../../data/demo";
import { FACILITIES } from "../../data/facilities";
import { DEMO_PATIENTS } from "../../data/patients";
import {
  buildDiagnosticReport,
  buildEncounter,
  buildPatient,
  buildReferralTransactionBundle,
  buildProvenance
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

  it("uses validation-friendly contact relationship coding", () => {
    const patient = buildPatient(createDemoDraft());
    const contact = (
      patient.contact as Array<{
        relationship: Array<{ coding: Array<{ system: string; code: string }> }>;
      }>
    )[0];
    expect(contact.relationship[0].coding[0]).toEqual(
      expect.objectContaining({
        system: "http://terminology.hl7.org/CodeSystem/v2-0131",
        code: "N"
      })
    );
  });

  it("adds the exact nested PWD extension only when enabled", () => {
    const draft = createDemoDraft();
    expect(buildPatient(draft).extension).toBeUndefined();
    draft.patient.pwdEnabled = true;
    draft.patient.pwdId = "SYN-PWD-1";
    draft.patient.disabilities = [
      { ...PWD_DISABILITY_OPTIONS[0] },
      { ...PWD_DISABILITY_OPTIONS[1] }
    ];
    draft.patient.pwdExpirationDate = "2028-01-01";
    const patient = buildPatient(draft);
    expect(patient.extension).toEqual([
      expect.objectContaining({
        url: PROFILES.pwdDisability,
        extension: expect.arrayContaining([
          { url: "pwdId", valueString: "SYN-PWD-1" },
          expect.objectContaining({
            url: "disabilityType",
            valueCodeableConcept: expect.objectContaining({
              coding: [
                expect.objectContaining({ code: PWD_DISABILITY_OPTIONS[0].code })
              ]
            })
          }),
          expect.objectContaining({
            url: "disabilityType",
            valueCodeableConcept: expect.objectContaining({
              coding: [
                expect.objectContaining({ code: PWD_DISABILITY_OPTIONS[1].code })
              ]
            })
          }),
          { url: "idExpirationDate", valueDate: "2028-01-01" }
        ])
      })
    ]);
  });

  it("builds blood pressure as the published panel Observation with components", () => {
    const draft = createDemoDraft();
    const bundle = buildReferralTransactionBundle(draft);
    const observations = (bundle.entry as Array<{ resource: Record<string, unknown> }>)
      .map((entry) => entry.resource)
      .filter((resource) => resource.resourceType === "Observation");
    const serialized = JSON.stringify(observations);
    expect(observations).toHaveLength(7);
    expect(
      observations.filter((resource) =>
        JSON.stringify(resource.code).includes("http://loinc.org")
      )
    ).toHaveLength(6);
    const bloodPressure = observations.find((resource) =>
      JSON.stringify(resource.code).includes("85354-9")
    );
    expect(bloodPressure).toBeDefined();
    expect(JSON.stringify(bloodPressure?.code)).toContain("75367002");
    expect(JSON.stringify(bloodPressure?.component)).toContain("8480-6");
    expect(JSON.stringify(bloodPressure?.component)).toContain("271649006");
    expect(JSON.stringify(bloodPressure?.component)).toContain("8462-4");
    expect(JSON.stringify(bloodPressure?.component)).toContain("271650006");
    expect(JSON.stringify(bloodPressure?.component)).toContain("mm[Hg]");
    expect(JSON.stringify(bloodPressure?.meta)).toContain("ereferral-observation");
    expect(serialized).toContain("Clinical history");
  });

  it("uses the current Connectathon PSGC canonical", () => {
    const serialized = JSON.stringify(buildPatient(createDemoDraft()));
    expect(serialized).toContain(PSGC_SYSTEM);
    expect(serialized).toContain(PSGC_VERSION);
  });

  it("uses valid current South Cotabato city and barangay PSGC codes", () => {
    const draft = createDemoDraft(FACILITIES[2], FACILITIES[0], DEMO_PATIENTS[2]);
    const bundle = buildReferralTransactionBundle(draft);
    const serialized = JSON.stringify(bundle);
    expect(serialized).toContain("1206306000");
    expect(serialized).toContain("1206306018");
    expect(serialized).not.toContain("1206305000");
    expect(serialized).not.toContain("1206305012");
  });

  it("omits empty address primitives", () => {
    const draft = createDemoDraft();
    draft.patient.address.postalCode = "";
    const patient = buildPatient(draft);
    const address = (patient.address as Array<Record<string, unknown>>)[0];
    expect(address).not.toHaveProperty("postalCode");
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

  it("includes DiagnosticReport attachment data when supplied", () => {
    const report = buildDiagnosticReport(createDemoDraft(), {
      patient: "urn:uuid:patient",
      encounter: "urn:uuid:encounter",
      referringPractitioner: "",
      receivingPractitioner: "",
      initiatingOrganization: "",
      receivingOrganization: "",
      referringRole: "",
      receivingRole: "",
      serviceRequest: "",
      chiefComplaint: "",
      clinicalHistory: "",
      workingImpression: "",
      observations: [],
      procedure: "",
      diagnosticReport: "",
      task: "",
      provenance: ""
    });
    expect(report.code).toEqual({ text: "synthetic-urinalysis.txt" });
    expect(report.subject).toEqual({ reference: "urn:uuid:patient" });
    expect(report).not.toHaveProperty("encounter");
    expect(report).not.toHaveProperty("basedOn");
    expect(report.issued).toBeDefined();
    expect(report.presentedForm).toEqual([
      { url: expect.stringMatching(/^data:text\/plain;base64,/) }
    ]);
    expect(JSON.stringify(report.presentedForm)).not.toContain("contentType");
  });

  it("keeps DiagnosticReport presentedForm title metadata when no attachment bytes exist", () => {
    const draft = createDemoDraft();
    draft.labAttachmentBase64 = "";
    draft.labAttachmentContentType = undefined;
    const report = buildDiagnosticReport(draft, {
      patient: "urn:uuid:patient",
      encounter: "urn:uuid:encounter",
      referringPractitioner: "",
      receivingPractitioner: "",
      initiatingOrganization: "",
      receivingOrganization: "",
      referringRole: "",
      receivingRole: "",
      serviceRequest: "",
      chiefComplaint: "",
      clinicalHistory: "",
      workingImpression: "",
      observations: [],
      procedure: "",
      diagnosticReport: "",
      task: "",
      provenance: ""
    });
    expect(report.code).toEqual({ text: "synthetic-urinalysis.txt" });
    expect(report.presentedForm).toEqual([{ title: "synthetic-urinalysis.txt" }]);
  });

  it("keeps DiagnosticReport external attachment URLs without contentType", () => {
    const draft = createDemoDraft();
    draft.labAttachmentBase64 = "";
    draft.labAttachmentUrl = "https://example.test/reports/urinalysis.pdf";
    draft.labAttachmentName = "urinalysis.pdf";
    const report = buildDiagnosticReport(draft, {
      patient: "urn:uuid:patient",
      encounter: "urn:uuid:encounter",
      referringPractitioner: "",
      receivingPractitioner: "",
      initiatingOrganization: "",
      receivingOrganization: "",
      referringRole: "",
      receivingRole: "",
      serviceRequest: "",
      chiefComplaint: "",
      clinicalHistory: "",
      workingImpression: "",
      observations: [],
      procedure: "",
      diagnosticReport: "",
      task: "",
      provenance: ""
    });

    expect(report.presentedForm).toEqual([
      {
        url: "https://example.test/reports/urinalysis.pdf",
        title: "urinalysis.pdf"
      }
    ]);
    expect(JSON.stringify(report.presentedForm)).not.toContain("contentType");
  });

  it("uses validator-compatible Encounter and Provenance signature fields", () => {
    const draft = createDemoDraft();
    const refs = {
      patient: "urn:uuid:patient",
      encounter: "urn:uuid:encounter",
      referringPractitioner: "",
      receivingPractitioner: "",
      initiatingOrganization: "urn:uuid:org",
      receivingOrganization: "",
      referringRole: "urn:uuid:role",
      receivingRole: "",
      serviceRequest: "urn:uuid:service-request",
      chiefComplaint: "",
      clinicalHistory: "",
      workingImpression: "",
      observations: [],
      procedure: "",
      diagnosticReport: "",
      task: "",
      provenance: ""
    };
    expect(buildEncounter(draft, refs).status).toBe("finished");
    const provenance = buildProvenance(draft, refs);
    expect(
      (
        provenance.signature as Array<{
          type: Array<{ system: string; version?: string }>;
        }>
      )[0].type[0]
    ).toEqual(
      expect.objectContaining({
        system: "urn:iso-astm:E1762-95:2013",
        version: "4.0.1"
      })
    );
  });

  it("builds 22 entries with seven conditional PUTs, fifteen POSTs, and valid urn references", () => {
    const bundle = buildReferralTransactionBundle(createDemoDraft());
    const entries = bundle.entry as Array<{
      fullUrl: string;
      request: { method: string; url: string };
      resource: unknown;
    }>;
    expect(entries).toHaveLength(22);
    expect(new Set(entries.map((entry) => entry.fullUrl)).size).toBe(22);
    expect(entries.filter((entry) => entry.request.method === "PUT")).toHaveLength(7);
    expect(entries.filter((entry) => entry.request.method === "POST")).toHaveLength(15);

    const fullUrls = new Set(entries.map((entry) => entry.fullUrl));
    const references = JSON.stringify(entries.map((entry) => entry.resource)).match(/urn:uuid:[a-f0-9-]+/g) ?? [];
    expect(references.length).toBeGreaterThan(10);
    for (const reference of references) expect(fullUrls.has(reference)).toBe(true);

    const serviceRequest = entries.find(
      (entry) => (entry.resource as { resourceType: string }).resourceType === "ServiceRequest"
    )?.resource as Record<string, unknown>;
    expect(serviceRequest.category).toBeDefined();
    expect(serviceRequest.code).toBeDefined();
    expect(serviceRequest.reasonCode).toBeDefined();
    expect(serviceRequest.priority).toBe("urgent");
    expect(serviceRequest.occurrenceDateTime).toBeDefined();
    expect(serviceRequest.relevantHistory).toBeDefined();
    expect(
      (
        serviceRequest.category as Array<{
          coding: Array<{ code: string; display: string }>;
          text: string;
        }>
      )[0].coding[0].code
    ).toBe("73770003");
    expect(
      (
        serviceRequest.category as Array<{
          coding: Array<{ display: string }>;
          text: string;
        }>
      )[0]
    ).toEqual(
      expect.objectContaining({
        text: "Emergency",
        coding: [
          expect.objectContaining({
            display: "Hospital-based outpatient emergency care center"
          })
        ]
      })
    );
    expect(
      (
        serviceRequest.reasonCode as Array<{
          coding: Array<{ code: string }>;
        }>
      )[0].coding[0].code
    ).toBe("11429006");
    expect(JSON.stringify(serviceRequest.reasonReference)).toContain("urn:uuid:");
    expect(JSON.stringify(serviceRequest.supportingInfo)).toContain("urn:uuid:");
    expect(JSON.stringify(serviceRequest.supportingInfo)).toContain(
      (entries.find(
        (entry) =>
          (entry.resource as { resourceType?: string; valueString?: string })
            .valueString === "Synthetic history: symptoms persisted despite initial supportive care."
      )?.fullUrl as string)
    );
    expect(JSON.stringify(serviceRequest.supportingInfo)).not.toContain(
      entries.find(
        (entry) => (entry.resource as { resourceType: string }).resourceType === "DiagnosticReport"
      )?.fullUrl as string
    );
    expect(JSON.stringify(serviceRequest.requester)).toContain("Kalibo Health Center");
    expect(JSON.stringify(serviceRequest.requester)).toContain("3056");
    expect(JSON.stringify(serviceRequest.requester)).not.toContain("Maria");
    expect(JSON.stringify(serviceRequest.performer)).toContain(
      "Dr. Rafael S. Tumbokon Memorial Hospital"
    );
    expect(JSON.stringify(serviceRequest.performer)).toContain("513");
    const referringRole = entries.find(
      (entry) => (entry.resource as { resourceType: string }).resourceType === "PractitionerRole"
    )?.resource as { organization?: { reference?: string; display?: string } } | undefined;
    expect(referringRole?.organization?.display).toBe("Kalibo Health Center - 3056");
    expect(
      entries.every((entry) =>
        (entry.resource as { text?: { div?: string } }).text?.div?.includes(
          'xmlns="http://www.w3.org/1999/xhtml"'
        )
      )
    ).toBe(true);
  });

  it("uses POST for a Patient without a reusable identifier", () => {
    const draft = createDemoDraft();
    draft.patient.philSysId = "";
    draft.patient.philHealthId = "";
    const bundle = buildReferralTransactionBundle(draft);
    const patientEntry = (
      bundle.entry as Array<{
        resource: { resourceType: string };
        request: { method: string; url: string };
      }>
    ).find((entry) => entry.resource.resourceType === "Patient");
    expect(patientEntry?.request).toEqual({ method: "POST", url: "Patient" });
  });

  it("uses PhilHealth conditional PUT when PhilSys is unavailable", () => {
    const draft = createDemoDraft();
    draft.patient.philSysId = "";
    const bundle = buildReferralTransactionBundle(draft);
    const patientEntry = (
      bundle.entry as Array<{
        resource: { resourceType: string };
        request: { method: string; url: string };
      }>
    ).find((entry) => entry.resource.resourceType === "Patient");
    expect(patientEntry?.request.method).toBe("PUT");
    expect(patientEntry?.request.url).toContain(IDENTIFIER_SYSTEMS.philHealth);
  });

  it("does not emit future authored or time-called values", () => {
    const draft = createDemoDraft();
    draft.authoredOn = new Date(Date.now() + 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16);
    draft.timeCalled = new Date(Date.now() + 2 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16);
    const bundle = buildReferralTransactionBundle(draft);
    const serviceRequest = (
      bundle.entry as Array<{ resource: { resourceType: string; authoredOn?: string; occurrenceDateTime?: string } }>
    ).find((entry) => entry.resource.resourceType === "ServiceRequest")?.resource;
    expect(new Date(serviceRequest?.authoredOn ?? "").getTime()).toBeLessThanOrEqual(Date.now());
    expect(new Date(serviceRequest?.occurrenceDateTime ?? "").getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("emits current referral timestamps instead of stale draft timestamps", () => {
    const draft = createDemoDraft();
    draft.authoredOn = "2020-01-01T08:00";
    draft.timeCalled = "2020-01-01T08:30";
    const beforeBuild = Date.now();
    const bundle = buildReferralTransactionBundle(draft);
    const serviceRequest = (
      bundle.entry as Array<{ resource: { resourceType: string; authoredOn?: string; occurrenceDateTime?: string } }>
    ).find((entry) => entry.resource.resourceType === "ServiceRequest")?.resource;
    expect(new Date(serviceRequest?.authoredOn ?? "").getTime()).toBeGreaterThanOrEqual(beforeBuild);
    expect(new Date(serviceRequest?.occurrenceDateTime ?? "").getTime()).toBeGreaterThanOrEqual(beforeBuild);
  });

  it("references a server Organization without fabricating receiving actors", () => {
    const draft = createDemoDraft();
    draft.receivingFacility = {
      ...draft.receivingFacility,
      name: "FHIR Directory Hospital",
      nhfrCode: "",
      source: "fhir",
      fhirReference:
        "https://cdr.pheref.fhirlab.net/fhir/Organization/server-hospital",
      fhirServerLabel: "PHeReF CDR"
    };
    draft.receivingPractitioner = undefined;
    const bundle = buildReferralTransactionBundle(draft);
    const entries = bundle.entry as Array<{
      fullUrl: string;
      resource: Record<string, unknown>;
      request: { method: string; url: string };
    }>;
    expect(entries).toHaveLength(19);
    expect(
      entries.filter(
        (entry) => entry.resource.resourceType === "Practitioner"
      )
    ).toHaveLength(1);
    expect(
      entries.filter(
        (entry) => entry.resource.resourceType === "PractitionerRole"
      )
    ).toHaveLength(1);
    expect(
      entries.filter(
        (entry) => entry.resource.resourceType === "Organization"
      )
    ).toHaveLength(1);
    const serviceRequest = entries.find(
      (entry) => entry.resource.resourceType === "ServiceRequest"
    )?.resource;
    const task = entries.find(
      (entry) => entry.resource.resourceType === "Task"
    )?.resource;
    expect(JSON.stringify(serviceRequest)).toContain(
      "Organization/server-hospital"
    );
    expect(JSON.stringify(task)).toContain("Organization/server-hospital");
    expect(JSON.stringify(bundle)).not.toContain(
      "https://cdr.pheref.fhirlab.net/fhir/Organization/server-hospital"
    );
  });
});
