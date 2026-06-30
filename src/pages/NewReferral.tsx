import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CodingSelect } from "../components/CodingSelect";
import { FormField, SelectInput, TextInput } from "../components/FormField";
import {
  CLINICAL_REASON_OPTIONS,
  REFERRAL_CATEGORY_OPTIONS,
  REFERRAL_PRIORITY_OPTIONS,
  REQUESTED_SERVICE_OPTIONS
} from "../config/fhir";
import { useAppContext } from "../context/useAppContext";
import { patientDisplayName } from "../data/patients";
import { searchOrganizationDirectory } from "../services/organizationDirectory";
import { searchPatients } from "../services/patientRegistry";
import type { OrganizationInput, ReferralDraft } from "../types";

type Section = keyof ReferralDraft;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/tiff",
  "image/bmp",
  "text/plain",
  "application/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
const ACCEPTED_ATTACHMENT_EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  txt: "text/plain",
  rtf: "application/rtf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};
const ATTACHMENT_ACCEPT = [
  ...ACCEPTED_ATTACHMENT_TYPES,
  ...Object.keys(ACCEPTED_ATTACHMENT_EXTENSIONS).map((extension) => `.${extension}`)
].join(",");
const ATTACHMENT_TYPE_HELP =
  "Accepted file types: PDF, JPG/JPEG, PNG, GIF, TIFF, BMP, TXT, RTF, DOC, and DOCX.";

function supportedAttachmentType(file: File) {
  if (ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ACCEPTED_ATTACHMENT_EXTENSIONS[extension] ?? "";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function currentLocalDateTime() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

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
  const [attachmentFeedback, setAttachmentFeedback] = useState<{
    status: "idle" | "reading" | "ready" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const maxDateTime = currentLocalDateTime();

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

  function refreshCurrentTimes() {
    const now = currentLocalDateTime();
    setDraft({ ...currentDraft, authoredOn: now, timeCalled: now });
  }

  async function updateLabAttachment(file?: File, input?: HTMLInputElement) {
    if (!file) {
      setDraft({
        ...currentDraft,
        labAttachmentBase64: "",
        labAttachmentContentType: undefined,
        labAttachmentName: undefined
      });
      setAttachmentFeedback({ status: "idle", message: "" });
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      if (input) input.value = "";
      setAttachmentFeedback({
        status: "error",
        message: `${file.name} is ${formatFileSize(file.size)}. Maximum file size is 5 MB.`
      });
      setDraft({
        ...currentDraft,
        labAttachmentBase64: "",
        labAttachmentContentType: undefined,
        labAttachmentName: undefined
      });
      return;
    }
    const contentType = supportedAttachmentType(file);
    if (!contentType) {
      if (input) input.value = "";
      setAttachmentFeedback({
        status: "error",
        message: `Unsupported attachment type for ${file.name}. ${ATTACHMENT_TYPE_HELP}`
      });
      setDraft({
        ...currentDraft,
        labAttachmentBase64: "",
        labAttachmentContentType: undefined,
        labAttachmentName: undefined
      });
      return;
    }
    setAttachmentFeedback({
      status: "reading",
      message: `Reading ${file.name} (${formatFileSize(file.size)})...`
    });
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const [, base64 = ""] = dataUrl.split(",");
      if (!base64) throw new Error("The file could not be converted to base64.");
      setDraft({
        ...currentDraft,
        labAttachmentBase64: base64,
        labAttachmentContentType: contentType,
        labAttachmentName: file.name
      });
      setAttachmentFeedback({
        status: "ready",
        message: `${file.name} (${formatFileSize(file.size)}, ${contentType}) is ready and will be included in the referral Bundle.`
      });
    } catch (error) {
      if (input) input.value = "";
      setDraft({
        ...currentDraft,
        labAttachmentBase64: "",
        labAttachmentContentType: undefined,
        labAttachmentName: undefined
      });
      setAttachmentFeedback({
        status: "error",
        message:
          error instanceof Error
            ? `Attachment could not be read: ${error.message}`
            : "Attachment could not be read."
      });
    }
  }

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
            <CodingSelect
              label="Coded working impression"
              value={draft.clinicalReason}
              options={CLINICAL_REASON_OPTIONS}
              onChange={(value) => updateSection("clinicalReason", value)}
              hint="Uses the PHeReF clinical reason value set for the referenced Condition."
            />
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
          <FormField label="Diagnostic report attachment">
            <input
              type="file"
              accept={ATTACHMENT_ACCEPT}
              onChange={(event) =>
                void updateLabAttachment(event.target.files?.[0], event.currentTarget)
              }
            />
            <small>
              Maximum file size is 5 MB. {ATTACHMENT_TYPE_HELP}
            </small>
            {attachmentFeedback.message ? (
              <div
                className={`notice ${
                  attachmentFeedback.status === "error"
                    ? "danger"
                    : attachmentFeedback.status === "ready"
                      ? "success"
                      : ""
                }`}
              >
                {attachmentFeedback.message}
              </div>
            ) : draft.labAttachmentBase64 ? (
              <div className="notice success">
                {draft.labAttachmentName || "Attachment"} is ready and will be
                included in the referral Bundle.
              </div>
            ) : null}
          </FormField>
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
                  max={maxDateTime}
                  value={maxDateTime}
                  readOnly
                />
              </FormField>
              <FormField
                label="Time called"
                hint="Automatically set to the current date and time."
              >
                <TextInput
                  type="datetime-local"
                  max={maxDateTime}
                  value={maxDateTime}
                  readOnly
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
                  {REFERRAL_PRIORITY_OPTIONS.map((option) => (
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
                options={REFERRAL_CATEGORY_OPTIONS}
                onChange={(value) => updateSection("referralCategory", value)}
              />
              <CodingSelect
                label="Requested service"
                value={draft.requestedService}
                options={REQUESTED_SERVICE_OPTIONS}
                onChange={(value) => updateSection("requestedService", value)}
              />
              <CodingSelect
                label="Clinical reason"
                value={draft.clinicalReason}
                options={CLINICAL_REASON_OPTIONS}
                onChange={(value) => updateSection("clinicalReason", value)}
              />
            </div>
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
              className="button"
              to="/referrals/preview"
              onClick={refreshCurrentTimes}
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
