import { useEffect } from "react";
import { Link } from "react-router-dom";
import { FormField, SelectInput, TextInput } from "../components/FormField";
import { useAppContext } from "../context/useAppContext";
import type { ReferralDraft } from "../types";

type Section = keyof ReferralDraft;

export function NewReferral() {
  const {
    draft,
    setDraft,
    resetDraft,
    startNewReferral,
    currentAccount,
    facilities
  } = useAppContext();

  useEffect(() => {
    if (!draft) startNewReferral();
  }, [draft, startNewReferral]);

  if (!draft || !currentAccount) {
    return <section className="card"><p>Preparing a synthetic referral draft…</p></section>;
  }
  const currentDraft = draft;

  function updateSection<K extends Section>(section: K, value: ReferralDraft[K]) {
    setDraft({ ...currentDraft, [section]: value });
  }

  const updatePatient = (key: keyof ReferralDraft["patient"], value: unknown) =>
    updateSection("patient", { ...currentDraft.patient, [key]: value } as ReferralDraft["patient"]);
  const updateVitals = (key: keyof ReferralDraft["vitals"], value: string | number) =>
    updateSection("vitals", { ...currentDraft.vitals, [key]: value });

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Use Case 1</p>
            <h2>New synthetic eReferral</h2>
            <p>Changes are saved automatically in this browser.</p>
          </div>
          <button type="button" className="secondary" onClick={resetDraft}>Reload demo case</button>
        </div>
      </section>

      <PersonSection
        title="Referring practitioner"
        person={draft.referringPractitioner}
        onChange={(value) => updateSection("referringPractitioner", value)}
      />
      <PersonSection
        title="Care navigator / receiving practitioner"
        person={draft.receivingPractitioner}
        onChange={(value) => updateSection("receivingPractitioner", value)}
      />
      <section className="card">
        <p className="eyebrow">Facility context</p>
        <h2>Initiating facility</h2>
        <div className="summary-grid">
          <div><span>Facility</span><strong>{draft.initiatingFacility.name}</strong></div>
          <div><span>NHFR code</span><strong>{draft.initiatingFacility.nhfrCode}</strong></div>
          <div><span>HCPN</span><strong>{draft.initiatingFacility.hcpnName}</strong></div>
          <div><span>Contact</span><strong>{draft.initiatingFacility.phone}</strong></div>
        </div>
        <p className="field-note">Auto-populated and locked from the logged-in facility account.</p>
      </section>
      <section className="card">
        <p className="eyebrow">Destination</p>
        <h2>Receiving facility</h2>
        <FormField label="Select receiving facility">
          <SelectInput
            value={
              facilities.find(
                (facility) =>
                  facility.organization.nhfrCode === draft.receivingFacility.nhfrCode
              )?.id ?? ""
            }
            onChange={(event) => {
              const facility = facilities.find((item) => item.id === event.target.value);
              if (!facility) return;
              setDraft({
                ...draft,
                receivingFacility: structuredClone(facility.organization),
                receivingPractitioner: structuredClone(facility.practitioner)
              });
            }}
          >
            {facilities
              .filter((facility) => facility.id !== currentAccount.organizationId)
              .map((facility) => (
                <option value={facility.id} key={facility.id}>{facility.name}</option>
              ))}
          </SelectInput>
        </FormField>
        <div className="summary-grid">
          <div><span>NHFR code</span><strong>{draft.receivingFacility.nhfrCode}</strong></div>
          <div><span>HCPN</span><strong>{draft.receivingFacility.hcpnName}</strong></div>
          <div><span>Contact</span><strong>{draft.receivingFacility.phone}</strong></div>
          <div><span>Address</span><strong>{draft.receivingFacility.address.line}</strong></div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Patient</p>
        <h2>Demographics and identifiers</h2>
        <div className="form-grid three">
          <FormField label="Given name"><TextInput value={draft.patient.given} onChange={(event) => updatePatient("given", event.target.value)} /></FormField>
          <FormField label="Middle name"><TextInput value={draft.patient.middle} onChange={(event) => updatePatient("middle", event.target.value)} /></FormField>
          <FormField label="Family name"><TextInput value={draft.patient.family} onChange={(event) => updatePatient("family", event.target.value)} /></FormField>
          <FormField label="Administrative gender">
            <SelectInput value={draft.patient.gender} onChange={(event) => updatePatient("gender", event.target.value)}>
              <option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="unknown">Unknown</option>
            </SelectInput>
          </FormField>
          <FormField label="Birth date"><TextInput type="date" value={draft.patient.birthDate} onChange={(event) => updatePatient("birthDate", event.target.value)} /></FormField>
          <FormField label="Computed age" hint="Displayed only; not stored in FHIR.">
            <TextInput readOnly value={Math.max(0, new Date().getFullYear() - new Date(draft.patient.birthDate).getFullYear())} />
          </FormField>
          <FormField label="PhilSys ID"><TextInput value={draft.patient.philSysId} onChange={(event) => updatePatient("philSysId", event.target.value)} /></FormField>
          <FormField label="PhilHealth ID"><TextInput value={draft.patient.philHealthId} onChange={(event) => updatePatient("philHealthId", event.target.value)} /></FormField>
          <FormField label="Mobile number"><TextInput value={draft.patient.phone} onChange={(event) => updatePatient("phone", event.target.value)} /></FormField>
          <FormField label="Next of kin name"><TextInput value={draft.patient.contactName} onChange={(event) => updatePatient("contactName", event.target.value)} /></FormField>
          <FormField label="Relationship code"><TextInput value={draft.patient.contactRelationship} onChange={(event) => updatePatient("contactRelationship", event.target.value)} /></FormField>
          <FormField label="Next of kin phone"><TextInput value={draft.patient.contactPhone} onChange={(event) => updatePatient("contactPhone", event.target.value)} /></FormField>
        </div>
        <AddressFields
          address={draft.patient.address}
          onChange={(address) => updatePatient("address", address)}
        />
        <label className="check-row">
          <input type="checkbox" checked={draft.patient.pwdEnabled} onChange={(event) => updatePatient("pwdEnabled", event.target.checked)} />
          Include PWD disability registration
        </label>
        {draft.patient.pwdEnabled ? (
          <div className="form-grid three">
            <FormField label="PWD ID"><TextInput value={draft.patient.pwdId} onChange={(event) => updatePatient("pwdId", event.target.value)} /></FormField>
            <FormField label="Disability code"><TextInput value={draft.patient.disability.code} onChange={(event) => updatePatient("disability", { ...draft.patient.disability, code: event.target.value, manual: true })} /></FormField>
            <FormField label="Disability display" hint="Manual fallback is labeled because the published expansion currently returns 404."><TextInput value={draft.patient.disability.display} onChange={(event) => updatePatient("disability", { ...draft.patient.disability, display: event.target.value, manual: true })} /></FormField>
            <FormField label="PWD ID expiration"><TextInput type="date" value={draft.patient.pwdExpirationDate} onChange={(event) => updatePatient("pwdExpirationDate", event.target.value)} /></FormField>
          </div>
        ) : null}
      </section>

      <section className="card">
        <p className="eyebrow">Referral details</p>
        <h2>Service request</h2>
        <div className="form-grid three">
          <FormField label="Referral ID"><TextInput value={draft.referralId} onChange={(event) => updateSection("referralId", event.target.value)} /></FormField>
          <FormField label="Authored on"><TextInput type="datetime-local" value={draft.authoredOn} onChange={(event) => updateSection("authoredOn", event.target.value)} /></FormField>
          <CodingFields label="Referral category" value={draft.referralCategory} onChange={(value) => updateSection("referralCategory", value)} />
          <CodingFields label="Service type / reasonCode" value={draft.serviceType} onChange={(value) => updateSection("serviceType", value)} />
        </div>
        <FormField label="Referral narrative">
          <textarea value={draft.referralNarrative} onChange={(event) => updateSection("referralNarrative", event.target.value)} />
        </FormField>
        <div className="notice">
          IG-first mapping: referral category is encoded in <code>ServiceRequest.category</code> and
          service type in <code>ServiceRequest.reasonCode</code>. The acceptance table’s conflicting
          priority/category labels are not used in generated FHIR.
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Clinical details</p>
        <h2>Conditions, vital signs, treatment, and laboratory result</h2>
        <div className="form-grid">
          <FormField label="Chief complaint"><textarea value={draft.chiefComplaint} onChange={(event) => updateSection("chiefComplaint", event.target.value)} /></FormField>
          <FormField label="Clinical history"><textarea value={draft.clinicalHistory} onChange={(event) => updateSection("clinicalHistory", event.target.value)} /></FormField>
          <FormField label="Working impression"><TextInput value={draft.workingImpressionText} onChange={(event) => updateSection("workingImpressionText", event.target.value)} /></FormField>
          <CodingFields label="Working impression code" value={draft.workingImpression} onChange={(value) => updateSection("workingImpression", value)} />
        </div>
        <div className="form-grid three">
          <FormField label="Observed at"><TextInput type="datetime-local" value={draft.vitals.observedAt} onChange={(event) => updateVitals("observedAt", event.target.value)} /></FormField>
          {([
            ["systolic", "Systolic (mmHg)"], ["diastolic", "Diastolic (mmHg)"],
            ["heartRate", "Heart rate (/min)"], ["respiratoryRate", "Respiratory rate (/min)"],
            ["oxygenSaturation", "Oxygen saturation (%)"], ["temperature", "Temperature (Cel)"],
            ["weight", "Weight (kg)"]
          ] as const).map(([key, label]) => (
            <FormField label={label} key={key}>
              <TextInput type="number" step="0.1" value={draft.vitals[key]} onChange={(event) => updateVitals(key, Number(event.target.value))} />
            </FormField>
          ))}
        </div>
        <FormField label="Treatment given"><textarea value={draft.treatment} onChange={(event) => updateSection("treatment", event.target.value)} /></FormField>
        <div className="form-grid">
          <FormField label="Laboratory attachment title"><TextInput value={draft.labTitle} onChange={(event) => updateSection("labTitle", event.target.value)} /></FormField>
          <FormField label="Laboratory conclusion"><TextInput value={draft.labConclusion} onChange={(event) => updateSection("labConclusion", event.target.value)} /></FormField>
        </div>
      </section>

      <div className="sticky-actions">
        <span>Draft saved locally · synthetic data only</span>
        <Link className="button" to="/referrals/preview">Preview FHIR Bundle</Link>
      </div>
    </div>
  );
}

