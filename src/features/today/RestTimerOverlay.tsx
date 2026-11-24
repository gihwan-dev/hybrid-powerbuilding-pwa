import { SkipForward, Timer } from 'lucide-react';
import { useCallback } from 'react';
import { ProgressRing } from '../../components/ui';
import { useRestTimer } from '../../hooks/useRestTimer';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import { useWorkoutStore } from '../../store/workout-store';

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function RestTimerOverlay() {
  const restTimer = useWorkoutStore((s) => s.activeSession?.restTimer ?? null);
  const adjustRestTimer = useWorkoutStore((s) => s.adjustRestTimer);
  const skipRestTimer = useWorkoutStore((s) => s.skipRestTimer);
  const expireRestTimer = useWorkoutStore((s) => s.expireRestTimer);

  const {
    playRestCompleteChime,
    triggerRestCompleteHaptic,
    triggerTapHaptic,
  } = useSoundHaptics();

  const handleExpire = useCallback(() => {
    playRestCompleteChime();
    triggerRestCompleteHaptic();
    expireRestTimer();
  }, [playRestCompleteChime, triggerRestCompleteHaptic, expireRestTimer]);

  const { remainingSeconds, progressRatio } = useRestTimer({
    targetEndTimeMs: restTimer?.targetEndTimeMs ?? null,
    totalSeconds: restTimer?.totalSeconds ?? 0,
    onExpire: handleExpire,
  });

  if (!restTimer || restTimer.targetEndTimeMs === null) {
    return null;
  }

  const nextPreviewText = restTimer.nextSetPreview
    ? restTimer.nextSetPreview.replace(/[·—]/g, ' ').replace(/\s{2,}/g, ' ').trim()
    : null;

  return (
    <section
      aria-label="휴식 타이머"
      className="flex flex-col items-center justify-between rounded-[24px] bg-white px-5 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-5"
    >
      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F3FF] px-3 py-1 text-[13px] font-bold text-[#1B64DA]">
        <Timer className="h-4 w-4" aria-hidden="true" />
        <span>휴식 타이머</span>
      </div>

      <ProgressRing
        size={220}
        strokeWidth={10}
        progress={progressRatio}
        style={{
          width: 'min(220px, 42dvh)',
          height: 'min(220px, 42dvh)',
        }}
      >
        <span className="text-[42px] font-bold tracking-tight text-[#191F28] tabular-nums leading-none">
          {formatCountdown(remainingSeconds)}
        </span>
        <span className="mt-1.5 text-[13px] font-semibold text-[#6B7684] tabular-nums">
          목표 {formatCountdown(restTimer.totalSeconds)}
        </span>
      </ProgressRing>

      {nextPreviewText ? (
        <div className="w-full rounded-[16px] bg-[#F2F4F6] px-4 py-3 text-center">
          <p className="text-[14px] font-semibold text-[#191F28] tabular-nums">
            {nextPreviewText}
          </p>
        </div>
      ) : null}

      <div className="grid w-full grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            triggerTapHaptic();
            adjustRestTimer(-30);
          }}
          className="min-h-[52px] cursor-pointer rounded-[16px] bg-[#F2F4F6] px-4 text-[16px] font-bold text-[#191F28] tabular-nums hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          -30초
        </button>

        <button
          type="button"
          onClick={() => {
            triggerTapHaptic();
            adjustRestTimer(30);
          }}
          className="min-h-[52px] cursor-pointer rounded-[16px] bg-[#F2F4F6] px-4 text-[16px] font-bold text-[#191F28] tabular-nums hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          +30초
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          triggerTapHaptic();
          skipRestTimer();
        }}
        className="inline-flex min-h-[54px] w-full cursor-pointer items-center justify-center gap-2 rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
      >
        <SkipForward className="h-5 w-5" aria-hidden="true" />
        <span>휴식 건너뛰기</span>
      </button>
    </section>
  );
}
