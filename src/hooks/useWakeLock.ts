import { useEffect, useRef, useState } from 'react';

export interface UseWakeLockResult {
  isSupported: boolean;
  isActive: boolean;
}

export function useWakeLock(enabled: boolean): UseWakeLockResult {
  const isSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.wakeLock?.request === 'function';

  const [isActive, setIsActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || !isSupported) {
      const current = sentinelRef.current;
      sentinelRef.current = null;
      setIsActive(false);
      if (current) {
        void current.release().catch(() => {});
      }
      return;
    }

    let cancelled = false;
    let requestInFlight = false;

    const releaseSentinel = () => {
      const current = sentinelRef.current;
      sentinelRef.current = null;
      if (current) {
        void current.release().catch(() => {});
      }
      if (!cancelled) {
        setIsActive(false);
      }
    };

    const requestWakeLock = async () => {
      const existing = sentinelRef.current;
      if (
        cancelled ||
        requestInFlight ||
        (existing && !existing.released) ||
        (typeof document !== 'undefined' &&
          document.visibilityState === 'hidden')
      ) {
        return;
      }

      requestInFlight = true;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }

        const handleRelease = () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null;
          }
          if (!cancelled) {
            setIsActive(false);
          }
        };

        sentinel.addEventListener('release', handleRelease);
        sentinelRef.current = sentinel;
        setIsActive(true);
      } catch {
        if (!cancelled) {
          setIsActive(false);
        }
      } finally {
        requestInFlight = false;
      }
    };

    void requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseSentinel();
    };
  }, [enabled, isSupported]);

  return {
    isSupported,
    isActive,
  };
}
