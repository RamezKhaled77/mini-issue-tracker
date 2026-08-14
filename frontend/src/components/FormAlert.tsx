import type { RefObject } from "react";

export interface FormAlertData {
  message: string;
  field?: string;
}

interface FormAlertProps {
  alert: FormAlertData | null;
  id: string;
  alertRef: RefObject<HTMLParagraphElement>;
}

export function FormAlert({ alert, id, alertRef }: FormAlertProps) {
  if (!alert) return null;
  return (
    <p id={id} ref={alertRef} role="alert" tabIndex={-1} className="alert alert-error">
      {alert.message}
    </p>
  );
}