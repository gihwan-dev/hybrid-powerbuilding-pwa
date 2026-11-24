import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_PROFILE } from '../../domain/routine-model-a';
import { useRestTimer } from '../../hooks/useRestTimer';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import { useWakeLock } from '../../hooks/useWakeLock';
import {
  CORRUPTED_BACKUP_KEY,
  STORAGE_KEY,
  createWorkoutStore,
  getLocalTodayIso,
} from '../workout-store';

function createMemoryStorage(initial?: Record<string, string>): Storage {
  const map = new Map<string, string>(
    initial ? Object.entries(initial) : [],
  );

  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('workout-store & hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 25, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('computes local YYYY-MM-DD without UTC drift around KST midnight–09:00', () => {
    const localAfterMidnight = new Date(2026, 10, 25, 0, 30, 0);
    expect(getLocalTodayIso(localAfterMidnight)).toBe('2026-11-25');
  });

  it('hydrates with seeded demo data on first visit and resets cleanly to Week 1 live state', () => {
    const storage = createMemoryStorage();
    const store = createWorkoutStore(storage);
    const initial = store.getState();

    expect(initial.isDemoMode).toBe(true);
    expect(initial.currentCycleWeek).toBe(4);
    expect(initial.weightLogs.length).toBeGreaterThan(0);
    expect(initial.f45Logs.length).toBeGreaterThan(0);
    expect(initial.recoveryLogs.length).toBeGreaterThan(0);
    expect(initial.isWorkoutOverlayOpen).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();

    store.getState().resetToLiveCleanState();
    const cleaned = store.getState();

    expect(cleaned.isDemoMode).toBe(false);
    expect(cleaned.currentCycleWeek).toBe(1);
    expect(cleaned.weightLogs).toEqual([]);
    expect(cleaned.f45Logs).toEqual([]);
    expect(cleaned.recoveryLogs).toEqual([]);
    expect(cleaned.userProfile).toEqual(DEFAULT_USER_PROFILE);
    expect(cleaned.activeSession).toBeNull();
    expect(cleaned.lastCompletedSummary).toBeNull();
  });

  it('dynamically recalculates Friday squat backoff weight on RIR 2 and RIR 0', () => {
    const storage = createMemoryStorage();
    const store = createWorkoutStore(storage);

    store.getState().startWorkout('fri', { dateISO: '2026-11-27' });
    const started = store.getState().activeSession;
    expect(started?.dayKey).toBe('fri');
    expect(started?.exercises[0]?.exerciseId).toBe('squat_top');
    expect(started?.exercises[1]?.exerciseId).toBe('squat_backoff');

    // Update squat_top to 125kg and complete with RIR 2 -> 125 * 0.88 = 110kg
    store.getState().updateSetDraft(0, 0, { weightKg: 125 });
    store.getState().tapCompleteCurrentSet();
    expect(store.getState().activeSession?.awaitingRirForPointer).toEqual({
      exerciseIndex: 0,
      setIndex: 0,
    });

    store.getState().confirmCurrentSetRir(2);

    const afterRir2 = store.getState().activeSession;
    const backoffAfterRir2 = afterRir2?.exercises[1];
    expect(backoffAfterRir2?.progressionBadge).toBe('탑세트 88%');
    expect(backoffAfterRir2?.sets.map((s) => s.weightKg)).toEqual([
      110,
      110,
      110,
    ]);
    expect(afterRir2?.currentPointer).toEqual({
      exerciseIndex: 1,
      setIndex: 0,
    });

    // Fresh Friday session with RIR 0 on 125kg -> 110 - 2.5 = 107.5kg
    store.getState().discardActiveWorkout();
    store.getState().startWorkout('fri', { dateISO: '2026-11-27' });
    store.getState().updateSetDraft(0, 0, { weightKg: 125 });
    store.getState().tapCompleteCurrentSet();
    store.getState().confirmCurrentSetRir(0);

    const backoffAfterRir0 = store.getState().activeSession?.exercises[1];
    expect(backoffAfterRir0?.progressionBadge).toBe('피로 조절 -2.5kg');
    expect(backoffAfterRir0?.sets.map((s) => s.weightKg)).toEqual([
      107.5,
      107.5,
      107.5,
    ]);
  });

  it('completes skipRir exercises directly into restTimer without awaitingRirForPointer', () => {
    const storage = createMemoryStorage();
    const store = createWorkoutStore(storage);

    // Saturday: speed_bench (index 0) has skipRir: true
    store.getState().startWorkout('sat', { dateISO: '2026-11-28' });
    expect(store.getState().activeSession?.exercises[0]?.exerciseId).toBe(
      'speed_bench',
    );
    expect(store.getState().activeSession?.exercises[0]?.skipRir).toBe(true);

    store.getState().tapCompleteCurrentSet();
    const afterSpeedBench = store.getState().activeSession;
    expect(afterSpeedBench?.awaitingRirForPointer).toBeNull();
    expect(afterSpeedBench?.exercises[0]?.sets[0]?.completed).toBe(true);
    expect(afterSpeedBench?.exercises[0]?.sets[0]?.rir).toBeNull();
    expect(afterSpeedBench?.restTimer.targetEndTimeMs).not.toBeNull();
    expect(afterSpeedBench?.currentPointer).toEqual({
      exerciseIndex: 0,
      setIndex: 1,
    });

    // Tuesday: suitcase_carry (index 5) has skipRir: true and kg_meters
    store.getState().discardActiveWorkout();
    store.getState().startWorkout('tue', { dateISO: '2026-11-24' });
    const suitcaseIdx = store
      .getState()
      .activeSession?.exercises.findIndex((e) => e.exerciseId === 'suitcase_carry');
    expect(suitcaseIdx).toBe(5);
    store.getState().jumpToSet(5, 0);
    store.getState().tapCompleteCurrentSet();
    const afterSuitcase = store.getState().activeSession;
    expect(afterSuitcase?.awaitingRirForPointer).toBeNull();
    expect(afterSuitcase?.exercises[5]?.sets[0]?.completed).toBe(true);
    expect(afterSuitcase?.exercises[5]?.sets[0]?.rir).toBeNull();
    expect(afterSuitcase?.exercises[5]?.sets[0]?.distanceMeters).toBe(35);
    expect(afterSuitcase?.restTimer.targetEndTimeMs).not.toBeNull();

    // Sunday: farmers_walk (index 4) has skipRir: true and kg_meters
    store.getState().discardActiveWorkout();
    store.getState().startWorkout('sun', { dateISO: '2026-11-29' });
    const farmersIdx = store
      .getState()
      .activeSession?.exercises.findIndex((e) => e.exerciseId === 'farmers_walk');
    expect(farmersIdx).toBe(4);
    store.getState().jumpToSet(4, 0);
    store.getState().tapCompleteCurrentSet();
    const afterFarmers = store.getState().activeSession;
    expect(afterFarmers?.awaitingRirForPointer).toBeNull();
    expect(afterFarmers?.exercises[4]?.sets[0]?.completed).toBe(true);
    expect(afterFarmers?.exercises[4]?.sets[0]?.rir).toBeNull();
    expect(afterFarmers?.exercises[4]?.sets[0]?.distanceMeters).toBe(25);
    expect(afterFarmers?.restTimer.targetEndTimeMs).not.toBeNull();
  });

  it('persists activeSession and restTimer across store rehydration', () => {
    const storage = createMemoryStorage();
    const store1 = createWorkoutStore(storage);

    store1.getState().startWorkout('tue', { dateISO: '2026-11-24' });
    store1.getState().updateSetDraft(0, 0, { weightKg: 92.5, reps: 5 });
    store1.getState().tapCompleteCurrentSet();
    store1.getState().confirmCurrentSetRir(2);

    const sessionBeforeReload = store1.getState().activeSession;
    expect(sessionBeforeReload).not.toBeNull();
    const expectedRestEnd = sessionBeforeReload?.restTimer.targetEndTimeMs;
    expect(typeof expectedRestEnd).toBe('number');

    const rawPersisted = storage.getItem(STORAGE_KEY);
    expect(rawPersisted).not.toBeNull();

    // Simulate page reload by instantiating a new store reading the same storage
    const store2 = createWorkoutStore(storage);
    const rehydrated = store2.getState();

    expect(rehydrated.isWorkoutOverlayOpen).toBe(false);
    expect(rehydrated.activeSession?.id).toBe(sessionBeforeReload?.id);
    expect(rehydrated.activeSession?.exercises[0]?.sets[0]?.completed).toBe(true);
    expect(rehydrated.activeSession?.exercises[0]?.sets[0]?.weightKg).toBe(92.5);
    expect(rehydrated.activeSession?.restTimer.targetEndTimeMs).toBe(
      expectedRestEnd,
    );
    expect(rehydrated.activeSession?.currentPointer).toEqual({
      exerciseIndex: 1,
      setIndex: 0,
    });

    rehydrated.resumeWorkout();
    expect(store2.getState().isWorkoutOverlayOpen).toBe(true);
  });

  it('useRestTimer syncs on visibilitychange after background sleep and fires onExpire once', () => {
    const onExpire = vi.fn();
    const startMs = Date.now();
    const targetEndTimeMs = startMs + 60_000;

    const { result } = renderHook(
      (props: { targetEndTimeMs: number | null; totalSeconds: number }) =>
        useRestTimer({
          targetEndTimeMs: props.targetEndTimeMs,
          totalSeconds: props.totalSeconds,
          onExpire,
        }),
      {
        initialProps: {
          targetEndTimeMs,
          totalSeconds: 60,
        },
      },
    );

    expect(result.current.isRunning).toBe(true);
    expect(result.current.remainingSeconds).toBe(60);
    expect(result.current.progressRatio).toBe(1);
    expect(onExpire).not.toHaveBeenCalled();

    // Simulate mobile background sleep: clock advances past targetEndTimeMs without interval firing
    act(() => {
      vi.setSystemTime(targetEndTimeMs + 5_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Additional visibilitychange, focus, or interval ticks must NOT re-fire onExpire
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(1000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('exports/imports backup JSON, handles invalid backup errors in Korean, and quarantines corrupted storage', () => {
    const storage = createMemoryStorage();
    const store = createWorkoutStore(storage);

    store.getState().setCycleWeek(5);
    store.getState().updateBaseOneRm({ squat: 150 });
    store.getState().logF45Session({
      dateISO: '2026-11-25',
      classTitle: 'F45 아틀레티카',
      rpe: 8,
      lowerBodyImpact: 'high',
    });
    store.getState().toggleRecoveryCheckItem('2026-11-26', 'sleep_7h');

    const backupJson = store.getState().exportBackupJson();

    store.getState().resetToLiveCleanState();
    expect(store.getState().currentCycleWeek).toBe(1);
    expect(store.getState().f45Logs).toEqual([]);

    const badJsonResult = store.getState().importBackupJson('{broken json');
    expect(badJsonResult.ok).toBe(false);
    if (!badJsonResult.ok) {
      expect(badJsonResult.error).toMatch(/요$/);
    }

    const badSchemaResult = store
      .getState()
      .importBackupJson(JSON.stringify({ schemaVersion: 2, invalid: true }));
    expect(badSchemaResult.ok).toBe(false);
    if (!badSchemaResult.ok) {
      expect(badSchemaResult.error).toMatch(/요$/);
    }

    const goodResult = store.getState().importBackupJson(backupJson);
    expect(goodResult).toEqual({ ok: true });
    expect(store.getState().currentCycleWeek).toBe(5);
    expect(store.getState().userProfile.baseOneRm.squat).toBe(150);
    expect(
      store.getState().f45Logs.some((f) => f.dateISO === '2026-11-25'),
    ).toBe(true);
    expect(
      store
        .getState()
        .recoveryLogs.find((r) => r.dateISO === '2026-11-26')
        ?.checkedItemIds,
    ).toEqual(['sleep_7h']);

    // Corrupted localStorage on startup should back up raw string and fall back cleanly
    const corruptedRaw = '{"schemaVersion":1,"broken":true}';
    const corruptedStorage = createMemoryStorage({
      [STORAGE_KEY]: corruptedRaw,
    });
    const recoveredStore = createWorkoutStore(corruptedStorage);
    expect(corruptedStorage.getItem(CORRUPTED_BACKUP_KEY)).toBe(corruptedRaw);
    expect(recoveredStore.getState().isDemoMode).toBe(true);
    expect(recoveredStore.getState().currentCycleWeek).toBe(4);
  });

  it('supports alternative swap, extra set, rest timer adjustment, and session completion PR summary', () => {
    const storage = createMemoryStorage();
    const store = createWorkoutStore(storage);

    store.getState().resetToLiveCleanState();
    store.getState().startWorkout('tue', { dateISO: '2026-11-24' });

    // Swap pendlay_row (index 2) to chest_supported_row
    store.getState().swapExerciseAlternative(2);
    const swappedEx = store.getState().activeSession?.exercises[2];
    expect(swappedEx?.usedAlternative).toBe(true);
    expect(swappedEx?.activeName).toBe('체스트 서포티드 로우');
    expect(swappedEx?.sets[0]?.weightKg).toBe(50);
    expect(store.getState().settings.preferAlternatives['pendlay_row']).toBe(
      true,
    );

    // Add extra set to bench_top (index 0)
    store.getState().addExtraSet(0);
    expect(store.getState().activeSession?.exercises[0]?.sets.length).toBe(2);

    // Complete bench_top set 1 at heavy weight to trigger a PR, then adjust rest timer
    store.getState().updateSetDraft(0, 0, { weightKg: 105, reps: 5 });
    store.getState().tapCompleteCurrentSet();
    store.getState().confirmCurrentSetRir(2);

    const restBefore =
      store.getState().activeSession?.restTimer.targetEndTimeMs ?? 0;
    store.getState().adjustRestTimer(30);
    const restAfter =
      store.getState().activeSession?.restTimer.targetEndTimeMs ?? 0;
    expect(restAfter - restBefore).toBe(30_000);

    // Finish early -> saves completed set and generates PR summary
    store.getState().finishWorkout();
    const afterFinish = store.getState();
    expect(afterFinish.activeSession).toBeNull();
    expect(afterFinish.isWorkoutOverlayOpen).toBe(false);
    expect(afterFinish.weightLogs.length).toBe(1);
    expect(afterFinish.lastCompletedSummary?.completedSetCount).toBe(1);
    expect(afterFinish.lastCompletedSummary?.tonnageKg).toBe(525);
    expect(afterFinish.lastCompletedSummary?.newPrLabels.length).toBe(1);
    expect(afterFinish.lastCompletedSummary?.newPrLabels[0]).toContain(
      '벤치프레스',
    );
  });

  it('useWakeLock and useSoundHaptics degrade safely when browser APIs are absent', () => {
    const { result: wakeResult } = renderHook(() => useWakeLock(true));
    expect(typeof wakeResult.current.isSupported).toBe('boolean');
    expect(wakeResult.current.isActive).toBe(false);

    const { result: soundResult } = renderHook(() =>
      useSoundHaptics({ soundEnabled: true, vibrationEnabled: true }),
    );
    expect(() => {
      soundResult.current.unlockAudio();
      soundResult.current.playRestCompleteChime();
      soundResult.current.playSetCompleteTick();
      soundResult.current.triggerRestCompleteHaptic();
      soundResult.current.triggerTapHaptic();
    }).not.toThrow();
  });

  it('prevents false PRs below historical/base 1RM and guards invalid numeric/date inputs', () => {
    const storage = createMemoryStorage();
    const store = createWorkoutStore(storage);

    store.getState().resetToLiveCleanState();
    store.getState().updateBaseOneRm({ bench: 120, squat: Number.NaN, deadlift: -20 });
    expect(store.getState().userProfile.baseOneRm.bench).toBe(120);
    expect(store.getState().userProfile.baseOneRm.squat).toBe(140);
    expect(store.getState().userProfile.baseOneRm.deadlift).toBe(160);

    // Invalid date or NaN inputs should not corrupt persisted state
    store.getState().logF45Session({
      dateISO: '2026-02-30',
      classTitle: 'Invalid',
      rpe: 8,
      lowerBodyImpact: 'low',
    });
    expect(store.getState().f45Logs).toEqual([]);

    store.getState().startWorkout('tue', { dateISO: '2026-11-24' });
    // Bench 90kg x 5 @ RIR 2 = e1RM 111kg (< baseOneRm 120kg) -> NOT a PR
    store.getState().updateSetDraft(0, 0, { weightKg: 90, reps: 5 });
    store.getState().tapCompleteCurrentSet();
    store.getState().confirmCurrentSetRir(2);
    store.getState().adjustRestTimer(Number.NaN);
    expect(store.getState().activeSession?.restTimer.totalSeconds).toBe(210);

    store.getState().finishWorkout();
    expect(store.getState().lastCompletedSummary?.newPrLabels).toEqual([]);

    // Rehydrating must succeed cleanly with zero quarantine
    const rehydrated = createWorkoutStore(storage);
    expect(storage.getItem(CORRUPTED_BACKUP_KEY)).toBeNull();
    expect(rehydrated.getState().weightLogs.length).toBe(1);
  });
});
