import { ChevronDown, Settings } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet, showToast } from '../../components/ui';
import {
  addIsoDays,
  calculateCnsFatigue,
  getDayKeyFromIsoDate,
  getMondayIsoDate,
} from '../../domain/fatigue-engine';
import { applyHighCnsTrim, prescribeSession } from '../../domain/progression-engine';
import { DAY_ORDER, getRoutineDay } from '../../domain/routine-model-a';
import type { CnsStatus, PrescribedExercise } from '../../domain/types';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import { getLocalTodayIso, useWorkoutStore } from '../../store/workout-store';
import { DayStrip } from './DayStrip';
import { F45CheckinSheet } from './F45CheckinSheet';
import { RecoveryCheckSheet } from './RecoveryCheckSheet';

export interface TodayViewProps {
  onOpenSettings: () => void;
}

const CNS_BADGE_STYLE: Record<
  CnsStatus,
  { container: string; dot: string; label: string }
> = {
  optimal: {
    container: 'bg-[#E8FAF0] text-[#027A48]',
    dot: 'bg-[#03B26C]',
    label: '최적',
  },
  caution: {
    container: 'bg-[#FFF5E6] text-[#B45309]',
    dot: 'bg-[#FF9F0A]',
    label: '보통',
  },
  overload: {
    container: 'bg-[#FFEBEE] text-[#C92A2A]',
    dot: 'bg-[#F04452]',
    label: '주의',
  },
};

function formatWeightText(
  weightKg: number,
  unit: PrescribedExercise['activeUnit'],
): string {
  if (unit === 'kg_added') {
    return weightKg > 0 ? `+${weightKg}kg` : '맨몸';
  }
  if (unit === 'kg_per_hand') {
    return `${weightKg}kg (한 손)`;
  }
  return `${weightKg}kg`;
}

function buildWeightMissionLine(exercise: PrescribedExercise): string {
  const cleanName = exercise.activeName.replace(/\s*\(탑세트\)\s*$/, '');
  const weightText = formatWeightText(
    exercise.prescribedWeightKg,
    exercise.activeUnit,
  );
  if (exercise.activeUnit === 'kg_meters') {
    const meters = exercise.definition.distanceMeters ?? 25;
    return `${cleanName} ${weightText} ${meters}m를 완주해요`;
  }
  const repRange =
    exercise.repsMin === exercise.repsMax
      ? `${exercise.repsMin}회`
      : `${exercise.repsMin}~${exercise.repsMax}회`;
  return `${cleanName} ${weightText} ${repRange}에 도전해요`;
}

function formatRoutinePreviewRow(exercise: PrescribedExercise): {
  targetText: string;
  weightText: string;
} {
  const weightText = formatWeightText(
    exercise.prescribedWeightKg,
    exercise.activeUnit,
  );
  if (exercise.activeUnit === 'kg_meters') {
    const meters = exercise.definition.distanceMeters ?? 25;
    return {
      targetText: `${exercise.sets}세트 × ${meters}m`,
      weightText,
    };
  }
  const repText =
    exercise.repsMin === exercise.repsMax
      ? `${exercise.repsMin}회`
      : `${exercise.repsMin}~${exercise.repsMax}회`;
  return {
    targetText: `${exercise.sets}세트 × ${repText}`,
    weightText,
  };
}

