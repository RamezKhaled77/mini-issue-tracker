import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth.js";

export function Layout() {
  const { user, signout } = useAuth();
  const navigate = useNavigate();

  async function handleSignout() {
    await signout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-title">
          Mini Issue Tracker
        </Link>
        <nav className="app-nav">
          <span className="app-user">{user?.email}</span>
          <button type="button" className="btn btn-ghost" onClick={handleSignout}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}