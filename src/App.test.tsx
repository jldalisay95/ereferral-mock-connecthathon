import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("application smoke test", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ resourceType: "CapabilityStatement", fhirVersion: "4.0.1" })
      })
    );
  });

  it("logs into the referring dashboard and shows the synthetic-data warning", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { name: "PHeRef Facility Login" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Login to demo" }));
    expect(screen.getByRole("heading", { name: "PHeRef Local EMR" })).toBeInTheDocument();
    expect(screen.getByText("Synthetic data only")).toBeInTheDocument();
    expect(await screen.findByText("Connection status")).toBeInTheDocument();
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
        json: async () => ({ resourceType: "CapabilityStatement", fhirVersion: "4.0.1" })
      } as Response;
    });

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Login to demo" }));
    await user.click(
      screen.getByRole("link", { name: (name) => name === "New referral" }),
    );
    await user.click(await screen.findByRole("link", { name: "Preview FHIR Bundle" }));
    await user.click(screen.getByRole("button", { name: "Validate Bundle" }));
    expect(await screen.findByRole("heading", { name: "Validation complete" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit to local demo" }));
    expect(await screen.findByRole("heading", { name: "Lina Dela Cruz" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Logout" }));

    await user.click(screen.getByRole("radio", { name: /drstmh/i }));
    await user.click(screen.getByRole("button", { name: "Login to demo" }));
    expect(await screen.findByText("New referral received")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Inbox/ }));
    await user.click(screen.getByRole("link", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Update referral status" }));
    expect(await screen.findByText("Referral updated to received.")).toBeInTheDocument();
    expect(screen.getAllByText("Received").length).toBeGreaterThan(0);

    expect(
      fetchMock.mock.calls.filter(([input, init]) =>
        init?.method === "PUT" ||
        (init?.method === "POST" && !String(input).includes("$validate"))
      )
    ).toHaveLength(0);
  });
});
