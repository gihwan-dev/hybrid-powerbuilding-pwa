const IPF_DOTS_MALE = {
  a: -307.75076,
  b: 24.0900756,
  c: -0.1918759221,
  d: 0.0007391293,
  e: -0.000001093,
} as const;

export function roundTo2_5(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value / 2.5) * 2.5;
  return rounded === 0 ? 0 : Number(rounded.toFixed(2));
}

export function roundToHalf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 2) / 2;
  return rounded === 0 ? 0 : Number(rounded.toFixed(1));
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min === 0 ? 0 : min;
  }
  const clamped = Math.min(Math.max(value, min), max);
  return clamped === 0 ? 0 : clamped;
}

export function calculateDotsScore(bodyweightKg: number, totalKg: number): number {
  if (
    !Number.isFinite(bodyweightKg) ||
    !Number.isFinite(totalKg) ||
    bodyweightKg <= 0 ||
    totalKg <= 0
  ) {
    return 0;
  }

  const bw = clamp(bodyweightKg, 40, 210);
  const { a, b, c, d, e } = IPF_DOTS_MALE;
  const denominator =
    a + b * bw + c * bw ** 2 + d * bw ** 3 + e * bw ** 4;

  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  const score = totalKg * (500 / denominator);
  return Number(score.toFixed(1));
}
