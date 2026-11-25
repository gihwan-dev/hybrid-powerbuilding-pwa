import { Settings } from 'lucide-react';
import { useState } from 'react';
import {
  BottomSheet,
  SegmentedTabs,
  showToast,
  type SegmentedTabOption,
} from '../../components/ui';
import { build12WeekForecast } from '../../domain/e1rm-engine';
import {
  calculateCnsFatigue,
  getMondayIsoDate,
} from '../../domain/fatigue-engine';
import type { ForecastSeriesKey } from '../../domain/types';
import { calculateWeeklyMuscleVolume } from '../../domain/volume-engine';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import { getLocalTodayIso, useWorkoutStore } from '../../store/workout-store';
import { CnsFatigueCard } from './CnsFatigueCard';
import { E1rmForecastChart } from './E1rmForecastChart';
import { MesocycleTimeline } from './MesocycleTimeline';
import { MuscleVolumeCard } from './MuscleVolumeCard';

export interface DashboardViewProps {
  onOpenSettings: () => void;
}

const SERIES_TABS: readonly SegmentedTabOption<ForecastSeriesKey>[] = [
  { value: 'total', label: '3대 합계' },
  { value: 'bench', label: '벤치' },
  { value: 'squat', label: '스쿼트' },
  { value: 'deadlift', label: '데드' },
];

function formatSignedDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}kg`;
}

export function DashboardView({ onOpenSettings }: DashboardViewProps) {
  const isDemoMode = useWorkoutStore((s) => s.isDemoMode);
  const currentCycleWeek = useWorkoutStore((s) => s.currentCycleWeek);
  const userProfile = useWorkoutStore((s) => s.userProfile);
  const weightLogs = useWorkoutStore((s) => s.weightLogs);
  const f45Logs = useWorkoutStore((s) => s.f45Logs);
  const recoveryLogs = useWorkoutStore((s) => s.recoveryLogs);
  const resetToLiveCleanState = useWorkoutStore((s) => s.resetToLiveCleanState);

  const { triggerTapHaptic } = useSoundHaptics();
  const [selectedSeries, setSelectedSeries] =
    useState<ForecastSeriesKey>('total');
  const [isDemoResetSheetOpen, setIsDemoResetSheetOpen] = useState(false);

  const todayISO = getLocalTodayIso();
  const mondayISO = getMondayIsoDate(todayISO);

  const forecast = build12WeekForecast({
    weightLogs,
    baseOneRm: userProfile.baseOneRm,
    currentCycleWeek,
    bodyweightKg: userProfile.weightKg,
  });

  const cns = calculateCnsFatigue({
    referenceDateISO: todayISO,
    cycleWeek: currentCycleWeek,
    weightLogs,
    f45Logs,
    recoveryLogs,
  });

  const weeklyVolume = calculateWeeklyMuscleVolume({
    weekStartISO: mondayISO,
    weightLogs,
    cycleWeek: currentCycleWeek,
  });

  const activeSeries = forecast.series[selectedSeries];

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-bold tracking-tight text-[#191F28]">
            대시보드
          </h1>

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

      <section
        aria-label="12주 1RM 성장 전망"
        className="rounded-[24px] bg-white p-5 min-[380px]:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-5"
      >
        <div className="space-y-1.5">
          <p className="text-[14px] font-semibold text-[#6B7684]">
            {activeSeries.label} 추정 1RM 전망
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-2 tabular-nums">
            <span className="text-[32px] font-bold leading-none tracking-tight text-[#191F28]">
              {activeSeries.currentKg}kg
            </span>
            <span className="text-[14px] font-bold text-[#1B64DA]">
              12주 후 {activeSeries.week12Kg}kg (
              {formatSignedDelta(activeSeries.delta12WeekKg)})
            </span>
          </div>
        </div>

        <SegmentedTabs
          options={SERIES_TABS}
          value={selectedSeries}
          onChange={setSelectedSeries}
          ariaLabel="리프트 종목 선택"
        />

        <E1rmForecastChart summary={activeSeries} />

        <div className="grid grid-cols-3 divide-x divide-[#F2F4F6] border-t border-[#F2F4F6] pt-4">
          <div className="pr-2 tabular-nums">
            <p className="whitespace-nowrap text-[12px] font-semibold text-[#6B7684]">
              4주 후
            </p>
            <p className="mt-1 whitespace-nowrap text-[15px] min-[380px]:text-[16px] font-bold text-[#191F28]">
              {activeSeries.week4Kg}kg
            </p>
          </div>
          <div className="px-2 text-center tabular-nums">
            <p className="whitespace-nowrap text-[12px] font-semibold text-[#6B7684]">
              8주 후
            </p>
            <p className="mt-1 whitespace-nowrap text-[15px] min-[380px]:text-[16px] font-bold text-[#191F28]">
              {activeSeries.week8Kg}kg
            </p>
          </div>
          <div className="pl-2 text-right tabular-nums">
            <p className="whitespace-nowrap text-[12px] font-semibold text-[#6B7684]">
              12주 후
            </p>
            <p className="mt-1 whitespace-nowrap text-[15px] min-[380px]:text-[16px] font-bold text-[#1B64DA]">
              {activeSeries.week12Kg}kg
            </p>
          </div>
        </div>
      </section>

      <CnsFatigueCard cns={cns} />

      <MuscleVolumeCard
        summaries={weeklyVolume}
        isDeloadWeek={currentCycleWeek === 6}
      />

      <MesocycleTimeline
        currentCycleWeek={currentCycleWeek}
        bodyweightKg={userProfile.weightKg}
        forecast={forecast}
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
