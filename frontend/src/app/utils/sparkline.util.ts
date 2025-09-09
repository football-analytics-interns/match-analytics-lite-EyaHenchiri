const BUCKETS = [0, 15, 30, 45, 60, 75, 90, 105, 120] as const;

export function buildSparkline(values: number[], minuteMax: number, w = 90, h = 24, ticks = BUCKETS): string {
  const pad = 2;
  const maxX = Math.max(1, minuteMax);
  const scaleX = (x: number) => pad + (w - 2 * pad) * (x / maxX);
  const scaleY = (y: number) => pad + (h - 2 * pad) * (1 - Math.max(0, Math.min(10, y)) / 10);

  // si values et ticks n'ont pas la même longueur, on espace uniformément
  const xs = values.length === ticks.length
    ? ticks
    : values.map((_, i) => (i / Math.max(1, values.length - 1)) * maxX);

  const pts = values.map((v, i) => [scaleX(xs[i]), scaleY(v)] as const);
  const d = pts.length
    ? pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    : `M${pad},${scaleY(0).toFixed(1)} L${w - pad},${scaleY(0).toFixed(1)}`;

  const g7 = scaleY(7).toFixed(1), g8 = scaleY(8).toFixed(1);
  return `
<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trend du rating">
  <path class="grid" d="M0 ${g7} H ${w}"></path>
  <path class="grid" d="M0 ${g8} H ${w}"></path>
  <path d="${d}"></path>
</svg>`;
}

export function buckets() { return [...BUCKETS]; }
