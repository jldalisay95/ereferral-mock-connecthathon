import {
  IDENTIFIER_SYSTEMS,
  PROFILES,
  PSGC_SYSTEM,
  PSGC_VERSION
} from "../../config/fhir";
import type { CodingInput, FhirResource, ReferralDraft } from "../../types";

export interface ReferralReferences {
  patient: string;
  referringPractitioner: string;
  receivingPractitioner: string;
  initiatingOrganization: string;
  receivingOrganization: string;
  referringRole: string;
  receivingRole: string;
  serviceRequest: string;
  encounter: string;
  chiefComplaint: string;
  workingImpression: string;
  observations: string[];
  procedure: string;
  diagnosticReport: string;
  task: string;
  provenance: string;
}

const profile = (url: string) => ({ profile: [url] });
const reference = (value: string) => ({ reference: value });
const codeable = (coding: CodingInput, text?: string) => ({
  coding: [{ system: coding.system, code: coding.code, display: coding.display }],
  ...(text ? { text } : {})
});
const iso = (value: string) => new Date(value).toISOString();
const escapeXhtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const narrative = (summary: string) => ({
  status: "generated",
  div: `<div xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en"><p>${escapeXhtml(summary)}</p></div>`
});

function address(input: ReferralDraft["patient"]["address"]) {
  const geographicExtensions = [
    ["region", input.regionCode],
    ["province", input.provinceCode],
    ["city-municipality", input.cityCode],
    ["barangay", input.barangayCode]
  ].flatMap(([name, code]) =>
    code
      ? [
          {
            url: `https://fhir.doh.gov.ph/phcore/StructureDefinition/${name}`,
            valueCoding: {
              system: PSGC_SYSTEM,
              version: input.psgcVersion || PSGC_VERSION,
              code
            }
          }
        ]
      : []
  );
  return {
    ...(geographicExtensions.length ? { extension: geographicExtensions } : {}),
    use: "home",
    ...(input.line ? { line: [input.line] } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.province ? { state: input.province } : {}),
    ...(input.postalCode ? { postalCode: input.postalCode } : {}),
    country: "PH"
  };
}

export function buildPatient(draft: ReferralDraft): FhirResource {
  const patient = draft.patient;
  const identifiers = [
    patient.philHealthId
      ? { system: IDENTIFIER_SYSTEMS.philHealth, value: patient.philHealthId }
      : null,
    patient.philSysId
      ? { system: IDENTIFIER_SYSTEMS.philSys, value: patient.philSysId }
      : null
  ].filter(Boolean);
  const extensions = patient.pwdEnabled
    ? [
        {
          url: PROFILES.pwdDisability,
          extension: [
            ...(patient.pwdId ? [{ url: "pwdId", valueString: patient.pwdId }] : []),
            ...patient.disabilities.map((disability) => ({
              url: "disabilityType",
              valueCodeableConcept: codeable(disability)
            })),
            ...(patient.pwdExpirationDate
              ? [{ url: "idExpirationDate", valueDate: patient.pwdExpirationDate }]
              : [])
          ]
        }
      ]
    : [];
  return {
    resourceType: "Patient",
    meta: profile(PROFILES.patient),
    language: "en",
    text: narrative(
      `Patient ${[patient.given, patient.middle, patient.family].filter(Boolean).join(" ")}`
    ),
    ...(extensions.length ? { extension: extensions } : {}),
    ...(identifiers.length ? { identifier: identifiers } : {}),
    active: true,
    name: [
      {
        use: "official",
        family: patient.family,
        given: [patient.given, ...(patient.middle ? [patient.middle] : [])]
      }
    ],
    ...(patient.phone
      ? { telecom: [{ system: "phone", value: patient.phone, use: "mobile" }] }
      : {}),
    gender: patient.gender,
    birthDate: patient.birthDate,
    ...(patient.address.line ? { address: [address(patient.address)] } : {}),
    ...(patient.contactName || patient.contactPhone
      ? {
          contact: [
            {
              relationship: [
                {
                  coding: [
                    {
                      system: patient.contactRelationship.system,
                      code: patient.contactRelationship.code,
                      display: patient.contactRelationship.display
                    }
                  ]
                }
              ],
              ...(patient.contactName ? { name: { text: patient.contactName } } : {}),
              ...(patient.contactPhone
                ? {
                    telecom: [
                      { system: "phone", value: patient.contactPhone, use: "mobile" }
                    ]
                  }
                : {})
            }
          ]
        }
      : {})
  };
}

