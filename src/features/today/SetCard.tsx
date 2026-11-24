import { ArrowLeftRight, Disc } from 'lucide-react';
import { NumberStepper } from '../../components/ui';
import { calculatePlateBreakdown } from '../../domain/plate-calculator';
import { findExerciseById } from '../../domain/routine-model-a';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import type { ActiveExerciseState } from '../../store/schemas';
import { useWorkoutStore } from '../../store/workout-store';
import { WarmupDisclosure } from './WarmupDisclosure';

function formatSetRoleLabel(
  exercise: ActiveExerciseState,
  setIndex: number,
): string {
  const total = exercise.sets.length;
  const num = setIndex + 1;
  switch (exercise.role) {
    case 'top':
      return total > 1 ? `탑세트 ${num}/${total}` : '탑세트';
    case 'backoff':
      return `백오프 ${num}/${total}`;
    case 'primer':
      return `파워 프라이머 ${num}/${total}`;
    case 'carry':
      return `캐리 ${num}/${total}`;
    case 'accessory':
      return `본세트 ${num}/${total}`;
  }
}

function formatPlateGuide(weightKg: number): string {
  const breakdown = calculatePlateBreakdown(weightKg);
  if (breakdown.isBarOnly) {
    return '빈 바벨 20kg';
  }
  const parts = breakdown.platesPerSide.map((item) =>
    item.pairs > 1 ? `${item.weightKg}×${item.pairs}` : `${item.weightKg}`,
  );
  const baseText = `한쪽 원판 ${parts.join(' + ')}kg`;
  if (!breakdown.isExact) {
    return `${baseText} (장착 ${breakdown.achievableTotalKg}kg)`;
  }
  return baseText;
}

