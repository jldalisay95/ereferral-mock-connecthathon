import { describe, expect, it, vi } from "vitest";
import type { FhirResource } from "../types";
import { hydrateReferral, searchRemoteReferrals } from "./referralRetrieval";
import { readResource, searchResources } from "./fhirClient";

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

  it("hydrates direct Organization performers and DiagnosticReports based on ServiceRequest", async () => {
    vi.mocked(readResource).mockImplementation(
      async (_baseUrl: string, resourceType: string, id: string) =>
        ({ resourceType, id, name: resourceType === "Organization" ? "Receiving Hospital" : undefined }) as FhirResource
    );
    vi.mocked(searchResources).mockImplementation(
      async (_baseUrl: string, resourceType: string, params: URLSearchParams) => {
        if (resourceType === "DiagnosticReport" && params.get("based-on") === "ServiceRequest/sr-1") {
          return [{ resourceType: "DiagnosticReport", id: "dr-1" }];
        }
        return [];
      }
    );

    const aggregate = await hydrateReferral("https://server.test/fhir", {
      resourceType: "ServiceRequest",
      id: "sr-1",
      subject: { reference: "Patient/patient-1", display: "Lina Dela Cruz" },
      performer: [{ reference: "Organization/org-1", display: "Receiving Hospital" }]
    });

    expect(aggregate.organizations).toEqual([
      expect.objectContaining({ resourceType: "Organization", id: "org-1" })
    ]);
    expect(aggregate.diagnosticReports).toEqual([
      expect.objectContaining({ resourceType: "DiagnosticReport", id: "dr-1" })
    ]);
  });

  it("hydrates Task owner PractitionerRole organization for display", async () => {
    vi.mocked(readResource).mockImplementation(
      async (_baseUrl: string, resourceType: string, id: string) => {
        if (resourceType === "PractitionerRole" && id === "role-owner") {
          return {
            resourceType: "PractitionerRole",
            id,
            organization: { reference: "Organization/org-owner" }
          };
        }
        if (resourceType === "Organization" && id === "org-owner") {
          return {
            resourceType: "Organization",
            id,
            name: "Owner Hospital"
          };
        }
        return { resourceType, id } as FhirResource;
      }
    );
    vi.mocked(searchResources).mockImplementation(
      async (_baseUrl: string, resourceType: string, params: URLSearchParams) => {
        if (resourceType === "Task" && params.get("focus") === "ServiceRequest/sr-2") {
          return [
            {
              resourceType: "Task",
              id: "task-owner",
              focus: { reference: "ServiceRequest/sr-2" },
              owner: { reference: "PractitionerRole/role-owner" }
            }
          ];
        }
        return [];
      }
    );

    const aggregate = await hydrateReferral("https://server.test/fhir", {
      resourceType: "ServiceRequest",
      id: "sr-2"
    });

    expect(aggregate.practitionerRoles).toEqual([
      expect.objectContaining({ resourceType: "PractitionerRole", id: "role-owner" })
    ]);
    expect(aggregate.organizations).toEqual([
      expect.objectContaining({ resourceType: "Organization", id: "org-owner" })
    ]);
  });
});
