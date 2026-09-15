import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import {
  PSGC_SYSTEM,
  PSGC_VALUE_SETS,
  PSGC_VERSION
} from "./config/fhir";
import { localRepository } from "./services/localRepository";
import { clearPsgcDirectoryCache } from "./services/psgcDirectory";
import { CONNECTATHON_CONFIG } from "./config/connectathon.config";

const psgcExpansions: Record<string, Array<{ code: string; display: string }>> = {
  [PSGC_VALUE_SETS.regions]: [
    { code: "0600000000", display: "Region VI (Western Visayas)" }
  ],
  [PSGC_VALUE_SETS.provinces]: [
    { code: "0600400000", display: "Aklan" }
  ],
  [PSGC_VALUE_SETS.cities]: [{ code: "0600407000", display: "Kalibo" }],
  [PSGC_VALUE_SETS.barangays]: [
    { code: "0600407013", display: "Poblacion" }
  ],
  [PSGC_VALUE_SETS.all]: [
    { code: "0600000000", display: "Region VI (Western Visayas)" },
    { code: "0600400000", display: "Aklan" },
    { code: "0600407000", display: "Kalibo" },
    { code: "0600407013", display: "Poblacion" }
  ]
};

const terminologyExpansions: Record<
  string,
  Array<{ system: string; code: string; display: string }>
> = {
  "practitioner-role": [
    { system: "http://snomed.info/sct", code: "158965000", display: "Doctor" }
  ],
  "referral-category": [
    { system: "http://snomed.info/sct", code: "73770003", display: "Emergency" }
  ],
  "reason-for-referral-service-type": [
    { system: "http://snomed.info/sct", code: "11429006", display: "Consultation" }
  ],
  "pwd-disability": [
    { system: "https://fhir.doh.gov.ph/pheref/CodeSystem/pwd-disability-type-cs", code: "visual", display: "Visual Disability" }
  ],
  "ereferral-relationship-type": [
    { system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode", code: "NOK", display: "next of kin" }
  ],
  "ereferral-receiving-response": [
    { system: "https://fhir.doh.gov.ph/pheref/CodeSystem/ereferral-receiving-response", code: "received", display: "Received" }
  ],
  "patient-contact-relationship": [
    { system: "http://terminology.hl7.org/CodeSystem/v2-0131", code: "N", display: "Next-of-Kin" }
  ],
  "administrative-gender": [
    { system: "http://hl7.org/fhir/administrative-gender", code: "female", display: "Female" },
    { system: "http://hl7.org/fhir/administrative-gender", code: "unknown", display: "Unknown" }
  ],
  "request-priority": [
    { system: "http://hl7.org/fhir/request-priority", code: "urgent", display: "Urgent" }
  ],
  "task-status": [
    { system: "http://hl7.org/fhir/task-status", code: "requested", display: "Requested" }
  ],
  "contact-point-system": [
    { system: "http://hl7.org/fhir/contact-point-system", code: "phone", display: "Phone" }
  ],
  "contact-point-use": [
    { system: "http://hl7.org/fhir/contact-point-use", code: "mobile", display: "Mobile" }
  ]
};

function psgcResponse(input: RequestInfo | URL): Response | undefined {
  const url = new URL(String(input), "http://localhost");
  const canonical = url.searchParams.get("url");
  const rows = canonical ? psgcExpansions[canonical] : undefined;
  const configuredValueSet = canonical
    ? CONNECTATHON_CONFIG.terminology.valueSets.find(
        (item) => item.canonical === canonical
      )
    : undefined;
  if (!rows && !configuredValueSet) return undefined;
  const expandedRows = rows ?? terminologyExpansions[configuredValueSet?.key ?? ""] ?? [];
  return {
    ok: true,
    status: 200,
    json: async () => ({
      resourceType: "ValueSet",
      expansion: {
        contains: expandedRows.map((row) => ({
          ...row,
          system: "system" in row ? row.system : PSGC_SYSTEM,
          ...(rows ? { version: PSGC_VERSION } : {})
        }))
      }
    })
  } as Response;
}

async function completeFacilityForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Facility name"), "New Server Facility");
  await user.type(screen.getByLabelText("NHFR code"), "SYN-NEW-001");
  await user.selectOptions(
    screen.getByLabelText("Region"),
    await screen.findByRole("option", { name: "Region VI (Western Visayas)" })
  );
  await user.selectOptions(
    screen.getByLabelText("Province"),
    await screen.findByRole("option", { name: "Aklan" })
  );
  await user.selectOptions(
    screen.getByLabelText("City / municipality"),
    await screen.findByRole("option", { name: "Kalibo" })
  );
  await user.selectOptions(
    screen.getByLabelText("Barangay"),
    await screen.findByRole("option", { name: "Poblacion" })
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: /^Practitioner role/ }),
    await screen.findByRole("option", { name: "Doctor" })
  );
  await user.type(screen.getByLabelText("Account username"), "newserver");
  await user.type(screen.getByLabelText("Account password"), "demo123");
  await user.type(screen.getByLabelText("Confirm password"), "demo123");
}

