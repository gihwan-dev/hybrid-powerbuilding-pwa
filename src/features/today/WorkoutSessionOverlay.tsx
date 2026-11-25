import { ListOrdered, Pause, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useWorkoutStore } from '../../store/workout-store';
import { ExerciseJumpSheet } from './ExerciseJumpSheet';
import { RestTimerOverlay } from './RestTimerOverlay';
import { RirSheet } from './RirSheet';
import { SetCard } from './SetCard';

export function WorkoutSessionOverlay() {
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const pauseWorkout = useWorkoutStore((s) => s.pauseWorkout);
  const [isJumpOpen, setIsJumpOpen] = useState(false);

  const mainRegionRef = useRef<HTMLElement>(null);
  const prevRestingRef = useRef<boolean | null>(null);

  const { isActive: isWakeLockActive } = useWakeLock(Boolean(activeSession));

  const isResting = activeSession?.restTimer.targetEndTimeMs !== null;
  const awaitingRir = activeSession?.awaitingRirForPointer !== null;

  useEffect(() => {
    if (!activeSession) return;
    if (prevRestingRef.current === null) {
      prevRestingRef.current = isResting;
      mainRegionRef.current?.focus();
      return;
    }
    if (prevRestingRef.current !== isResting && !awaitingRir) {
      prevRestingRef.current = isResting;
      mainRegionRef.current?.focus();
    }
  }, [activeSession, isResting, awaitingRir]);

  if (!activeSession) {
    return null;
  }

  let totalSets = 0;
  let completedOrSkippedSets = 0;
  for (const exercise of activeSession.exercises) {
    for (const set of exercise.sets) {
      totalSets += 1;
      if (set.completed || set.skipped) {
        completedOrSkippedSets += 1;
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${activeSession.title} 진행 화면`}
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[#F2F4F6] text-[#191F28] pt-[env(safe-area-inset-top,0px)] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
    >
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-1 px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={pauseWorkout}
          className="inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[14px] px-2 text-[13px] font-semibold text-[#4E5968] min-[380px]:gap-1.5 min-[380px]:px-3 min-[380px]:text-[14px] hover:bg-white/80 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          <Pause className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>잠시 멈추기</span>
        </button>

        <div className="flex min-w-0 flex-col items-center text-center">
          <span className="whitespace-nowrap text-[14px] font-bold text-[#191F28] tabular-nums">
            {completedOrSkippedSets} / {totalSets} 세트
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-[#4E5968]">
            <Sun
              className={`h-3.5 w-3.5 shrink-0 ${
                isWakeLockActive ? 'text-[#027A48]' : 'text-[#4E5968]'
              }`}
              aria-hidden="true"
            />
            <span>{isWakeLockActive ? '화면 켜짐 유지 중' : '화면 켜짐 대기'}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsJumpOpen(true)}
          className="inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[14px] px-2 text-[13px] font-semibold text-[#1B64DA] min-[380px]:gap-1.5 min-[380px]:px-3 min-[380px]:text-[14px] hover:bg-white/80 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          <ListOrdered className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>전체 목록</span>
        </button>
      </header>

      <main
        ref={mainRegionRef}
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start px-4 pt-2 focus:outline-none"
      >
        {isResting ? <RestTimerOverlay /> : <SetCard />}
      </main>

      <RirSheet />
      <ExerciseJumpSheet
        open={isJumpOpen}
        onClose={() => setIsJumpOpen(false)}
      />
    </div>
  );
}
