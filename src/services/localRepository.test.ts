import { beforeEach, describe, expect, it } from "vitest";
import { createDemoDraft } from "../data/demo";
import { DEMO_ACCOUNTS, FACILITIES } from "../data/facilities";
import { createDraftRecord } from "./referralRecords";
import { localRepository } from "./localRepository";

describe("versioned local repository", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to live server mode, seeded patients, and persists sessions", () => {
    const state = localRepository.load();
    expect(state.version).toBe(3);
    expect(state.settings.demoMode).toBe(false);
    expect(state.patients.length).toBeGreaterThanOrEqual(3);
    const next = localRepository.setSession(state, {
      userId: "user-kalibo",
      username: "kalibo",
      displayName: "Kalibo Facility User",
      role: "facility_user",
      facilityId: "org-kalibo",
      facilityName: "Kalibo Health Center",
      loggedInAt: "2026-06-23T00:00:00Z"
    });
    expect(localRepository.load().session).toEqual(next.session);
    expect(localRepository.clearSession(next).session).toBeNull();
  });

  it("migrates version 2 endpoint and session data", () => {
    localStorage.setItem(
      "pheref.appState.v2",
      JSON.stringify({
        version: 2,
        session: {
          userId: "user-kalibo",
          loggedInAt: "2026-06-23T00:00:00Z"
        },
        settings: {
          version: 2,
          pherefBaseUrl: "https://example.test/fhir",
          phCoreBaseUrl: "https://phcore.test/fhir",
          terminologyBaseUrl: "https://tx.test/fhir",
          demoMode: true
        },
        activeDraftIds: {},
        referrals: [],
        notifications: []
      })
    );
    const state = localRepository.load();
    expect(state.version).toBe(3);
    expect(state.settings.pherefBaseUrl).toBe("https://example.test/fhir");
    expect(state.session?.username).toBe("kalibo");
    expect(state.patients.length).toBeGreaterThanOrEqual(3);
  });

  it("normalizes legacy draft terminology and rebuilds its Bundle", () => {
    const draft = createDemoDraft();
    draft.referralCategory = {
      system: "http://snomed.info/sct",
      code: "440655000",
      display: "Outpatient"
    };
    draft.requestedService = {
      system: "http://snomed.info/sct",
      code: "165197003",
      display: "Diagnostics"
    };
    const record = createDraftRecord(
      draft,
      DEMO_ACCOUNTS[0],
      FACILITIES[1].id
    );
    localStorage.setItem(
      "pheref.appState.v2",
      JSON.stringify({
        version: 2,
        session: null,
        settings: {
          version: 2,
          pherefBaseUrl: "https://example.test/fhir",
          phCoreBaseUrl: "https://phcore.test/fhir",
          terminologyBaseUrl: "https://tx.test/fhir",
          demoMode: true
        },
        activeDraftIds: { "user-kalibo": record.id },
        referrals: [record],
        notifications: []
      })
    );
    const state = localRepository.load();
    expect(state.referrals[0].draft.referralCategory).toEqual(
      expect.objectContaining({
        code: "440655000",
        display: "Outpatient"
      })
    );
    expect(state.referrals[0].draft.requestedService).toEqual(
      expect.objectContaining({
        code: "165197003",
        display: "Diagnostics"
      })
    );
    expect(JSON.stringify(state.referrals[0].fhirBundle)).toContain("440655000");
    expect(JSON.stringify(state.referrals[0].fhirBundle)).toContain("Outpatient");
  });

  it("normalizes legacy contact and disability coding into constrained choices", () => {
    const draft = createDemoDraft();
    const legacyPatient = draft.patient as unknown as Record<string, unknown>;
    legacyPatient.contactRelationship = {
      system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
      code: "NOK",
      display: "Next of Kin"
    };
    legacyPatient.disability = {
      system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs",
      code: "hearing",
      display: "Custom display"
    };
    legacyPatient.disabilities = undefined;
    const record = createDraftRecord(
      draft,
      DEMO_ACCOUNTS[0],
      FACILITIES[1].id
    );
    localStorage.setItem(
      "pheref.appState.v3",
      JSON.stringify({
        ...localRepository.load(),
        referrals: [record],
        patients: [
          {
            id: "legacy-patient",
            organizationId: FACILITIES[0].id,
            registryType: "registered",
            patient: draft.patient,
            notes: "",
            createdAt: "2026-06-23T00:00:00Z",
            updatedAt: "2026-06-23T00:00:00Z"
          }
        ]
      })
    );
    const state = localRepository.load();
    expect(state.referrals[0].draft.patient.contactRelationship).toEqual(
      expect.objectContaining({
        system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
        code: "NOK",
        display: "Next of Kin"
      })
    );
    expect(JSON.stringify(state.referrals[0].fhirBundle)).not.toContain('"code":"NOK"');
    expect(state.referrals[0].draft.patient.disabilities[0].display).toBe("Custom display");
    expect(state.patients[0].patient.disabilities[0].code).toBe("hearing");
  });

  it("preserves an external Organization destination without restoring a practitioner", () => {
    const draft = createDemoDraft();
    draft.receivingFacility = {
      ...draft.receivingFacility,
      name: "External Hospital",
      nhfrCode: "",
      source: "fhir",
      fhirReference:
        "https://cdr.pheref.fhirlab.net/fhir/Organization/external-hospital",
      fhirServerLabel: "PHeReF CDR"
    };
    draft.receivingPractitioner = undefined;
    const record = createDraftRecord(
      draft,
      DEMO_ACCOUNTS[0],
      `fhir:${draft.receivingFacility.fhirReference}`
    );
    localStorage.setItem(
      "pheref.appState.v3",
      JSON.stringify({
        ...localRepository.load(),
        referrals: [record]
      })
    );
    const state = localRepository.load();
    const normalized = state.referrals[0];
    expect(normalized.draft.receivingPractitioner).toBeUndefined();
    expect(
      (normalized.fhirBundle.entry as unknown[]).length
    ).toBe(19);
  });

  it("migrates stale South Cotabato PSGC codes to the current hierarchy", () => {
    const draft = createDemoDraft(FACILITIES[2], FACILITIES[0]);
    draft.initiatingFacility.address.city = "Koronadal City";
    draft.initiatingFacility.address.cityCode = "1206305000";
    draft.initiatingFacility.address.barangay = "Zone III";
    draft.initiatingFacility.address.barangayCode = "1206305012";
    const record = createDraftRecord(
      draft,
      DEMO_ACCOUNTS[2],
      FACILITIES[0].id
    );
    localStorage.setItem(
      "pheref.appState.v3",
      JSON.stringify({
        ...localRepository.load(),
        referrals: [record]
      })
    );
    const state = localRepository.load();
    const address = state.referrals[0].draft.initiatingFacility.address;
    expect(address.cityCode).toBe("1206306000");
    expect(address.city).toBe("City of Koronadal");
    expect(address.barangayCode).toBe("1206306018");
    expect(address.barangay).toBe("Zone III");
  });

  it("migrates legacy endpoint overrides", () => {
    localStorage.setItem(
      "pheref.endpoints",
      JSON.stringify({ pherefBaseUrl: "https://example.test/fhir" })
    );
    expect(localRepository.load().settings.pherefBaseUrl).toBe(
      "https://example.test/fhir"
    );
  });
});
