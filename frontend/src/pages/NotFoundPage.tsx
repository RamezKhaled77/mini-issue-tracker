import { Link } from "react-router-dom";
import { Button } from "../components/Button.js";

export function NotFoundPage() {
  return (
    <section className="not-found">
      <p className="page-eyebrow">404</p>
      <h1 className="page-title">Page not found</h1>
      <p className="not-found-description">
        The page you are looking for does not exist or has moved.
      </p>
      <Link to="/">
        <Button variant="secondary">Back to workspaces</Button>
      </Link>
    </section>
  );
}