async function login(user: ReturnType<typeof userEvent.setup>, username: string) {
  await user.clear(screen.getByLabelText("Username"));
  await user.type(screen.getByLabelText("Username"), username);
  await user.clear(screen.getByLabelText("Password"));
  await user.type(screen.getByLabelText("Password"), "demo123");
  await user.click(screen.getByRole("button", { name: "Login" }));
}

describe("application workflow", () => {
  beforeEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/login");
    localStorage.clear();
    sessionStorage.clear();
    clearPsgcDirectoryCache();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input) =>
        psgcResponse(input) ??
        ({
          ok: true,
          status: 200,
          json: async () => ({
            resourceType: "CapabilityStatement",
            fhirVersion: "4.0.1"
          })
        } as Response)
      )
    );
  });

  it("authenticates a facility account and rejects an invalid password", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Local EMR eReferral Mock" })
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Username"), "kalibo");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Login" }));
    expect(screen.getByText("Invalid username or password.")).toBeInTheDocument();
    await login(user, "kalibo");
    expect(
      screen.getByRole("heading", { name: "Local Referral EMR" })
    ).toBeInTheDocument();
    expect(screen.getByText("Synthetic data only")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Connectathon Guide" }));
    expect(
      screen.getByRole("heading", { name: "Connectathon Guide" })
    ).toBeInTheDocument();
    expect(screen.getByText("Connectathon ready")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Terminology Check" }));
    expect(
      screen.getByRole("heading", { name: "Philippine Standard Geographic Code" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PSGC Regions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PSGC Barangays" })).toBeInTheDocument();
  });

  it("keeps the public participant setup read-only when the ready preset is active", () => {
    window.history.replaceState({}, "", "/participant-setup");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Participant Starter Setup" })
    ).toBeInTheDocument();
    expect(screen.getByText(/ready preset is active/i)).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /^PHeRef FHIR server URL/ })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save browser endpoints" })
    ).toBeDisabled();
  });

  it("self-registers a facility locally and signs in without a FHIR write", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    render(<App />);

    await user.click(
      screen.getByRole("link", { name: "Create a facility account" })
    );
    await completeFacilityForm(user);
    await user.click(
      screen.getByRole("button", { name: "Create facility account" })
    );

    expect(
      await screen.findByRole("heading", { name: "New Server Facility" })
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([, init]) =>
        ["POST", "PUT", "PATCH"].includes(String(init?.method ?? "GET"))
      )
    ).toHaveLength(0);
  });

  it("submits to the FHIR server, notifies the receiver, and updates Task status", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    let serverTask: Record<string, unknown> | undefined;
    const transactionUrl = "https://cdr.pheref.fhirlab.net/fhir";
    fetchMock.mockImplementation(async (input, init) => {
      const terminology = psgcResponse(input);
      if (terminology) return terminology;
      const url = String(input);
      if (url.includes("$validate")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ resourceType: "OperationOutcome", issue: [] })
        } as Response;
      }
      if (url === transactionUrl && init?.method === "POST") {
        const bundle = JSON.parse(String(init.body)) as {
          entry?: Array<{ resource?: Record<string, unknown> }>;
        };
        const entries = bundle.entry ?? [];
        return {
          ok: true,
          status: 200,
          json: async () => ({
            resourceType: "Bundle",
            type: "transaction-response",
            entry: entries.map((entry, index) => {
              const type = String(entry.resource?.resourceType ?? "Resource");
              const id = type === "Task" ? "server-task" : `server-${type.toLowerCase()}-${index}`;
              if (type === "Task") {
                serverTask = { ...entry.resource, id };
              }
              return {
                response: {
                  status: "201 Created",
                  location: `${type}/${id}/_history/1`
                }
              };
            })
          })
        } as Response;
      }
      if (
        url === `${transactionUrl}/Task/server-task` &&
        (!init?.method || init.method === "GET")
      ) {
        return {
          ok: true,
          status: 200,
          json: async () => serverTask
        } as Response;
      }
      if (url === `${transactionUrl}/Task/server-task` && init?.method === "PUT") {
        serverTask = JSON.parse(String(init.body)) as Record<string, unknown>;
        return {
          ok: true,
          status: 200,
          json: async () => serverTask
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          resourceType: "CapabilityStatement",
          fhirVersion: "4.0.1"
        })
      } as Response;
    });

    render(<App />);
    await login(user, "kalibo");
    await user.click(screen.getByRole("link", { name: "Generate Referral" }));
    const patientResult = screen.getByText("Lina Demo Dela Cruz").closest("article");
    expect(patientResult).not.toBeNull();
    await user.click(
      within(patientResult as HTMLElement).getByRole("button", {
        name: "Generate referral"
      })
    );
    await user.click(screen.getByRole("checkbox", { name: /Referral criteria satisfied/i }));
    await user.click(screen.getByRole("button", { name: "Continue to consent" }));
    await user.click(screen.getByRole("checkbox", { name: /Patient\/representative consent/i }));
    await user.click(screen.getByRole("button", { name: "Continue to destination" }));
    await user.click(screen.getByRole("button", { name: "Continue to referral details" }));
    await screen.findByRole("option", { name: "Emergency" });
    await user.selectOptions(screen.getByLabelText("Priority"), "urgent");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^Referral category/ }),
      "http://snomed.info/sct|73770003"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^Requested service/ }),
      "http://snomed.info/sct|11429006"
    );
    await user.click(screen.getByRole("link", { name: "Preview and validate" }));
    await user.click(screen.getByRole("button", { name: "Validate Bundle" }));
    expect(
      await screen.findByRole("heading", { name: "Validation complete" })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit to FHIR server" }));
    expect(
      await screen.findByRole("heading", { name: "Lina Demo Dela Cruz" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Print" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Logout" }));

    await login(user, "drstmh");
    expect(await screen.findByText("New referral received")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Incoming Referrals/ }));
    await user.click(screen.getByRole("link", { name: "View" }));
    await user.type(
      screen.getByRole("textbox"),
      "Referral logged by receiving facility."
    );
    await user.click(screen.getByRole("button", { name: "Update referral status" }));
    expect(
      await screen.findByText("Referral updated to received.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Received").length).toBeGreaterThan(0);

    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input) === transactionUrl &&
          init?.method === "POST"
      )
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input) === `${transactionUrl}/Task/server-task` &&
          init?.method === "PUT"
      )
    ).toHaveLength(1);
  });

  it("keeps Admin registration local, then explicitly validates and publishes", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    let organizationBundle:
      | {
          entry?: Array<{
            resource?: { name?: string };
            request?: { method?: string; url?: string };
          }>;
        }
      | undefined;
    let organizationTransactionCount = 0;
    let blockOrganizationValidation = true;
    let failOrganizationTransaction = true;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockImplementation(async (input, init) => {
      const psgc = psgcResponse(input);
      if (psgc) return psgc;
      if (String(input).endsWith("/Organization/$validate")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            resourceType: "OperationOutcome",
            issue: blockOrganizationValidation
              ? [
                  {
                    severity: "error",
                    code: "invalid",
                    diagnostics: "Synthetic Organization validation failure"
                  }
                ]
              : []
          })
        } as Response;
      }
      if (
        String(input) === "https://cdr.pheref.fhirlab.net/fhir" &&
        init?.method === "POST"
      ) {
        if (failOrganizationTransaction) throw new TypeError("Failed to fetch");
        organizationBundle = JSON.parse(String(init.body));
        organizationTransactionCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            resourceType: "Bundle",
            type: "transaction-response",
            entry: [
              {
                response: {
                  status: "201 Created",
                  location: "Organization/server-new-facility/_history/1"
                }
              }
            ]
          })
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          resourceType: "CapabilityStatement",
          fhirVersion: "4.0.1"
        })
      } as Response;
    });

    render(<App />);
    await login(user, "admin");
    await user.click(screen.getByRole("link", { name: "Settings" }));
    await completeFacilityForm(user);
    await user.click(
      screen.getByRole("button", { name: "Register facility locally" })
    );

    expect(
      await screen.findByText("New Server Facility was registered locally.")
    ).toBeInTheDocument();
    expect(organizationBundle).toBeUndefined();
    expect(screen.getByText("Connectathon Administration")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Validate and publish Organization" })
    );
    expect(
      await screen.findByText(
        "Organization was not published because validation did not pass."
      )
    ).toBeInTheDocument();
    expect(organizationBundle).toBeUndefined();
    expect(
      screen.getAllByText(/Synthetic Organization validation failure/)
    ).not.toHaveLength(0);

    blockOrganizationValidation = false;
    await user.click(
      screen.getByRole("button", { name: "Validate and publish Organization" })
    );
    expect(
      await screen.findByText("Organization publish failed: Failed to fetch")
    ).toBeInTheDocument();
    expect(screen.getAllByText("New Server Facility").length).toBeGreaterThan(0);
    expect(organizationBundle).toBeUndefined();

    failOrganizationTransaction = false;
    await user.click(
      screen.getByRole("button", { name: "Validate and publish Organization" })
    );
    expect(
      await screen.findByText(
        "Organization published as Organization/server-new-facility."
      )
    ).toBeInTheDocument();
    expect(organizationBundle?.entry?.[0].resource?.name).toBe("New Server Facility");
    expect(organizationBundle?.entry?.[0].request).toEqual({
      method: "PUT",
      url: expect.stringMatching(
        /^Organization\?identifier=.*\|SYN-NEW-001$/
      )
    });
    await user.click(
      screen.getByRole("button", { name: "Validate and republish Organization" })
    );
    await screen.findByText(
      "Organization published as Organization/server-new-facility."
    );
    expect(organizationTransactionCount).toBe(2);
    expect(
      localRepository
        .load()
        .registeredFacilities.filter((facility) => facility.name === "New Server Facility")
    ).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Logout" }));
    await login(user, "newserver");
    expect(
      screen.getByRole("heading", { name: "New Server Facility" })
    ).toBeInTheDocument();
  });
});
