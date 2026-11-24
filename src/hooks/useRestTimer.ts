import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../domain/math';

export interface UseRestTimerInput {
  targetEndTimeMs: number | null;
  totalSeconds: number;
  onExpire: () => void;
}

export interface UseRestTimerResult {
  remainingSeconds: number;
  progressRatio: number;
  isRunning: boolean;
}

function computeRemainingSeconds(targetEndTimeMs: number | null): number {
  if (targetEndTimeMs === null) return 0;
  return Math.max(0, Math.ceil((targetEndTimeMs - Date.now()) / 1000));
}

export function useRestTimer({
  targetEndTimeMs,
  totalSeconds,
  onExpire,
}: UseRestTimerInput): UseRestTimerResult {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    computeRemainingSeconds(targetEndTimeMs),
  );

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const firedForTargetRef = useRef<number | null>(null);

  const syncTimer = useCallback(() => {
    const nextRemaining = computeRemainingSeconds(targetEndTimeMs);
    setRemainingSeconds(nextRemaining);

    if (
      targetEndTimeMs !== null &&
      nextRemaining === 0 &&
      firedForTargetRef.current !== targetEndTimeMs
    ) {
      firedForTargetRef.current = targetEndTimeMs;
      onExpireRef.current();
    }
  }, [targetEndTimeMs]);

  useEffect(() => {
    if (targetEndTimeMs === null) {
      firedForTargetRef.current = null;
      setRemainingSeconds(0);
      return;
    }

    if (firedForTargetRef.current !== targetEndTimeMs) {
      firedForTargetRef.current = null;
    }

    syncTimer();

    const intervalId = window.setInterval(syncTimer, 200);
    const handleVisibilityOrFocus = () => {
      syncTimer();
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [targetEndTimeMs, syncTimer]);

  const isRunning = targetEndTimeMs !== null && remainingSeconds > 0;
  const progressRatio =
    targetEndTimeMs !== null && totalSeconds > 0
      ? clamp(remainingSeconds / totalSeconds, 0, 1)
      : 0;

  return {
    remainingSeconds,
    progressRatio,
    isRunning,
  };
}
