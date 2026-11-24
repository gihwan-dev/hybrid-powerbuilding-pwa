import { clamp, roundTo2_5 } from './math';
import { getRoutineDay, scaleInitialWeightForOneRm } from './routine-model-a';
import type {
  BackoffRecalculationResult,
  CycleWeek,
  DayKey,
  ExerciseDefinition,
  OneRmMap,
  PrescribedExercise,
  PrescribedSession,
  ProgressionTone,
  WeightExerciseLog,
  WeightSessionLog,
} from './types';

export function calculateBackoffWeight(topWeightKg: number, ratio: number): number {
  if (
    !Number.isFinite(topWeightKg) ||
    !Number.isFinite(ratio) ||
    topWeightKg <= 0 ||
    ratio <= 0
  ) {
    return 0;
  }
  return roundTo2_5(topWeightKg * ratio);
}

export interface RecalculateLiveBackoffInput {
  topWeightKg: number;
  ratio: number;
  actualTopRir: number | null;
  defaultWeightKg: number;
}

export function recalculateLiveBackoff(
  input: RecalculateLiveBackoffInput,
): BackoffRecalculationResult {
  const { topWeightKg, ratio, actualTopRir, defaultWeightKg } = input;
  const pct = Math.round(ratio * 100);
  const baseBackoff =
    topWeightKg > 0 ? calculateBackoffWeight(topWeightKg, ratio) : defaultWeightKg;

  if (actualTopRir !== null && actualTopRir === 0) {
    const adjusted = Math.max(0, roundTo2_5(baseBackoff - 2.5));
    return {
      prescribedWeightKg: adjusted,
      ratio,
      fatigueAdjusted: true,
      badge: '피로 조절 -2.5kg',
      reason: '탑세트 RIR이 0이라 피로 관리를 위해 백오프 중량을 2.5kg 낮췄어요',
    };
  }

  return {
    prescribedWeightKg: baseBackoff,
    ratio,
    fatigueAdjusted: false,
    badge: `탑세트 ${pct}%`,
    reason: `오늘 탑세트 중량 기준으로 ${pct}% 백오프 중량을 계산했어요`,
  };
}

interface LatestExerciseRecord {
  session: WeightSessionLog;
  exercise: WeightExerciseLog;
}

function findLatestCompletedExerciseLog(
  exerciseId: string,
  weightLogs: WeightSessionLog[],
  preferNonDeload: boolean,
): LatestExerciseRecord | null {
  const sortedLogs = [...weightLogs].sort((a, b) =>
    b.dateISO.localeCompare(a.dateISO),
  );

  let fallbackRecord: LatestExerciseRecord | null = null;

  for (const session of sortedLogs) {
    const found = session.exercises.find(
      (ex) =>
        ex.exerciseId === exerciseId &&
        ex.sets.some((set) => set.completed && set.actualReps > 0),
    );
    if (!found) continue;

    if (!fallbackRecord) {
      fallbackRecord = { session, exercise: found };
    }

    if (!preferNonDeload || session.cycleWeek !== 6) {
      return { session, exercise: found };
    }
  }

  return fallbackRecord;
}

function formatWeightUnit(weightKg: number, unit: ExerciseDefinition['unit']): string {
  switch (unit) {
    case 'kg_added':
      return weightKg > 0 ? `+${weightKg}kg` : '맨몸';
    case 'kg_per_hand':
      return `${weightKg}kg (한 손)`;
    case 'kg_meters':
      return `${weightKg}kg`;
    case 'kg':
      return `${weightKg}kg`;
  }
}

