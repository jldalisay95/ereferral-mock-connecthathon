import { useEffect, useMemo, useState } from "react";
import { FormField, SelectInput, TextInput } from "./FormField";
import {
  barangaysForCity,
  citiesForLocation,
  loadPsgcBarangays,
  loadPsgcDirectory,
  provincesForRegion,
  type PsgcDirectory,
  type PsgcOption
} from "../services/psgcDirectory";
import type { AddressInput } from "../types";

function selectedOption(options: PsgcOption[], code: string) {
  return options.find((option) => option.code === code);
}

export function PsgcAddressFields({
  address,
  terminologyBaseUrl,
  onChange
}: {
  address: AddressInput;
  terminologyBaseUrl: string;
  onChange: (address: AddressInput) => void;
}) {
  const [directory, setDirectory] = useState<PsgcDirectory | null>(null);
  const [barangays, setBarangays] = useState<PsgcOption[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [barangayStatus, setBarangayStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    loadPsgcDirectory(terminologyBaseUrl, controller.signal)
      .then((value) => {
        setDirectory(value);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    return () => controller.abort();
  }, [terminologyBaseUrl]);

  useEffect(() => {
    if (!address.cityCode) {
      setBarangays([]);
      setBarangayStatus("idle");
      return;
    }
    const controller = new AbortController();
    setBarangayStatus("loading");
    loadPsgcBarangays(terminologyBaseUrl, controller.signal)
      .then((value) => {
        setBarangays(value);
        setBarangayStatus("ready");
      })
      .catch(() => setBarangayStatus("error"));
    return () => controller.abort();
  }, [address.cityCode, terminologyBaseUrl]);

  const provinceOptions = useMemo(
    () =>
      directory
        ? provincesForRegion(directory.provinces, address.regionCode)
        : [],
    [directory, address.regionCode]
  );
  const cityOptions = useMemo(
    () =>
      directory
        ? citiesForLocation(
            directory.cities,
            address.regionCode,
            address.provinceCode
          )
        : [],
    [directory, address.regionCode, address.provinceCode]
  );
  const barangayOptions = useMemo(
    () => barangaysForCity(barangays, address.cityCode),
    [barangays, address.cityCode]
  );
  const provinceRequired = provinceOptions.length > 0;

  function selectRegion(code: string) {
    const option = selectedOption(directory?.regions ?? [], code);
    onChange({
      ...address,
      region: option?.display ?? "",
      regionCode: option?.code ?? "",
      province: "",
      provinceCode: "",
      city: "",
      cityCode: "",
      barangay: "",
      barangayCode: "",
      psgcVersion: option?.version ?? address.psgcVersion
    });
  }

  function selectProvince(code: string) {
    const option = selectedOption(provinceOptions, code);
    onChange({
      ...address,
      province: option?.display ?? "",
      provinceCode: option?.code ?? "",
      city: "",
      cityCode: "",
      barangay: "",
      barangayCode: "",
      psgcVersion: option?.version ?? address.psgcVersion
    });
  }

  function selectCity(code: string) {
    const option = selectedOption(cityOptions, code);
    onChange({
      ...address,
      city: option?.display ?? "",
      cityCode: option?.code ?? "",
      barangay: "",
      barangayCode: "",
      psgcVersion: option?.version ?? address.psgcVersion
    });
  }

  function selectBarangay(code: string) {
    const option = selectedOption(barangayOptions, code);
    onChange({
      ...address,
      barangay: option?.display ?? "",
      barangayCode: option?.code ?? "",
      psgcVersion: option?.version ?? address.psgcVersion
    });
  }

  return (
    <fieldset className="psgc-address-fields">
      <legend>Philippine address</legend>
      <p className="field-note">
        Geographic fields use dependent selections from the PH Core PSGC value
        sets. Street or building details remain free text because PSGC does not
        code them.
      </p>
      {status === "error" ? (
        <div className="notice warning">
          PSGC terminology could not be loaded. Existing coded address values
          are retained, but geographic manual entry is disabled.
        </div>
      ) : null}
      <div className="form-grid three">
        <FormField label="Region">
          <SelectInput
            value={address.regionCode}
            disabled={status !== "ready"}
            onChange={(event) => selectRegion(event.target.value)}
          >
            <option value="">
              {status === "loading" ? "Loading regions..." : "Select region"}
            </option>
            {directory?.regions.map((option) => (
              <option value={option.code} key={option.code}>
                {option.display}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Province">
          <SelectInput
            value={address.provinceCode}
            disabled={
              status !== "ready" ||
              !address.regionCode ||
              !provinceRequired
            }
            onChange={(event) => selectProvince(event.target.value)}
          >
            <option value="">
              {address.regionCode && !provinceRequired
                ? "Not applicable for selected region"
                : "Select province"}
            </option>
            {provinceOptions.map((option) => (
              <option value={option.code} key={option.code}>
                {option.display}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="City / municipality">
          <SelectInput
            value={address.cityCode}
            disabled={
              status !== "ready" ||
              !address.regionCode ||
              (provinceRequired && !address.provinceCode)
            }
            onChange={(event) => selectCity(event.target.value)}
          >
            <option value="">Select city or municipality</option>
            {cityOptions.map((option) => (
              <option value={option.code} key={option.code}>
                {option.display}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Barangay">
          <SelectInput
            value={address.barangayCode}
            disabled={
              !address.cityCode ||
              barangayStatus === "loading" ||
              barangayStatus === "error"
            }
            onChange={(event) => selectBarangay(event.target.value)}
          >
            <option value="">
              {barangayStatus === "loading"
                ? "Loading barangays..."
                : "Select barangay"}
            </option>
            {barangayOptions.map((option) => (
              <option value={option.code} key={option.code}>
                {option.display}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField
          label="Street / building"
          hint="House number, street, building, sitio, or purok; not coded by PSGC."
        >
          <TextInput
            value={address.line}
            onChange={(event) =>
              onChange({ ...address, line: event.target.value })
            }
          />
        </FormField>
        <FormField label="Postal code">
          <TextInput
            inputMode="numeric"
            value={address.postalCode}
            onChange={(event) =>
              onChange({ ...address, postalCode: event.target.value })
            }
          />
        </FormField>
      </div>
      {address.cityCode ? (
        <small>
          PSGC version <code>{address.psgcVersion}</code>
        </small>
      ) : null}
    </fieldset>
  );
}
