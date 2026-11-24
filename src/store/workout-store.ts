import { create } from 'zustand';
import { buildDemoSeedState } from '../domain/demo-seed';
import { calculateE1rm, extractCurrentLiftE1rms } from '../domain/e1rm-engine';
import { getDayKeyFromIsoDate } from '../domain/fatigue-engine';
import { clamp, roundToHalf } from '../domain/math';
import {
  applyHighCnsTrim,
  prescribeSession,
  recalculateLiveBackoff,
} from '../domain/progression-engine';
import {
  DEFAULT_USER_PROFILE,
  findExerciseById,
  scaleInitialWeightForOneRm,
} from '../domain/routine-model-a';
import type {
  CompletedSetLog,
  CycleWeek,
  DayKey,
  F45SessionLog,
  LiftKey,
  LowerBodyImpact,
  OneRmMap,
  PrescribedExercise,
  RecoveryCheckLog,
  UserProfile,
  WeightExerciseLog,
  WeightSessionLog,
} from '../domain/types';
import {
  IsoDateSchema,
  PersistedAppStateSchema,
  type ActiveExerciseState,
  type ActiveSetDraft,
  type ActiveWorkoutSession,
  type AppSettings,
  type LastCompletedSummary,
  type PersistedAppState,
  type RestTimerState,
  type SessionPointer,
} from './schemas';

export const STORAGE_KEY = 'apex400_state_v1';
export const CORRUPTED_BACKUP_KEY = 'apex400_corrupted_backup';

const LIFT_LABELS: Record<LiftKey, string> = {
  bench: '벤치프레스',
  squat: '백 스쿼트',
  deadlift: '데드리프트',
  ohp: 'OHP',
};

const EMPTY_REST_TIMER: RestTimerState = {
  targetEndTimeMs: null,
  totalSeconds: 0,
  nextSetPreview: null,
};

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  geminiApiKey: '',
  preferAlternatives: {},
};

export function getLocalTodayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cloneDefaultProfile(): UserProfile {
  return {
    ...DEFAULT_USER_PROFILE,
    baseOneRm: { ...DEFAULT_USER_PROFILE.baseOneRm },
  };
}

function cloneSettings(settings?: AppSettings): AppSettings {
  const source = settings ?? DEFAULT_SETTINGS;
  return {
    soundEnabled: source.soundEnabled,
    vibrationEnabled: source.vibrationEnabled,
    geminiApiKey: source.geminiApiKey,
    preferAlternatives: { ...source.preferAlternatives },
  };
}

function buildDefaultDemoPersistedState(
  todayISO: string,
  settings?: AppSettings,
): PersistedAppState {
  const seeded = buildDemoSeedState(todayISO);
  return {
    schemaVersion: 1,
    isDemoMode: true,
    currentCycleWeek: seeded.currentCycleWeek,
    selectedDayOverride: null,
    pendingCnsTrimForDay: null,
    userProfile: seeded.userProfile,
    weightLogs: seeded.weightLogs,
    f45Logs: seeded.f45Logs,
    recoveryLogs: seeded.recoveryLogs,
    activeSession: null,
    lastCompletedSummary: null,
    settings: cloneSettings(settings),
  };
}

function buildCleanPersistedState(settings?: AppSettings): PersistedAppState {
  return {
    schemaVersion: 1,
    isDemoMode: false,
    currentCycleWeek: 1,
    selectedDayOverride: null,
    pendingCnsTrimForDay: null,
    userProfile: cloneDefaultProfile(),
    weightLogs: [],
    f45Logs: [],
    recoveryLogs: [],
    activeSession: null,
    lastCompletedSummary: null,
    settings: cloneSettings(settings),
  };
}

function resolveDefaultStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function safeWriteStorage(
  storage: Storage | null,
  key: string,
  value: string,
): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage quota or private browsing write failures
  }
}

function extractPersistedState(state: PersistedAppState): PersistedAppState {
  return {
    schemaVersion: 1,
    isDemoMode: state.isDemoMode,
    currentCycleWeek: state.currentCycleWeek,
    selectedDayOverride: state.selectedDayOverride,
    pendingCnsTrimForDay: state.pendingCnsTrimForDay,
    userProfile: state.userProfile,
    weightLogs: state.weightLogs,
    f45Logs: state.f45Logs,
    recoveryLogs: state.recoveryLogs,
    activeSession: state.activeSession,
    lastCompletedSummary: state.lastCompletedSummary,
    settings: state.settings,
  };
}

function persistState(storage: Storage | null, state: PersistedAppState): void {
  const payload = extractPersistedState(state);
  safeWriteStorage(storage, STORAGE_KEY, JSON.stringify(payload));
}

function loadInitialPersistedState(
  storage: Storage | null,
  todayISO: string,
): PersistedAppState {
  if (!storage) {
    return buildDefaultDemoPersistedState(todayISO);
  }

  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return buildDefaultDemoPersistedState(todayISO);
  }

  if (raw === null) {
    const seeded = buildDefaultDemoPersistedState(todayISO);
    persistState(storage, seeded);
    return seeded;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const validated = PersistedAppStateSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
  } catch {
    // Corrupted JSON falls through to backup + fallback
  }

  safeWriteStorage(storage, CORRUPTED_BACKUP_KEY, raw);
  const fallback = buildDefaultDemoPersistedState(todayISO);
  persistState(storage, fallback);
  return fallback;
}

