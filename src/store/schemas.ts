import { z } from 'zod';
import type {
  CycleWeek,
  DayKey,
  EquipmentType,
  ExerciseUnit,
  F45SessionLog,
  LiftKey,
  LowerBodyImpact,
  OneRmMap,
  RecoveryCheckLog,
  SetRole,
  UserProfile,
  WeightSessionLog,
} from '../domain/types';

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [yStr, mStr, dStr] = value.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const day = Number(dStr);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, '유효한 날짜 형식(YYYY-MM-DD)이 아니에요');

export const DayKeySchema = z.enum([
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]) satisfies z.ZodType<DayKey>;

export const CycleWeekSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]) satisfies z.ZodType<CycleWeek>;

export const SetRoleSchema = z.enum([
  'top',
  'backoff',
  'primer',
  'accessory',
  'carry',
]) satisfies z.ZodType<SetRole>;

export const LiftKeySchema = z.enum([
  'bench',
  'squat',
  'deadlift',
  'ohp',
]) satisfies z.ZodType<LiftKey>;

export const LowerBodyImpactSchema = z.enum([
  'low',
  'medium',
  'high',
]) satisfies z.ZodType<LowerBodyImpact>;

export const ExerciseUnitSchema = z.enum([
  'kg',
  'kg_added',
  'kg_per_hand',
  'kg_meters',
]) satisfies z.ZodType<ExerciseUnit>;

export const EquipmentTypeSchema = z.enum([
  'barbell',
  'dumbbell',
  'bodyweight',
  'cable',
  'machine',
  'trapbar',
]) satisfies z.ZodType<EquipmentType>;

export const OneRmMapSchema = z.object({
  bench: z.number().min(0),
  squat: z.number().min(0),
  deadlift: z.number().min(0),
  ohp: z.number().min(0),
}) satisfies z.ZodType<OneRmMap>;

export const UserProfileSchema = z.object({
  heightCm: z.number().positive(),
  weightKg: z.number().positive(),
  bodyFatPct: z.number().min(0).max(100),
  baseOneRm: OneRmMapSchema,
}) satisfies z.ZodType<UserProfile>;

export const CompletedSetLogSchema = z.object({
  setNumber: z.number().int().positive(),
  weightKg: z.number().min(0),
  actualReps: z.number().int().min(0),
  distanceMeters: z.number().min(0).optional(),
  rir: z.number().min(0).max(10).nullable(),
  completed: z.boolean(),
  e1rmKg: z.number().min(0).optional(),
});

export const WeightExerciseLogSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  role: SetRoleSchema,
  liftKey: LiftKeySchema.optional(),
  usedAlternative: z.boolean(),
  alternativeName: z.string().optional(),
  sets: z.array(CompletedSetLogSchema),
});

export const WeightSessionLogSchema = z.object({
  id: z.string(),
  dateISO: IsoDateSchema,
  dayKey: DayKeySchema,
  cycleWeek: CycleWeekSchema,
  title: z.string(),
  durationMinutes: z.number().min(0).optional(),
  note: z.string().optional(),
  exercises: z.array(WeightExerciseLogSchema),
}) satisfies z.ZodType<WeightSessionLog>;

export const F45SessionLogSchema = z.object({
  id: z.string(),
  dateISO: IsoDateSchema,
  dayKey: DayKeySchema,
  classTitle: z.string(),
  rpe: z.number().min(1).max(10),
  lowerBodyImpact: LowerBodyImpactSchema,
  durationMinutes: z.number().min(0).optional(),
  note: z.string().optional(),
}) satisfies z.ZodType<F45SessionLog>;

export const RecoveryCheckLogSchema = z.object({
  id: z.string(),
  dateISO: IsoDateSchema,
  dayKey: DayKeySchema,
  checkedItemIds: z.array(z.string()),
  note: z.string().optional(),
}) satisfies z.ZodType<RecoveryCheckLog>;

export const AppSettingsSchema = z.object({
  soundEnabled: z.boolean(),
  vibrationEnabled: z.boolean(),
  geminiApiKey: z.string(),
  preferAlternatives: z.record(z.string(), z.boolean()),
});

export const ActiveSetDraftSchema = z.object({
  setNumber: z.number().int().positive(),
  weightKg: z.number().min(0),
  reps: z.number().int().min(0),
  distanceMeters: z.number().min(0).optional(),
  rir: z.number().min(0).max(10).nullable(),
  completed: z.boolean(),
  skipped: z.boolean(),
  e1rmKg: z.number().min(0).optional(),
});

