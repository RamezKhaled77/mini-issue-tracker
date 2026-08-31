import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { Field } from "./Field.js";
import { Input } from "./Input.js";
import { Select } from "./Select.js";

/** One option for a filter `<select>`. */
export interface FilterOption {
  value: string;
  label: string;
}

/** A `<select>`-style filter owned by the page's filter state. */
export interface FilterSelect {
  /** Stable key + accessible-name discriminator. */
  id: string;
  /** Accessible name for the control (rendered as an sr-only Field label). */
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

export interface FilterBarProps {
  /** Extra class names appended to the `.filter-bar` surface. */
  className?: string;
  /** Leading text-search control. */
  query?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    label: string;
  };
  /** Status / priority / label selects. Order is preserved. */
  selects?: FilterSelect[];
  /** My-issues-only trailing sort control. */
  sort?: {
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  };
  /** Trailing control node (e.g. a staleness note). */
  actions?: ReactNode;
  /** Result count node supplied by the page (e.g. "12 results"). */
  resultCount?: ReactNode;
  /**
   * Whether a filter is actively applied. With `onClear`, this renders the
   * "Filtering… Clear filters" indicator owned by this primitive.
   */
  isFiltering?: boolean;
  /** Resets all filters. Renders the "Clear filters" affordance when provided. */
  onClear?: () => void;
  /** @default "Clear filters" */
  clearLabel?: string;
}

const MOBILE_FILTER_QUERY = "(max-width: 700px)";

/** Read-once `matchMedia`. `false` when unavailable (jsdom), i.e. desktop-class. */
function readMatches(query: string): boolean {
  try {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

/**
 * Tracks a media query. Private to FilterBar — one consumer, so it is not
 * extracted as a shared hook (abstraction ceiling).
 */
function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => readMatches(query));
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    let mq: ReturnType<typeof window.matchMedia>;
    try {
      mq = window.matchMedia(query);
    } catch {
      return;
    }
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

/**
 * Canonical filter toolbar for the ledger surfaces (`WorkspacePage`,
 * `MyIssuesPage`). A UI contract, not a filter engine: pages keep owning their
 * filter state, URL projection, saved-view semantics, sorting, and
 * project/label semantics. FilterBar owns the shared presentation: the ruled
 * control surface, result count, the "Filtering… Clear filters" affordance,
 * and the mobile "Filters" disclosure. Visual contract: VISUAL_LANGUAGE.md §16a.
 */
export function FilterBar({
  className = "",
  query,
  selects,
  sort,
  actions,
  resultCount,
  isFiltering = false,
  onClear,
  clearLabel = "Clear filters",
}: FilterBarProps) {
  const isMobile = useMatchMedia(MOBILE_FILTER_QUERY);
  const [open, setOpen] = useState(() => !isMobile);
  // Re-sync on breakpoint cross (desktop→mobile). No visible effect on desktop
  // because the toggle is not rendered there.
  useEffect(() => setOpen(!isMobile), [isMobile]);

  const controlsId = useId();
  const showClear = Boolean(isFiltering && onClear);

  return (
    <div
      className={[
        "filter-bar",
        !open && isMobile ? "filter-bar--collapsed" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="search"
    >
      {isMobile && (
        <Button
          type="button"
          variant="ghost"
          className="filter-bar-toggle"
          aria-expanded={open}
          aria-controls={controlsId}
          onClick={() => setOpen((o) => !o)}
        >
          Filters
        </Button>
      )}
      <div id={controlsId} className="filter-bar-controls">
        {query && (
<Field label={query.label} srOnlyLabel className="field-grow search-field">
             <Input
               value={query.value}
               onChange={(e) => query.onChange(e.target.value)}
               placeholder={query.placeholder}
             />
           </Field>
        )}
{selects?.map((s) => (
           <Field key={s.id} label={s.label} srOnlyLabel>
             <Select value={s.value} onChange={(e) => s.onChange(e.target.value)}>
               {s.options.map((o) => (
                 <option key={o.value} value={o.value}>
                   {o.label}
                 </option>
               ))}
             </Select>
           </Field>
         ))}
         {sort && (
           <Field label={sort.label} srOnlyLabel>
             <Select value={sort.value} onChange={(e) => sort.onChange(e.target.value)}>
               {sort.options.map((o) => (
                 <option key={o.value} value={o.value}>
                   {o.label}
                 </option>
               ))}
             </Select>
           </Field>
         )}
        <div className="filter-meta">
          {resultCount}
          {showClear && (
            <span className="filter-active">
              Filtering
              <Button type="button" variant="ghost" className="filter-clear" onClick={onClear}>
                {clearLabel}
              </Button>
            </span>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}
