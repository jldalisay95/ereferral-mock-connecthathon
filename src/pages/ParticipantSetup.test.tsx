import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONNECTATHON_CONFIG,
  PRESET_CAPABILITIES
} from "../config/connectathon.config";
import { useAppContext } from "../context/useAppContext";
import { runRemoteReadinessChecks } from "../services/connectathonReadiness";
import type { AppSettings } from "../types";
import { ParticipantSetup } from "./ParticipantSetup";

vi.mock("../context/useAppContext", () => ({ useAppContext: vi.fn() }));
vi.mock("../services/connectathonReadiness", () => ({
  runRemoteReadinessChecks: vi.fn()
}));

const endpoints: AppSettings = {
  version: 3,
  pherefBaseUrl: "https://pheref.example/fhir",
  phCoreBaseUrl: "https://phcore.example/fhir",
  terminologyBaseUrl: "https://tx.example/fhir",
  demoMode: true
};

describe("Participant Starter setup", () => {
  const setEndpoints = vi.fn();
  const resetEndpoints = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(useAppContext).mockReturnValue({
      connectathonConfig: {
        ...CONNECTATHON_CONFIG,
        preset: "participant",
        capabilities: PRESET_CAPABILITIES.participant
      },
      currentAccount: null,
      endpoints,
      setEndpoints,
      resetEndpoints
    } as unknown as ReturnType<typeof useAppContext>);
    vi.mocked(runRemoteReadinessChecks).mockResolvedValue([
      {
        id: "url-syntax",
        label: "Endpoint and canonical URL syntax",
        status: "pass",
        configKey: "endpoints.*",
        detail: "All URLs are valid."
      }
    ]);
  });

  it("saves normalized browser-local endpoints in participant mode", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ParticipantSetup />
      </MemoryRouter>
    );

    const pheref = screen.getByLabelText("PHeRef FHIR server URL");
    expect(pheref).toBeEnabled();
    await user.clear(pheref);
    await user.type(pheref, "https://starter.example/fhir/");
    await user.click(
      screen.getByRole("button", { name: "Save browser endpoints" })
    );

    expect(setEndpoints).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 3,
        pherefBaseUrl: "https://starter.example/fhir",
        demoMode: true
      })
    );
    expect(screen.getByText(/browser endpoint overrides saved/i)).toBeInTheDocument();
  });

  it("rejects an invalid URL without changing stored settings", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ParticipantSetup />
      </MemoryRouter>
    );

    const pheref = screen.getByLabelText("PHeRef FHIR server URL");
    await user.clear(pheref);
    await user.type(pheref, "not-a-url");
    await user.click(
      screen.getByRole("button", { name: "Save browser endpoints" })
    );

    expect(setEndpoints).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "endpoints.pherefBaseUrl"
    );
  });

  it("tests the same endpoints it saves and uses only the readiness reader", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ParticipantSetup />
      </MemoryRouter>
    );

    await user.click(
      screen.getByRole("button", { name: "Test servers and terminology" })
    );

    expect(setEndpoints).toHaveBeenCalledWith(endpoints);
    expect(runRemoteReadinessChecks).toHaveBeenCalledWith(
      expect.objectContaining({ preset: "participant" }),
      endpoints
    );
    expect(await screen.findByText("All checks pass")).toBeInTheDocument();
  });
});