function createSessionId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

function buildActiveExerciseFromPrescribed(
  ex: PrescribedExercise,
): ActiveExerciseState {
  const def = ex.definition;
  const defaultReps =
    def.role === 'top'
      ? ex.repsMin
      : Math.round((ex.repsMin + ex.repsMax) / 2);
  const defaultDistance =
    ex.activeUnit === 'kg_meters' ? (def.distanceMeters ?? 25) : undefined;

  const sets: ActiveSetDraft[] = Array.from(
    { length: ex.sets },
    (_, index) => ({
      setNumber: index + 1,
      weightKg: ex.prescribedWeightKg,
      reps: defaultReps,
      ...(defaultDistance !== undefined ? { distanceMeters: defaultDistance } : {}),
      rir: null,
      completed: false,
      skipped: false,
    }),
  );

  return {
    exerciseId: def.id,
    activeName: ex.activeName,
    usedAlternative: ex.usedAlternative,
    role: def.role,
    ...(def.liftKey !== undefined ? { liftKey: def.liftKey } : {}),
    ...(def.pairedTopExerciseId !== undefined
      ? { pairedTopExerciseId: def.pairedTopExerciseId }
      : {}),
    ...(def.backoffRatio !== undefined
      ? { backoffRatio: def.backoffRatio }
      : {}),
    activeEquipment: ex.activeEquipment,
    activeUnit: ex.activeUnit,
    repsMin: ex.repsMin,
    repsMax: ex.repsMax,
    targetRirMin: ex.targetRirMin,
    targetRirMax: ex.targetRirMax,
    skipRir: ex.skipRir,
    restSeconds: def.restSeconds,
    progressionBadge: ex.progressionBadge,
    progressionReason: ex.progressionReason,
    lastSessionSummary: ex.lastSessionSummary,
    sets,
  };
}

function isSetOpen(set: ActiveSetDraft | undefined): boolean {
  return Boolean(set && !set.completed && !set.skipped);
}

function findNextIncompletePointer(
  exercises: ActiveExerciseState[],
  afterPointer: SessionPointer,
): SessionPointer | null {
  for (let exIdx = afterPointer.exerciseIndex; exIdx < exercises.length; exIdx += 1) {
    const ex = exercises[exIdx];
    if (!ex) continue;
    const startSetIdx =
      exIdx === afterPointer.exerciseIndex ? afterPointer.setIndex + 1 : 0;
    for (let setIdx = startSetIdx; setIdx < ex.sets.length; setIdx += 1) {
      if (isSetOpen(ex.sets[setIdx])) {
        return { exerciseIndex: exIdx, setIndex: setIdx };
      }
    }
  }

  for (let exIdx = 0; exIdx <= afterPointer.exerciseIndex; exIdx += 1) {
    const ex = exercises[exIdx];
    if (!ex) continue;
    const maxSetIdx =
      exIdx === afterPointer.exerciseIndex
        ? afterPointer.setIndex
        : ex.sets.length;
    for (let setIdx = 0; setIdx < maxSetIdx; setIdx += 1) {
      if (isSetOpen(ex.sets[setIdx])) {
        return { exerciseIndex: exIdx, setIndex: setIdx };
      }
    }
  }

  return null;
}

function formatNextSetPreview(
  exercise: ActiveExerciseState,
  setIndex: number,
): string {
  const nextSet = exercise.sets[setIndex];
  if (!nextSet) {
    return `다음 세트: ${exercise.activeName} ${setIndex + 1}세트`;
  }

  let detail = '';
  if (exercise.activeUnit === 'kg_meters') {
    detail = `${nextSet.weightKg}kg × ${nextSet.distanceMeters ?? 25}m`;
  } else if (exercise.activeUnit === 'kg_added') {
    const weightLabel = nextSet.weightKg > 0 ? `+${nextSet.weightKg}kg` : '맨몸';
    detail = `${weightLabel} × ${nextSet.reps}회`;
  } else {
    detail = `${nextSet.weightKg}kg × ${nextSet.reps}회`;
  }

  return `다음 세트: ${exercise.activeName} ${setIndex + 1}세트 (${detail})`;
}

function extractHistoricalMaxLiftE1rms(
  weightLogs: WeightSessionLog[],
  baseOneRm: OneRmMap,
): OneRmMap {
  const maxByLift: OneRmMap = { ...baseOneRm };
  for (const log of weightLogs) {
    for (const ex of log.exercises) {
      if (!ex.liftKey || ex.role === 'primer') continue;
      for (const s of ex.sets) {
        if (!s.completed || s.weightKg <= 0 || s.actualReps <= 0) continue;
        const e1rm =
          typeof s.e1rmKg === 'number' && s.e1rmKg > 0
            ? roundToHalf(s.e1rmKg)
            : calculateE1rm(s.weightKg, s.actualReps, s.rir ?? 0);
        if (e1rm > maxByLift[ex.liftKey]) {
          maxByLift[ex.liftKey] = e1rm;
        }
      }
    }
  }
  return maxByLift;
}