export function TodayView({ onOpenSettings }: TodayViewProps) {
  const isDemoMode = useWorkoutStore((s) => s.isDemoMode);
  const currentCycleWeek = useWorkoutStore((s) => s.currentCycleWeek);
  const selectedDayOverride = useWorkoutStore((s) => s.selectedDayOverride);
  const pendingCnsTrimForDay = useWorkoutStore((s) => s.pendingCnsTrimForDay);
  const userProfile = useWorkoutStore((s) => s.userProfile);
  const weightLogs = useWorkoutStore((s) => s.weightLogs);
  const f45Logs = useWorkoutStore((s) => s.f45Logs);
  const recoveryLogs = useWorkoutStore((s) => s.recoveryLogs);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const settings = useWorkoutStore((s) => s.settings);

  const selectDay = useWorkoutStore((s) => s.selectDay);
  const togglePendingCnsTrim = useWorkoutStore((s) => s.togglePendingCnsTrim);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const resumeWorkout = useWorkoutStore((s) => s.resumeWorkout);
  const discardActiveWorkout = useWorkoutStore((s) => s.discardActiveWorkout);
  const advanceToNextCycle = useWorkoutStore((s) => s.advanceToNextCycle);
  const toggleRecoveryCheckItem = useWorkoutStore(
    (s) => s.toggleRecoveryCheckItem,
  );
  const resetToLiveCleanState = useWorkoutStore(
    (s) => s.resetToLiveCleanState,
  );

  const { unlockAudio, triggerTapHaptic } = useSoundHaptics();

  const [isRoutineOpen, setIsRoutineOpen] = useState(false);
  const [isF45SheetOpen, setIsF45SheetOpen] = useState(false);
  const [isRecoverySheetOpen, setIsRecoverySheetOpen] = useState(false);
  const [isDemoResetSheetOpen, setIsDemoResetSheetOpen] = useState(false);

  const todayISO = getLocalTodayIso();
  const actualTodayKey = getDayKeyFromIsoDate(todayISO);
  const selectedDayKey = selectedDayOverride ?? actualTodayKey;
  const mondayISO = getMondayIsoDate(todayISO);
  const selectedDayOffset = Math.max(0, DAY_ORDER.indexOf(selectedDayKey));
  const selectedDateISO = addIsoDays(mondayISO, selectedDayOffset);
  const isPreviewingOtherDay = selectedDayKey !== actualTodayKey;

  const dayDef = getRoutineDay(selectedDayKey);

  const cns = calculateCnsFatigue({
    referenceDateISO: todayISO,
    cycleWeek: currentCycleWeek,
    weightLogs,
    f45Logs,
    recoveryLogs,
  });

  const basePrescribed = prescribeSession({
    dayKey: selectedDayKey,
    cycleWeek: currentCycleWeek,
    weightLogs,
    baseOneRm: userProfile.baseOneRm,
    preferAlternatives: settings.preferAlternatives,
  });

  const isCnsTrimApplied =
    dayDef.type === 'weight' &&
    cns.shouldSuggestBackoffTrim &&
    currentCycleWeek !== 6 &&
    pendingCnsTrimForDay === selectedDayKey;

  const prescribed = isCnsTrimApplied
    ? applyHighCnsTrim(basePrescribed)
    : basePrescribed;

  const existingWeightLog = weightLogs.find(
    (log) => log.dateISO === selectedDateISO && log.dayKey === selectedDayKey,
  );
  const existingF45Log = f45Logs.find(
    (log) => log.dateISO === selectedDateISO,
  );
  const existingRecoveryLog = recoveryLogs.find(
    (log) => log.dateISO === selectedDateISO,
  );

  const primaryExercise =
    prescribed.exercises.find((ex) => ex.definition.role === 'top') ??
    prescribed.exercises[0];

  const totalPlannedSets = prescribed.exercises.reduce(
    (sum, ex) => sum + ex.sets,
    0,
  );
  const estimatedMinutes =
    dayDef.type === 'weight'
      ? Math.max(30, Math.round((totalPlannedSets * 4) / 5) * 5)
      : dayDef.type === 'f45'
        ? 45
        : 0;

  let missionText = `${dayDef.title} 루틴을 진행해요`;
  let statusPillLabel = '준비 완료';
  let statusPillClass = 'bg-[#E8F3FF] text-[#1B64DA]';

  if (dayDef.type === 'weight' && primaryExercise) {
    missionText = buildWeightMissionLine(primaryExercise);
    if (existingWeightLog) {
      statusPillLabel = '오늘 기록 완료';
      statusPillClass = 'bg-[#E8FAF0] text-[#027A48]';
    } else {
      statusPillLabel = primaryExercise.progressionBadge;
      if (primaryExercise.progressionTone === 'increase') {
        statusPillClass = 'bg-[#E8FAF0] text-[#027A48]';
      } else if (primaryExercise.progressionTone === 'decrease') {
        statusPillClass = 'bg-[#FFF5E6] text-[#B45309]';
      } else {
        statusPillClass = 'bg-[#E8F3FF] text-[#1B64DA]';
      }
    }
  } else if (dayDef.type === 'f45') {
    missionText = `${dayDef.title} 출석과 강도를 기록해요`;
    if (existingF45Log) {
      statusPillLabel = `출석 완료 (RPE ${existingF45Log.rpe})`;
      statusPillClass = 'bg-[#E8FAF0] text-[#027A48]';
    } else {
      statusPillLabel = '컨디셔닝';
      statusPillClass = 'bg-[#E8F3FF] text-[#1B64DA]';
    }
  } else if (dayDef.type === 'rest') {
    const checkedCount = existingRecoveryLog?.checkedItemIds.length ?? 0;
    missionText = '4가지 회복 루틴을 체크해요';
    statusPillLabel =
      checkedCount > 0 ? `회복 ${checkedCount}/4 완료` : '휴식 및 영양';
    statusPillClass =
      checkedCount === 4
        ? 'bg-[#E8FAF0] text-[#027A48]'
        : 'bg-[#E8F3FF] text-[#1B64DA]';
  }

  const cnsStyle = CNS_BADGE_STYLE[cns.status];

  let activeCompletedCount = 0;
  let activeTotalCount = 0;
  if (activeSession) {
    for (const ex of activeSession.exercises) {
      for (const s of ex.sets) {
        activeTotalCount += 1;
        if (s.completed || s.skipped) {
          activeCompletedCount += 1;
        }
      }
    }
  }

  const handleStartWeight = () => {
    unlockAudio();
    triggerTapHaptic();
    startWorkout(selectedDayKey, {
      applyCnsTrim: isCnsTrimApplied,
      dateISO: todayISO,
    });
  };

  const handleResumeWeight = () => {
    unlockAudio();
    triggerTapHaptic();
    resumeWorkout();
  };

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#191F28] shadow-[0_1px_2px_rgba(15,23,42,0.04)] tabular-nums">
            {currentCycleWeek === 6
              ? '6주차 디로딩 주간'
              : `${currentCycleWeek}주차 (6주 주기)`}
          </span>

          {isDemoMode ? (
            <button
              type="button"
              onClick={() => setIsDemoResetSheetOpen(true)}
              className="inline-flex min-h-12 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full bg-[#E8F3FF] px-3 text-[13px] font-semibold text-[#1B64DA] hover:bg-[#D5E8FF] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              체험 데이터
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="설정 열기"
          className="inline-flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-[#4E5968] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-[#E5E8EB]/60 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <DayStrip
        todayISO={todayISO}
        actualTodayKey={actualTodayKey}
        selectedDayKey={selectedDayKey}
        weightLogs={weightLogs}
        f45Logs={f45Logs}
        recoveryLogs={recoveryLogs}
        onSelectDay={selectDay}
      />

      {currentCycleWeek === 6 ? (
        <section className="rounded-[20px] bg-[#E8F3FF] p-5 space-y-3">
          <p className="text-[14px] font-semibold leading-relaxed text-[#191F28]">
            6주차 디로딩 주간이에요. 중량은 유지하고 세트 수만 절반으로 줄여요.
          </p>
          <button
            type="button"
            onClick={() => {
              triggerTapHaptic();
              advanceToNextCycle();
              showToast('새 사이클 1주차를 시작해요');
            }}
            className="min-h-12 w-full cursor-pointer rounded-[14px] bg-white px-4 text-[15px] font-bold text-[#1B64DA] hover:bg-[#F8FBFF] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            새 사이클 1주차 시작하기
          </button>
        </section>
      ) : null}

      <section
        aria-label="오늘의 훈련 요약"
        className="rounded-[24px] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-5"
      >
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-[22px] font-bold tracking-tight text-[#191F28]">
              {dayDef.fullLabel} {dayDef.title}
            </h1>
            {isPreviewingOtherDay ? (
              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[#F2F4F6] px-2.5 py-1 text-[12px] font-semibold text-[#4E5968]">
                미리보기 날짜
              </span>
            ) : null}
          </div>
          <p className="text-[14px] leading-relaxed text-[#4E5968]">
            {dayDef.type === 'weight' ? prescribed.subtitle : dayDef.subtitle}
          </p>
        </div>

        <div className="space-y-2.5 border-t border-[#F2F4F6] pt-4">
          <p className="text-[17px] font-bold leading-snug text-[#191F28] tabular-nums">
            {missionText}
          </p>
          <div>
            <span
              className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold tabular-nums ${statusPillClass}`}
            >
              {statusPillLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F2F4F6] pt-4">
          <span className="whitespace-nowrap text-[13px] font-semibold text-[#6B7684] tabular-nums">
            {dayDef.type === 'rest'
              ? '수면 및 영양 관리'
              : `예상 시간 약 ${estimatedMinutes}분`}
          </span>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold tabular-nums ${cnsStyle.container}`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${cnsStyle.dot}`}
            />
            <span>
              신경계 피로도 {cns.score} {cnsStyle.label}
            </span>
          </span>
        </div>
      </section>

      {dayDef.type === 'weight' &&
      cns.shouldSuggestBackoffTrim &&
      currentCycleWeek !== 6 ? (
        <section className="rounded-[20px] bg-[#FFF5E6] p-5 space-y-3">
          <p className="text-[14px] font-semibold leading-relaxed text-[#191F28]">
            피로도가 높아요. 백오프 1세트를 줄일까요?
          </p>
          <button
            type="button"
            aria-pressed={isCnsTrimApplied}
            onClick={() => {
              triggerTapHaptic();
              togglePendingCnsTrim(selectedDayKey);
            }}
            className={`min-h-12 w-full cursor-pointer rounded-[14px] px-4 text-[14px] font-bold active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
              isCnsTrimApplied
                ? 'bg-[#B45309] text-white'
                : 'bg-white text-[#B45309]'
            }`}
          >
            {isCnsTrimApplied
              ? '감량 적용됨 (누르면 해제)'
              : '백오프 1세트 줄이기 적용'}
          </button>
        </section>
      ) : null}

      {dayDef.type === 'weight' && prescribed.exercises.length > 0 ? (
        <section className="rounded-[20px] bg-white px-5 py-1 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <button
            type="button"
            aria-expanded={isRoutineOpen}
            onClick={() => setIsRoutineOpen((prev) => !prev)}
            className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            <span className="text-[15px] font-semibold text-[#191F28] tabular-nums">
              오늘 루틴 {prescribed.exercises.length}종목 살펴보기
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-5 w-5 shrink-0 text-[#6B7684] transition-transform duration-150 ${
                isRoutineOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isRoutineOpen ? (
            <div className="divide-y divide-[#F2F4F6] pb-2">
              {prescribed.exercises.map((exercise) => {
                const row = formatRoutinePreviewRow(exercise);
                return (
                  <div
                    key={exercise.definition.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold leading-snug text-[#191F28]">
                        {exercise.activeName}
                      </p>
                      <p className="mt-0.5 text-[12px] font-medium text-[#6B7684] tabular-nums">
                        {row.targetText}
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-bold text-[#1B64DA] tabular-nums">
                      {row.weightText}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-2 pt-1">
        {activeSession ? (
          <>
            <button
              type="button"
              onClick={handleResumeWeight}
              className="min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white tabular-nums hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              이어서 운동하기 ({activeCompletedCount}/{activeTotalCount} 세트)
            </button>
            <button
              type="button"
              onClick={() => {
                triggerTapHaptic();
                discardActiveWorkout();
                showToast('진행 중인 운동 기록을 비웠어요');
              }}
              className="min-h-12 w-full cursor-pointer rounded-[16px] px-4 text-[14px] font-semibold text-[#4E5968] hover:bg-white/70 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              진행 중인 기록 비우기
            </button>
          </>
        ) : dayDef.type === 'weight' ? (
          <button
            type="button"
            onClick={handleStartWeight}
            className="min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            {isPreviewingOtherDay
              ? `${dayDef.fullLabel} ${dayDef.title} 당겨서 시작하기`
              : '오늘 운동 시작하기'}
          </button>
        ) : dayDef.type === 'f45' ? (
          <button
            type="button"
            onClick={() => {
              triggerTapHaptic();
              setIsF45SheetOpen(true);
            }}
            className="min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            {existingF45Log ? 'F45 기록 수정하기' : '오늘 F45 출석 기록하기'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              triggerTapHaptic();
              setIsRecoverySheetOpen(true);
            }}
            className="min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            오늘 회복 체크하기
          </button>
        )}
      </div>

      <F45CheckinSheet
        open={isF45SheetOpen}
        onClose={() => setIsF45SheetOpen(false)}
        dateISO={selectedDateISO}
        dayKey={selectedDayKey}
        defaultFocus={dayDef.f45DefaultFocus}
        existingLog={existingF45Log}
      />

      <RecoveryCheckSheet
        open={isRecoverySheetOpen}
        onClose={() => setIsRecoverySheetOpen(false)}
        dateISO={selectedDateISO}
        checkedItemIds={existingRecoveryLog?.checkedItemIds ?? []}
        onToggleItem={toggleRecoveryCheckItem}
      />

      <BottomSheet
        open={isDemoResetSheetOpen}
        onClose={() => setIsDemoResetSheetOpen(false)}
        title="체험 데이터를 초기화할까요?"
        description="샘플로 채워진 4주 기록을 지우고 내 실제 기록으로 1주차부터 시작할 수 있어요"
      >
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              triggerTapHaptic();
              resetToLiveCleanState();
              setIsDemoResetSheetOpen(false);
              showToast('내 기록 모드로 1주차부터 시작해요');
            }}
            className="min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            내 기록으로 새로 시작하기
          </button>
          <button
            type="button"
            onClick={() => setIsDemoResetSheetOpen(false)}
            className="min-h-[52px] w-full cursor-pointer rounded-[18px] bg-[#F2F4F6] px-5 text-[16px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            계속 체험하기
          </button>
        </div>
      </BottomSheet>
    </main>
  );
}
