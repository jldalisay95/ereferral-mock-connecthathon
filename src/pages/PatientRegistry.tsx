import { useMemo, useState } from "react";
import { CodingMultiSelect, CodingSelect } from "../components/CodingSelect";
import { FormField, SelectInput, TextInput } from "../components/FormField";
import { PsgcAddressFields } from "../components/PsgcAddressFields";
import { useAppContext } from "../context/useAppContext";
import { createEmptyPatient, patientDisplayName } from "../data/patients";
import {
  findDuplicatePatients,
  searchPatients
} from "../services/patientRegistry";
import type { PatientInput, PatientRecord, RegistryType } from "../types";
import { useTerminologyValueSet } from "../hooks/useTerminologyValueSet";

const emptySearch = { given: "", family: "", birthDate: "", identifier: "" };

export function PatientRegistry() {
  const {
    scopedPatients,
    savePatient,
    linkWalkInPatient,
    endpoints
  } = useAppContext();
  const [search, setSearch] = useState(emptySearch);
  const [editing, setEditing] = useState<PatientRecord | null>(null);
  const [patient, setPatient] = useState<PatientInput>(createEmptyPatient());
  const [registryType, setRegistryType] = useState<RegistryType>("registered");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const genders = useTerminologyValueSet("administrative-gender");
  const relationships = useTerminologyValueSet("ereferral-relationship-type");
  const disabilities = useTerminologyValueSet("pwd-disability");
  const requiredTerminology = patient.pwdEnabled
    ? [genders, relationships, disabilities]
    : [genders, relationships];
  const liveTerminologyPending = requiredTerminology.some(
    (item) => item.requiresLiveExpansion && item.source !== "server"
  ) ||
    (genders.requiresLiveExpansion &&
      !genders.options.some((option) => option.code === patient.gender)) ||
    (relationships.requiresLiveExpansion &&
      !relationships.options.some(
        (option) =>
          option.system === patient.contactRelationship.system &&
          option.code === patient.contactRelationship.code
      )) ||
    (patient.pwdEnabled &&
      disabilities.requiresLiveExpansion &&
      patient.disabilities.some(
        (selected) =>
          !disabilities.options.some(
            (option) =>
              option.system === selected.system && option.code === selected.code
          )
      ));

  const results = useMemo(
    () => searchPatients(scopedPatients, search),
    [scopedPatients, search]
  );
  const duplicates = findDuplicatePatients(
    scopedPatients,
    patient,
    editing?.id
  );

  function beginCreate(type: RegistryType) {
    const next = createEmptyPatient();
    if (type === "walk-in") {
      next.given = "Unidentified";
      next.family = `Patient ${Math.floor(Math.random() * 9000 + 1000)}`;
      next.gender = "unknown";
    }
    setEditing(null);
    setPatient(next);
    setRegistryType(type);
    setNotes(type === "walk-in" ? "Temporary walk-in registry record." : "");
    setMessage("");
  }

  function beginEdit(record: PatientRecord) {
    setEditing(record);
    setPatient(structuredClone(record.patient));
    setRegistryType(record.registryType);
    setNotes(record.notes);
    setMessage("");
  }

  function update<K extends keyof PatientInput>(key: K, value: PatientInput[K]) {
    setPatient((current) => ({ ...current, [key]: value }));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (
      registryType === "registered" &&
      (!patient.given ||
        !patient.family ||
        !patient.birthDate ||
        patient.gender === "unknown")
    ) {
      setMessage("Registered patients require name, birth date, and administrative gender.");
      return;
    }
    if (duplicates.length) {
      setMessage("Resolve the possible duplicate before saving this patient.");
      return;
    }
    if (patient.pwdEnabled && !patient.disabilities.length) {
      setMessage("Select at least one PWD disability type.");
      return;
    }
    const hasAddress = Boolean(
      patient.address.line ||
        patient.address.postalCode ||
        patient.address.regionCode ||
        patient.address.provinceCode ||
        patient.address.cityCode ||
        patient.address.barangayCode
    );
    if (
      hasAddress &&
      (!patient.address.regionCode ||
        !patient.address.cityCode ||
        !patient.address.barangayCode)
    ) {
      setMessage(
        "Complete the PSGC region, city/municipality, and barangay selections."
      );
      return;
    }
    const record = savePatient(
      patient,
      registryType,
      notes,
      editing?.id
    );
    setEditing(record);
    setMessage("Patient registry record saved.");
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Facility registry</p>
            <h2>Patient Registry</h2>
            <p>Search local synthetic patients before generating a referral.</p>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => beginCreate("registered")}>
              Add patient
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => beginCreate("walk-in")}
            >
              Add walk-in
            </button>
          </div>
        </div>
        <div className="form-grid">
          <FormField label="First name">
            <TextInput
              value={search.given}
              onChange={(event) =>
                setSearch({ ...search, given: event.target.value })
              }
            />
          </FormField>
          <FormField label="Last name">
            <TextInput
              value={search.family}
              onChange={(event) =>
                setSearch({ ...search, family: event.target.value })
              }
            />
          </FormField>
          <FormField label="Birth date">
            <TextInput
              type="date"
              value={search.birthDate}
              onChange={(event) =>
                setSearch({ ...search, birthDate: event.target.value })
              }
            />
          </FormField>
          <FormField label="PhilSys or PhilHealth ID">
            <TextInput
              value={search.identifier}
              onChange={(event) =>
                setSearch({ ...search, identifier: event.target.value })
              }
            />
          </FormField>
        </div>
      </section>

      <section className="card">
        <h2>Registry results</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Birth date</th>
                <th>Identifiers</th>
                <th>Registry type</th>
                <th>Linked profile</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((record) => (
                <tr key={record.id}>
                  <td>{patientDisplayName(record.patient)}</td>
                  <td>{record.patient.birthDate || "Not recorded"}</td>
                  <td>
                    {record.patient.philSysId || record.patient.philHealthId || "Temporary"}
                  </td>
                  <td>{record.registryType}</td>
                  <td>
                    {record.registryType === "walk-in" ? (
                      <select
                        aria-label={`Link ${patientDisplayName(record.patient)}`}
                        value={record.linkedPatientId ?? ""}
                        onChange={(event) =>
                          linkWalkInPatient(record.id, event.target.value)
                        }
                      >
                        <option value="">Not linked</option>
                        {scopedPatients
                          .filter(
                            (candidate) =>
                              candidate.registryType === "registered" &&
                              candidate.id !== record.id
                          )
                          .map((candidate) => (
                            <option value={candidate.id} key={candidate.id}>
                              {patientDisplayName(candidate.patient)}
                            </option>
                          ))}
                      </select>
                    ) : "Full profile"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() => beginEdit(record)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <form className="card" onSubmit={save}>
        <p className="eyebrow">{editing ? "Edit record" : "New record"}</p>
        <h2>{registryType === "walk-in" ? "Walk-in patient" : "Patient details"}</h2>
        {message ? <div className="notice">{message}</div> : null}
        {duplicates.length ? (
          <div className="notice warning">
            Possible duplicate: {duplicates.map((item) => patientDisplayName(item.patient)).join(", ")}.
          </div>
        ) : null}
        <div className="form-grid three">
          <FormField label="First name">
            <TextInput value={patient.given} onChange={(event) => update("given", event.target.value)} />
          </FormField>
          <FormField label="Middle name">
            <TextInput value={patient.middle} onChange={(event) => update("middle", event.target.value)} />
          </FormField>
          <FormField label="Last name">
            <TextInput value={patient.family} onChange={(event) => update("family", event.target.value)} />
          </FormField>
          <FormField label="Administrative gender">
            <SelectInput value={patient.gender} onChange={(event) => update("gender", event.target.value as PatientInput["gender"])}>
              <option value="" disabled>
                {genders.status === "loading" ? "Loading live genders..." : "Select gender"}
              </option>
              {genders.options.map((option) => (
                <option value={option.code} key={`${option.system}|${option.code}`}>
                  {option.display}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Birth date">
            <TextInput type="date" value={patient.birthDate} onChange={(event) => update("birthDate", event.target.value)} />
          </FormField>
          <FormField label="Contact number">
            <TextInput value={patient.phone} onChange={(event) => update("phone", event.target.value)} />
          </FormField>
          <FormField label="PhilSys ID">
            <TextInput value={patient.philSysId} onChange={(event) => update("philSysId", event.target.value)} />
          </FormField>
          <FormField label="PhilHealth ID">
            <TextInput value={patient.philHealthId} onChange={(event) => update("philHealthId", event.target.value)} />
          </FormField>
          <FormField label="Next of kin / accompanied by">
            <TextInput value={patient.contactName} onChange={(event) => update("contactName", event.target.value)} />
          </FormField>
          <CodingSelect
            label="Contact relationship"
            value={patient.contactRelationship}
            options={relationships.options}
            disabled={relationships.requiresLiveExpansion && relationships.source !== "server"}
            onChange={(value) => update("contactRelationship", value)}
            hint={`ValueSet: ${relationships.canonical}`}
          />
          <FormField label="Next of kin phone">
            <TextInput value={patient.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} />
          </FormField>
        </div>
        <PsgcAddressFields
          address={patient.address}
          terminologyBaseUrl={endpoints.terminologyBaseUrl}
          onChange={(value) => update("address", value)}
        />
        <label className="check-row">
          <input
            type="checkbox"
            checked={patient.pwdEnabled}
            onChange={(event) => update("pwdEnabled", event.target.checked)}
          />
          Record PWD disability registration
        </label>
        {patient.pwdEnabled ? (
          <div className="form-grid">
            <FormField label="PWD ID">
              <TextInput value={patient.pwdId} onChange={(event) => update("pwdId", event.target.value)} />
            </FormField>
            <FormField label="PWD ID expiration date">
              <TextInput
                type="date"
                value={patient.pwdExpirationDate}
                onChange={(event) =>
                  update("pwdExpirationDate", event.target.value)
                }
              />
            </FormField>
            <CodingMultiSelect
              label="Disability types"
              values={patient.disabilities}
              options={disabilities.options}
              disabled={disabilities.requiresLiveExpansion && disabilities.source !== "server"}
              onChange={(values) => update("disabilities", values)}
              hint={`The PHeReF PWD extension permits more than one disability type. ValueSet: ${disabilities.canonical}`}
            />
          </div>
        ) : null}
        <FormField label="Registry notes">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </FormField>
        {liveTerminologyPending ? (
          <div className="notice warning" role="alert">
            Ready mode requires successful live ValueSet expansions from the
            configured terminology server. Bundled terminology is not used.
          </div>
        ) : null}
        <button type="submit" disabled={liveTerminologyPending}>Save patient</button>
      </form>
    </div>
  );
}