export const ActiveExerciseStateSchema = z.object({
  exerciseId: z.string(),
  activeName: z.string(),
  usedAlternative: z.boolean(),
  role: SetRoleSchema,
  liftKey: LiftKeySchema.optional(),
  pairedTopExerciseId: z.string().optional(),
  backoffRatio: z.number().gt(0).lte(1).optional(),
  activeEquipment: EquipmentTypeSchema,
  activeUnit: ExerciseUnitSchema,
  repsMin: z.number().int().min(1),
  repsMax: z.number().int().min(1),
  targetRirMin: z.number().min(0).max(10),
  targetRirMax: z.number().min(0).max(10),
  skipRir: z.boolean(),
  restSeconds: z.number().int().min(0),
  progressionBadge: z.string(),
  progressionReason: z.string(),
  lastSessionSummary: z.string().nullable(),
  sets: z.array(ActiveSetDraftSchema).min(1),
});

export const SessionPointerSchema = z.object({
  exerciseIndex: z.number().int().min(0),
  setIndex: z.number().int().min(0),
});

export const RestTimerStateSchema = z.object({
  targetEndTimeMs: z.number().min(0).nullable(),
  totalSeconds: z.number().int().min(0),
  nextSetPreview: z.string().nullable(),
});

export const ActiveWorkoutSessionSchema = z
  .object({
    id: z.string(),
    dayKey: DayKeySchema,
    dateISO: IsoDateSchema,
    title: z.string(),
    startedAtMs: z.number(),
    cycleWeek: CycleWeekSchema,
    cnsTrimApplied: z.boolean(),
    exercises: z.array(ActiveExerciseStateSchema).min(1),
    checkedWarmupSteps: z.record(z.string(), z.array(z.number().int().positive())),
    currentPointer: SessionPointerSchema,
    awaitingRirForPointer: SessionPointerSchema.nullable(),
    restTimer: RestTimerStateSchema,
  })
  .superRefine((session, ctx) => {
    const checkPointer = (
      ptr: { exerciseIndex: number; setIndex: number },
      fieldName: 'currentPointer' | 'awaitingRirForPointer',
    ) => {
      const ex = session.exercises[ptr.exerciseIndex];
      if (!ex) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [fieldName, 'exerciseIndex'],
          message: '종목 인덱스가 유효하지 않아요',
        });
        return;
      }
      if (!ex.sets[ptr.setIndex]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [fieldName, 'setIndex'],
          message: '세트 인덱스가 유효하지 않아요',
        });
      }
    };

    checkPointer(session.currentPointer, 'currentPointer');
    if (session.awaitingRirForPointer) {
      checkPointer(session.awaitingRirForPointer, 'awaitingRirForPointer');
    }
  });

export const LastCompletedSummarySchema = z.object({
  sessionId: z.string(),
  dateISO: IsoDateSchema,
  dayKey: DayKeySchema,
  title: z.string(),
  tonnageKg: z.number().min(0),
  completedSetCount: z.number().int().min(0),
  durationMinutes: z.number().int().min(0),
  newPrLabels: z.array(z.string()),
  updatedOneRm: OneRmMapSchema,
  sbdTotalKg: z.number().min(0),
});

export const PersistedAppStateSchema = z.object({
  schemaVersion: z.literal(1),
  isDemoMode: z.boolean(),
  currentCycleWeek: CycleWeekSchema,
  selectedDayOverride: DayKeySchema.nullable(),
  pendingCnsTrimForDay: DayKeySchema.nullable(),
  userProfile: UserProfileSchema,
  weightLogs: z.array(WeightSessionLogSchema),
  f45Logs: z.array(F45SessionLogSchema),
  recoveryLogs: z.array(RecoveryCheckLogSchema),
  activeSession: ActiveWorkoutSessionSchema.nullable(),
  lastCompletedSummary: LastCompletedSummarySchema.nullable(),
  settings: AppSettingsSchema,
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type ActiveSetDraft = z.infer<typeof ActiveSetDraftSchema>;
export type ActiveExerciseState = z.infer<typeof ActiveExerciseStateSchema>;
export type SessionPointer = z.infer<typeof SessionPointerSchema>;
export type RestTimerState = z.infer<typeof RestTimerStateSchema>;
export type ActiveWorkoutSession = z.infer<typeof ActiveWorkoutSessionSchema>;
export type LastCompletedSummary = z.infer<typeof LastCompletedSummarySchema>;
export type PersistedAppState = z.infer<typeof PersistedAppStateSchema>;