function sanitizeSummary(summary: string | null): string | null {
  if (!summary) return null;
  return summary
    .replace(/\s*·\s*RIR\s+([0-9.]+)/g, ' (RIR $1)')
    .replace(/[·—]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function SetCard() {
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const updateSetDraft = useWorkoutStore((s) => s.updateSetDraft);
  const tapCompleteCurrentSet = useWorkoutStore((s) => s.tapCompleteCurrentSet);
  const swapExerciseAlternative = useWorkoutStore(
    (s) => s.swapExerciseAlternative,
  );
  const toggleWarmupCheck = useWorkoutStore((s) => s.toggleWarmupCheck);
  const jumpToSet = useWorkoutStore((s) => s.jumpToSet);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);

  const { playSetCompleteTick, triggerTapHaptic } = useSoundHaptics();

  if (!activeSession) {
    return null;
  }

  const { exerciseIndex, setIndex } = activeSession.currentPointer;
  const exercise = activeSession.exercises[exerciseIndex];
  const currentSet = exercise?.sets[setIndex];

  if (!exercise || !currentSet) {
    return null;
  }

  const definition = findExerciseById(exercise.exerciseId);
  const hasAlternative = Boolean(definition?.alternative);
  const showPlateGuide =
    exercise.activeEquipment === 'barbell' &&
    (definition?.supportsPlates ?? true);
  const showWarmup =
    exercise.role === 'top' &&
    Boolean(definition?.supportsWarmup) &&
    setIndex === 0;

  const isCarry = exercise.activeUnit === 'kg_meters';
  const targetRepText = isCarry
    ? `목표 ${definition?.distanceMeters ?? currentSet.distanceMeters ?? 25}m`
    : exercise.repsMin === exercise.repsMax
      ? `목표 ${exercise.repsMin}회`
      : `목표 ${exercise.repsMin}~${exercise.repsMax}회`;

  const targetRirText = exercise.skipRir
    ? 'RIR 측정 생략'
    : exercise.targetRirMin === exercise.targetRirMax
      ? `권장 RIR ${exercise.targetRirMin}`
      : `권장 RIR ${exercise.targetRirMin}~${exercise.targetRirMax}`;

  const sanitizedLastSummary = sanitizeSummary(exercise.lastSessionSummary);
  const sanitizedBadge = sanitizeSummary(exercise.progressionBadge) ?? '';
  const sanitizedReason = sanitizeSummary(exercise.progressionReason);

  const checkedWarmupSteps =
    activeSession.checkedWarmupSteps[exercise.exerciseId] ?? [];

  const isSetFinishedOrSkipped = currentSet.completed || currentSet.skipped;

  const handleCompleteSet = () => {
    playSetCompleteTick();
    triggerTapHaptic();
    tapCompleteCurrentSet();
  };

  const handleGoNextOpenSet = () => {
    for (
      let exIdx = 0;
      exIdx < activeSession.exercises.length;
      exIdx += 1
    ) {
      const candidateEx = activeSession.exercises[exIdx];
      if (!candidateEx) continue;
      for (let sIdx = 0; sIdx < candidateEx.sets.length; sIdx += 1) {
        const candidateSet = candidateEx.sets[sIdx];
        if (candidateSet && !candidateSet.completed && !candidateSet.skipped) {
          jumpToSet(exIdx, sIdx);
          return;
        }
      }
    }
    finishWorkout();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex min-h-8 items-center rounded-full bg-[#E8F3FF] px-3 py-1 text-[13px] font-bold text-[#1B64DA] tabular-nums">
            {formatSetRoleLabel(exercise, setIndex)}
          </span>

          {hasAlternative ? (
            <button
              type="button"
              onClick={() => {
                triggerTapHaptic();
                swapExerciseAlternative(exerciseIndex);
              }}
              className="inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-[14px] bg-[#F2F4F6] px-3 text-[13px] font-semibold text-[#1B64DA] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{exercise.usedAlternative ? '기본 동작으로' : '대체 동작'}</span>
            </button>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-[22px] font-bold leading-snug tracking-tight text-[#191F28]">
            {exercise.activeName}
          </h2>
          <p className="text-[14px] font-medium text-[#4E5968] tabular-nums">
            {targetRepText} / {targetRirText}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sanitizedBadge ? (
            <span className="inline-flex items-center rounded-full bg-[#F2F4F6] px-3 py-1 text-[12px] font-semibold text-[#1B64DA] tabular-nums">
              {sanitizedBadge}
            </span>
          ) : null}
          {sanitizedLastSummary ? (
            <span className="text-[13px] font-medium text-[#4E5968] tabular-nums">
              {sanitizedLastSummary}
            </span>
          ) : null}
        </div>

        {showPlateGuide ? (
          <div className="inline-flex max-w-full items-start gap-2 rounded-[14px] bg-[#F2F4F6] px-3 py-2 text-[13px] font-semibold text-[#4E5968] tabular-nums">
            <Disc className="mt-0.5 h-4 w-4 shrink-0 text-[#1B64DA]" aria-hidden="true" />
            <span className="min-w-0 leading-snug break-keep">
              {formatPlateGuide(currentSet.weightKg)}
            </span>
          </div>
        ) : null}

        {showWarmup ? (
          <WarmupDisclosure
            exerciseId={exercise.exerciseId}
            workingWeightKg={currentSet.weightKg}
            checkedSteps={checkedWarmupSteps}
            onToggleStep={toggleWarmupCheck}
          />
        ) : null}

        <div className="space-y-4 pt-1">
          <NumberStepper
            label="중량"
            value={currentSet.weightKg}
            step={2.5}
            min={0}
            max={400}
            allowDecimal
            unitLabel={
              exercise.activeUnit === 'kg_per_hand' ? 'kg (한 손)' : 'kg'
            }
            padUnitLabel="kg"
            prefix={
              exercise.activeUnit === 'kg_added' && currentSet.weightKg > 0
                ? '+'
                : ''
            }
            zeroOverrideLabel={
              exercise.activeUnit === 'kg_added' ? '맨몸' : undefined
            }
            padTitle={`${exercise.activeName} 중량 입력`}
            onChange={(nextWeight) =>
              updateSetDraft(exerciseIndex, setIndex, { weightKg: nextWeight })
            }
            onStepFeedback={triggerTapHaptic}
          />

          {isCarry ? (
            <NumberStepper
              label="이동 거리"
              value={
                currentSet.distanceMeters ?? definition?.distanceMeters ?? 25
              }
              step={5}
              min={5}
              max={200}
              unitLabel="m"
              padTitle={`${exercise.activeName} 거리 입력`}
              onChange={(nextDistance) =>
                updateSetDraft(exerciseIndex, setIndex, {
                  distanceMeters: nextDistance,
                })
              }
              onStepFeedback={triggerTapHaptic}
            />
          ) : (
            <NumberStepper
              label="반복 횟수"
              value={currentSet.reps}
              step={1}
              min={1}
              max={15}
              unitLabel="회"
              padTitle={`${exercise.activeName} 반복 횟수 입력`}
              onChange={(nextReps) =>
                updateSetDraft(exerciseIndex, setIndex, { reps: nextReps })
              }
              onStepFeedback={triggerTapHaptic}
            />
          )}
        </div>

        {definition?.coachingCue || sanitizedReason ? (
          <div className="border-t border-[#F2F4F6] pt-3">
            <p className="text-[13px] leading-relaxed text-[#6B7684]">
              {definition?.coachingCue ?? sanitizedReason}
            </p>
          </div>
        ) : null}
      </section>

      {isSetFinishedOrSkipped ? (
        <button
          type="button"
          onClick={handleGoNextOpenSet}
          className="min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          다음 진행 세트로 이동
        </button>
      ) : (
        <button
          type="button"
          onClick={handleCompleteSet}
          className="min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          세트 완료
        </button>
      )}
    </div>
  );
}
