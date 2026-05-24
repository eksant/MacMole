interface Props {
  value: number; // 0–100
  height?: number;
}

function barGradient(value: number): string {
  if (value > 85) return "linear-gradient(90deg, #ef4444, #dc2626)";
  if (value > 65) return "linear-gradient(90deg, #f59e0b, #ef4444)";
  return "linear-gradient(90deg, #8b5cf6, #3b82f6)";
}

function barGlow(value: number): string {
  if (value > 85) return "0 0 8px rgba(239,68,68,0.5)";
  if (value > 65) return "0 0 8px rgba(245,158,11,0.5)";
  return "0 0 8px rgba(139,92,246,0.4)";
}

export default function GaugeBar({ value, height = 4 }: Props) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: "rgba(255,255,255,0.08)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: barGradient(pct),
          boxShadow: barGlow(pct),
        }}
      />
    </div>
  );
}
