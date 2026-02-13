import { useId } from "react";

/**
 * Repeating dopamine molecule SVG pattern overlay.
 * Used as a background layer in banners.
 */
export default function MoleculePattern({ opacity = 0.05 }: { opacity?: number }) {
  const id = useId();
  const patternId = `mol-pat-${id}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id={patternId} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          {/* Mini hexagon */}
          <polygon
            points="18,8 26,8 30,15 26,22 18,22 14,15"
            stroke="currentColor"
            strokeWidth="0.8"
            fill="none"
            opacity="0.6"
          />
          {/* Chain */}
          <polyline
            points="18,22 15,28 19,33"
            stroke="currentColor"
            strokeWidth="0.8"
            fill="none"
            opacity="0.6"
          />
          {/* NH2 dot */}
          <circle cx="19" cy="33" r="2" fill="currentColor" opacity="0.4" />
          {/* OH dots */}
          <circle cx="32" cy="10" r="1.2" fill="currentColor" opacity="0.4" />
          <circle cx="33" cy="18" r="1.2" fill="currentColor" opacity="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} opacity={opacity} />
    </svg>
  );
}
