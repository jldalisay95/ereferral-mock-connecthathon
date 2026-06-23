import type { FacilityAccount, FacilityDefinition } from "../types";

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
  postalCode: "5600"
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
      phone: "(043) 756-2233",
      address: aklanAddress
    },
    practitioner: {
      prefix: "Dr.",
      given: "Maria",
      family: "Villanueva",
      license: "SYN-PRC-5466863",
      role: {
        system: "http://snomed.info/sct",
        code: "158965000",
        display: "Medical practitioner"
      }
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
      phone: "(043) 756-3124",
      address: { ...aklanAddress, line: "National Highway" }
    },
    practitioner: {
      prefix: "Dr.",
      given: "Carlos",
      family: "Lim",
      license: "SYN-PRC-7890123",
      role: {
        system: "http://snomed.info/sct",
        code: "158965000",
        display: "Medical practitioner"
      }
    }
  }
];

export const DEMO_ACCOUNTS: FacilityAccount[] = [
  {
    id: "user-kalibo",
    username: "kalibo",
    displayName: "Kalibo Referring Facility User",
    role: "referring_facility_user",
    organizationId: "org-kalibo",
    organizationName: "Kalibo Health Center",
    practitionerRoleId: "practitioner-role-kalibo"
  },
  {
    id: "user-drstmh",
    username: "drstmh",
    displayName: "DRSTMH Receiving Facility User",
    role: "receiving_facility_user",
    organizationId: "org-drstmh",
    organizationName: "Dr. Rafael S. Tumbokon Memorial Hospital",
    practitionerRoleId: "practitioner-role-drstmh"
  },
  {
    id: "user-admin",
    username: "admin",
    displayName: "Connectathon Admin Demo User",
    role: "admin",
    organizationId: "org-admin",
    organizationName: "Connectathon Administration"
  }
];

export const findFacility = (id: string) => FACILITIES.find((facility) => facility.id === id);
export const findAccount = (id: string) => DEMO_ACCOUNTS.find((account) => account.id === id);
