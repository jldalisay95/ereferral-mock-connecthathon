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
  hint
}: {
  label: string;
  value: CodingInput;
  options: readonly CodingInput[];
  onChange: (value: CodingInput) => void;
  hint?: string;
}) {
  return (
    <fieldset className="coding-fields">
      <legend>{label}</legend>
      <FormField label={label} hint={hint}>
        <SelectInput
          value={optionValue(value)}
          onChange={(event) => {
            const selected = options.find(
              (option) => optionValue(option) === event.target.value
            );
            if (selected) onChange({ ...selected });
          }}
        >
          {options.map((option) => (
            <option value={optionValue(option)} key={optionValue(option)}>
              {option.display}
            </option>
          ))}
        </SelectInput>
      </FormField>
      <small>
        <code>{value.system}</code> | <code>{value.code}</code>
      </small>
    </fieldset>
  );
}

export function CodingMultiSelect({
  label,
  values,
  options,
  onChange,
  hint
}: {
  label: string;
  values: CodingInput[];
  options: readonly CodingInput[];
  onChange: (values: CodingInput[]) => void;
  hint?: string;
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
