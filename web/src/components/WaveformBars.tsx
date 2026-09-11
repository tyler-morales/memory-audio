type WaveformBarsProps = {
  peaks: number[];
  color?: string;
  height?: number;
  className?: string;
  "aria-hidden"?: boolean;
};

export function WaveformBars({
  peaks,
  color = "currentColor",
  height = 36,
  className = "mini-wave",
  "aria-hidden": ariaHidden = true,
}: WaveformBarsProps) {
  const bars = peaks.length > 0 ? peaks : Array.from({ length: 24 }, () => 0.15);
  return (
    <div className={className} style={{ height, color }} aria-hidden={ariaHidden}>
      {bars.map((p, i) => (
        <span
          key={i}
          style={{ height: `${Math.max(8, Math.round(p * 100))}%` }}
        />
      ))}
    </div>
  );
}