export function buildPractitioner(
  person: ReferralDraft["referringPractitioner"]
): FhirResource {
  return {
    resourceType: "Practitioner",
    meta: profile(PROFILES.practitioner),
    language: "en",
    text: narrative(
      `Practitioner ${[person.prefix, person.given, person.family].filter(Boolean).join(" ")}`
    ),
    identifier: [{ system: IDENTIFIER_SYSTEMS.prc, value: person.license }],
    name: [
      {
        use: "official",
        family: person.family,
        given: [person.given],
        ...(person.prefix ? { prefix: [person.prefix] } : {})
      }
    ]
  };
}

export function buildPractitionerRole(
  person: ReferralDraft["referringPractitioner"],
  practitionerRef: string,
  organizationRef: string
): FhirResource {
  return {
    resourceType: "PractitionerRole",
    meta: profile(PROFILES.practitionerRole),
    language: "en",
    text: narrative(
      `${person.role.display} for ${person.given} ${person.family}`
    ),
    identifier: [{ system: IDENTIFIER_SYSTEMS.prc, value: person.license }],
    practitioner: reference(practitionerRef),
    organization: reference(organizationRef),
    code: [codeable(person.role)]
  };
}

export function buildOrganization(
  input: ReferralDraft["initiatingFacility"]
): FhirResource {
  return {
    resourceType: "Organization",
    meta: profile(PROFILES.organization),
    language: "en",
    text: narrative(`Organization ${input.name}`),
    active: true,
    identifier: [
      { system: IDENTIFIER_SYSTEMS.nhfr, value: input.nhfrCode },
      { system: IDENTIFIER_SYSTEMS.hcpn, value: input.hcpnName }
    ],
    name: input.name,
    telecom: [{ system: "phone", value: input.phone, use: "work" }],
    address: [{ ...address(input.address), use: "work" }]
  };
}

export function buildEncounter(draft: ReferralDraft, refs: ReferralReferences): FhirResource {
  return {
    resourceType: "Encounter",
    meta: profile(PROFILES.encounter),
    language: "en",
    text: narrative(`Referral encounter for ${draft.patient.given} ${draft.patient.family}`),
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory"
    },
    subject: reference(refs.patient),
    basedOn: [reference(refs.serviceRequest)]
  };
}

export function buildChiefComplaintCondition(
  draft: ReferralDraft,
  refs: ReferralReferences
): FhirResource {
  return {
    resourceType: "Condition",
    meta: profile(PROFILES.condition),
    language: "en",
    text: narrative(`Chief complaint: ${draft.chiefComplaint}`),
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active"
        }
      ]
    },
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-category",
            code: "problem-list-item",
            display: "Problem List Item"
          }
        ]
      }
    ],
    code: { text: draft.chiefComplaint },
    subject: reference(refs.patient),
    encounter: reference(refs.encounter),
    note: [{ text: draft.clinicalHistory }]
  };
}

export function buildWorkingImpressionCondition(
  draft: ReferralDraft,
  refs: ReferralReferences
): FhirResource {
  return {
    resourceType: "Condition",
    meta: profile(PROFILES.condition),
    language: "en",
    text: narrative(`Clinical reason: ${draft.workingImpressionText}`),
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active"
        }
      ]
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "provisional",
          display: "Provisional"
        }
      ]
    },
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-category",
            code: "encounter-diagnosis",
            display: "Encounter Diagnosis"
          }
        ]
      }
    ],
    code: codeable(draft.clinicalReason, draft.workingImpressionText),
    subject: reference(refs.patient),
    encounter: reference(refs.encounter)
  };
}

