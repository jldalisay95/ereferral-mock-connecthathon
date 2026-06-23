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
  });

  it("submits locally, notifies the receiver, and updates Task status", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("$validate")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ resourceType: "OperationOutcome", issue: [] })
        } as Response;
      }
      if (init?.method === "POST" || init?.method === "PUT") {
        throw new Error(`Unexpected external write in Demo mode: ${url}`);
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
    await user.click(screen.getByRole("button", { name: "Submit to local demo" }));
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
          init?.method === "PUT" ||
          (init?.method === "POST" && !String(input).includes("$validate"))
      )
    ).toHaveLength(0);
  });
});