function recalculateSiblingBackoffs(
  exercises: ActiveExerciseState[],
  topExerciseId: string,
  topWeightKg: number,
  topRir: number | null,
  baseOneRm: OneRmMap,
): ActiveExerciseState[] {
  return exercises.map((ex) => {
    if (ex.pairedTopExerciseId !== topExerciseId) {
      return ex;
    }
    const def = findExerciseById(ex.exerciseId);
    const ratio = ex.backoffRatio ?? def?.backoffRatio;
    if (!ratio || ratio <= 0) {
      return ex;
    }

    const defaultWeightKg = def
      ? scaleInitialWeightForOneRm(def, baseOneRm)
      : (ex.sets[0]?.weightKg ?? 0);

    const recalc = recalculateLiveBackoff({
      topWeightKg,
      ratio,
      actualTopRir: topRir,
      defaultWeightKg,
    });

    return {
      ...ex,
      progressionBadge: recalc.badge,
      progressionReason: recalc.reason,
      sets: ex.sets.map((set) =>
        !set.completed && !set.skipped
          ? { ...set, weightKg: recalc.prescribedWeightKg }
          : set,
      ),
    };
  });
}

function refreshRestPreview(
  restTimer: RestTimerState,
  exercises: ActiveExerciseState[],
  pointer: SessionPointer,
): RestTimerState {
  if (restTimer.targetEndTimeMs === null) {
    return restTimer;
  }
  const nextEx = exercises[pointer.exerciseIndex];
  return {
    ...restTimer,
    nextSetPreview: nextEx
      ? formatNextSetPreview(nextEx, pointer.setIndex)
      : restTimer.nextSetPreview,
  };
}

function buildFinalizedSessionPatch(
  state: PersistedAppState,
  activeSession: ActiveWorkoutSession,
): Partial<PersistedAppState> & { isWorkoutOverlayOpen: boolean } {
  const weightExercises: WeightExerciseLog[] = [];
  let completedSetCount = 0;
  let totalTonnage = 0;

  for (const ex of activeSession.exercises) {
    const completedSets: CompletedSetLog[] = [];
    for (const set of ex.sets) {
      if (!set.completed || set.skipped) continue;
      completedSetCount += 1;
      if (ex.activeUnit !== 'kg_meters') {
        const weightMultiplier = ex.activeUnit === 'kg_per_hand' ? 2 : 1;
        totalTonnage += set.weightKg * weightMultiplier * set.reps;
      }

      completedSets.push({
        setNumber: set.setNumber,
        weightKg: set.weightKg,
        actualReps: set.reps,
        ...(set.distanceMeters !== undefined
          ? { distanceMeters: set.distanceMeters }
          : {}),
        rir: set.rir,
        completed: true,
        ...(set.e1rmKg !== undefined ? { e1rmKg: set.e1rmKg } : {}),
      });
    }

    if (completedSets.length > 0) {
      const def = findExerciseById(ex.exerciseId);
      weightExercises.push({
        exerciseId: ex.exerciseId,
        exerciseName: def?.name ?? ex.activeName,
        role: ex.role,
        ...(ex.liftKey !== undefined ? { liftKey: ex.liftKey } : {}),
        usedAlternative: ex.usedAlternative,
        ...(ex.usedAlternative ? { alternativeName: ex.activeName } : {}),
        sets: completedSets,
      });
    }
  }

  if (completedSetCount === 0) {
    return {
      activeSession: null,
      isWorkoutOverlayOpen: false,
    };
  }

  const durationMinutes = Math.max(
    1,
    Math.round((Date.now() - activeSession.startedAtMs) / 60_000),
  );

  const sessionLog: WeightSessionLog = {
    id: activeSession.id,
    dateISO: activeSession.dateISO,
    dayKey: activeSession.dayKey,
    cycleWeek: activeSession.cycleWeek,
    title: activeSession.title,
    durationMinutes,
    exercises: weightExercises,
  };

  const historicalPeakOneRm = extractHistoricalMaxLiftE1rms(
    state.weightLogs,
    state.userProfile.baseOneRm,
  );
  const sessionPeakOneRm = extractHistoricalMaxLiftE1rms(
    [sessionLog],
    { bench: 0, squat: 0, deadlift: 0, ohp: 0 },
  );
  const nextWeightLogs = [...state.weightLogs, sessionLog];
  const updatedOneRm = extractCurrentLiftE1rms(
    nextWeightLogs,
    state.userProfile.baseOneRm,
  );

  const newPrLabels: string[] = [];
  (['bench', 'squat', 'deadlift', 'ohp'] as const).forEach((lift) => {
    if (sessionPeakOneRm[lift] > historicalPeakOneRm[lift]) {
      newPrLabels.push(`${LIFT_LABELS[lift]} e1RM ${sessionPeakOneRm[lift]}kg`);
    }
  });

  const sbdTotalKg = roundToHalf(
    updatedOneRm.bench + updatedOneRm.squat + updatedOneRm.deadlift,
  );

  const summary: LastCompletedSummary = {
    sessionId: sessionLog.id,
    dateISO: sessionLog.dateISO,
    dayKey: sessionLog.dayKey,
    title: sessionLog.title,
    tonnageKg: Math.round(totalTonnage),
    completedSetCount,
    durationMinutes,
    newPrLabels,
    updatedOneRm,
    sbdTotalKg,
  };

  return {
    weightLogs: nextWeightLogs,
    activeSession: null,
    pendingCnsTrimForDay: null,
    lastCompletedSummary: summary,
    isWorkoutOverlayOpen: false,
  };
}

