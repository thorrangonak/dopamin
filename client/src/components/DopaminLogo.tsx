/**
 * Dopamin brand wordmark with molecule icon.
 *
 * The dopamine molecule icon replaces the old gradient dot
 * as the brand signature element.
 */
import DopaminMoleculeIcon from "./DopaminMoleculeIcon";

export default function DopaminLogo({
  size = "default",
}: {
  size?: "sm" | "default" | "lg" | "xl";
}) {
  const config = {
    sm: { fontSize: "1rem", iconSize: 16 },
    default: { fontSize: "1.25rem", iconSize: 20 },
    lg: { fontSize: "1.625rem", iconSize: 24 },
    xl: { fontSize: "2.5rem", iconSize: 40 },
  };

  const c = config[size];

  return (
    <span
      className="dp-wordmark text-foreground inline-flex items-center select-none gap-1.5"
      style={{ fontSize: c.fontSize }}
      aria-label="dopamin"
    >
      <DopaminMoleculeIcon size={c.iconSize} />
      dopamin
    </span>
  );
}
