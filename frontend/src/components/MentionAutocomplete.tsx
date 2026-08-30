import { useEffect, useRef, useMemo } from "react";

export interface MentionMember {
  userId: string;
  name: string;
}

export interface MentionAutocompleteProps {
  members: MentionMember[];
  query: string;
  activeIndex: number;
  onSelect: (member: MentionMember) => void;
  onDismiss: () => void;
  onActiveChange: (index: number) => void;
  listBoxId: string;
}

const MAX_SUGGESTIONS = 10;

export function MentionAutocomplete({
  members,
  query,
  activeIndex,
  onSelect,
  onDismiss,
  onActiveChange,
  listBoxId,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const term = query.replace("@", "").toLowerCase();
    return members
      .filter((m) => m.name.toLowerCase().includes(term))
      .slice(0, MAX_SUGGESTIONS);
  }, [members, query]);

  useEffect(() => {
    onActiveChange(0);
  }, [filtered.length, onActiveChange]);

  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= filtered.length) return;
    const item = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    ) as HTMLElement | null;
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, filtered.length]);

  useEffect(() => {
    if (filtered.length === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          onActiveChange(Math.min(activeIndex + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          onActiveChange(Math.max(activeIndex - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (filtered[activeIndex]) {
            onSelect(filtered[activeIndex]);
          }
          break;
        case "Tab":
          e.preventDefault();
          e.stopPropagation();
          if (filtered[activeIndex]) {
            onSelect(filtered[activeIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filtered, activeIndex, onSelect, onDismiss, onActiveChange]);

  if (!query.startsWith("@")) {
    return null;
  }

  const activeDescendant =
    filtered.length > 0 ? `${listBoxId}-option-${activeIndex}` : undefined;

  return (
    <>
      <ul
        className="mention-autocomplete"
        role="listbox"
        id={listBoxId}
        aria-label="Mention suggestions"
        aria-expanded={filtered.length > 0}
        aria-activedescendant={activeDescendant}
        ref={listRef}
      >
        {filtered.length === 0 ? (
          <li className="mention-autocomplete-empty" role="option" aria-disabled="true">
            No matching members
          </li>
        ) : (
          filtered.map((member, index) => (
            <li
              key={member.userId}
              id={`${listBoxId}-option-${index}`}
              className={`mention-autocomplete-item${index === activeIndex ? " mention-autocomplete-item--active" : ""}`}
              role="option"
              data-index={index}
              aria-selected={index === activeIndex}
              onClick={() => onSelect(member)}
              onMouseEnter={() => onActiveChange(index)}
            >
              <span className="mention-autocomplete-prefix">@</span>
              <span className="mention-autocomplete-name">{member.name}</span>
            </li>
          ))
        )}
      </ul>
      <span role="status" className="sr-only">
        {filtered.length} {filtered.length === 1 ? "result" : "results"}
      </span>
    </>
  );
}