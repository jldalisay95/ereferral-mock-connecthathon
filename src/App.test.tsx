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
  ]
};

function psgcResponse(input: RequestInfo | URL): Response | undefined {
  const url = new URL(String(input), "http://localhost");
  const canonical = url.searchParams.get("url");
  const rows = canonical ? psgcExpansions[canonical] : undefined;
  if (!rows) return undefined;
  return {
    ok: true,
    status: 200,
    json: async () => ({
      resourceType: "ValueSet",
      expansion: {
        contains: rows.map((row) => ({
          ...row,
          system: PSGC_SYSTEM,
          version: PSGC_VERSION
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
