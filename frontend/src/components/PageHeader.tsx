import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  backTo?: { to: string; label: string };
  title: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  id?: string;
}

/**
 * Canonical page masthead: optional back-link, title (h1), optional eyebrow,
 * trailing action slot, bottom hairline. CSS home: layout.css (.page-header).
 */
export function PageHeader({ backTo, title, eyebrow, meta, actions, id }: PageHeaderProps) {
  return (
    <header className="page-header page-header--stacked">
      {backTo && (
        <Link to={backTo.to} className="back-link">
          &larr; {backTo.label}
        </Link>
      )}
      <div className="page-header-row">
        <div className="page-header-main">
          {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
          <h1 className="page-title" id={id}>
            {title}
          </h1>
          {meta && <div className="page-header-meta">{meta}</div>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  );
}
