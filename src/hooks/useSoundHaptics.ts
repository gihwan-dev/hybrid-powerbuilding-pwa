import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { useCallback } from 'react';
import { useWorkoutStore } from '../store/workout-store';

interface CapacitorHapticsPlugin {
  impact?: (options: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>;
  notification?: (options: {
    type: 'SUCCESS' | 'WARNING' | 'ERROR';
  }) => Promise<void>;
}

interface TestBridgeWindow {
  Capacitor?: {
    Plugins?: {
      Haptics?: CapacitorHapticsPlugin;
    };
  };
  webkitAudioContext?: typeof AudioContext;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    return sharedAudioContext;
  }

  const win = window as unknown as TestBridgeWindow;
  const AudioCtx = window.AudioContext ?? win.webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    sharedAudioContext = new AudioCtx();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function getInjectedTestHaptics(): CapacitorHapticsPlugin | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as TestBridgeWindow).Capacitor?.Plugins?.Haptics ?? null;
}

function scheduleTone(
  ctx: AudioContext,
  frequencyHz: number,
  startTime: number,
  durationSec: number,
  peakGain: number,
  type: OscillatorType,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequencyHz, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.02);
}

export interface UseSoundHapticsOptions {
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
}

export interface UseSoundHapticsResult {
  unlockAudio: () => void;
  playRestCompleteChime: () => void;
  playSetCompleteTick: () => void;
  triggerRestCompleteHaptic: () => void;
  triggerTapHaptic: () => void;
}

export function useSoundHaptics(
  options?: UseSoundHapticsOptions,
): UseSoundHapticsResult {
  const storeSoundEnabled = useWorkoutStore((s) => s.settings.soundEnabled);
  const storeVibrationEnabled = useWorkoutStore(
    (s) => s.settings.vibrationEnabled,
  );

  const soundEnabled = options?.soundEnabled ?? storeSoundEnabled;
  const vibrationEnabled = options?.vibrationEnabled ?? storeVibrationEnabled;

  const unlockAudio = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  }, []);

  const playRestCompleteChime = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const triggerChime = () => {
      try {
        const now = ctx.currentTime;
        // Warm 2-note chime: E5 (659.25Hz) followed 140ms later by B5 (987.77Hz)
        scheduleTone(ctx, 659.25, now, 0.26, 0.16, 'sine');
        scheduleTone(ctx, 659.25, now, 0.22, 0.05, 'triangle');

        const secondStart = now + 0.14;
        scheduleTone(ctx, 987.77, secondStart, 0.42, 0.18, 'sine');
        scheduleTone(ctx, 987.77, secondStart, 0.36, 0.06, 'triangle');
      } catch {
        // Ignore Web Audio scheduling errors on restricted browsers
      }
    };

    if (ctx.state === 'suspended') {
      void ctx.resume().then(triggerChime).catch(() => {});
      return;
    }

    triggerChime();
  }, [soundEnabled]);

  const playSetCompleteTick = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const triggerTick = () => {
      try {
        const now = ctx.currentTime;
        scheduleTone(ctx, 523.25, now, 0.06, 0.1, 'sine');
      } catch {
        // Ignore Web Audio scheduling errors on restricted browsers
      }
    };

    if (ctx.state === 'suspended') {
      void ctx.resume().then(triggerTick).catch(() => {});
      return;
    }

    triggerTick();
  }, [soundEnabled]);

  const triggerRestCompleteHaptic = useCallback(() => {
    if (!vibrationEnabled) return;
    const injectedHaptics = getInjectedTestHaptics();
    if (injectedHaptics?.notification) {
      void injectedHaptics.notification({ type: 'SUCCESS' }).catch(() => {});
      return;
    }
    if (Capacitor.isNativePlatform()) {
      void Haptics.notification({ type: NotificationType.Success }).catch(
        () => {},
      );
      return;
    }
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      try {
        navigator.vibrate([120, 60, 120]);
      } catch {
        // Ignore vibration API errors
      }
    }
  }, [vibrationEnabled]);

  const triggerTapHaptic = useCallback(() => {
    if (!vibrationEnabled) return;
    const injectedHaptics = getInjectedTestHaptics();
    if (injectedHaptics?.impact) {
      void injectedHaptics.impact({ style: 'LIGHT' }).catch(() => {});
      return;
    }
    if (Capacitor.isNativePlatform()) {
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      return;
    }
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignore vibration API errors
      }
    }
  }, [vibrationEnabled]);

  return {
    unlockAudio,
    playRestCompleteChime,
    playSetCompleteTick,
    triggerRestCompleteHaptic,
    triggerTapHaptic,
  };
}
