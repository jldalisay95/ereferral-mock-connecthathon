import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("application smoke test", () => {
  beforeEach(() => {
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

  it("renders the dashboard and synthetic-data warning", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "PHeRef Local EMR" })).toBeInTheDocument();
    expect(screen.getByText("Synthetic data only")).toBeInTheDocument();
    expect(await screen.findByText("Connection status")).toBeInTheDocument();
  });
});