const vitalDefinitions = {
  heartRate: {
    code: "8867-4",
    display: "Heart rate",
    unit: "beats/minute",
    unitCode: "/min"
  },
  respiratoryRate: {
    code: "9279-1",
    display: "Respiratory rate",
    unit: "breaths/minute",
    unitCode: "/min"
  },
  oxygenSaturation: {
    code: "2708-6",
    display: "Oxygen saturation in Arterial blood",
    unit: "%",
    unitCode: "%"
  },
  temperature: {
    code: "8310-5",
    display: "Body temperature",
    unit: "Celsius",
    unitCode: "Cel"
  },
  weight: {
    code: "29463-7",
    display: "Body weight",
    unit: "kg",
    unitCode: "kg"
  }
} as const;

export function buildVitalSignObservation(
  draft: ReferralDraft,
  refs: ReferralReferences,
  kind: keyof typeof vitalDefinitions
): FhirResource {
  const definition = vitalDefinitions[kind];
  return {
    resourceType: "Observation",
    meta: profile(PROFILES.observation),
    language: "en",
    text: narrative(`${definition.display}: ${draft.vitals[kind]} ${definition.unit}`),
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "vital-signs",
            display: "Vital Signs"
          }
        ]
      }
    ],
    code: {
      coding: [{ system: "http://loinc.org", code: definition.code, display: definition.display }]
    },
    subject: reference(refs.patient),
    encounter: reference(refs.encounter),
    performer: [reference(refs.referringRole)],
    effectiveDateTime: iso(draft.vitals.observedAt),
    valueQuantity: {
      value: draft.vitals[kind],
      unit: definition.unit,
      system: "http://unitsofmeasure.org",
      code: definition.unitCode
    }
  };
}

export function buildBloodPressureObservation(
  draft: ReferralDraft,
  refs: ReferralReferences
): FhirResource {
  return {
    resourceType: "Observation",
    meta: profile(PROFILES.observation),
    language: "en",
    text: narrative(
      `Blood pressure: ${draft.vitals.systolic}/${draft.vitals.diastolic} mmHg`
    ),
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "vital-signs",
            display: "Vital Signs"
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "85354-9",
          display: "Blood pressure panel with all children optional"
        }
      ]
    },
    subject: reference(refs.patient),
    encounter: reference(refs.encounter),
    performer: [reference(refs.referringRole)],
    effectiveDateTime: iso(draft.vitals.observedAt),
    component: [
      {
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8480-6",
              display: "Systolic blood pressure"
            }
          ]
        },
        valueQuantity: {
          value: draft.vitals.systolic,
          unit: "mmHg",
          system: "http://unitsofmeasure.org",
          code: "mm[Hg]"
        }
      },
      {
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "8462-4",
              display: "Diastolic blood pressure"
            }
          ]
        },
        valueQuantity: {
          value: draft.vitals.diastolic,
          unit: "mmHg",
          system: "http://unitsofmeasure.org",
          code: "mm[Hg]"
        }
      }
    ]
  };
}

export function buildProcedure(draft: ReferralDraft, refs: ReferralReferences): FhirResource {
  return {
    resourceType: "Procedure",
    meta: profile(PROFILES.procedure),
    language: "en",
    text: narrative(`Treatment given: ${draft.treatment}`),
    status: "completed",
    code: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "416608005",
          display: "Drug therapy"
        }
      ]
    },
    subject: reference(refs.patient),
    encounter: reference(refs.encounter),
    note: [{ text: draft.treatment }]
  };
}

export function buildDiagnosticReport(
  draft: ReferralDraft,
  refs: ReferralReferences
): FhirResource {
  return {
    resourceType: "DiagnosticReport",
    language: "en",
    text: narrative(`${draft.labTitle}: ${draft.labConclusion}`),
    status: "final",
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "24356-8",
          display: "Urinalysis complete panel - Urine"
        }
      ]
    },
    subject: reference(refs.patient),
    encounter: reference(refs.encounter),
    conclusion: draft.labConclusion,
    presentedForm: [
      {
        contentType: "text/plain",
        title: draft.labTitle,
        data: draft.labAttachmentBase64
      }
    ]
  };
}

