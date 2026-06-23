import { PSGC_VERSION } from "../config/fhir";
import type { FacilityAccount, FacilityDefinition } from "../types";

const medicalPractitioner = {
  system: "http://snomed.info/sct",
  code: "158965000",
  display: "Doctor"
};

const aklanAddress = {
  line: "Mabini Street",
  barangay: "Poblacion",
  barangayCode: "0600407013",
  city: "Kalibo",
  cityCode: "0600407000",
  province: "Aklan",
  provinceCode: "0600400000",
  region: "Region VI (Western Visayas)",
  regionCode: "0600000000",
  postalCode: "5600",
  psgcVersion: PSGC_VERSION
};

const southCotabatoAddress = {
  line: "Provincial Road",
  barangay: "Zone III",
  barangayCode: "1206306018",
  city: "City of Koronadal",
  cityCode: "1206306000",
  province: "South Cotabato",
  provinceCode: "1206300000",
  region: "Region XII (SOCCSKSARGEN)",
  regionCode: "1200000000",
  postalCode: "9506",
  psgcVersion: PSGC_VERSION
};

export const FACILITIES: FacilityDefinition[] = [
  {
    id: "org-kalibo",
    name: "Kalibo Health Center",
    practitionerRoleId: "practitioner-role-kalibo",
    organization: {
      name: "Kalibo Health Center",
      nhfrCode: "3056",
      hcpnName: "Aklan HCPN",
      phone: "(036) 268-9336",
      address: aklanAddress,
      source: "local"
    },
    practitioner: {
      prefix: "Dr.",
      given: "Maria",
      family: "Villanueva",
      license: "SYN-PRC-5466863",
      role: medicalPractitioner
    }
  },
  {
    id: "org-drstmh",
    name: "Dr. Rafael S. Tumbokon Memorial Hospital",
    practitionerRoleId: "practitioner-role-drstmh",
    organization: {
      name: "Dr. Rafael S. Tumbokon Memorial Hospital",
      nhfrCode: "513",
      hcpnName: "Aklan HCPN",
      phone: "(036) 268-7063",
      address: { ...aklanAddress, line: "National Highway" },
      source: "local"
    },
    practitioner: {
      prefix: "Dr.",
      given: "Carlos",
      family: "Lim",
      license: "SYN-PRC-7890123",
      role: medicalPractitioner
    }
  },
  {
    id: "org-south-cotabato",
    name: "South Cotabato Demo Facility",
    practitionerRoleId: "practitioner-role-south-cotabato",
    organization: {
      name: "South Cotabato Demo Facility",
      nhfrCode: "SYN-SC-001",
      hcpnName: "South Cotabato Demo HCPN",
      phone: "(083) 000-0101",
      address: southCotabatoAddress,
      source: "local"
    },
    practitioner: {
      prefix: "Dr.",
      given: "Andrea",
      family: "Santos",
      license: "SYN-PRC-3456789",
      role: medicalPractitioner
    }
  }
];

export const DEMO_ACCOUNTS: FacilityAccount[] = [
  {
    id: "user-kalibo",
    username: "kalibo",
    password: "demo123",
    displayName: "Kalibo Facility User",
    role: "facility_user",
    organizationId: "org-kalibo",
    organizationName: "Kalibo Health Center",
    practitionerRoleId: "practitioner-role-kalibo"
  },
  {
    id: "user-drstmh",
    username: "drstmh",
    password: "demo123",
    displayName: "DRSTMH Facility User",
    role: "facility_user",
    organizationId: "org-drstmh",
    organizationName: "Dr. Rafael S. Tumbokon Memorial Hospital",
    practitionerRoleId: "practitioner-role-drstmh"
  },
  {
    id: "user-south-cotabato",
    username: "southcotabato",
    password: "demo123",
    displayName: "South Cotabato Facility User",
    role: "facility_user",
    organizationId: "org-south-cotabato",
    organizationName: "South Cotabato Demo Facility",
    practitionerRoleId: "practitioner-role-south-cotabato"
  },
  {
    id: "user-admin",
    username: "admin",
    password: "demo123",
    displayName: "Connectathon Admin",
    role: "admin",
    organizationId: "org-admin",
    organizationName: "Connectathon Administration"
  }
];

export const findFacility = (id: string) =>
  FACILITIES.find((facility) => facility.id === id);

export const findAccount = (id: string) =>
  DEMO_ACCOUNTS.find((account) => account.id === id);

export const authenticateAccount = (username: string, password: string) =>
  DEMO_ACCOUNTS.find(
    (account) =>
      account.username.toLowerCase() === username.trim().toLowerCase() &&
      account.password === password
  );
