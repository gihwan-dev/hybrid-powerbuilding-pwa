import { ArrowLeftRight, Plus } from 'lucide-react';
import { BottomSheet } from '../../components/ui';
import { findExerciseById } from '../../domain/routine-model-a';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import { useWorkoutStore } from '../../store/workout-store';

export interface ExerciseJumpSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ExerciseJumpSheet({ open, onClose }: ExerciseJumpSheetProps) {
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const jumpToSet = useWorkoutStore((s) => s.jumpToSet);
  const swapExerciseAlternative = useWorkoutStore(
    (s) => s.swapExerciseAlternative,
  );
  const skipSet = useWorkoutStore((s) => s.skipSet);
  const addExtraSet = useWorkoutStore((s) => s.addExtraSet);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);

  const { triggerTapHaptic } = useSoundHaptics();

  if (!activeSession) {
    return null;
  }

  const { exerciseIndex: currentExIdx, setIndex: currentSetIdx } =
    activeSession.currentPointer;
  const currentSet =
    activeSession.exercises[currentExIdx]?.sets[currentSetIdx];
  const canSkipCurrent =
    Boolean(currentSet) && !currentSet?.completed && !currentSet?.skipped;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="전체 운동 목록"
      description="원하는 세트를 눌러 바로 이동하거나 동작을 바꿀 수 있어요"
    >
      <div className="space-y-4">
        <div className="divide-y divide-[#F2F4F6]">
          {activeSession.exercises.map((exercise, exIdx) => {
            const definition = findExerciseById(exercise.exerciseId);
            const hasAlternative = Boolean(definition?.alternative);

            return (
              <div key={exercise.exerciseId} className="py-3.5 first:pt-1 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[16px] font-bold leading-snug text-[#191F28]">
                      {exercise.activeName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {hasAlternative ? (
                      <button
                        type="button"
                        onClick={() => {
                          triggerTapHaptic();
                          swapExerciseAlternative(exIdx);
                        }}
                        className="inline-flex min-h-12 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[12px] bg-[#F2F4F6] px-3 text-[13px] font-semibold text-[#1B64DA] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>대체 동작</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        triggerTapHaptic();
                        addExtraSet(exIdx);
                      }}
                      className="inline-flex min-h-12 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[12px] bg-[#F2F4F6] px-3 text-[13px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>세트 추가</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {exercise.sets.map((set, sIdx) => {
                    const isCurrent =
                      exIdx === currentExIdx && sIdx === currentSetIdx;
                    const statusLabel = set.completed
                      ? '완료'
                      : set.skipped
                        ? '건너뜀'
                        : isCurrent
                          ? '진행 중'
                          : '대기';

                    const chipStyle = set.completed
                      ? 'bg-[#E8FAF0] text-[#027A48]'
                      : set.skipped
                        ? 'bg-[#F2F4F6] text-[#4E5968]'
                        : isCurrent
                          ? 'bg-[#1B64DA] text-white'
                          : 'bg-[#F2F4F6] text-[#191F28]';

                    return (
                      <button
                        key={set.setNumber}
                        type="button"
                        onClick={() => {
                          triggerTapHaptic();
                          jumpToSet(exIdx, sIdx);
                          onClose();
                        }}
                        className={`min-h-12 cursor-pointer whitespace-nowrap rounded-[12px] px-3 py-2 text-[13px] font-semibold tabular-nums active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${chipStyle}`}
                      >
                        {set.setNumber}세트 {statusLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-[#F2F4F6] pt-3">
          {canSkipCurrent ? (
            <button
              type="button"
              onClick={() => {
                triggerTapHaptic();
                skipSet(currentExIdx, currentSetIdx);
                onClose();
              }}
              className="min-h-12 w-full cursor-pointer rounded-[16px] bg-[#F2F4F6] px-4 text-[15px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              현재 세트 건너뛰기
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              triggerTapHaptic();
              onClose();
              finishWorkout();
            }}
            className="min-h-[52px] w-full cursor-pointer rounded-[16px] bg-[#191F28] px-4 text-[16px] font-bold text-white hover:bg-[#333D4B] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            운동 지금 마치기
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
