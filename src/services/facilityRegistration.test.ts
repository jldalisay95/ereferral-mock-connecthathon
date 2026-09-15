import { describe, expect, it } from "vitest";
import { FACILITIES, DEMO_ACCOUNTS } from "../data/facilities";
import { PSGC_VERSION } from "../config/fhir";
import {
  createFacilityRegistration,
  emptyFacilityRegistration,
  getFacilityRegistrationErrors
} from "./facilityRegistration";

function completeRegistration() {
  return {
    ...emptyFacilityRegistration(),
    organizationName: "Public Test Facility",
    nhfrCode: "SYN-PUBLIC-001",
    address: {
      line: "Synthetic Street",
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
    },
    username: "publictest",
    password: "synthetic-password",
    passwordConfirmation: "synthetic-password",
    practitionerRole: {
      system: "http://snomed.info/sct",
      code: "158965000",
      display: "Doctor"
    }
  };
}

describe("facility registration", () => {
  it("creates a normalized local facility and synthetic account", () => {
    const result = createFacilityRegistration(
      completeRegistration(),
      DEMO_ACCOUNTS,
      FACILITIES
    );

    expect(result.facility.organization).toMatchObject({
      name: "Public Test Facility",
      nhfrCode: "SYN-PUBLIC-001",
      source: "local"
    });
    expect(result.facility.organization.fhirReference).toBeUndefined();
    expect(result.account).toMatchObject({
      username: "publictest",
      role: "facility_user",
      organizationId: result.facility.id
    });
  });

  it("reports duplicate identity, password mismatch, and incomplete PSGC selection", () => {
    const value = completeRegistration();
    value.username = "kalibo";
    value.nhfrCode = FACILITIES[0].organization.nhfrCode;
    value.passwordConfirmation = "different";
    value.address.cityCode = "";
    value.address.barangayCode = "";

    const errors = getFacilityRegistrationErrors(value, DEMO_ACCOUNTS, FACILITIES);

    expect(errors).toEqual(
      expect.arrayContaining([
        "Username already exists.",
        "A facility with this NHFR code already exists.",
        "Password and confirmation must match.",
        "A PSGC city or municipality is required.",
        "A PSGC barangay is required."
      ])
    );
    expect(() =>
      createFacilityRegistration(value, DEMO_ACCOUNTS, FACILITIES)
    ).toThrow();
  });
});