export function buildServiceRequest(
  draft: ReferralDraft,
  refs: ReferralReferences
): FhirResource {
  return {
    resourceType: "ServiceRequest",
    meta: profile(PROFILES.serviceRequest),
    language: "en",
    text: narrative(
      `${draft.referralCategory.display} ${draft.requestedService.display} referral for ${draft.patient.given} ${draft.patient.family}`
    ),
    requisition: { system: IDENTIFIER_SYSTEMS.referral, value: draft.referralId },
    status: "active",
    intent: "order",
    category: [
      {
        coding: [
          {
            system: draft.referralCategory.system,
            code: draft.referralCategory.code,
            display:
              draft.referralCategory.code === "73770003"
                ? "Hospital-based outpatient emergency care center"
                : draft.referralCategory.display
          }
        ],
        text: draft.referralCategory.display
      }
    ],
    priority: draft.priority,
    code: codeable(draft.requestedService),
    subject: reference(refs.patient),
    encounter: reference(refs.encounter),
    occurrenceDateTime: iso(draft.timeCalled),
    authoredOn: iso(draft.authoredOn),
    requester: reference(refs.referringRole),
    performer: [reference(refs.receivingRole)],
    reasonCode: [codeable(draft.requestedService, draft.referralNarrative)],
    reasonReference: [reference(refs.workingImpression)],
    supportingInfo: [
      reference(refs.chiefComplaint),
      ...refs.observations.map(reference),
      reference(refs.procedure)
    ],
    note: [
      { text: draft.referralNarrative },
      ...(draft.remarks ? [{ text: draft.remarks }] : [])
    ],
    relevantHistory: [reference(refs.provenance)]
  };
}

export function buildTask(draft: ReferralDraft, refs: ReferralReferences): FhirResource {
  return {
    resourceType: "Task",
    meta: profile(PROFILES.task),
    language: "en",
    text: narrative(`Referral workflow task for ${draft.referralId}`),
    status: "requested",
    intent: "order",
    code: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "3457005",
          display: "Patient referral"
        }
      ],
      text: draft.referralNarrative
    },
    focus: reference(refs.serviceRequest),
    for: reference(refs.patient),
    authoredOn: iso(draft.authoredOn),
    lastModified: iso(draft.authoredOn),
    requester: reference(refs.referringRole),
    owner: reference(refs.receivingRole),
    note: [{ text: "Referral awaiting receiving-facility response." }]
  };
}

export function buildProvenance(
  draft: ReferralDraft,
  refs: ReferralReferences
): FhirResource {
  return {
    resourceType: "Provenance",
    meta: profile(PROFILES.provenance),
    language: "en",
    text: narrative(`Referral creation provenance for ${draft.referralId}`),
    target: [reference(refs.serviceRequest)],
    recorded: iso(draft.authoredOn),
    activity: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
          code: "CREATE",
          display: "create"
        }
      ]
    },
    agent: [
      {
        type: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
              code: "author",
              display: "Author"
            }
          ]
        },
        who: reference(refs.referringRole),
        onBehalfOf: reference(refs.initiatingOrganization)
      }
    ],
    signature: [
      {
        type: [
          {
            system: "urn:iso-astm:E1762-95:2013",
            code: "1.2.840.10065.1.12.1.5",
            display: "Verification Signature"
          }
        ],
        when: iso(draft.authoredOn),
        who: reference(refs.referringRole),
        data: draft.signatureBase64
      }
    ]
  };
}

function newUrn() {
  return `urn:uuid:${crypto.randomUUID()}`;
}

