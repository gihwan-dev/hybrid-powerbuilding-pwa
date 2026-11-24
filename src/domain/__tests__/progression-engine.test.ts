import { describe, expect, it } from 'vitest';
import {
  applyHighCnsTrim,
  calculateBackoffWeight,
  prescribeSession,
  recalculateLiveBackoff,
} from '../progression-engine';
import { DEFAULT_USER_PROFILE } from '../routine-model-a';
import type { WeightSessionLog } from '../types';

function makeTueLog(
  weightKg: number,
  actualReps: number,
  rir: number | null,
  cycleWeek: 1 | 2 | 3 | 4 | 5 | 6 = 1,
): WeightSessionLog {
  return {
    id: `tue_${weightKg}_${actualReps}_${rir}`,
    dateISO: '2026-11-10',
    dayKey: 'tue',
    cycleWeek,
    title: '상체 A',
    exercises: [
      {
        exerciseId: 'bench_top',
        exerciseName: '벤치프레스 (탑세트)',
        role: 'top',
        liftKey: 'bench',
        usedAlternative: false,
        sets: [
          { setNumber: 1, weightKg, actualReps, rir, completed: true },
        ],
      },
      {
        exerciseId: 'bench_backoff',
        exerciseName: '벤치프레스 (백오프)',
        role: 'backoff',
        liftKey: 'bench',
        usedAlternative: false,
        sets: [1, 2, 3].map((setNumber) => ({
          setNumber,
          weightKg: 80,
          actualReps: 6,
          rir: 1.5,
          completed: true,
        })),
      },
      {
        exerciseId: 'incline_db_press',
        exerciseName: '인클라인 덤벨 프레스',
        role: 'accessory',
        usedAlternative: false,
        sets: [1, 2, 3].map((setNumber) => ({
          setNumber,
          weightKg: 28,
          actualReps: 7,
          rir: 1,
          completed: true,
        })),
      },
    ],
  };
}

