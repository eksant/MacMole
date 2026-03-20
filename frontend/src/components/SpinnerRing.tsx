interface Props {
  size?: number;
  color?: string;
  label?: string;
}

/**
 * Animated gradient spinner ring shown while a CLI command is running.
 */
export default function SpinnerRing({ size = 56, color = "#8b5cf6", label }: Props) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-3 py-6 animate-fade-in">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Static track */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="4"
          />
        </svg>
        {/* Spinning arc */}
        <svg
          width={size} height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 animate-spin-ring"
          style={{ animationDuration: "0.9s" }}
        >
          <defs>
            <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor={color} stopOpacity="0" />
              <stop offset="60%"  stopColor={color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={`url(#ring-grad)`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${circ * 0.65} ${circ * 0.35}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ filter: `drop-shadow(0 0 5px ${color}80)` }}
          />
        </svg>
      </div>
      {label && (
        <p className="text-xs font-medium animate-pulse-glow" style={{ color: "rgba(255,255,255,0.55)" }}>
          {label}
        </p>
      )}
    </div>
  );
}
