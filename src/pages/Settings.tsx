import { useEffect, useState, type FormEvent } from "react";
import { FormField, TextInput } from "../components/FormField";
import { PsgcAddressFields } from "../components/PsgcAddressFields";
import { useAppContext } from "../context/useAppContext";
import { EMPTY_ADDRESS } from "../data/patients";
import type { AppSettings, FacilityRegistrationInput } from "../types";

function emptyRegistration(): FacilityRegistrationInput {
  return {
    organizationName: "",
    nhfrCode: "",
    hcpnName: "",
    phone: "",
    address: { ...EMPTY_ADDRESS },
    practitionerPrefix: "Dr.",
    practitionerGiven: "",
    practitionerFamily: "",
    practitionerLicense: "",
    username: "",
    password: "demo123"
  };
}

export function Settings() {
  const { facilities, settings, setEndpoints, resetEndpoints, registerFacility } = useAppContext();
  const [editable, setEditable] = useState(settings);
  const [registration, setRegistration] = useState(emptyRegistration);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setEditable(settings), [settings]);
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setEditable((current) => ({ ...current, [key]: value }));
  const updateRegistration = <K extends keyof FacilityRegistrationInput>(
    key: K,
    value: FacilityRegistrationInput[K]
  ) => setRegistration((current) => ({ ...current, [key]: value }));

  async function submitRegistration(event: FormEvent) {
    event.preventDefault();
    setRegistering(true);
    setMessage("");
    try {
      const facility = await registerFacility(registration);
      setRegistration(emptyRegistration());
      setMessage(
        settings.demoMode
          ? `${facility.name} was registered locally.`
          : `${facility.name} was registered locally and submitted to the FHIR server.`
      );
    } catch (error) {
      setMessage(
        `Facility registration failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Administration</p>
        <h2>FHIR and demo settings</h2>
        <div className="form-grid">
          <label className="field"><span>PHeRef CDR URL</span><input value={editable.pherefBaseUrl} onChange={(event) => update("pherefBaseUrl", event.target.value)} /></label>
          <label className="field"><span>PH Core CDR URL</span><input value={editable.phCoreBaseUrl} onChange={(event) => update("phCoreBaseUrl", event.target.value)} /></label>
          <label className="field"><span>Terminology URL</span><input value={editable.terminologyBaseUrl} onChange={(event) => update("terminologyBaseUrl", event.target.value)} /></label>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={editable.demoMode} onChange={(event) => update("demoMode", event.target.checked)} />
          Demo mode: keep transaction submissions and Task updates in local mock persistence
        </label>
        <div className="notice warning">
          Live mode is the default. Keep Demo mode unchecked to submit real POST and PUT requests to the configured PHeRef server.
        </div>
        <div className="button-row">
          <button type="button" onClick={() => setEndpoints(editable)}>Save settings</button>
          <button type="button" className="secondary" onClick={resetEndpoints}>Reset defaults</button>
        </div>
      </section>
      <section className="card">
        <p className="eyebrow">Facility registry</p>
        <h2>Register new facility and account</h2>
        {message ? <div className="notice">{message}</div> : null}
        <form className="page-stack" onSubmit={submitRegistration}>
          <div className="form-grid">
            <FormField label="Facility name">
              <TextInput
                required
                value={registration.organizationName}
                onChange={(event) =>
                  updateRegistration("organizationName", event.target.value)
                }
              />
            </FormField>
            <FormField label="NHFR code">
              <TextInput
                required
                value={registration.nhfrCode}
                onChange={(event) => updateRegistration("nhfrCode", event.target.value)}
              />
            </FormField>
            <FormField label="HCPN name">
              <TextInput
                value={registration.hcpnName}
                onChange={(event) => updateRegistration("hcpnName", event.target.value)}
              />
            </FormField>
            <FormField label="Phone">
              <TextInput
                value={registration.phone}
                onChange={(event) => updateRegistration("phone", event.target.value)}
              />
            </FormField>
          </div>
          <PsgcAddressFields
            address={registration.address}
            terminologyBaseUrl={editable.terminologyBaseUrl}
            onChange={(address) => updateRegistration("address", address)}
          />
          <div className="form-grid">
            <FormField label="Practitioner prefix">
              <TextInput
                value={registration.practitionerPrefix}
                onChange={(event) =>
                  updateRegistration("practitionerPrefix", event.target.value)
                }
              />
            </FormField>
            <FormField label="Practitioner given name">
              <TextInput
                value={registration.practitionerGiven}
                onChange={(event) =>
                  updateRegistration("practitionerGiven", event.target.value)
                }
              />
            </FormField>
            <FormField label="Practitioner family name">
              <TextInput
                value={registration.practitionerFamily}
                onChange={(event) =>
                  updateRegistration("practitionerFamily", event.target.value)
                }
              />
            </FormField>
            <FormField label="PRC license">
              <TextInput
                value={registration.practitionerLicense}
                onChange={(event) =>
                  updateRegistration("practitionerLicense", event.target.value)
                }
              />
            </FormField>
            <FormField label="Account username">
              <TextInput
                required
                value={registration.username}
                onChange={(event) => updateRegistration("username", event.target.value)}
              />
            </FormField>
            <FormField label="Account password">
              <TextInput
                required
                type="password"
                value={registration.password}
                onChange={(event) => updateRegistration("password", event.target.value)}
              />
            </FormField>
          </div>
          <div className="button-row">
            <button type="submit" disabled={registering}>
              {registering ? "Registering..." : "Register facility"}
            </button>
          </div>
        </form>
        <h3>Registered facilities</h3>
        <div className="result-list">
          {facilities.map((facility) => (
            <article className="result-card" key={facility.id}>
              <div>
                <strong>{facility.name}</strong>
                <span>NHFR {facility.organization.nhfrCode || "Not set"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
