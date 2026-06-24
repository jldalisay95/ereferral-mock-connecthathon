import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          resourceType: "CapabilityStatement",
          fhirVersion: "4.0.1"
        })
      })
    );
  });

  it("authenticates a facility account and rejects an invalid password", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Connectathon eReferral Demo" })
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Username"), "kalibo");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Login" }));
    expect(screen.getByText("Invalid username or password.")).toBeInTheDocument();
    await login(user, "kalibo");
    expect(
      screen.getByRole("heading", { name: "Local eReferral Mock" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Never use real patient data/)).toBeInTheDocument();
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

  it("registers a facility account and creates the Organization on the server", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    let organizationBundle: { entry?: Array<{ resource?: { name?: string } }> } | undefined;
    fetchMock.mockImplementation(async (input, init) => {
      if (
        String(input) === "https://cdr.pheref.fhirlab.net/fhir" &&
        init?.method === "POST"
      ) {
        organizationBundle = JSON.parse(String(init.body));
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
    await user.type(screen.getByLabelText("Facility name"), "New Server Facility");
    await user.type(screen.getByLabelText("NHFR code"), "SYN-NEW-001");
    await user.type(screen.getByLabelText("Account username"), "newserver");
    await user.click(screen.getByRole("button", { name: "Register facility" }));

    expect(
      await screen.findByText(
        "New Server Facility was registered locally and submitted to the FHIR server."
      )
    ).toBeInTheDocument();
    expect(organizationBundle?.entry?.[0].resource?.name).toBe("New Server Facility");
    await user.click(screen.getByRole("button", { name: "Logout" }));
    await login(user, "newserver");
    expect(
      screen.getByRole("heading", { name: "New Server Facility" })
    ).toBeInTheDocument();
  });
});
