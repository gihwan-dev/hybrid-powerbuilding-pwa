export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type CycleWeek = 1 | 2 | 3 | 4 | 5 | 6;

export type MuscleGroupId =
  | 'chest'
  | 'back'
  | 'quads'
  | 'posterior_chain'
  | 'shoulders_arms'
  | 'functional_core';

export type SetRole = 'top' | 'backoff' | 'primer' | 'accessory' | 'carry';

export type LiftKey = 'bench' | 'squat' | 'deadlift' | 'ohp';

export type LowerBodyImpact = 'low' | 'medium' | 'high';

export type RoutineDayType = 'weight' | 'f45' | 'rest';

export type ExerciseUnit = 'kg' | 'kg_added' | 'kg_per_hand' | 'kg_meters';

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'bodyweight'
  | 'cable'
  | 'machine'
  | 'trapbar';

export type ProgressionTone = 'increase' | 'hold' | 'decrease' | 'deload' | 'base';

export type CnsStatus = 'optimal' | 'caution' | 'overload';

export interface ExerciseAlternative {
  id: string;
  name: string;
  defaultWeightKg: number;
  equipment: EquipmentType;
  unit?: ExerciseUnit;
  repsMin?: number;
  repsMax?: number;
  sets?: number;
  note?: string;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  role: SetRole;
  liftKey?: LiftKey;
  pairedTopExerciseId?: string;
  backoffRatio?: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  distanceMeters?: number;
  defaultWeightKg: number;
  targetRirMin: number;
  targetRirMax: number;
  skipRir: boolean;
  restSeconds: number;
  unit: ExerciseUnit;
  equipment: EquipmentType;
  isAddedWeight?: boolean;
  isPerHand?: boolean;
  primaryMuscles: MuscleGroupId[];
  secondaryMuscles: MuscleGroupId[];
  supportsWarmup: boolean;
  supportsPlates: boolean;
  alternative?: ExerciseAlternative;
  coachingCue: string;
}

export interface RecoveryChecklistItem {
  id: string;
  label: string;
  detail: string;
}

export interface RoutineDayDefinition {
  dayKey: DayKey;
  shortLabel: string;
  fullLabel: string;
  type: RoutineDayType;
  title: string;
  subtitle: string;
  f45DefaultFocus?: string;
  exercises: ExerciseDefinition[];
  recoveryChecklist: RecoveryChecklistItem[];
}

export interface OneRmMap {
  bench: number;
  squat: number;
  deadlift: number;
  ohp: number;
}

export interface UserProfile {
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
  baseOneRm: OneRmMap;
}

export interface CompletedSetLog {
  setNumber: number;
  weightKg: number;
  actualReps: number;
  distanceMeters?: number;
  rir: number | null;
  completed: boolean;
  e1rmKg?: number;
}

export interface WeightExerciseLog {
  exerciseId: string;
  exerciseName: string;
  role: SetRole;
  liftKey?: LiftKey;
  usedAlternative: boolean;
  alternativeName?: string;
  sets: CompletedSetLog[];
}

export interface WeightSessionLog {
  id: string;
  dateISO: string;
  dayKey: DayKey;
  cycleWeek: CycleWeek;
  title: string;
  durationMinutes?: number;
  note?: string;
  exercises: WeightExerciseLog[];
}

export interface F45SessionLog {
  id: string;
  dateISO: string;
  dayKey: DayKey;
  classTitle: string;
  rpe: number;
  lowerBodyImpact: LowerBodyImpact;
  durationMinutes?: number;
  note?: string;
}

export interface RecoveryCheckLog {
  id: string;
  dateISO: string;
  dayKey: DayKey;
  checkedItemIds: string[];
  note?: string;
}

export interface PrescribedExercise {
  definition: ExerciseDefinition;
  activeName: string;
  usedAlternative: boolean;
  activeEquipment: EquipmentType;
  activeUnit: ExerciseUnit;
  prescribedWeightKg: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  targetRirMin: number;
  targetRirMax: number;
  skipRir: boolean;
  progressionBadge: string;
  progressionTone: ProgressionTone;
  progressionReason: string;
  lastSessionSummary: string | null;
  isDeloadAdjusted: boolean;
}

export interface PrescribedSession {
  dayKey: DayKey;
  cycleWeek: CycleWeek;
  isDeloadWeek: boolean;
  title: string;
  subtitle: string;
  cnsTrimApplied: boolean;
  exercises: PrescribedExercise[];
}

export interface BackoffRecalculationResult {
  prescribedWeightKg: number;
  ratio: number;
  fatigueAdjusted: boolean;
  badge: string;
  reason: string;
}

export interface CnsFatigueFactor {
  id: string;
  label: string;
  delta: number;
  impact: 'increase' | 'decrease' | 'neutral';
  detail: string;
}

export interface CnsFatigueResult {
  score: number;
  status: CnsStatus;
  statusLabel: string;
  headline: string;
  advice: string;
  shouldSuggestBackoffTrim: boolean;
  factors: CnsFatigueFactor[];
}

export type ForecastSeriesKey = 'total' | 'bench' | 'squat' | 'deadlift';

export interface ForecastPoint {
  weekOffset: number;
  label: string;
  cycleWeek: CycleWeek;
  isDeloadWeek: boolean;
  projectedKg: number;
  lowerBoundKg: number;
  upperBoundKg: number;
}

export interface ForecastHistoryPoint {
  dateISO: string;
  weekOffset: number;
  actualKg: number;
}

export interface LiftForecastSummary {
  key: ForecastSeriesKey;
  label: string;
  currentKg: number;
  week4Kg: number;
  week8Kg: number;
  week12Kg: number;
  delta12WeekKg: number;
  weeklySlopeKg: number;
  historyPoints: ForecastHistoryPoint[];
  points: ForecastPoint[];
}

export interface ForecastResult {
  currentOneRm: OneRmMap;
  currentSbdTotalKg: number;
  projected12WeekSbdTotalKg: number;
  dotsCurrent: number;
  dotsProjected12Week: number;
  hasEnoughTrendData: boolean;
  series: Record<ForecastSeriesKey, LiftForecastSummary>;
}

export interface MuscleVolumeSummary {
  muscleGroup: MuscleGroupId;
  label: string;
  completedSets: number;
  plannedSets: number;
  targetMinSets: number;
  targetMaxSets: number;
  status: 'below' | 'optimal' | 'high';
}

export interface PlatePairCount {
  weightKg: number;
  pairs: number;
}

export interface PlateBreakdown {
  targetWeightKg: number;
  barWeightKg: number;
  perSideWeightKg: number;
  platesPerSide: PlatePairCount[];
  achievableTotalKg: number;
  remainderKg: number;
  isExact: boolean;
  isBarOnly: boolean;
}

export interface WarmupSet {
  setNumber: number;
  percentage: number;
  weightKg: number;
  reps: number;
  plateBreakdown: PlateBreakdown | null;
}

export type AiFocusTopic =
  | 'overall_balance'
  | 'strength_plateau'
  | 'f45_fatigue'
  | 'deload_strategy';
