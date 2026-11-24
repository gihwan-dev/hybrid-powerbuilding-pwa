import { roundTo2_5 } from './math';
import { calculatePlateBreakdown, DEFAULT_BAR_WEIGHT_KG } from './plate-calculator';
import type { WarmupSet } from './types';

interface RampStep {
  ratio: number;
  reps: number;
}

const DEFAULT_RAMP_STEPS: readonly RampStep[] = [
  { ratio: 0.5, reps: 5 },
  { ratio: 0.7, reps: 3 },
  { ratio: 0.85, reps: 1 },
];

export function buildWarmupSets(
  workingWeightKg: number,
  barWeightKg = DEFAULT_BAR_WEIGHT_KG,
): WarmupSet[] {
  const safeBar =
    Number.isFinite(barWeightKg) && barWeightKg > 0
      ? barWeightKg
      : DEFAULT_BAR_WEIGHT_KG;

  if (!Number.isFinite(workingWeightKg) || workingWeightKg <= safeBar) {
    return [];
  }

  const sets: WarmupSet[] = [];
  let prevWeight = safeBar;

  sets.push({
    setNumber: 1,
    percentage: Math.round((safeBar / workingWeightKg) * 100),
    weightKg: safeBar,
    reps: 8,
    plateBreakdown: calculatePlateBreakdown(safeBar, safeBar),
  });

  for (const step of DEFAULT_RAMP_STEPS) {
    const candidate = roundTo2_5(workingWeightKg * step.ratio);
    if (candidate <= prevWeight || candidate >= workingWeightKg) {
      continue;
    }

    prevWeight = candidate;
    sets.push({
      setNumber: sets.length + 1,
      percentage: Math.round((candidate / workingWeightKg) * 100),
      weightKg: candidate,
      reps: step.reps,
      plateBreakdown: calculatePlateBreakdown(candidate, safeBar),
    });
  }

  return sets;
}
