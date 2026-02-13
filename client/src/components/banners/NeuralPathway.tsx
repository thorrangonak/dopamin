import { useId } from "react";

/**
 * Animated neural pathway line rendered at the bottom of banners.
 * Represents synaptic signal transmission.
 */
export default function NeuralPathway({ color = "white" }: { color?: string }) {
  const id = useId();
  const gradId = `neural-grad-${id}`;

  return (
    <svg
      className="absolute bottom-0 left-0 w-full h-12 pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 800 48"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="30%" stopColor={color} stopOpacity="0.3" />
          <stop offset="50%" stopColor={color} stopOpacity="0.6" />
          <stop offset="70%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Main pathway line */}
      <path
        d="M0,40 Q100,10 200,30 T400,20 T600,35 T800,15"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        fill="none"
        className="dp-neural-path"
      />

      {/* Synapse nodes */}
      {[200, 400, 600].map((cx, i) => (
        <circle
          key={i}
          cx={cx}
          cy={i % 2 === 0 ? 30 : 20}
          r="3"
          fill={color}
          opacity="0.4"
          className="dp-synapse-pulse"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}
    </svg>
  );
}