export function buildReferralTransactionBundle(draft: ReferralDraft): FhirResource {
  const hasReceivingPractitioner = Boolean(draft.receivingPractitioner);
  const receivingOrganizationReference =
    draft.receivingFacility.fhirReference ?? newUrn();
  const refs: ReferralReferences = {
    patient: newUrn(),
    referringPractitioner: newUrn(),
    receivingPractitioner: hasReceivingPractitioner ? newUrn() : receivingOrganizationReference,
    initiatingOrganization: newUrn(),
    receivingOrganization: receivingOrganizationReference,
    referringRole: newUrn(),
    receivingRole: hasReceivingPractitioner ? newUrn() : receivingOrganizationReference,
    serviceRequest: newUrn(),
    encounter: newUrn(),
    chiefComplaint: newUrn(),
    workingImpression: newUrn(),
    observations: Array.from({ length: 6 }, newUrn),
    procedure: newUrn(),
    diagnosticReport: newUrn(),
    task: newUrn(),
    provenance: newUrn()
  };
  const patientRequest = draft.patient.philSysId
    ? {
        method: "PUT",
        url: `Patient?identifier=${IDENTIFIER_SYSTEMS.philSys}|${draft.patient.philSysId}`
      }
    : draft.patient.philHealthId
      ? {
          method: "PUT",
          url: `Patient?identifier=${IDENTIFIER_SYSTEMS.philHealth}|${draft.patient.philHealthId}`
        }
      : { method: "POST", url: "Patient" };
  const masterEntries: Array<{
    fullUrl: string;
    resource: FhirResource;
    request: { method: string; url: string };
  }> = [
    {
      fullUrl: refs.patient,
      resource: buildPatient(draft),
      request: patientRequest
    },
    {
      fullUrl: refs.referringPractitioner,
      resource: buildPractitioner(draft.referringPractitioner),
      request: {
        method: "PUT",
        url: `Practitioner?identifier=${IDENTIFIER_SYSTEMS.prc}|${draft.referringPractitioner.license}`
      }
    },
    {
      fullUrl: refs.initiatingOrganization,
      resource: buildOrganization(draft.initiatingFacility),
      request: {
        method: "PUT",
        url: `Organization?identifier=${IDENTIFIER_SYSTEMS.nhfr}|${draft.initiatingFacility.nhfrCode}`
      }
    },
    {
      fullUrl: refs.referringRole,
      resource: buildPractitionerRole(
        draft.referringPractitioner,
        refs.referringPractitioner,
        refs.initiatingOrganization
      ),
      request: {
        method: "PUT",
        url: `PractitionerRole?identifier=${IDENTIFIER_SYSTEMS.prc}|${draft.referringPractitioner.license}`
      }
    },
  ];
  if (!draft.receivingFacility.fhirReference) {
    masterEntries.push({
      fullUrl: refs.receivingOrganization,
      resource: buildOrganization(draft.receivingFacility),
      request: {
        method: "PUT",
        url: `Organization?identifier=${IDENTIFIER_SYSTEMS.nhfr}|${draft.receivingFacility.nhfrCode}`
      }
    });
  }
  if (draft.receivingPractitioner) {
    masterEntries.push(
      {
        fullUrl: refs.receivingPractitioner,
        resource: buildPractitioner(draft.receivingPractitioner),
        request: {
          method: "PUT",
          url: `Practitioner?identifier=${IDENTIFIER_SYSTEMS.prc}|${draft.receivingPractitioner.license}`
        }
      },
      {
        fullUrl: refs.receivingRole,
        resource: buildPractitionerRole(
          draft.receivingPractitioner,
          refs.receivingPractitioner,
          refs.receivingOrganization
        ),
        request: {
          method: "PUT",
          url: `PractitionerRole?identifier=${IDENTIFIER_SYSTEMS.prc}|${draft.receivingPractitioner.license}`
        }
      }
    );
  }
  const observations = [
    buildBloodPressureObservation(draft, refs),
    buildVitalSignObservation(draft, refs, "heartRate"),
    buildVitalSignObservation(draft, refs, "respiratoryRate"),
    buildVitalSignObservation(draft, refs, "oxygenSaturation"),
    buildVitalSignObservation(draft, refs, "temperature"),
    buildVitalSignObservation(draft, refs, "weight")
  ];
  const clinicalResources: Array<[string, FhirResource]> = [
    [refs.serviceRequest, buildServiceRequest(draft, refs)],
    [refs.encounter, buildEncounter(draft, refs)],
    [refs.chiefComplaint, buildChiefComplaintCondition(draft, refs)],
    [refs.workingImpression, buildWorkingImpressionCondition(draft, refs)],
    ...observations.map(
      (observation, index): [string, FhirResource] => [refs.observations[index], observation]
    ),
    [refs.procedure, buildProcedure(draft, refs)],
    [refs.diagnosticReport, buildDiagnosticReport(draft, refs)],
    [refs.task, buildTask(draft, refs)],
    [refs.provenance, buildProvenance(draft, refs)]
  ];
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      ...masterEntries,
      ...clinicalResources.map(([fullUrl, resource]) => ({
        fullUrl,
        resource,
        request: { method: "POST", url: resource.resourceType }
      }))
    ]
  };
}
