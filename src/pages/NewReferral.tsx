import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CodingSelect } from "../components/CodingSelect";
import { FormField, SelectInput, TextInput } from "../components/FormField";
import { useAppContext } from "../context/useAppContext";
import { patientDisplayName } from "../data/patients";
import { searchOrganizationDirectory } from "../services/organizationDirectory";
import { searchPatients } from "../services/patientRegistry";
import type { OrganizationInput, ReferralDraft } from "../types";
import { useTerminologyValueSet } from "../hooks/useTerminologyValueSet";

type Section = keyof ReferralDraft;

export function NewReferral() {
  const {
    draft,
    setDraft,
    resetDraft,
    cancelDraft,
    startNewReferral,
    currentAccount,
    facilities,
    scopedPatients,
    endpoints
  } = useAppContext();
  const [step, setStep] = useState(draft ? 2 : 1);
  const [patientQuery, setPatientQuery] = useState("");
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [organizationResults, setOrganizationResults] = useState<
    OrganizationInput[]
  >([]);
  const [organizationSearchStatus, setOrganizationSearchStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const referralCategories = useTerminologyValueSet("referral-category");
  const requestedServices = useTerminologyValueSet(
    "reason-for-referral-service-type"
  );
  const requestPriorities = useTerminologyValueSet("request-priority");
  const practitionerRoles = useTerminologyValueSet("practitioner-role");
  const administrativeGenders = useTerminologyValueSet("administrative-gender");
  const contactRelationships = useTerminologyValueSet(
    "patient-contact-relationship"
  );
  const disabilityTypes = useTerminologyValueSet("pwd-disability");
  const hasLiveCoding = (
    terminology: typeof referralCategories,
    coding: { system: string; code: string } | undefined
  ) =>
    Boolean(
      coding?.system &&
        coding.code &&
        terminology.options.some(
          (option) =>
            option.system === coding.system && option.code === coding.code
        )
    );
  const liveTerminologyPending = [
    referralCategories,
    requestedServices,
    requestPriorities,
    practitionerRoles,
    administrativeGenders,
    contactRelationships,
    disabilityTypes
  ].some((item) => item.requiresLiveExpansion && item.source !== "server") ||
    (referralCategories.requiresLiveExpansion &&
      !referralCategories.options.some(
        (option) =>
          option.system === draft?.referralCategory.system &&
          option.code === draft?.referralCategory.code
      )) ||
    (requestedServices.requiresLiveExpansion &&
      !requestedServices.options.some(
        (option) =>
          option.system === draft?.requestedService.system &&
          option.code === draft?.requestedService.code
      )) ||
    (requestPriorities.requiresLiveExpansion &&
      !requestPriorities.options.some((option) => option.code === draft?.priority)) ||
    (practitionerRoles.requiresLiveExpansion &&
      (!hasLiveCoding(practitionerRoles, draft?.referringPractitioner.role) ||
        (draft?.receivingPractitioner
          ? !hasLiveCoding(practitionerRoles, draft.receivingPractitioner.role)
          : false))) ||
    (administrativeGenders.requiresLiveExpansion &&
      !administrativeGenders.options.some(
        (option) => option.code === draft?.patient.gender
      )) ||
    (contactRelationships.requiresLiveExpansion &&
      Boolean(draft?.patient.contactRelationship.code) &&
      !hasLiveCoding(contactRelationships, draft?.patient.contactRelationship)) ||
    (disabilityTypes.requiresLiveExpansion &&
      Boolean(draft?.patient.pwdEnabled) &&
      Boolean(
        draft?.patient.disabilities.some(
          (coding) => !hasLiveCoding(disabilityTypes, coding)
        )
      ));

  const patientResults = useMemo(
    () =>
      patientQuery.trim()
        ? scopedPatients.filter((record) => {
            const value = patientQuery.trim().toLowerCase();
            return [
              record.patient.given,
              record.patient.family,
              record.patient.philSysId,
              record.patient.philHealthId
            ].some((field) => field.toLowerCase().includes(value));
          })
        : searchPatients(scopedPatients, {}),
    [scopedPatients, patientQuery]
  );

  if (!currentAccount) return null;

  function selectPatient(patientId: string) {
    startNewReferral(patientId);
    setStep(2);
  }

  if (!draft) {
    return (
      <div className="page-stack">
        <WorkflowSteps current={1} />
        <section className="card">
          <p className="eyebrow">Step 1</p>
          <h2>Search patient</h2>
          <div className="search-row">
            <input
              value={patientQuery}
              onChange={(event) => setPatientQuery(event.target.value)}
              placeholder="Name, PhilSys ID, or PhilHealth ID"
              aria-label="Patient search"
            />
            <Link className="button secondary" to="/patients">Open Patient Registry</Link>
          </div>
          <div className="result-list">
            {patientResults.map((record) => (
              <article className="result-card" key={record.id}>
                <div>
                  <strong>{patientDisplayName(record.patient)}</strong>
                  <span>
                    {record.patient.birthDate || "Birth date not recorded"} - {record.registryType}
                  </span>
                  <span>
                    {record.patient.philSysId || record.patient.philHealthId || "Temporary identity"}
                  </span>
                </div>
                <button type="button" onClick={() => selectPatient(record.id)}>
                  Generate referral
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const currentDraft = draft;

  function updateSection<K extends Section>(section: K, value: ReferralDraft[K]) {
    setDraft({ ...currentDraft, [section]: value });
  }

  const updateVitals = (
    key: keyof ReferralDraft["vitals"],
    value: string | number
  ) => updateSection("vitals", { ...currentDraft.vitals, [key]: value });

  return (
    <div className="page-stack">
      <WorkflowSteps current={step} />

      {step === 2 ? (
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Assess and prepare referral</h2>
              <p>{patientDisplayName(draft.patient)}</p>
            </div>
            <button type="button" className="secondary" onClick={resetDraft}>
              Reload synthetic case
            </button>
          </div>
          <div className="form-grid">
            <FormField label="Chief complaint">
              <textarea
                value={draft.chiefComplaint}
                onChange={(event) =>
                  updateSection("chiefComplaint", event.target.value)
                }
              />
            </FormField>
            <FormField label="Clinical history">
              <textarea
                value={draft.clinicalHistory}
                onChange={(event) =>
                  updateSection("clinicalHistory", event.target.value)
                }
              />
            </FormField>
            <FormField label="Working impression">
              <TextInput
                value={draft.workingImpressionText}
                onChange={(event) =>
                  updateSection("workingImpressionText", event.target.value)
                }
              />
            </FormField>
            <p className="field-note">
              The active IG permits free text for the clinical reason and does
              not define a required project ValueSet for this field.
            </p>
          </div>
          <div className="form-grid three">
            <FormField label="Observed at">
              <TextInput
                type="datetime-local"
                value={draft.vitals.observedAt}
                onChange={(event) => updateVitals("observedAt", event.target.value)}
              />
            </FormField>
            {([
              ["systolic", "Systolic (mmHg)"],
              ["diastolic", "Diastolic (mmHg)"],
              ["heartRate", "Heart rate (/min)"],
              ["respiratoryRate", "Respiratory rate (/min)"],
              ["oxygenSaturation", "Oxygen saturation (%)"],
              ["temperature", "Temperature (Cel)"],
              ["weight", "Weight (kg)"]
            ] as const).map(([key, label]) => (
              <FormField label={label} key={key}>
                <TextInput
                  type="number"
                  step="0.1"
                  value={draft.vitals[key]}
                  onChange={(event) => updateVitals(key, Number(event.target.value))}
                />
              </FormField>
            ))}
          </div>
          <FormField label="Treatment given">
            <textarea
              value={draft.treatment}
              onChange={(event) => updateSection("treatment", event.target.value)}
            />
          </FormField>
          <div className="form-grid">
            <FormField label="Laboratory attachment title">
              <TextInput
                value={draft.labTitle}
                onChange={(event) => updateSection("labTitle", event.target.value)}
              />
            </FormField>
            <FormField label="Laboratory conclusion">
              <TextInput
                value={draft.labConclusion}
                onChange={(event) =>
                  updateSection("labConclusion", event.target.value)
                }
              />
            </FormField>
          </div>
          <label className="decision-row">
            <input
              type="checkbox"
              checked={draft.referralCriteriaSatisfied}
              onChange={(event) =>
                updateSection("referralCriteriaSatisfied", event.target.checked)
              }
            />
            <span>
              <strong>Referral criteria satisfied?</strong>
              <small>This is a local clinical decision and is not sent as a new FHIR profile.</small>
            </span>
          </label>
          <div className="button-row">
            {!draft.referralCriteriaSatisfied ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  cancelDraft();
                  setStep(1);
                }}
              >
                Cancel without eReferral
              </button>
            ) : (
              <button type="button" onClick={() => setStep(3)}>
                Continue to consent
              </button>
            )}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card">
          <p className="eyebrow">Step 3</p>
          <h2>Discuss referral and record consent</h2>
          <div className="notice">
            Consent is retained as local workflow metadata because PHeReF v0.1
            does not define a formal referral Consent profile.
          </div>
          <label className="decision-row">
            <input
              type="checkbox"
              checked={draft.consentGiven}
              onChange={(event) =>
                updateSection("consentGiven", event.target.checked)
              }
            />
            <span>
              <strong>{draft.consentStatement}</strong>
              <small>Required before this demo can submit the referral.</small>
            </span>
          </label>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              disabled={!draft.consentGiven}
              onClick={() => setStep(4)}
            >
              Continue to destination
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="card">
          <p className="eyebrow">Step 4</p>
          <h2>Select receiving facility</h2>
          <div className="summary-grid">
            <div>
              <span>Initiating facility</span>
              <strong>{draft.initiatingFacility.name}</strong>
            </div>
            <div>
              <span>NHFR code</span>
              <strong>{draft.initiatingFacility.nhfrCode}</strong>
            </div>
          </div>
          <FormField label="Receiving facility">
            <SelectInput
              value={
                facilities.find(
                  (facility) =>
                    facility.organization.nhfrCode ===
                    draft.receivingFacility.nhfrCode
                )?.id ?? ""
              }
              onChange={(event) => {
                const facility = facilities.find(
                  (item) => item.id === event.target.value
                );
                if (!facility) return;
                setDraft({
                  ...draft,
                  receivingFacility: structuredClone(facility.organization),
                  receivingPractitioner: structuredClone(facility.practitioner)
                });
              }}
            >
              {draft.receivingFacility.fhirReference ? (
                <option value="">
                  External: {draft.receivingFacility.name}
                </option>
              ) : null}
              {facilities
                .filter(
                  (facility) => facility.id !== currentAccount.organizationId
                )
                .map((facility) => (
                  <option value={facility.id} key={facility.id}>
                    {facility.name}
                  </option>
                ))}
            </SelectInput>
          </FormField>
          <div className="directory-search">
            <div>
              <h3>FHIR Organization directory</h3>
              <p>
                Search Organizations available on the configured PHeReF and PH
                Core FHIR servers.
              </p>
            </div>
            <div className="search-row">
              <TextInput
                value={organizationQuery}
                onChange={(event) => setOrganizationQuery(event.target.value)}
                placeholder="Organization name or identifier"
                aria-label="FHIR Organization search"
              />
              <button
                type="button"
                className="secondary"
                disabled={
                  organizationQuery.trim().length < 2 ||
                  organizationSearchStatus === "loading"
                }
                onClick={async () => {
                  setOrganizationSearchStatus("loading");
                  try {
                    setOrganizationResults(
                      await searchOrganizationDirectory(
                        endpoints,
                        organizationQuery
                      )
                    );
                    setOrganizationSearchStatus("idle");
                  } catch {
                    setOrganizationSearchStatus("error");
                  }
                }}
              >
                {organizationSearchStatus === "loading"
                  ? "Searching..."
                  : "Search FHIR servers"}
              </button>
            </div>
            {organizationSearchStatus === "error" ? (
              <div className="notice warning">
                Organization search could not reach the configured FHIR servers.
              </div>
            ) : null}
            {organizationResults.length ? (
              <div className="result-list">
                {organizationResults.map((organization) => (
                  <article
                    className="result-card"
                    key={organization.fhirReference}
                  >
                    <div>
                      <strong>{organization.name}</strong>
                      <span>
                        {organization.fhirServerLabel}
                        {organization.nhfrCode
                          ? ` - NHFR ${organization.nhfrCode}`
                          : " - no NHFR identifier returned"}
                      </span>
                      <span>{organization.fhirReference}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          receivingFacility: structuredClone(organization),
                          receivingPractitioner: undefined
                        })
                      }
                    >
                      Select Organization
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
          <div className="summary-grid">
            <div><span>Selected destination</span><strong>{draft.receivingFacility.name}</strong></div>
            <div><span>Source</span><strong>{draft.receivingFacility.fhirServerLabel ?? "Local demo directory"}</strong></div>
            <div><span>NHFR code</span><strong>{draft.receivingFacility.nhfrCode || "Not returned"}</strong></div>
            <div><span>HCPN</span><strong>{draft.receivingFacility.hcpnName || "Not returned"}</strong></div>
            <div><span>Contact</span><strong>{draft.receivingFacility.phone || "Not returned"}</strong></div>
          </div>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => setStep(3)}>
              Back
            </button>
            <button type="button" onClick={() => setStep(5)}>
              Continue to referral details
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <>
          <section className="card">
            <p className="eyebrow">Step 5</p>
            <h2>Referral request</h2>
            <div className="form-grid three">
              <FormField label="Referral ID">
                <TextInput
                  value={draft.referralId}
                  onChange={(event) =>
                    updateSection("referralId", event.target.value)
                  }
                />
              </FormField>
              <FormField label="Date and time of referral">
                <TextInput
                  type="datetime-local"
                  value={draft.authoredOn}
                  onChange={(event) =>
                    updateSection("authoredOn", event.target.value)
                  }
                />
              </FormField>
              <FormField
                label="Time called"
                hint="Draft mapping uses ServiceRequest.occurrenceDateTime."
              >
                <TextInput
                  type="datetime-local"
                  value={draft.timeCalled}
                  onChange={(event) =>
                    updateSection("timeCalled", event.target.value)
                  }
                />
              </FormField>
              <FormField label="Priority">
                <SelectInput
                  value={draft.priority}
                  onChange={(event) =>
                    updateSection(
                      "priority",
                      event.target.value as ReferralDraft["priority"]
                    )
                  }
                >
                  <option value="" disabled>
                    {requestPriorities.status === "loading"
                      ? "Loading live priorities..."
                      : "Select priority"}
                  </option>
                  {requestPriorities.options.map((option) => (
                    <option value={option.code} key={option.code}>
                      {option.display}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </div>
            <div className="coding-grid">
              <CodingSelect
                label="Referral category"
                value={draft.referralCategory}
                options={referralCategories.options}
                disabled={
                  referralCategories.requiresLiveExpansion &&
                  referralCategories.source !== "server"
                }
                onChange={(value) => updateSection("referralCategory", value)}
                hint={`ValueSet: ${referralCategories.canonical}`}
              />
              <CodingSelect
                label="Requested service"
                value={draft.requestedService}
                options={requestedServices.options}
                disabled={
                  requestedServices.requiresLiveExpansion &&
                  requestedServices.source !== "server"
                }
                onChange={(value) => updateSection("requestedService", value)}
                hint={`ValueSet: ${requestedServices.canonical}`}
              />
            </div>
            {liveTerminologyPending ? (
              <div className="notice warning" role="alert">
                Ready mode requires successful live ValueSet expansions from
                the configured terminology server. Bundled terminology is not
                used. Check the Connectathon Guide if a field remains disabled.
              </div>
            ) : null}
            <div className="form-grid">
              <FormField label="Referral narrative">
                <textarea
                  value={draft.referralNarrative}
                  onChange={(event) =>
                    updateSection("referralNarrative", event.target.value)
                  }
                />
              </FormField>
              <FormField label="Remarks / instructions">
                <textarea
                  value={draft.remarks}
                  onChange={(event) =>
                    updateSection("remarks", event.target.value)
                  }
                />
              </FormField>
            </div>
          </section>
          <section className="card">
            <p className="eyebrow">Audit context</p>
            <h2>Practitioners and signature</h2>
            <div className="summary-grid">
              <div>
                <span>Referring practitioner</span>
                <strong>
                  {draft.referringPractitioner.prefix}{" "}
                  {draft.referringPractitioner.given}{" "}
                  {draft.referringPractitioner.family}
                </strong>
              </div>
              <div>
                <span>Receiving assignee</span>
                <strong>
                  {draft.receivingPractitioner
                    ? [
                        draft.receivingPractitioner.prefix,
                        draft.receivingPractitioner.given,
                        draft.receivingPractitioner.family
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : draft.receivingFacility.name}
                </strong>
              </div>
              <div>
                <span>Signature</span>
                <strong>Synthetic Provenance placeholder</strong>
              </div>
            </div>
          </section>
          <div className="sticky-actions">
            <button type="button" className="secondary" onClick={() => setStep(4)}>
              Back
            </button>
            <span>Draft saved locally - synthetic data only</span>
            <Link
              className={`button${liveTerminologyPending ? " disabled" : ""}`}
              aria-disabled={liveTerminologyPending}
              onClick={(event) => {
                if (liveTerminologyPending) event.preventDefault();
              }}
              to="/referrals/preview"
            >
              Preview and validate
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function WorkflowSteps({ current }: { current: number }) {
  const labels = ["Patient", "Assessment", "Consent", "Destination", "Referral"];
  return (
    <ol className="workflow-steps" aria-label="Referral workflow">
      {labels.map((label, index) => (
        <li className={current === index + 1 ? "current" : current > index + 1 ? "done" : ""} key={label}>
          <span>{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