function commitSetWithRir(
  state: WorkoutStoreState,
  pointer: SessionPointer,
  rir: number | null,
): Partial<WorkoutStoreState> {
  const session = state.activeSession;
  if (!session) return {};

  const targetExercise = session.exercises[pointer.exerciseIndex];
  const targetSet = targetExercise?.sets[pointer.setIndex];
  if (!targetExercise || !targetSet || targetSet.completed || targetSet.skipped) {
    return {};
  }

  const safeRir =
    targetExercise.skipRir || rir === null
      ? null
      : Number.isFinite(rir)
        ? clamp(Number(rir.toFixed(1)), 0, 10)
        : 0;

  const computedE1rm =
    targetExercise.liftKey &&
    !targetExercise.skipRir &&
    targetSet.weightKg > 0 &&
    targetSet.reps > 0
      ? calculateE1rm(targetSet.weightKg, targetSet.reps, safeRir ?? 0)
      : undefined;

  let nextExercises = session.exercises.map((ex, exIdx) => {
    if (exIdx !== pointer.exerciseIndex) return ex;
    return {
      ...ex,
      sets: ex.sets.map((s, setIdx) => {
        if (setIdx !== pointer.setIndex) return s;
        return {
          ...s,
          completed: true,
          skipped: false,
          rir: safeRir,
          ...(computedE1rm !== undefined ? { e1rmKg: computedE1rm } : {}),
        };
      }),
    };
  });

  if (targetExercise.role === 'top') {
    nextExercises = recalculateSiblingBackoffs(
      nextExercises,
      targetExercise.exerciseId,
      targetSet.weightKg,
      safeRir,
      state.userProfile.baseOneRm,
    );
  }

  const nextPointer = findNextIncompletePointer(nextExercises, pointer);

  if (!nextPointer) {
    const updatedSession: ActiveWorkoutSession = {
      ...session,
      exercises: nextExercises,
      awaitingRirForPointer: null,
      restTimer: { ...EMPTY_REST_TIMER },
    };
    return buildFinalizedSessionPatch(state, updatedSession);
  }

  const nextExercise = nextExercises[nextPointer.exerciseIndex];
  const restSeconds = Math.max(0, targetExercise.restSeconds);
  const restTimer: RestTimerState =
    restSeconds > 0
      ? {
          targetEndTimeMs: Date.now() + restSeconds * 1000,
          totalSeconds: restSeconds,
          nextSetPreview: nextExercise
            ? formatNextSetPreview(nextExercise, nextPointer.setIndex)
            : null,
        }
      : { ...EMPTY_REST_TIMER };

  return {
    activeSession: {
      ...session,
      exercises: nextExercises,
      currentPointer: nextPointer,
      awaitingRirForPointer: null,
      restTimer,
    },
  };
}

export interface StartWorkoutOptions {
  applyCnsTrim?: boolean;
  dateISO?: string;
}

export interface SetDraftPatch {
  weightKg?: number;
  reps?: number;
  distanceMeters?: number;
}

export interface LogF45Input {
  dateISO: string;
  dayKey?: DayKey;
  classTitle: string;
  rpe: number;
  lowerBodyImpact: LowerBodyImpact;
  durationMinutes?: number;
  note?: string;
}

export interface WorkoutStoreActions {
  selectDay: (dayKey: DayKey | null) => void;
  togglePendingCnsTrim: (dayKey: DayKey) => void;
  startWorkout: (dayKey: DayKey, options?: StartWorkoutOptions) => void;
  updateSetDraft: (
    exerciseIndex: number,
    setIndex: number,
    patch: SetDraftPatch,
  ) => void;
  tapCompleteCurrentSet: () => void;
  confirmCurrentSetRir: (rir: number) => void;
  cancelPendingRir: () => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  skipRestTimer: () => void;
  expireRestTimer: () => void;
  jumpToSet: (exerciseIndex: number, setIndex: number) => void;
  skipSet: (exerciseIndex: number, setIndex: number) => void;
  addExtraSet: (exerciseIndex: number) => void;
  swapExerciseAlternative: (exerciseIndex: number) => void;
  toggleWarmupCheck: (exerciseId: string, setNumber: number) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  discardActiveWorkout: () => void;
  finishWorkout: () => void;
  dismissCompletedSummary: () => void;
  logF45Session: (input: LogF45Input) => void;
  toggleRecoveryCheckItem: (dateISO: string, itemId: string) => void;
  loadDemoData: () => void;
  resetToLiveCleanState: () => void;
  updateUserProfile: (patch: Partial<Omit<UserProfile, 'baseOneRm'>>) => void;
  updateBaseOneRm: (patch: Partial<OneRmMap>) => void;
  setCycleWeek: (week: CycleWeek) => void;
  advanceToNextCycle: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  exportBackupJson: () => string;
  importBackupJson: (
    rawJson: string,
  ) => { ok: true } | { ok: false; error: string };
}

