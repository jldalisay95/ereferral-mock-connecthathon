import { describe, expect, it, vi } from "vitest";
import type { FhirResource } from "../types";
import { searchRemoteReferrals } from "./referralRetrieval";
import { searchResources } from "./fhirClient";

vi.mock("./fhirClient", () => ({
  readResource: vi.fn(),
  searchResources: vi.fn()
}));

const patient = { resourceType: "Patient", id: "patient-1" };
const organization = { resourceType: "Organization", id: "org-1" };
const role = { resourceType: "PractitionerRole", id: "role-1" };
const matchingServiceRequest = {
  resourceType: "ServiceRequest",
  id: "sr-match"
};
const otherServiceRequest = {
  resourceType: "ServiceRequest",
  id: "sr-other"
};
const matchingTask = {
  resourceType: "Task",
  id: "task-1",
  focus: { reference: "ServiceRequest/sr-match" }
};
const otherTask = {
  resourceType: "Task",
  id: "task-2",
  focus: { reference: "ServiceRequest/sr-other" }
};

function paramsContain(params: URLSearchParams, key: string, value: string) {
  return params.get(key) === value;
}

describe("remote referral retrieval", () => {
  it("intersects patient, organization, ServiceRequest status, and Task status filters", async () => {
    vi.mocked(searchResources).mockImplementation(
      async (_baseUrl: string, resourceType: string, params: URLSearchParams) => {
        if (resourceType === "Patient") return [patient];
        if (resourceType === "Organization") return [organization];
        if (resourceType === "PractitionerRole") return [role];
        if (
          resourceType === "Task" &&
          paramsContain(params, "status", "requested")
        ) {
          return [matchingTask, otherTask];
        }
        if (
          resourceType === "ServiceRequest" &&
          paramsContain(params, "subject", "Patient/patient-1")
        ) {
          return [matchingServiceRequest, otherServiceRequest];
        }
        if (
          resourceType === "ServiceRequest" &&
          paramsContain(params, "requester", "PractitionerRole/role-1")
        ) {
          return [matchingServiceRequest];
        }
        if (
          resourceType === "ServiceRequest" &&
          paramsContain(params, "performer", "PractitionerRole/role-1")
        ) {
          return [];
        }
        if (
          resourceType === "ServiceRequest" &&
          paramsContain(params, "performer", "Organization/org-1")
        ) {
          return [];
        }
        if (
          resourceType === "ServiceRequest" &&
          paramsContain(params, "status", "active")
        ) {
          return [matchingServiceRequest, otherServiceRequest];
        }
        if (
          resourceType === "ServiceRequest" &&
          paramsContain(params, "_id", "sr-match")
        ) {
          return [matchingServiceRequest];
        }
        if (
          resourceType === "ServiceRequest" &&
          paramsContain(params, "_id", "sr-other")
        ) {
          return [otherServiceRequest];
        }
        return [];
      }
    );

    const results = await searchRemoteReferrals("https://server.test/fhir", {
      patient: "Lina",
      organization: "Kalibo",
      serviceStatus: "active",
      taskStatus: "requested"
    });

    expect(results as FhirResource[]).toEqual([matchingServiceRequest]);
  });
});
