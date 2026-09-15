import { CONNECTATHON_CONFIG } from "../config/connectathon.config";
import { EMPTY_ADDRESS } from "../data/patients";
import type {
  FacilityAccount,
  FacilityDefinition,
  FacilityRegistrationInput,
  FacilityRegistrationResult
} from "../types";

export function emptyFacilityRegistration(): FacilityRegistrationInput {
  return {
    organizationName: "",
    nhfrCode: "",
    hcpnName: "",
    phone: "",
    address: { ...EMPTY_ADDRESS },
    practitionerPrefix: "Dr.",
    practitionerGiven: "",
    practitionerFamily: "",
    practitionerLicense: "",
    username: "",
    password: "",
    passwordConfirmation: ""
  };
}

export function getFacilityRegistrationErrors(
  value: FacilityRegistrationInput,
  accounts: readonly FacilityAccount[],
  facilities: readonly FacilityDefinition[]
): string[] {
  const errors: string[] = [];
  const username = value.username.trim().toLowerCase();
  const nhfrCode = value.nhfrCode.trim();
  if (!value.organizationName.trim()) errors.push("Facility name is required.");
  if (!nhfrCode) errors.push("NHFR code is required.");
  if (!username) errors.push("Username is required.");
  if (!value.password) errors.push("Password is required.");
  if (value.password !== value.passwordConfirmation) {
    errors.push("Password and confirmation must match.");
  }
  if (!value.address.regionCode) errors.push("A PSGC region is required.");
  if (!value.address.cityCode) {
    errors.push("A PSGC city or municipality is required.");
  }
  if (!value.address.barangayCode) errors.push("A PSGC barangay is required.");
  if (!value.address.psgcVersion) errors.push("A PSGC version is required.");
  if (accounts.some((account) => account.username.toLowerCase() === username)) {
    errors.push("Username already exists.");
  }
  if (
    facilities.some(
      (facility) =>
        facility.organization.nhfrCode.trim().toLowerCase() ===
        nhfrCode.toLowerCase()
    )
  ) {
    errors.push("A facility with this NHFR code already exists.");
  }
  return errors;
}

export function createFacilityRegistration(
  value: FacilityRegistrationInput,
  accounts: readonly FacilityAccount[],
  facilities: readonly FacilityDefinition[]
): FacilityRegistrationResult {
  const errors = getFacilityRegistrationErrors(value, accounts, facilities);
  if (errors.length) throw new Error(errors.join(" "));

  const username = value.username.trim().toLowerCase();
  const nhfrCode = value.nhfrCode.trim();
  const id = `org-${crypto.randomUUID()}`;
  const practitionerRoleId = `practitioner-role-${crypto.randomUUID()}`;
  const organization = {
    name: value.organizationName.trim(),
    nhfrCode,
    hcpnName: value.hcpnName.trim(),
    phone: value.phone.trim(),
    address: structuredClone(value.address),
    source: "local" as const
  };
  const doctorRole =
    CONNECTATHON_CONFIG.terminology.practitionerRoles.find(
      (role) => role.code === "158965000"
    ) ?? CONNECTATHON_CONFIG.terminology.practitionerRoles[0];
  const facility: FacilityDefinition = {
    id,
    name: organization.name,
    practitionerRoleId,
    organization,
    practitioner: {
      prefix: value.practitionerPrefix.trim() || undefined,
      given: value.practitionerGiven.trim() || "Facility",
      family: value.practitionerFamily.trim() || "Practitioner",
      license: value.practitionerLicense.trim() || `SYN-PRC-${nhfrCode}`,
      role: { ...doctorRole }
    }
  };
  const account: FacilityAccount = {
    id: `user-${crypto.randomUUID()}`,
    username,
    password: value.password,
    displayName: `${facility.name} User`,
    role: "facility_user",
    organizationId: id,
    organizationName: facility.name,
    practitionerRoleId
  };
  return { facility, account };
}
