import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth.js";
import { Button } from "./Button.js";
import { Avatar } from "./Avatar.js";

export function Layout() {
  const { user, signout } = useAuth();
  const navigate = useNavigate();

  async function handleSignout() {
    await signout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <Link to="/" className="app-title">
          Mini Issue Tracker
        </Link>
        <nav className="app-nav" aria-label="Account">
          {user && (
            <>
              <Avatar name={user.name} />
              <span className="app-user">
                <span className="app-user-name">{user.name}</span>
                <span className="app-user-email">{user.email}</span>
              </span>
            </>
          )}
          <Button type="button" variant="ghost" onClick={handleSignout}>
            Sign out
          </Button>
        </nav>
      </header>
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}