interface PersonSectionProps {
  title: string;
  person: ReferralDraft["referringPractitioner"];
  onChange: (value: ReferralDraft["referringPractitioner"]) => void;
}

function PersonSection({ title, person, onChange }: PersonSectionProps) {
  const update = (key: keyof typeof person, value: unknown) =>
    onChange({ ...person, [key]: value } as typeof person);
  return (
    <section className="card">
      <p className="eyebrow">Master data</p><h2>{title}</h2>
      <div className="form-grid three">
        <FormField label="Prefix"><TextInput value={person.prefix} onChange={(event) => update("prefix", event.target.value)} /></FormField>
        <FormField label="Given name"><TextInput value={person.given} onChange={(event) => update("given", event.target.value)} /></FormField>
        <FormField label="Family name"><TextInput value={person.family} onChange={(event) => update("family", event.target.value)} /></FormField>
        <FormField label="PRC license identifier"><TextInput value={person.license} onChange={(event) => update("license", event.target.value)} /></FormField>
        <CodingFields label="Practitioner role" value={person.role} onChange={(role) => update("role", role)} />
      </div>
    </section>
  );
}

interface AddressFieldsProps {
  address: ReferralDraft["patient"]["address"];
  onChange: (value: ReferralDraft["patient"]["address"]) => void;
}

