import type { PlateBreakdown, PlatePairCount } from './types';

export const DEFAULT_BAR_WEIGHT_KG = 20;

export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export function calculatePlateBreakdown(
  targetWeightKg: number,
  barWeightKg = DEFAULT_BAR_WEIGHT_KG,
): PlateBreakdown {
  const safeBarKg =
    Number.isFinite(barWeightKg) && barWeightKg > 0
      ? barWeightKg
      : DEFAULT_BAR_WEIGHT_KG;

  if (!Number.isFinite(targetWeightKg) || targetWeightKg <= 0) {
    return {
      targetWeightKg: 0,
      barWeightKg: safeBarKg,
      perSideWeightKg: 0,
      platesPerSide: [],
      achievableTotalKg: 0,
      remainderKg: 0,
      isExact: false,
      isBarOnly: true,
    };
  }

  const targetMilli = Math.round(targetWeightKg * 1000);
  const barMilli = Math.round(safeBarKg * 1000);

  if (targetMilli <= barMilli) {
    return {
      targetWeightKg,
      barWeightKg: safeBarKg,
      perSideWeightKg: 0,
      platesPerSide: [],
      achievableTotalKg: safeBarKg,
      remainderKg: 0,
      isExact: targetMilli === barMilli,
      isBarOnly: true,
    };
  }

  const perSideTargetMilli = Math.floor((targetMilli - barMilli) / 2);
  let remainingMilli = perSideTargetMilli;
  const platesPerSide: PlatePairCount[] = [];

  for (const plateKg of STANDARD_PLATES_KG) {
    const plateMilli = Math.round(plateKg * 1000);
    const pairs = Math.floor(remainingMilli / plateMilli);
    if (pairs > 0) {
      platesPerSide.push({ weightKg: plateKg, pairs });
      remainingMilli -= pairs * plateMilli;
    }
  }

  const loadedPerSideMilli = perSideTargetMilli - remainingMilli;
  const achievableTotalMilli = barMilli + loadedPerSideMilli * 2;
  const remainderMilli = Math.max(0, targetMilli - achievableTotalMilli);

  return {
    targetWeightKg,
    barWeightKg: safeBarKg,
    perSideWeightKg: Number((loadedPerSideMilli / 1000).toFixed(2)),
    platesPerSide,
    achievableTotalKg: Number((achievableTotalMilli / 1000).toFixed(2)),
    remainderKg: Number((remainderMilli / 1000).toFixed(2)),
    isExact: remainderMilli === 0,
    isBarOnly: platesPerSide.length === 0,
  };
}
