import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, className = "", ...props }: TextareaProps) {
  return (
    <textarea className={["textarea", className].filter(Boolean).join(" ")} aria-invalid={invalid || undefined} {...props} />
  );
}
