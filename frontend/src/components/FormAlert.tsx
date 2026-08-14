import type { RefObject } from "react";
import { Alert } from "./Alert.js";

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
    <Alert id={id} ref={alertRef} role="alert" tabIndex={-1}>
      {alert.message}
    </Alert>
  );
}