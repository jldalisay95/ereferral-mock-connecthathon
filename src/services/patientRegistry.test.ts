import { describe, expect, it } from "vitest";
import { createEmptyPatient, DEMO_PATIENTS } from "../data/patients";
import {
  createPatientRecord,
  findDuplicatePatients,
  searchPatients
} from "./patientRegistry";

describe("patient registry", () => {
  it("searches names, birth dates, PhilSys, and PhilHealth identifiers", () => {
    expect(searchPatients(DEMO_PATIENTS, { family: "cruz" })).toHaveLength(1);
    expect(searchPatients(DEMO_PATIENTS, { given: "ben" })).toHaveLength(1);
    expect(searchPatients(DEMO_PATIENTS, { birthDate: "1998-11-02" })).toHaveLength(1);
    expect(searchPatients(DEMO_PATIENTS, { identifier: "PHIC-000001" })).toHaveLength(1);
  });

  it("detects identifier and demographic duplicates", () => {
    expect(
      findDuplicatePatients(DEMO_PATIENTS, structuredClone(DEMO_PATIENTS[0].patient))
    ).toHaveLength(1);
  });

  it("creates a walk-in record that can be completed later", () => {
    const patient = createEmptyPatient();
    patient.given = "Unidentified";
    patient.family = "Patient 1001";
    const record = createPatientRecord(
      "org-kalibo",
      patient,
      "walk-in",
      "Temporary identity"
    );
    expect(record.registryType).toBe("walk-in");
    expect(record.patient.birthDate).toBe("");
  });
});
