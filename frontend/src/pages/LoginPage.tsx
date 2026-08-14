import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth.js";
import { ApiError } from "../api/client.js";
import { FormAlert } from "../components/FormAlert.js";
import { useFocusAlert } from "../components/useFocusAlert.js";
import { Field } from "../components/Field.js";
import { Button } from "../components/Button.js";

export function LoginPage() {
  const { signin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { alert, alertRef, focusAlert } = useFocusAlert();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    focusAlert(null);
    try {
      await signin(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const field = Object.keys(err.fields)[0];
        focusAlert({ message: err.fields[field] ?? err.message, field });
      } else {
        focusAlert({ message: "Sign-in failed" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const emailInvalid = alert?.field === "email";
  const passwordInvalid = alert?.field === "password";

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Link to="/login" className="auth-brand">
          Mini Issue Tracker
        </Link>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">Sign in to access your workspaces.</p>
        <FormAlert id="auth-error" alert={alert} alertRef={alertRef} />
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
            aria-invalid={emailInvalid || undefined}
            aria-describedby={emailInvalid ? "auth-error" : undefined}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={passwordInvalid || undefined}
            aria-describedby={passwordInvalid ? "auth-error" : undefined}
          />
        </Field>
        <Button type="submit" variant="primary" block disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
        <p className="auth-alt">
          No account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </div>
  );
}