function evaluateStandardProgression(
  definition: ExerciseDefinition,
  latest: LatestExerciseRecord | null,
  baselineWeightKg: number,
  useAlternative: boolean,
  activeUnit: ExerciseDefinition['unit'],
): {
  prescribedWeightKg: number;
  badge: string;
  tone: ProgressionTone;
  reason: string;
  lastSessionSummary: string | null;
} {
  if (!latest) {
    return {
      prescribedWeightKg: baselineWeightKg,
      badge: '초기 설정',
      tone: 'base',
      reason: '설정된 기준 중량으로 첫 세션을 시작해요',
      lastSessionSummary: null,
    };
  }

  const completedSets = latest.exercise.sets.filter(
    (s) => s.completed && s.actualReps > 0,
  );
  const firstSet = completedSets[0];

  if (!firstSet) {
    return {
      prescribedWeightKg: baselineWeightKg,
      badge: '초기 설정',
      tone: 'base',
      reason: '이전 완료 세트 기록이 없어 기준 중량으로 진행해요',
      lastSessionSummary: null,
    };
  }

  const lastWeight = firstSet.weightKg;
  const minReps = Math.min(...completedSets.map((s) => s.actualReps));
  const maxReps = Math.max(...completedSets.map((s) => s.actualReps));
  const rirValues = completedSets
    .map((s) => s.rir)
    .filter((r): r is number => r !== null);
  const minRir = rirValues.length > 0 ? Math.min(...rirValues) : null;

  const repLabel =
    minReps === maxReps ? `${minReps}회` : `${minReps}~${maxReps}회`;
  const rirLabel = minRir !== null ? ` · RIR ${minRir}` : '';
  const lastSessionSummary = `직전 ${formatWeightUnit(lastWeight, activeUnit)} × ${repLabel}${rirLabel}`;

  // If the user switched between main and alternative exercise, reset safely to the target movement baseline
  if (useAlternative !== latest.exercise.usedAlternative) {
    return {
      prescribedWeightKg: baselineWeightKg,
      badge: '대체 동작',
      tone: 'base',
      reason: '선택한 동작의 기준 중량으로 안전하게 시작해요',
      lastSessionSummary,
    };
  }

  if (minRir === 0 && minReps < definition.repsMin) {
    return {
      prescribedWeightKg: Math.max(0, Number((lastWeight - 2.5).toFixed(2))),
      badge: '피로 관리 -2.5kg',
      tone: 'decrease',
      reason: `직전 세션에서 RIR 0 및 목표 하한(${definition.repsMin}회) 미달로 중량을 2.5kg 낮췄어요`,
      lastSessionSummary,
    };
  }

  if (minRir === 0 || minReps < definition.repsMin) {
    return {
      prescribedWeightKg: lastWeight,
      badge: '중량 유지 추천',
      tone: 'hold',
      reason:
        minRir === 0
          ? '직전 세트 RIR이 0이라 현재 중량에서 여유를 먼저 확보해요'
          : `직전 반복 수가 목표 하한(${definition.repsMin}회) 미만이라 중량을 유지해요`,
      lastSessionSummary,
    };
  }

  if (
    !definition.skipRir &&
    minReps >= definition.repsMax &&
    minRir !== null &&
    minRir >= 2
  ) {
    return {
      prescribedWeightKg: Number((lastWeight + 2.5).toFixed(2)),
      badge: '증량 추천 +2.5kg',
      tone: 'increase',
      reason: `직전 세션에서 목표 상한(${definition.repsMax}회)과 RIR 2 이상을 달성해 2.5kg 증량했어요`,
      lastSessionSummary,
    };
  }

  return {
    prescribedWeightKg: lastWeight,
    badge: '중량 유지 추천',
    tone: 'hold',
    reason: '목표 반복 수와 RIR 범위 안에서 안정적으로 볼륨을 쌓아요',
    lastSessionSummary,
  };
}

export interface LiveTopSetOverride {
  weightKg: number;
  rir: number | null;
}

export interface PrescribeSessionInput {
  dayKey: DayKey;
  cycleWeek: CycleWeek;
  weightLogs: WeightSessionLog[];
  baseOneRm: OneRmMap;
  liveTopSets?: Record<string, LiveTopSetOverride>;
  preferAlternatives?: Record<string, boolean>;
}