function AddressFields({ address, onChange }: AddressFieldsProps) {
  const update = (key: keyof typeof address, value: string) => onChange({ ...address, [key]: value });
  return (
    <div className="form-grid three nested-fields">
      {([
        ["line", "Street / address line"], ["barangay", "Barangay"], ["barangayCode", "Barangay PSGC"],
        ["city", "City / municipality"], ["cityCode", "City PSGC"], ["province", "Province"],
        ["provinceCode", "Province PSGC"], ["region", "Region"], ["regionCode", "Region PSGC"],
        ["postalCode", "Postal code"]
      ] as const).map(([key, label]) => (
        <FormField label={label} key={key}><TextInput value={address[key]} onChange={(event) => update(key, event.target.value)} /></FormField>
      ))}
    </div>
  );
}

interface CodingFieldsProps {
  label: string;
  value: ReferralDraft["referralCategory"];
  onChange: (value: ReferralDraft["referralCategory"]) => void;
}

function CodingFields({ label, value, onChange }: CodingFieldsProps) {
  return (
    <>
      <FormField label={`${label} code`}><TextInput value={value.code} onChange={(event) => onChange({ ...value, code: event.target.value, manual: true })} /></FormField>
      <FormField label={`${label} display`}><TextInput value={value.display} onChange={(event) => onChange({ ...value, display: event.target.value, manual: true })} /></FormField>
      <FormField label={`${label} system`}><TextInput value={value.system} onChange={(event) => onChange({ ...value, system: event.target.value, manual: true })} /></FormField>
    </>
  );
}
