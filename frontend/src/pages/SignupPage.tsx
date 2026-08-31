import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth.js";
import { ApiError } from "../api/client.js";
import { FormAlert } from "../components/FormAlert.js";
import { useFocusAlert } from "../components/useFocusAlert.js";
import { Field } from "../components/Field.js";
import { Input } from "../components/Input.js";
import { Button } from "../components/Button.js";
import { IconBrand } from "../components/icons.js";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { alert, alertRef, focusAlert } = useFocusAlert();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    focusAlert(null);
    if (!name.trim()) {
      focusAlert({ message: "Full name is required", field: "name" });
      return;
    }
    if (password !== confirm) {
      focusAlert({ message: "Passwords do not match", field: "confirm" });
      return;
    }
    setSubmitting(true);
    try {
      await signup(name.trim(), email, password);
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

  const nameInvalid = alert?.field === "name";
  const emailInvalid = alert?.field === "email";
  const passwordInvalid = alert?.field === "password";
  const confirmInvalid = alert?.field === "confirm";

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Link to="/login" className="auth-brand">
          <span className="app-brand-mark" aria-hidden="true">
            <IconBrand />
          </span>
          <span className="app-brand-text">
            <span className="app-brand-name">Mini</span>
            <span className="app-brand-sub">Issue Tracker</span>
          </span>
        </Link>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Create an account to start tracking issues.</p>
        <FormAlert id="auth-error" alert={alert} alertRef={alertRef} />
<Field label="Full name">
           <Input
             type="text"
             value={name}
             onChange={(e) => setName(e.target.value)}
             autoComplete="name"
             autoFocus
             required
             aria-invalid={nameInvalid || undefined}
             aria-describedby={nameInvalid ? "auth-error" : undefined}
           />
         </Field>
<Field label="Email">
           <Input
             type="email"
             value={email}
             onChange={(e) => setEmail(e.target.value)}
             autoComplete="email"
             required
             aria-invalid={emailInvalid || undefined}
             aria-describedby={emailInvalid ? "auth-error" : undefined}
           />
         </Field>
<Field label="Password">
           <Input
             type="password"
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             autoComplete="new-password"
             required
             aria-invalid={passwordInvalid || undefined}
             aria-describedby={passwordInvalid ? "auth-error" : undefined}
           />
         </Field>
<Field label="Confirm password">
           <Input
             type="password"
             value={confirm}
             onChange={(e) => setConfirm(e.target.value)}
             autoComplete="new-password"
             required
             aria-invalid={confirmInvalid || undefined}
             aria-describedby={confirmInvalid ? "auth-error" : undefined}
           />
         </Field>
        <Button type="submit" variant="primary" block disabled={submitting}>
          {submitting ? "Creating account..." : "Sign up"}
        </Button>
        <p className="auth-alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}