import { addIsoDays, parseIsoDateToUtcDays } from './fatigue-engine';
import { clamp } from './math';
import {
  DAY_ORDER,
  MUSCLE_GROUP_LABELS,
  ROUTINE_DAYS,
  findExerciseById,
} from './routine-model-a';
import type {
  CycleWeek,
  MuscleGroupId,
  MuscleVolumeSummary,
  WeightSessionLog,
} from './types';

export const MUSCLE_GROUP_ORDER: readonly MuscleGroupId[] = [
  'chest',
  'back',
  'quads',
  'posterior_chain',
  'shoulders_arms',
  'functional_core',
];

export const WEEKLY_VOLUME_TARGETS: Record<
  MuscleGroupId,
  { min: number; max: number }
> = {
  chest: { min: 10, max: 14 },
  back: { min: 10, max: 14 },
  quads: { min: 10, max: 14 },
  posterior_chain: { min: 10, max: 14 },
  shoulders_arms: { min: 10, max: 14 },
  functional_core: { min: 10, max: 14 },
};

function roundVolumeSets(value: number): number {
  return Number(value.toFixed(1));
}

export interface CalculateWeeklyMuscleVolumeInput {
  weekStartISO: string;
  weightLogs: WeightSessionLog[];
  cycleWeek?: CycleWeek;
}

export function calculateWeeklyMuscleVolume(
  input: CalculateWeeklyMuscleVolumeInput,
): MuscleVolumeSummary[] {
  const { weekStartISO, weightLogs, cycleWeek = 1 } = input;
  const isDeloadWeek = cycleWeek === 6;
  const weekEndISO = addIsoDays(weekStartISO, 6);
  const startDays = parseIsoDateToUtcDays(weekStartISO);
  const endDays = parseIsoDateToUtcDays(weekEndISO);

  const plannedByMuscle: Record<MuscleGroupId, number> = {
    chest: 0,
    back: 0,
    quads: 0,
    posterior_chain: 0,
    shoulders_arms: 0,
    functional_core: 0,
  };

  for (const dayKey of DAY_ORDER) {
    const day = ROUTINE_DAYS[dayKey];
    for (const ex of day.exercises) {
      if (isDeloadWeek && ex.role === 'backoff') continue;
      const effectiveSets = isDeloadWeek
        ? ex.role === 'top'
          ? 1
          : clamp(Math.round(ex.sets * 0.5), 1, 2)
        : ex.sets;

      for (const primary of ex.primaryMuscles) {
        plannedByMuscle[primary] += effectiveSets;
      }
      for (const secondary of ex.secondaryMuscles) {
        plannedByMuscle[secondary] += effectiveSets * 0.5;
      }
    }
  }

  const completedByMuscle: Record<MuscleGroupId, number> = {
    chest: 0,
    back: 0,
    quads: 0,
    posterior_chain: 0,
    shoulders_arms: 0,
    functional_core: 0,
  };

  for (const log of weightLogs) {
    const logDays = parseIsoDateToUtcDays(log.dateISO);
    if (logDays < startDays || logDays > endDays) continue;

    for (const exLog of log.exercises) {
      const completedSetCount = exLog.sets.filter((s) => s.completed).length;
      if (completedSetCount <= 0) continue;

      const def = findExerciseById(exLog.exerciseId);
      if (!def) continue;

      for (const primary of def.primaryMuscles) {
        completedByMuscle[primary] += completedSetCount;
      }
      for (const secondary of def.secondaryMuscles) {
        completedByMuscle[secondary] += completedSetCount * 0.5;
      }
    }
  }

  return MUSCLE_GROUP_ORDER.map((muscleGroup) => {
    const baseTarget = WEEKLY_VOLUME_TARGETS[muscleGroup];
    const targetMinSets = isDeloadWeek
      ? Math.max(1, Math.round(baseTarget.min * 0.5))
      : baseTarget.min;
    const targetMaxSets = isDeloadWeek
      ? Math.max(2, Math.round(baseTarget.max * 0.5))
      : baseTarget.max;
    const completedSets = roundVolumeSets(completedByMuscle[muscleGroup]);
    const plannedSets = roundVolumeSets(plannedByMuscle[muscleGroup]);

    const status: MuscleVolumeSummary['status'] =
      completedSets < targetMinSets
        ? 'below'
        : completedSets > targetMaxSets
          ? 'high'
          : 'optimal';

    return {
      muscleGroup,
      label: MUSCLE_GROUP_LABELS[muscleGroup],
      completedSets,
      plannedSets,
      targetMinSets,
      targetMaxSets,
      status,
    };
  });
}
