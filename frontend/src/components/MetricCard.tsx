interface Props {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Tailwind gradient class e.g. "from-violet-500 to-indigo-500" */
  accent?: string;
  /** Hex accent color for left border */
  accentColor?: string;
}

export default function MetricCard({ title, icon, children, accentColor = "#8b5cf6" }: Props) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 animate-fade-in-up relative overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Subtle gradient top edge */}
      <div
        className="absolute top-0 left-4 right-4 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}30, transparent)` }}
      />

      <div
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        {icon && <span style={{ color: accentColor }}>{icon}</span>}
        {title}
      </div>
      {children}
    </div>
  );
}
