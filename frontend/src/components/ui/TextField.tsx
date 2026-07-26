import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({ label, hint, error, className = "", ...props }: TextFieldProps) {
  return (
    <label className="block">
      <span className="text-muted mb-1.5 block text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <input
        className={`bg-surface text-body placeholder:text-faint focus:border-accent h-12 w-full rounded-lg border px-4 text-base transition outline-none ${
          error ? "border-[#be0404]" : "border-line-strong"
        } ${className}`}
        {...props}
      />
      {error ? (
        <span className="mt-1.5 block text-sm text-[#be0404]">{error}</span>
      ) : hint ? (
        <span className="text-muted mt-1.5 block text-sm">{hint}</span>
      ) : null}
    </label>
  );
}
