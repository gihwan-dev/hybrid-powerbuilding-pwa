import { getMondayIsoDate, parseIsoDateToUtcDays } from './fatigue-engine';
import { calculateDotsScore, clamp, roundToHalf } from './math';
import { DEFAULT_USER_PROFILE } from './routine-model-a';
import type {
  CycleWeek,
  ForecastHistoryPoint,
  ForecastPoint,
  ForecastResult,
  ForecastSeriesKey,
  LiftForecastSummary,
  LiftKey,
  OneRmMap,
  WeightSessionLog,
} from './types';

export function calculateE1rm(weightKg: number, reps: number, rir = 0): number {
  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(reps) ||
    weightKg <= 0 ||
    reps <= 0
  ) {
    return 0;
  }

  const safeRir = Number.isFinite(rir) ? Math.max(0, rir) : 0;
  const effectiveReps = reps + safeRir;

  if (effectiveReps <= 1) {
    return roundToHalf(weightKg);
  }

  return roundToHalf(weightKg * (1 + effectiveReps / 30));
}

export function extractCurrentLiftE1rms(
  weightLogs: WeightSessionLog[],
  baseOneRm: OneRmMap,
): OneRmMap {
  const result: OneRmMap = { ...baseOneRm };
  const sortedLogs = [...weightLogs].sort((a, b) =>
    a.dateISO.localeCompare(b.dateISO),
  );

  const latestByLift: Partial<Record<LiftKey, number>> = {};

  for (const log of sortedLogs) {
    const sessionMaxByLift: Partial<Record<LiftKey, number>> = {};

    for (const ex of log.exercises) {
      if (!ex.liftKey || ex.role === 'primer') continue;

      for (const set of ex.sets) {
        if (!set.completed || set.weightKg <= 0 || set.actualReps <= 0) continue;
        const e1rm =
          typeof set.e1rmKg === 'number' && set.e1rmKg > 0
            ? roundToHalf(set.e1rmKg)
            : calculateE1rm(set.weightKg, set.actualReps, set.rir ?? 0);
        if (e1rm <= 0) continue;

        const currentMax = sessionMaxByLift[ex.liftKey] ?? 0;
        if (e1rm > currentMax) {
          sessionMaxByLift[ex.liftKey] = e1rm;
        }
      }
    }

    (['bench', 'squat', 'deadlift', 'ohp'] as const).forEach((lift) => {
      const value = sessionMaxByLift[lift];
      if (typeof value === 'number' && value > 0) {
        latestByLift[lift] = value;
      }
    });
  }

  (['bench', 'squat', 'deadlift', 'ohp'] as const).forEach((lift) => {
    const value = latestByLift[lift];
    if (typeof value === 'number' && value > 0) {
      result[lift] = value;
    }
  });

  return result;
}

interface WeeklyPoint {
  dateISO: string;
  weekDays: number;
  e1rmKg: number;
}

function computeOlsSlope(points: WeeklyPoint[]): number {
  if (points.length < 2) return 0;

  const first = points[0];
  if (!first) return 0;

  const xs = points.map((p) => (p.weekDays - first.weekDays) / 7);
  const ys = points.map((p) => p.e1rmKg);

  const n = xs.length;
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] ?? 0) - meanX;
    const dy = (ys[i] ?? 0) - meanY;
    numerator += dx * dy;
    denominator += dx * dx;
  }

  if (denominator <= 0) return 0;
  return numerator / denominator;
}

const SERIES_LABELS: Record<ForecastSeriesKey, string> = {
  total: 'SBD 합계',
  bench: '벤치프레스',
  squat: '백 스쿼트',
  deadlift: '컨벤셔널 데드리프트',
};

export interface Build12WeekForecastInput {
  weightLogs: WeightSessionLog[];
  baseOneRm: OneRmMap;
  currentCycleWeek: CycleWeek;
  bodyweightKg?: number;
}