export interface WorkoutStoreState extends PersistedAppState {
  isWorkoutOverlayOpen: boolean;
}

export type WorkoutStore = WorkoutStoreState & WorkoutStoreActions;

export function createWorkoutStore(customStorage?: Storage | null) {
  const storage =
    customStorage === undefined ? resolveDefaultStorage() : customStorage;
  const initialPersisted = loadInitialPersistedState(storage, getLocalTodayIso());

  return create<WorkoutStore>()((set, get) => {
    const commitPersisted = (
      updater: (
        state: WorkoutStore,
      ) => Partial<WorkoutStoreState> | null | undefined,
    ) => {
      let updatedState: WorkoutStore | null = null;
      set((prev) => {
        const patch = updater(prev);
        if (!patch || Object.keys(patch).length === 0) {
          return prev;
        }
        updatedState = { ...prev, ...patch };
        return patch;
      });
      if (updatedState) {
        persistState(storage, updatedState);
      }
    };

    return {
      ...initialPersisted,
      isWorkoutOverlayOpen: false,

      selectDay: (dayKey) => {
        commitPersisted(() => ({ selectedDayOverride: dayKey }));
      },

      togglePendingCnsTrim: (dayKey) => {
        commitPersisted((state) => ({
          pendingCnsTrimForDay:
            state.pendingCnsTrimForDay === dayKey ? null : dayKey,
        }));
      },

      startWorkout: (dayKey, options) => {
        commitPersisted((state) => {
          const prescribed = prescribeSession({
            dayKey,
            cycleWeek: state.currentCycleWeek,
            weightLogs: state.weightLogs,
            baseOneRm: state.userProfile.baseOneRm,
            preferAlternatives: state.settings.preferAlternatives,
          });

          if (prescribed.exercises.length === 0) {
            return null;
          }

          const shouldTrim =
            options?.applyCnsTrim ?? state.pendingCnsTrimForDay === dayKey;
          const finalPrescribed = shouldTrim
            ? applyHighCnsTrim(prescribed)
            : prescribed;

          const activeExercises = finalPrescribed.exercises.map(
            buildActiveExerciseFromPrescribed,
          );

          const validDate = options?.dateISO
            ? IsoDateSchema.safeParse(options.dateISO)
            : null;
          const dateISO = validDate?.success ? validDate.data : getLocalTodayIso();

          const activeSession: ActiveWorkoutSession = {
            id: createSessionId('session'),
            dayKey,
            dateISO,
            title: finalPrescribed.title,
            startedAtMs: Date.now(),
            cycleWeek: state.currentCycleWeek,
            cnsTrimApplied: finalPrescribed.cnsTrimApplied,
            exercises: activeExercises,
            checkedWarmupSteps: {},
            currentPointer: { exerciseIndex: 0, setIndex: 0 },
            awaitingRirForPointer: null,
            restTimer: { ...EMPTY_REST_TIMER },
          };

          return {
            activeSession,
            lastCompletedSummary: null,
            isWorkoutOverlayOpen: true,
          };
        });
      },

      updateSetDraft: (exerciseIndex, setIndex, patch) => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session) return null;

          const exercise = session.exercises[exerciseIndex];
          const targetSet = exercise?.sets[setIndex];
          if (!exercise || !targetSet) return null;

          const nextWeight =
            patch.weightKg !== undefined && Number.isFinite(patch.weightKg)
              ? Math.max(0, Number(patch.weightKg.toFixed(2)))
              : targetSet.weightKg;
          const nextReps =
            patch.reps !== undefined && Number.isFinite(patch.reps)
              ? Math.max(0, Math.round(patch.reps))
              : targetSet.reps;
          const nextDistance =
            patch.distanceMeters !== undefined &&
            Number.isFinite(patch.distanceMeters)
              ? Math.max(0, Math.round(patch.distanceMeters))
              : targetSet.distanceMeters;

          const shouldComputeE1rm =
            targetSet.completed &&
            Boolean(exercise.liftKey) &&
            !exercise.skipRir &&
            nextWeight > 0 &&
            nextReps > 0;
          const nextE1rm = shouldComputeE1rm
            ? calculateE1rm(nextWeight, nextReps, targetSet.rir ?? 0)
            : undefined;

          let nextExercises = session.exercises.map((ex, exIdx) => {
            if (exIdx !== exerciseIndex) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s, sIdx) => {
                if (sIdx !== setIndex) return s;
                const { e1rmKg: _oldE1rm, ...restSet } = s;
                return {
                  ...restSet,
                  weightKg: nextWeight,
                  reps: nextReps,
                  ...(nextDistance !== undefined
                    ? { distanceMeters: nextDistance }
                    : {}),
                  ...(nextE1rm !== undefined ? { e1rmKg: nextE1rm } : {}),
                };
              }),
            };
          });

          if (targetSet.completed && exercise.role === 'top') {
            nextExercises = recalculateSiblingBackoffs(
              nextExercises,
              exercise.exerciseId,
              nextWeight,
              targetSet.rir,
              state.userProfile.baseOneRm,
            );
          }

          return {
            activeSession: {
              ...session,
              exercises: nextExercises,
              restTimer: refreshRestPreview(
                session.restTimer,
                nextExercises,
                session.currentPointer,
              ),
            },
          };
        });
      },

      tapCompleteCurrentSet: () => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session) return null;

          const pointer = session.currentPointer;
          const exercise = session.exercises[pointer.exerciseIndex];
          const currentSet = exercise?.sets[pointer.setIndex];
          if (!exercise || !isSetOpen(currentSet)) {
            return null;
          }

          if (exercise.skipRir) {
            return commitSetWithRir(state, pointer, null);
          }

          return {
            activeSession: {
              ...session,
              awaitingRirForPointer: { ...pointer },
            },
          };
        });
      },

      confirmCurrentSetRir: (rir) => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session) return null;
          const pointer =
            session.awaitingRirForPointer ?? session.currentPointer;
          return commitSetWithRir(state, pointer, rir);
        });
      },

      cancelPendingRir: () => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session || session.awaitingRirForPointer === null) return null;
          return {
            activeSession: {
              ...session,
              awaitingRirForPointer: null,
            },
          };
        });
      },

      adjustRestTimer: (deltaSeconds) => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (
            !session ||
            session.restTimer.targetEndTimeMs === null ||
            !Number.isFinite(deltaSeconds)
          ) {
            return null;
          }

          const safeDelta = Math.round(deltaSeconds);
          const nextEndMs =
            session.restTimer.targetEndTimeMs + safeDelta * 1000;
          if (nextEndMs <= Date.now()) {
            return {
              activeSession: {
                ...session,
                restTimer: { ...EMPTY_REST_TIMER },
              },
            };
          }

          const remaining = Math.ceil((nextEndMs - Date.now()) / 1000);
          const nextTotalSeconds = Math.max(
            remaining,
            session.restTimer.totalSeconds + safeDelta,
            1,
          );

          return {
            activeSession: {
              ...session,
              restTimer: {
                ...session.restTimer,
                targetEndTimeMs: nextEndMs,
                totalSeconds: nextTotalSeconds,
              },
            },
          };
        });
      },

      skipRestTimer: () => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session || session.restTimer.targetEndTimeMs === null) {
            return null;
          }
          return {
            activeSession: {
              ...session,
              restTimer: { ...EMPTY_REST_TIMER },
            },
          };
        });
      },

      expireRestTimer: () => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session || session.restTimer.targetEndTimeMs === null) {
            return null;
          }
          return {
            activeSession: {
              ...session,
              restTimer: { ...EMPTY_REST_TIMER },
            },
          };
        });
      },

      jumpToSet: (exerciseIndex, setIndex) => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session) return null;
          const target = session.exercises[exerciseIndex]?.sets[setIndex];
          if (!target) return null;

          return {
            activeSession: {
              ...session,
              currentPointer: { exerciseIndex, setIndex },
              awaitingRirForPointer: null,
            },
          };
        });
      },

      skipSet: (exerciseIndex, setIndex) => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session) return null;
          const target = session.exercises[exerciseIndex]?.sets[setIndex];
          if (!target) return null;

          const nextExercises = session.exercises.map((ex, exIdx) => {
            if (exIdx !== exerciseIndex) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s, sIdx) => {
                if (sIdx !== setIndex) return s;
                const { e1rmKg: _removedE1rm, ...restSet } = s;
                return {
                  ...restSet,
                  completed: false,
                  skipped: true,
                  rir: null,
                };
              }),
            };
          });

          const nextOpen = findNextIncompletePointer(nextExercises, {
            exerciseIndex,
            setIndex,
          });

          if (!nextOpen) {
            const finalizedSession: ActiveWorkoutSession = {
              ...session,
              exercises: nextExercises,
              awaitingRirForPointer: null,
              restTimer: { ...EMPTY_REST_TIMER },
            };
            return buildFinalizedSessionPatch(state, finalizedSession);
          }

          const currentEx =
            nextExercises[session.currentPointer.exerciseIndex];
          const currentSet = currentEx?.sets[session.currentPointer.setIndex];
          const shouldMovePointer =
            (session.currentPointer.exerciseIndex === exerciseIndex &&
              session.currentPointer.setIndex === setIndex) ||
            !isSetOpen(currentSet);
          const resolvedPointer = shouldMovePointer
            ? nextOpen
            : session.currentPointer;

          return {
            activeSession: {
              ...session,
              exercises: nextExercises,
              currentPointer: resolvedPointer,
              awaitingRirForPointer: null,
              restTimer: refreshRestPreview(
                session.restTimer,
                nextExercises,
                resolvedPointer,
              ),
            },
          };
        });
      },

      addExtraSet: (exerciseIndex) => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session) return null;
          const targetExercise = session.exercises[exerciseIndex];
          if (!targetExercise) return null;

          const lastSet = targetExercise.sets[targetExercise.sets.length - 1];
          const newSet: ActiveSetDraft = {
            setNumber: targetExercise.sets.length + 1,
            weightKg: lastSet?.weightKg ?? 0,
            reps: lastSet?.reps ?? targetExercise.repsMin,
            ...(lastSet?.distanceMeters !== undefined
              ? { distanceMeters: lastSet.distanceMeters }
              : {}),
            rir: null,
            completed: false,
            skipped: false,
          };

          const nextExercises = session.exercises.map((ex, exIdx) =>
            exIdx === exerciseIndex
              ? { ...ex, sets: [...ex.sets, newSet] }
              : ex,
          );

          return {
            activeSession: {
              ...session,
              exercises: nextExercises,
            },
          };
        });
      },

      swapExerciseAlternative: (exerciseIndex) => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session) return null;

          const targetExercise = session.exercises[exerciseIndex];
          if (!targetExercise) return null;

          const def = findExerciseById(targetExercise.exerciseId);
          if (!def?.alternative) return null;

          const nextUseAlt = !targetExercise.usedAlternative;
          const nextPreferAlternatives: Record<string, boolean> = {
            ...state.settings.preferAlternatives,
            [targetExercise.exerciseId]: nextUseAlt,
          };

          let prescribed = prescribeSession({
            dayKey: session.dayKey,
            cycleWeek: session.cycleWeek,
            weightLogs: state.weightLogs,
            baseOneRm: state.userProfile.baseOneRm,
            preferAlternatives: nextPreferAlternatives,
          });
          if (session.cnsTrimApplied) {
            prescribed = applyHighCnsTrim(prescribed);
          }

          const matchedPrescribed = prescribed.exercises.find(
            (item) => item.definition.id === targetExercise.exerciseId,
          );
          if (!matchedPrescribed) return null;

          const nextExercises = session.exercises.map((ex, idx) => {
            if (idx !== exerciseIndex) return ex;
            return {
              ...ex,
              activeName: matchedPrescribed.activeName,
              usedAlternative: matchedPrescribed.usedAlternative,
              activeEquipment: matchedPrescribed.activeEquipment,
              activeUnit: matchedPrescribed.activeUnit,
              progressionBadge: matchedPrescribed.progressionBadge,
              progressionReason: matchedPrescribed.progressionReason,
              lastSessionSummary: matchedPrescribed.lastSessionSummary,
              sets: ex.sets.map((s) =>
                !s.completed && !s.skipped
                  ? { ...s, weightKg: matchedPrescribed.prescribedWeightKg }
                  : s,
              ),
            };
          });

          return {
            activeSession: {
              ...session,
              exercises: nextExercises,
              restTimer: refreshRestPreview(
                session.restTimer,
                nextExercises,
                session.currentPointer,
              ),
            },
            settings: {
              ...state.settings,
              preferAlternatives: nextPreferAlternatives,
            },
          };
        });
      },

      toggleWarmupCheck: (exerciseId, setNumber) => {
        commitPersisted((state) => {
          const session = state.activeSession;
          if (!session) return null;

          const existing = session.checkedWarmupSteps[exerciseId] ?? [];
          const hasStep = existing.includes(setNumber);
          const nextSteps = hasStep
            ? existing.filter((step) => step !== setNumber)
            : [...existing, setNumber].sort((a, b) => a - b);

          return {
            activeSession: {
              ...session,
              checkedWarmupSteps: {
                ...session.checkedWarmupSteps,
                [exerciseId]: nextSteps,
              },
            },
          };
        });
      },

      pauseWorkout: () => {
        set({ isWorkoutOverlayOpen: false });
      },

      resumeWorkout: () => {
        if (!get().activeSession) return;
        set({ isWorkoutOverlayOpen: true });
      },

      discardActiveWorkout: () => {
        commitPersisted((state) => {
          if (!state.activeSession && !state.isWorkoutOverlayOpen) return null;
          return {
            activeSession: null,
            isWorkoutOverlayOpen: false,
          };
        });
      },

      finishWorkout: () => {
        commitPersisted((state) => {
          if (!state.activeSession) return null;
          return buildFinalizedSessionPatch(state, state.activeSession);
        });
      },

      dismissCompletedSummary: () => {
        commitPersisted((state) => {
          if (!state.lastCompletedSummary) return null;
          return { lastCompletedSummary: null };
        });
      },

      logF45Session: (input) => {
        commitPersisted((state) => {
          const validDate = IsoDateSchema.safeParse(input.dateISO);
          if (!validDate.success) return null;

          const dayKey = input.dayKey ?? getDayKeyFromIsoDate(validDate.data);
          const safeRpe = Number.isFinite(input.rpe)
            ? clamp(Math.round(input.rpe), 1, 10)
            : 7;
          const safeDuration =
            input.durationMinutes !== undefined &&
            Number.isFinite(input.durationMinutes) &&
            input.durationMinutes >= 0
              ? Math.round(input.durationMinutes)
              : undefined;
          const existingIndex = state.f45Logs.findIndex(
            (item) => item.dateISO === validDate.data,
          );

          const entry: F45SessionLog = {
            id:
              existingIndex >= 0
                ? (state.f45Logs[existingIndex]?.id ?? createSessionId('f45'))
                : createSessionId('f45'),
            dateISO: validDate.data,
            dayKey,
            classTitle: input.classTitle.trim() || 'F45 세션',
            rpe: safeRpe,
            lowerBodyImpact: input.lowerBodyImpact,
            ...(safeDuration !== undefined
              ? { durationMinutes: safeDuration }
              : {}),
            ...(input.note !== undefined && input.note.trim() !== ''
              ? { note: input.note.trim() }
              : {}),
          };

          const nextLogs =
            existingIndex >= 0
              ? state.f45Logs.map((item, idx) =>
                  idx === existingIndex ? entry : item,
                )
              : [...state.f45Logs, entry];

          return { f45Logs: nextLogs };
        });
      },

      toggleRecoveryCheckItem: (dateISO, itemId) => {
        commitPersisted((state) => {
          const validDate = IsoDateSchema.safeParse(dateISO);
          if (!validDate.success) return null;

          const existingIndex = state.recoveryLogs.findIndex(
            (item) => item.dateISO === validDate.data,
          );

          if (existingIndex < 0) {
            const created: RecoveryCheckLog = {
              id: createSessionId('recovery'),
              dateISO: validDate.data,
              dayKey: getDayKeyFromIsoDate(validDate.data),
              checkedItemIds: [itemId],
            };
            return { recoveryLogs: [...state.recoveryLogs, created] };
          }

          const existing = state.recoveryLogs[existingIndex];
          if (!existing) return null;

          const alreadyChecked = existing.checkedItemIds.includes(itemId);
          const nextCheckedIds = alreadyChecked
            ? existing.checkedItemIds.filter((id) => id !== itemId)
            : [...existing.checkedItemIds, itemId];

          const nextLogs = state.recoveryLogs.map((item, idx) =>
            idx === existingIndex
              ? { ...item, checkedItemIds: nextCheckedIds }
              : item,
          );

          return { recoveryLogs: nextLogs };
        });
      },

      loadDemoData: () => {
        commitPersisted((state) => ({
          ...buildDefaultDemoPersistedState(getLocalTodayIso(), state.settings),
          isWorkoutOverlayOpen: false,
        }));
      },

      resetToLiveCleanState: () => {
        commitPersisted((state) => ({
          ...buildCleanPersistedState(state.settings),
          isWorkoutOverlayOpen: false,
        }));
      },

      updateUserProfile: (patch) => {
        commitPersisted((state) => {
          const nextHeight =
            patch.heightCm !== undefined &&
            Number.isFinite(patch.heightCm) &&
            patch.heightCm > 0
              ? Number(patch.heightCm.toFixed(1))
              : state.userProfile.heightCm;
          const nextWeight =
            patch.weightKg !== undefined &&
            Number.isFinite(patch.weightKg) &&
            patch.weightKg > 0
              ? Number(patch.weightKg.toFixed(1))
              : state.userProfile.weightKg;
          const nextBodyFat =
            patch.bodyFatPct !== undefined && Number.isFinite(patch.bodyFatPct)
              ? clamp(Number(patch.bodyFatPct.toFixed(1)), 0, 100)
              : state.userProfile.bodyFatPct;

          return {
            userProfile: {
              ...state.userProfile,
              heightCm: nextHeight,
              weightKg: nextWeight,
              bodyFatPct: nextBodyFat,
            },
          };
        });
      },

      updateBaseOneRm: (patch) => {
        commitPersisted((state) => {
          const sanitizeRm = (val: number | undefined, fallback: number) =>
            val !== undefined && Number.isFinite(val) && val >= 0
              ? Number(val.toFixed(1))
              : fallback;

          return {
            userProfile: {
              ...state.userProfile,
              baseOneRm: {
                bench: sanitizeRm(patch.bench, state.userProfile.baseOneRm.bench),
                squat: sanitizeRm(patch.squat, state.userProfile.baseOneRm.squat),
                deadlift: sanitizeRm(
                  patch.deadlift,
                  state.userProfile.baseOneRm.deadlift,
                ),
                ohp: sanitizeRm(patch.ohp, state.userProfile.baseOneRm.ohp),
              },
            },
          };
        });
      },

      setCycleWeek: (week) => {
        commitPersisted(() => ({ currentCycleWeek: week }));
      },

      advanceToNextCycle: () => {
        commitPersisted((state) => ({
          currentCycleWeek: ((state.currentCycleWeek % 6) + 1) as CycleWeek,
        }));
      },

      updateSettings: (patch) => {
        commitPersisted((state) => ({
          settings: {
            ...state.settings,
            ...patch,
            preferAlternatives: patch.preferAlternatives
              ? { ...patch.preferAlternatives }
              : state.settings.preferAlternatives,
          },
        }));
      },

      exportBackupJson: () => {
        return JSON.stringify(extractPersistedState(get()), null, 2);
      },

      importBackupJson: (rawJson) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawJson);
        } catch {
          return {
            ok: false,
            error: '올바른 JSON 백업 파일 형식이 아니에요',
          };
        }

        const validated = PersistedAppStateSchema.safeParse(parsed);
        if (!validated.success) {
          return {
            ok: false,
            error: '백업 데이터 형식이 현재 앱 버전과 맞지 않아요',
          };
        }

        commitPersisted(() => ({
          ...validated.data,
          isWorkoutOverlayOpen: false,
        }));

        return { ok: true };
      },
    };
  });
}

export const useWorkoutStore = createWorkoutStore();
