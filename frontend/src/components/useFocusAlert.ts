import { useCallback, useEffect, useRef, useState } from "react";
import type { FormAlertData } from "./FormAlert.js";

export function useFocusAlert() {
  const [alert, setAlert] = useState<FormAlertData | null>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (alert) {
      alertRef.current?.focus();
    }
  }, [alert]);

  const focusAlert = useCallback((next: FormAlertData | null) => {
    setAlert(next);
  }, []);

  return { alert, alertRef, focusAlert };
}