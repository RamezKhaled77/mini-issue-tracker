import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth.js";
import { ApiError } from "../api/client.js";
import { FormAlert } from "../components/FormAlert.js";
import { useFocusAlert } from "../components/useFocusAlert.js";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { alert, alertRef, focusAlert } = useFocusAlert();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    focusAlert(null);
    if (password !== confirm) {
      focusAlert({ message: "Passwords do not match", field: "confirm" });
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const field = Object.keys(err.fields)[0];
        focusAlert({ message: err.fields[field] ?? err.message, field });
      } else {
        focusAlert({ message: "Sign-up failed" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const emailInvalid = alert?.field === "email";
  const passwordInvalid = alert?.field === "password";
  const confirmInvalid = alert?.field === "confirm";

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Create account</h1>
        <FormAlert id="auth-error" alert={alert} alertRef={alertRef} />
        <label className="field">
          <span className="field-label">Email</span>
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
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={passwordInvalid || undefined}
            aria-describedby={passwordInvalid ? "auth-error" : undefined}
          />
        </label>
        <label className="field">
          <span className="field-label">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={confirmInvalid || undefined}
            aria-describedby={confirmInvalid ? "auth-error" : undefined}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Creating account..." : "Sign up"}
        </button>
        <p className="auth-alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}