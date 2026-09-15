import { FormField, SelectInput } from "./FormField";
import type { CodingInput } from "../types";

function optionValue(option: CodingInput) {
  return `${option.system}|${option.code}`;
}

export function CodingSelect({
  label,
  value,
  options,
  onChange,
  hint,
  disabled = false,
  required = true
}: {
  label: string;
  value: CodingInput;
  options: readonly CodingInput[];
  onChange: (value: CodingInput) => void;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const selectedValue = options.some(
    (option) => optionValue(option) === optionValue(value)
  )
    ? optionValue(value)
    : "";
  return (
    <fieldset className="coding-fields">
      <legend>{label}</legend>
      <FormField label={label} hint={hint}>
        <SelectInput
          value={selectedValue}
          disabled={disabled}
          required={required}
          onChange={(event) => {
            const selected = options.find(
              (option) => optionValue(option) === event.target.value
            );
            if (selected) onChange({ ...selected });
          }}
        >
          <option value="">
            {disabled ? "Live terminology unavailable" : "Select a code"}
          </option>
          {options.map((option) => (
            <option value={optionValue(option)} key={optionValue(option)}>
              {option.display}
            </option>
          ))}
        </SelectInput>
      </FormField>
      {selectedValue ? (
        <small>
          <code>{value.system}</code> | <code>{value.code}</code>
        </small>
      ) : null}
    </fieldset>
  );
}

export function CodingMultiSelect({
  label,
  values,
  options,
  onChange,
  hint,
  disabled = false
}: {
  label: string;
  values: CodingInput[];
  options: readonly CodingInput[];
  onChange: (values: CodingInput[]) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const selected = new Set(values.map(optionValue));
  return (
    <fieldset className="coding-fields coding-fields-multi">
      <legend>{label}</legend>
      {hint ? <small>{hint}</small> : null}
      <div className="coding-choices">
        {options.map((option) => {
          const key = optionValue(option);
          return (
            <label className="choice-row" key={key}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.has(key)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...values, { ...option }]
                      : values.filter((value) => optionValue(value) !== key)
                  )
                }
              />
              <span>
                <strong>{option.display}</strong>
                <small>{option.code}</small>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
