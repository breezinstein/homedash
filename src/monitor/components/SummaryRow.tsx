/**
 * Shared metric row used by the top summary cards (Power, Home Status).
 * Icon + label on the left, colour-coded value on the right.
 */
export function SummaryRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="summary-row">
      <span className="summary-row-key">
        <span className="summary-row-icon">{icon}</span>
        {label}
      </span>
      <span className="summary-row-value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}