export function prescribeSession(
  input: PrescribeSessionInput,
): PrescribedSession {
  const {
    dayKey,
    cycleWeek,
    weightLogs,
    baseOneRm,
    liveTopSets,
    preferAlternatives,
  } = input;

  const day = getRoutineDay(dayKey);
  const isDeloadWeek = cycleWeek === 6;

  if (day.type !== 'weight') {
    return {
      dayKey,
      cycleWeek,
      isDeloadWeek,
      title: day.title,
      subtitle: day.subtitle,
      cnsTrimApplied: false,
      exercises: [],
    };
  }

  const prescribedMap = new Map<string, PrescribedExercise>();
  const exercises: PrescribedExercise[] = [];

  for (const def of day.exercises) {
    if (isDeloadWeek && def.role === 'backoff') {
      continue;
    }

    const latest = findLatestCompletedExerciseLog(def.id, weightLogs, true);
    const useAlt = Boolean(
      (preferAlternatives?.[def.id] ?? latest?.exercise.usedAlternative ?? false) &&
        def.alternative,
    );

    const activeName =
      useAlt && def.alternative ? def.alternative.name : def.name;
    const activeEquipment =
      useAlt && def.alternative ? def.alternative.equipment : def.equipment;
    const activeUnit =
      useAlt && def.alternative
        ? (def.alternative.unit ?? def.unit)
        : def.unit;

    const baselineWeightKg =
      useAlt && def.alternative
        ? def.alternative.defaultWeightKg
        : scaleInitialWeightForOneRm(def, baseOneRm);

    let prescribedWeightKg = baselineWeightKg;
    let badge = '초기 설정';
    let tone: ProgressionTone = 'base';
    let reason = '설정된 기준 중량으로 세션을 진행해요';
    let lastSessionSummary: string | null = null;

    if (def.role === 'backoff' && def.pairedTopExerciseId && def.backoffRatio) {
      const pairedTop = prescribedMap.get(def.pairedTopExerciseId);
      const liveOverride = liveTopSets?.[def.pairedTopExerciseId];

      const latestBackoffSummary = latest?.exercise.sets.find((s) => s.completed)
        ? `직전 ${formatWeightUnit(
            latest.exercise.sets.find((s) => s.completed)?.weightKg ?? baselineWeightKg,
            activeUnit,
          )}`
        : null;

      if (liveOverride && liveOverride.weightKg > 0) {
        const recalc = recalculateLiveBackoff({
          topWeightKg: liveOverride.weightKg,
          ratio: def.backoffRatio,
          actualTopRir: liveOverride.rir,
          defaultWeightKg: baselineWeightKg,
        });
        prescribedWeightKg = recalc.prescribedWeightKg;
        badge = recalc.badge;
        tone = recalc.fatigueAdjusted ? 'decrease' : 'hold';
        reason = recalc.reason;
        lastSessionSummary = latestBackoffSummary;
      } else {
        const topWeight = pairedTop?.prescribedWeightKg ?? baselineWeightKg;
        prescribedWeightKg =
          pairedTop !== undefined
            ? calculateBackoffWeight(topWeight, def.backoffRatio)
            : baselineWeightKg;
        const pct = Math.round(def.backoffRatio * 100);
        badge = `탑세트 ${pct}%`;
        tone = pairedTop?.progressionTone === 'increase' ? 'increase' : 'hold';
        reason = `예정 탑세트(${topWeight}kg)의 ${pct}% 비율로 자동 연동했어요`;
        lastSessionSummary = latestBackoffSummary;
      }
    } else {
      const evaluated = evaluateStandardProgression(
        def,
        latest,
        baselineWeightKg,
        useAlt,
        activeUnit,
      );
      prescribedWeightKg = evaluated.prescribedWeightKg;
      badge = evaluated.badge;
      tone = evaluated.tone;
      reason = evaluated.reason;
      lastSessionSummary = evaluated.lastSessionSummary;
    }

    let sets = def.sets;
    let targetRirMin = def.targetRirMin;
    let targetRirMax = def.targetRirMax;
    let isDeloadAdjusted = false;

    if (isDeloadWeek) {
      // Keep working weight as-is (do not apply Week 1-5 +2.5kg jumps during deload)
      const lastCompletedWeight = latest?.exercise.sets.find(
        (s) => s.completed && s.actualReps > 0,
      )?.weightKg;
      if (
        typeof lastCompletedWeight === 'number' &&
        useAlt === (latest?.exercise.usedAlternative ?? false)
      ) {
        prescribedWeightKg = lastCompletedWeight;
      }

      isDeloadAdjusted = true;
      tone = 'deload';

      if (def.role === 'top') {
        sets = 1;
        targetRirMin = 3;
        targetRirMax = 4;
        badge = '디로드 6주차';
        reason = '중량은 유지하고 RIR 3~4 여유를 남겨 중추신경계 피로를 회복해요';
      } else {
        sets = clamp(Math.round(def.sets * 0.5), 1, 2);
        if (!def.skipRir) {
          targetRirMin = Math.max(def.targetRirMin, 3);
          targetRirMax = Math.max(def.targetRirMax, 4);
        }
        badge = '디로드 볼륨 -50%';
        reason = '디로드 주간으로 세트 수를 절반(최대 2세트)으로 줄여 회복에 집중해요';
      }
    }

    const prescribed: PrescribedExercise = {
      definition: def,
      activeName,
      usedAlternative: useAlt,
      activeEquipment,
      activeUnit,
      prescribedWeightKg,
      sets,
      repsMin: def.repsMin,
      repsMax: def.repsMax,
      targetRirMin,
      targetRirMax,
      skipRir: def.skipRir,
      progressionBadge: badge,
      progressionTone: tone,
      progressionReason: reason,
      lastSessionSummary,
      isDeloadAdjusted,
    };

    prescribedMap.set(def.id, prescribed);
    exercises.push(prescribed);
  }

  return {
    dayKey,
    cycleWeek,
    isDeloadWeek,
    title: day.title,
    subtitle: isDeloadWeek
      ? '6주차 디로드: 중량은 유지하고 볼륨과 강도를 낮춰 회복해요'
      : day.subtitle,
    cnsTrimApplied: false,
    exercises,
  };
}

export function applyHighCnsTrim(session: PrescribedSession): PrescribedSession {
  return {
    ...session,
    cnsTrimApplied: true,
    exercises: session.exercises.map((exercise) => {
      if (exercise.definition.role !== 'backoff') {
        return exercise;
      }

      const trimmedSets = Math.max(1, exercise.sets - 1);
      const didTrim = trimmedSets < exercise.sets;
      return {
        ...exercise,
        sets: trimmedSets,
        progressionBadge: didTrim ? 'CNS 백오프 -1세트' : exercise.progressionBadge,
        progressionReason: didTrim
          ? '높은 CNS 피로도를 반영해 백오프 세트를 1세트 줄였어요'
          : exercise.progressionReason,
      };
    }),
  };
}
