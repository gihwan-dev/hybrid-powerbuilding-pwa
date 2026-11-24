import { Check } from 'lucide-react';
import { addIsoDays, getMondayIsoDate } from '../../domain/fatigue-engine';
import { DAY_ORDER, ROUTINE_DAYS } from '../../domain/routine-model-a';
import type {
  DayKey,
  F45SessionLog,
  RecoveryCheckLog,
  WeightSessionLog,
} from '../../domain/types';

export interface DayStripProps {
  todayISO: string;
  actualTodayKey: DayKey;
  selectedDayKey: DayKey;
  weightLogs: WeightSessionLog[];
  f45Logs: F45SessionLog[];
  recoveryLogs: RecoveryCheckLog[];
  onSelectDay: (dayKey: DayKey | null) => void;
}

export function DayStrip({
  todayISO,
  actualTodayKey,
  selectedDayKey,
  weightLogs,
  f45Logs,
  recoveryLogs,
  onSelectDay,
}: DayStripProps) {
  const mondayISO = getMondayIsoDate(todayISO);

  const completedDates = new Set<string>();
  for (const log of weightLogs) {
    completedDates.add(log.dateISO);
  }
  for (const log of f45Logs) {
    completedDates.add(log.dateISO);
  }
  for (const log of recoveryLogs) {
    if (log.checkedItemIds.length > 0) {
      completedDates.add(log.dateISO);
    }
  }

  const isPreviewingOtherDay = selectedDayKey !== actualTodayKey;

  return (
    <section aria-label="이번 주 훈련 일정" className="space-y-2">
      <div className="-mx-2.5 grid grid-cols-7 gap-0.5 px-1">
        {DAY_ORDER.map((dayKey, index) => {
          const dayDef = ROUTINE_DAYS[dayKey];
          const dateISO = addIsoDays(mondayISO, index);
          const dayNumber = Number(dateISO.split('-')[2] ?? '1');
          const isToday = dayKey === actualTodayKey;
          const isSelected = dayKey === selectedDayKey;
          const isCompleted = completedDates.has(dateISO);

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => onSelectDay(isToday ? null : dayKey)}
              aria-pressed={isSelected}
              aria-label={`${dayDef.fullLabel} ${dayNumber}일${isToday ? ' 오늘' : ''}${isCompleted ? ' 기록 완료' : ''}`}
              className={`relative flex min-h-[64px] min-w-[48px] cursor-pointer flex-col items-center justify-between rounded-[16px] px-1 py-2 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                isSelected
                  ? 'bg-white ring-2 ring-[#3182F6] shadow-[0_1px_3px_rgba(15,23,42,0.06)]'
                  : isToday
                    ? 'bg-white/90'
                    : 'bg-transparent hover:bg-white/60'
              }`}
            >
              <span
                className={`text-[12px] font-semibold ${
                  isSelected || isToday ? 'text-[#1B64DA]' : 'text-[#4E5968]'
                }`}
              >
                {dayDef.shortLabel}
              </span>

              <span
                className={`text-[15px] font-bold tabular-nums ${
                  isSelected ? 'text-[#191F28]' : 'text-[#4E5968]'
                }`}
              >
                {dayNumber}
              </span>

              <span className="flex h-4 items-center justify-center">
                {isCompleted ? (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#3182F6] text-white">
                    <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
                  </span>
                ) : isToday ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3182F6]" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {isPreviewingOtherDay ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onSelectDay(null)}
            className="inline-flex min-h-12 cursor-pointer items-center rounded-[12px] px-3 text-[14px] font-semibold text-[#1B64DA] hover:bg-white/70 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            오늘로 돌아가기
          </button>
        </div>
      ) : null}
    </section>
  );
}