describe('progression-engine', () => {
  it('calculates backoff weights rounded to 2.5kg', () => {
    expect(calculateBackoffWeight(90, 0.88)).toBe(80);
    expect(calculateBackoffWeight(122.5, 0.88)).toBe(107.5);
    expect(calculateBackoffWeight(55, 0.86)).toBe(47.5);
    expect(calculateBackoffWeight(142.5, 0.86)).toBe(122.5);
    expect(calculateBackoffWeight(0, 0.88)).toBe(0);
  });

  it('recalculates live backoff with -2.5kg fatigue trim when top set RIR === 0', () => {
    const normal = recalculateLiveBackoff({
      topWeightKg: 95,
      ratio: 0.88,
      actualTopRir: 2,
      defaultWeightKg: 80,
    });
    expect(normal.prescribedWeightKg).toBe(82.5); // roundTo2_5(83.6) = 82.5
    expect(normal.fatigueAdjusted).toBe(false);

    const fatigued = recalculateLiveBackoff({
      topWeightKg: 95,
      ratio: 0.88,
      actualTopRir: 0,
      defaultWeightKg: 80,
    });
    expect(fatigued.prescribedWeightKg).toBe(80); // 82.5 - 2.5 = 80
    expect(fatigued.fatigueAdjusted).toBe(true);
    expect(fatigued.badge).toBe('피로 조절 -2.5kg');
  });

  it('prescribes baseline Model A weights when no logs exist and scales with custom 1RM', () => {
    const defaultSession = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 1,
      weightLogs: [],
      baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
    });

    const benchTop = defaultSession.exercises.find((e) => e.definition.id === 'bench_top')!;
    const benchBackoff = defaultSession.exercises.find((e) => e.definition.id === 'bench_backoff')!;
    const inclineDb = defaultSession.exercises.find((e) => e.definition.id === 'incline_db_press')!;

    expect(benchTop.prescribedWeightKg).toBe(90);
    expect(benchBackoff.prescribedWeightKg).toBe(80);
    expect(inclineDb.prescribedWeightKg).toBe(28);

    const scaledSession = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 1,
      weightLogs: [],
      baseOneRm: { ...DEFAULT_USER_PROFILE.baseOneRm, bench: 120 },
    });

    const scaledTop = scaledSession.exercises.find((e) => e.definition.id === 'bench_top')!;
    const scaledBackoff = scaledSession.exercises.find((e) => e.definition.id === 'bench_backoff')!;
    expect(scaledTop.prescribedWeightKg).toBe(107.5); // roundTo2_5(90 * 1.2 = 108)
    expect(scaledBackoff.prescribedWeightKg).toBe(95); // roundTo2_5(107.5 * 0.88 = 94.6)
  });

  it('recommends +2.5kg when actualReps >= repsMax and rir >= 2 and updates paired backoff', () => {
    const session = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 2,
      weightLogs: [makeTueLog(90, 5, 2)],
      baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
    });

    const benchTop = session.exercises.find((e) => e.definition.id === 'bench_top')!;
    const benchBackoff = session.exercises.find((e) => e.definition.id === 'bench_backoff')!;

    expect(benchTop.prescribedWeightKg).toBe(92.5);
    expect(benchTop.progressionBadge).toBe('증량 추천 +2.5kg');
    expect(benchTop.progressionTone).toBe('increase');
    // Paired backoff updates to roundTo2_5(92.5 * 0.88 = 81.4) = 82.5
    expect(benchBackoff.prescribedWeightKg).toBe(82.5);
  });

  it('holds weight when RIR === 0 (even at repsMax) or actualReps < repsMin (RIR > 0)', () => {
    const rirZeroAtMax = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 2,
      weightLogs: [makeTueLog(90, 5, 0)],
      baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
    });
    const top1 = rirZeroAtMax.exercises.find((e) => e.definition.id === 'bench_top')!;
    expect(top1.prescribedWeightKg).toBe(90);
    expect(top1.progressionBadge).toBe('중량 유지 추천');
    expect(top1.progressionTone).toBe('hold');

    const underMinReps = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 2,
      weightLogs: [makeTueLog(90, 2, 1)],
      baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
    });
    const top2 = underMinReps.exercises.find((e) => e.definition.id === 'bench_top')!;
    expect(top2.prescribedWeightKg).toBe(90);
    expect(top2.progressionBadge).toBe('중량 유지 추천');

    // Keeps 28kg dumbbell intact without snapping to 27.5kg
    const inclineDb = underMinReps.exercises.find((e) => e.definition.id === 'incline_db_press')!;
    expect(inclineDb.prescribedWeightKg).toBe(28);
  });

  it('decreases weight by -2.5kg when RIR === 0 and actualReps < repsMin', () => {
    const session = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 3,
      weightLogs: [makeTueLog(92.5, 2, 0)],
      baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
    });

    const benchTop = session.exercises.find((e) => e.definition.id === 'bench_top')!;
    expect(benchTop.prescribedWeightKg).toBe(90);
    expect(benchTop.progressionBadge).toBe('피로 관리 -2.5kg');
    expect(benchTop.progressionTone).toBe('decrease');
  });

  it('supports liveTopSets override for immediate backoff recalculation', () => {
    const session = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 3,
      weightLogs: [makeTueLog(90, 4, 1.5)],
      baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
      liveTopSets: {
        bench_top: { weightKg: 95, rir: 0 },
      },
    });

    const benchBackoff = session.exercises.find((e) => e.definition.id === 'bench_backoff')!;
    expect(benchBackoff.prescribedWeightKg).toBe(80);
    expect(benchBackoff.progressionBadge).toBe('피로 조절 -2.5kg');
  });

  it('applies Week 6 deload: keeps weights, omits backoff, sets top 1 set RIR 3~4, cuts accessories ~50% max 2 sets', () => {
    const deload = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 6,
      weightLogs: [makeTueLog(90, 5, 2)],
      baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
    });

    expect(deload.isDeloadWeek).toBe(true);
    expect(deload.exercises.some((e) => e.definition.role === 'backoff')).toBe(false);

    const benchTop = deload.exercises.find((e) => e.definition.id === 'bench_top')!;
    expect(benchTop.prescribedWeightKg).toBe(90); // Keeps working weight instead of +2.5kg jump
    expect(benchTop.sets).toBe(1);
    expect(benchTop.targetRirMin).toBe(3);
    expect(benchTop.targetRirMax).toBe(4);
    expect(benchTop.isDeloadAdjusted).toBe(true);

    const pendlayRow = deload.exercises.find((e) => e.definition.id === 'pendlay_row')!;
    expect(pendlayRow.sets).toBe(2); // 4 -> 2

    const inclineDb = deload.exercises.find((e) => e.definition.id === 'incline_db_press')!;
    expect(inclineDb.sets).toBe(2); // 3 * 0.5 rounded = 2, capped at 2
  });

  it('trims backoff sets by 1 (minimum 1) on applyHighCnsTrim', () => {
    const tueSession = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 3,
      weightLogs: [],
      baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
    });
    const trimmedTue = applyHighCnsTrim(tueSession);
    expect(trimmedTue.cnsTrimApplied).toBe(true);
    const benchBackoff = trimmedTue.exercises.find((e) => e.definition.id === 'bench_backoff')!;
    expect(benchBackoff.sets).toBe(2); // 3 -> 2
    expect(benchBackoff.progressionBadge).toBe('CNS 백오프 -1세트');

    // Trimming a 1-set backoff should stay at 1
    const doubleTrimmed = applyHighCnsTrim(applyHighCnsTrim(trimmedTue));
    const floorBackoff = doubleTrimmed.exercises.find((e) => e.definition.id === 'bench_backoff')!;
    expect(floorBackoff.sets).toBe(1);
  });

  it('switches to alternative exercise when preferAlternatives is enabled', () => {
    const session = prescribeSession({
      dayKey: 'tue',
      cycleWeek: 2,
      weightLogs: [],
      baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
      preferAlternatives: { pendlay_row: true },
    });

    const row = session.exercises.find((e) => e.definition.id === 'pendlay_row')!;
    expect(row.usedAlternative).toBe(true);
    expect(row.activeName).toBe('체스트 서포티드 로우');
    expect(row.prescribedWeightKg).toBe(50);
  });
});
