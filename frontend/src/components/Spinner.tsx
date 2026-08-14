interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label = "Loading", className = "" }: SpinnerProps) {
  return (
    <span className={["spinner", className].filter(Boolean).join(" ")} role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}