function buildSingleLiftForecast(
  lift: 'bench' | 'squat' | 'deadlift',
  currentKg: number,
  weeklyPoints: WeeklyPoint[],
  latestLoggedWeekDays: number | null,
  currentCycleWeek: CycleWeek,
): LiftForecastSummary {
  const hasTrend = weeklyPoints.length >= 2;
  const rawSlope = hasTrend ? computeOlsSlope(weeklyPoints) : currentKg * 0.0033;
  const weeklySlopeKg = Number(clamp(rawSlope, -1.0, 1.5).toFixed(3));

  const anchorWeekDays =
    latestLoggedWeekDays ?? weeklyPoints[weeklyPoints.length - 1]?.weekDays ?? 0;
  const historyPoints: ForecastHistoryPoint[] = weeklyPoints.map((wp) => ({
    dateISO: wp.dateISO,
    weekOffset: Math.round((wp.weekDays - anchorWeekDays) / 7),
    actualKg: roundToHalf(wp.e1rmKg),
  }));

  const points: ForecastPoint[] = [];
  let runningProjected = currentKg;

  for (let weekOffset = 0; weekOffset <= 12; weekOffset += 1) {
    const cycleWeek = (((currentCycleWeek - 1 + weekOffset) % 6) + 1) as CycleWeek;
    const isDeloadWeek = cycleWeek === 6;

    if (weekOffset > 0) {
      const prevCycleWeek = (((currentCycleWeek - 1 + (weekOffset - 1)) % 6) + 1) as CycleWeek;
      const prevWasDeload = prevCycleWeek === 6;

      let stepMultiplier = 1;
      if (isDeloadWeek) {
        stepMultiplier = 0;
      } else if (prevWasDeload && weeklySlopeKg > 0) {
        stepMultiplier = 1.35;
      }

      runningProjected += weeklySlopeKg * stepMultiplier;
    }

    const spread =
      weekOffset === 0
        ? 0
        : Number(
            (Math.max(0.5, Math.abs(weeklySlopeKg) * 0.8 + 0.6) * Math.sqrt(weekOffset)).toFixed(1),
          );

    const projectedKg = roundToHalf(runningProjected);
    const lowerBoundKg = roundToHalf(Math.max(0, runningProjected - spread));
    const upperBoundKg = roundToHalf(runningProjected + spread);

    points.push({
      weekOffset,
      label: weekOffset === 0 ? '현재' : `${weekOffset}주`,
      cycleWeek,
      isDeloadWeek,
      projectedKg,
      lowerBoundKg,
      upperBoundKg,
    });
  }

  const week4Kg = points[4]?.projectedKg ?? currentKg;
  const week8Kg = points[8]?.projectedKg ?? currentKg;
  const week12Kg = points[12]?.projectedKg ?? currentKg;

  return {
    key: lift,
    label: SERIES_LABELS[lift],
    currentKg: roundToHalf(currentKg),
    week4Kg,
    week8Kg,
    week12Kg,
    delta12WeekKg: roundToHalf(week12Kg - currentKg),
    weeklySlopeKg: Number(weeklySlopeKg.toFixed(2)),
    historyPoints,
    points,
  };
}

