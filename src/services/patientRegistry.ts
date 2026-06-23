import { patientDisplayName } from "../data/patients";
import type { PatientInput, PatientRecord, RegistryType } from "../types";

export interface PatientSearch {
  given: string;
  family: string;
  birthDate: string;
  identifier: string;
}

const includes = (value: string, query: string) =>
  value.toLowerCase().includes(query.trim().toLowerCase());

export function searchPatients(
  patients: PatientRecord[],
  query: Partial<PatientSearch>
) {
  return patients.filter((record) => {
    const patient = record.patient;
    return (
      (!query.given || includes(patient.given, query.given)) &&
      (!query.family || includes(patient.family, query.family)) &&
      (!query.birthDate || patient.birthDate === query.birthDate) &&
      (!query.identifier ||
        includes(patient.philHealthId, query.identifier) ||
        includes(patient.philSysId, query.identifier))
    );
  });
}

export function findDuplicatePatients(
  patients: PatientRecord[],
  patient: PatientInput,
  excludedId?: string
) {
  return patients.filter((record) => {
    if (record.id === excludedId) return false;
    if (
      patient.philSysId &&
      record.patient.philSysId &&
      patient.philSysId === record.patient.philSysId
    ) {
      return true;
    }
    if (
      patient.philHealthId &&
      record.patient.philHealthId &&
      patient.philHealthId === record.patient.philHealthId
    ) {
      return true;
    }
    return (
      patientDisplayName(record.patient).toLowerCase() ===
        patientDisplayName(patient).toLowerCase() &&
      Boolean(patient.birthDate) &&
      record.patient.birthDate === patient.birthDate
    );
  });
}

export function createPatientRecord(
  organizationId: string,
  patient: PatientInput,
  registryType: RegistryType,
  notes: string
): PatientRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    organizationId,
    patient,
    registryType,
    notes,
    createdAt: now,
    updatedAt: now
  };
}
