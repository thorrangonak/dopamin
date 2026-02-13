import { useId } from "react";

/**
 * Simplified dopamine molecule (C8H11NO2) SVG icon.
 * Catechol ring (hexagon) + 2 OH groups + ethylamine chain + NH2 terminal.
 */
export default function DopaminMoleculeIcon({
  size = 24,
  className = "",
  animated = false,
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  const id = useId();
  const gradId = `dp-mol-grad-${id}`;
  const glowId = `dp-mol-glow-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`${animated ? "dp-float" : ""} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--dp-purple)" />
          <stop offset="100%" stopColor="var(--dp-pink)" />
        </linearGradient>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Catechol ring — hexagon */}
      <polygon
        points="8,3.5 12.5,3.5 14.75,7.5 12.5,11.5 8,11.5 5.75,7.5"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
        filter={`url(#${glowId})`}
      />

      {/* OH group 1 — top-right of ring */}
      <circle cx="15.5" cy="4.5" r="1.4" fill={`url(#${gradId})`} opacity="0.85" />
      {/* OH bond line */}
      <line x1="14.75" y1="4" x2="15.5" y2="4.5" stroke={`url(#${gradId})`} strokeWidth="1" />

      {/* OH group 2 — bottom-right of ring */}
      <circle cx="16" cy="9" r="1.4" fill={`url(#${gradId})`} opacity="0.85" />
      {/* OH bond line */}
      <line x1="14.75" y1="7.5" x2="16" y2="9" stroke={`url(#${gradId})`} strokeWidth="1" />

      {/* Ethylamine chain — kinked line from bottom of ring */}
      <polyline
        points="8,11.5 6,15 9,18"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* NH2 terminal group */}
      <circle
        cx="9"
        cy="18"
        r="2"
        fill={`url(#${gradId})`}
        className={animated ? "dp-synapse-pulse" : ""}
      />
      <circle cx="9" cy="18" r="0.8" fill="var(--background, #0a0a0f)" />
    </svg>
  );
}