export function build12WeekForecast(
  input: Build12WeekForecastInput,
): ForecastResult {
  const {
    weightLogs,
    baseOneRm,
    currentCycleWeek,
    bodyweightKg = DEFAULT_USER_PROFILE.weightKg,
  } = input;

  const currentOneRm = extractCurrentLiftE1rms(weightLogs, baseOneRm);

  const weeklyBuckets: Record<
    'bench' | 'squat' | 'deadlift',
    Map<string, number>
  > = {
    bench: new Map<string, number>(),
    squat: new Map<string, number>(),
    deadlift: new Map<string, number>(),
  };

  for (const log of weightLogs) {
    const mondayISO = getMondayIsoDate(log.dateISO);
    for (const ex of log.exercises) {
      if (
        ex.role === 'primer' ||
        (ex.liftKey !== 'bench' && ex.liftKey !== 'squat' && ex.liftKey !== 'deadlift')
      ) {
        continue;
      }

      for (const set of ex.sets) {
        if (!set.completed || set.weightKg <= 0 || set.actualReps <= 0) continue;
        const e1rm =
          typeof set.e1rmKg === 'number' && set.e1rmKg > 0
            ? roundToHalf(set.e1rmKg)
            : calculateE1rm(set.weightKg, set.actualReps, set.rir ?? 0);
        if (e1rm <= 0) continue;

        const bucket = weeklyBuckets[ex.liftKey];
        const prev = bucket.get(mondayISO) ?? 0;
        if (e1rm > prev) {
          bucket.set(mondayISO, e1rm);
        }
      }
    }
  }

  const toSortedPoints = (bucket: Map<string, number>): WeeklyPoint[] =>
    Array.from(bucket.entries())
      .map(([mondayISO, e1rmKg]) => ({
        dateISO: mondayISO,
        weekDays: parseIsoDateToUtcDays(mondayISO),
        e1rmKg,
      }))
      .sort((a, b) => a.weekDays - b.weekDays);

  const benchPoints = toSortedPoints(weeklyBuckets.bench);
  const squatPoints = toSortedPoints(weeklyBuckets.squat);
  const deadliftPoints = toSortedPoints(weeklyBuckets.deadlift);

  const allMondays = Array.from(
    new Set([
      ...weeklyBuckets.bench.keys(),
      ...weeklyBuckets.squat.keys(),
      ...weeklyBuckets.deadlift.keys(),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const latestMondayISO = allMondays[allMondays.length - 1] ?? null;
  const latestLoggedWeekDays = latestMondayISO
    ? parseIsoDateToUtcDays(latestMondayISO)
    : null;

  const hasEnoughTrendData =
    benchPoints.length >= 2 || squatPoints.length >= 2 || deadliftPoints.length >= 2;

  const benchSummary = buildSingleLiftForecast(
    'bench',
    currentOneRm.bench,
    benchPoints,
    latestLoggedWeekDays,
    currentCycleWeek,
  );
  const squatSummary = buildSingleLiftForecast(
    'squat',
    currentOneRm.squat,
    squatPoints,
    latestLoggedWeekDays,
    currentCycleWeek,
  );
  const deadliftSummary = buildSingleLiftForecast(
    'deadlift',
    currentOneRm.deadlift,
    deadliftPoints,
    latestLoggedWeekDays,
    currentCycleWeek,
  );

  let runningBench = baseOneRm.bench;
  let runningSquat = baseOneRm.squat;
  let runningDeadlift = baseOneRm.deadlift;
  const totalHistoryPoints: ForecastHistoryPoint[] = allMondays.map((mondayISO) => {
    const b = weeklyBuckets.bench.get(mondayISO);
    const s = weeklyBuckets.squat.get(mondayISO);
    const d = weeklyBuckets.deadlift.get(mondayISO);
    if (typeof b === 'number') runningBench = b;
    if (typeof s === 'number') runningSquat = s;
    if (typeof d === 'number') runningDeadlift = d;

    const weekDays = parseIsoDateToUtcDays(mondayISO);
    return {
      dateISO: mondayISO,
      weekOffset:
        latestLoggedWeekDays !== null
          ? Math.round((weekDays - latestLoggedWeekDays) / 7)
          : 0,
      actualKg: roundToHalf(runningBench + runningSquat + runningDeadlift),
    };
  });

  const totalPoints: ForecastPoint[] = benchSummary.points.map((bp, index) => {
    const sp = squatSummary.points[index] ?? bp;
    const dp = deadliftSummary.points[index] ?? bp;

    return {
      weekOffset: bp.weekOffset,
      label: bp.label,
      cycleWeek: bp.cycleWeek,
      isDeloadWeek: bp.isDeloadWeek,
      projectedKg: roundToHalf(bp.projectedKg + sp.projectedKg + dp.projectedKg),
      lowerBoundKg: roundToHalf(bp.lowerBoundKg + sp.lowerBoundKg + dp.lowerBoundKg),
      upperBoundKg: roundToHalf(bp.upperBoundKg + sp.upperBoundKg + dp.upperBoundKg),
    };
  });

  const currentSbdTotalKg = roundToHalf(
    benchSummary.currentKg + squatSummary.currentKg + deadliftSummary.currentKg,
  );
  const totalWeek4 = totalPoints[4]?.projectedKg ?? currentSbdTotalKg;
  const totalWeek8 = totalPoints[8]?.projectedKg ?? currentSbdTotalKg;
  const totalWeek12 = totalPoints[12]?.projectedKg ?? currentSbdTotalKg;

  const totalSummary: LiftForecastSummary = {
    key: 'total',
    label: SERIES_LABELS.total,
    currentKg: currentSbdTotalKg,
    week4Kg: totalWeek4,
    week8Kg: totalWeek8,
    week12Kg: totalWeek12,
    delta12WeekKg: roundToHalf(totalWeek12 - currentSbdTotalKg),
    weeklySlopeKg: Number(
      (
        benchSummary.weeklySlopeKg +
        squatSummary.weeklySlopeKg +
        deadliftSummary.weeklySlopeKg
      ).toFixed(2),
    ),
    historyPoints: totalHistoryPoints,
    points: totalPoints,
  };

  return {
    currentOneRm,
    currentSbdTotalKg,
    projected12WeekSbdTotalKg: totalWeek12,
    dotsCurrent: calculateDotsScore(bodyweightKg, currentSbdTotalKg),
    dotsProjected12Week: calculateDotsScore(bodyweightKg, totalWeek12),
    hasEnoughTrendData,
    series: {
      total: totalSummary,
      bench: benchSummary,
      squat: squatSummary,
      deadlift: deadliftSummary,
    },
  };
}
