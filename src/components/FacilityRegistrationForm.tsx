import { useState, type FormEvent } from "react";
import { emptyFacilityRegistration } from "../services/facilityRegistration";
import type { FacilityRegistrationInput } from "../types";
import { FormField, TextInput } from "./FormField";
import { PsgcAddressFields } from "./PsgcAddressFields";
import { CodingSelect } from "./CodingSelect";
import { useTerminologyValueSet } from "../hooks/useTerminologyValueSet";

interface FacilityRegistrationFormProps {
  terminologyBaseUrl: string;
  onSubmit: (
    value: FacilityRegistrationInput
  ) => string | void | Promise<string | void>;
  submitLabel?: string;
}

export function FacilityRegistrationForm({
  terminologyBaseUrl,
  onSubmit,
  submitLabel = "Create facility account"
}: FacilityRegistrationFormProps) {
  const [registration, setRegistration] = useState(emptyFacilityRegistration);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const practitionerRoles = useTerminologyValueSet("practitioner-role");
  const liveRoleRequired =
    practitionerRoles.requiresLiveExpansion &&
    (practitionerRoles.source !== "server" ||
      !practitionerRoles.options.some(
        (option) =>
          option.system === registration.practitionerRole.system &&
          option.code === registration.practitionerRole.code
      ));

  const update = <K extends keyof FacilityRegistrationInput>(
    key: K,
    value: FacilityRegistrationInput[K]
  ) => setRegistration((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const successMessage = await onSubmit(registration);
      setRegistration(emptyFacilityRegistration());
      setMessage(successMessage ?? "Facility account created locally.");
    } catch (error) {
      setMessage(
        `Facility registration failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="page-stack" onSubmit={submit}>
      {message ? <div className="notice" role="status">{message}</div> : null}
      <div className="form-grid">
        <FormField label="Facility name">
          <TextInput
            required
            autoComplete="organization"
            value={registration.organizationName}
            onChange={(event) => update("organizationName", event.target.value)}
          />
        </FormField>
        <FormField label="NHFR code">
          <TextInput
            required
            value={registration.nhfrCode}
            onChange={(event) => update("nhfrCode", event.target.value)}
          />
        </FormField>
        <FormField label="HCPN name">
          <TextInput
            value={registration.hcpnName}
            onChange={(event) => update("hcpnName", event.target.value)}
          />
        </FormField>
        <FormField label="Phone">
          <TextInput
            type="tel"
            autoComplete="tel"
            value={registration.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </FormField>
      </div>

      <PsgcAddressFields
        address={registration.address}
        terminologyBaseUrl={terminologyBaseUrl}
        onChange={(address) => update("address", address)}
      />

      <div className="form-grid">
        <FormField label="Practitioner prefix">
          <TextInput
            value={registration.practitionerPrefix}
            onChange={(event) => update("practitionerPrefix", event.target.value)}
          />
        </FormField>
        <FormField label="Practitioner given name">
          <TextInput
            autoComplete="given-name"
            value={registration.practitionerGiven}
            onChange={(event) => update("practitionerGiven", event.target.value)}
          />
        </FormField>
        <FormField label="Practitioner family name">
          <TextInput
            autoComplete="family-name"
            value={registration.practitionerFamily}
            onChange={(event) => update("practitionerFamily", event.target.value)}
          />
        </FormField>
        <FormField label="PRC license">
          <TextInput
            value={registration.practitionerLicense}
            onChange={(event) => update("practitionerLicense", event.target.value)}
          />
        </FormField>
        <CodingSelect
          label="Practitioner role"
          value={registration.practitionerRole}
          options={practitionerRoles.options}
          disabled={liveRoleRequired}
          onChange={(value) => update("practitionerRole", value)}
          hint={`ValueSet: ${practitionerRoles.canonical}`}
        />
        <FormField label="Account username">
          <TextInput
            required
            autoComplete="username"
            value={registration.username}
            onChange={(event) => update("username", event.target.value)}
          />
        </FormField>
        <FormField label="Account password">
          <TextInput
            required
            type="password"
            autoComplete="new-password"
            value={registration.password}
            onChange={(event) => update("password", event.target.value)}
          />
        </FormField>
        <FormField label="Confirm password">
          <TextInput
            required
            type="password"
            autoComplete="new-password"
            value={registration.passwordConfirmation}
            onChange={(event) =>
              update("passwordConfirmation", event.target.value)
            }
          />
        </FormField>
      </div>

      <div className="notice warning">
        This creates a synthetic account in this browser only. Do not use a real
        password, credential, facility secret, or patient information.
      </div>
      {liveRoleRequired ? (
        <div className="notice warning" role="alert">
          Ready mode requires a live Practitioner Role expansion from the
          terminology server. {practitionerRoles.error ?? "Loading ValueSet..."}
        </div>
      ) : null}
      <div className="button-row">
        <button type="submit" disabled={submitting || liveRoleRequired}>
          {submitting ? "Creating facility…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
