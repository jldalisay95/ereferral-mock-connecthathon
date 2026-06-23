import type { InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes } from "react";

interface FormFieldProps extends PropsWithChildren {
  label: string;
  hint?: string;
}

export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />;
}
