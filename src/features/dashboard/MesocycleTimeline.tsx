import type { CycleWeek, ForecastResult } from '../../domain/types';

export interface MesocycleTimelineProps {
  currentCycleWeek: CycleWeek;
  bodyweightKg: number;
  forecast: ForecastResult;
}

const CYCLE_WEEKS: readonly CycleWeek[] = [1, 2, 3, 4, 5, 6];

export function MesocycleTimeline({
  currentCycleWeek,
  bodyweightKg,
  forecast,
}: MesocycleTimelineProps) {
  const { bench, squat, deadlift } = forecast.currentOneRm;
  const rawTotalKg = Math.max(0, bench) + Math.max(0, squat) + Math.max(0, deadlift);
  const bwRatio =
    bodyweightKg > 0
      ? (forecast.currentSbdTotalKg / bodyweightKg).toFixed(2)
      : '0.00';

  const benchPct =
    rawTotalKg > 0 ? Math.min(100, Math.round((Math.max(0, bench) / rawTotalKg) * 100)) : 0;
  const squatPct =
    rawTotalKg > 0
      ? Math.min(100 - benchPct, Math.round((Math.max(0, squat) / rawTotalKg) * 100))
      : 0;
  const deadliftPct = rawTotalKg > 0 ? Math.max(0, 100 - benchPct - squatPct) : 0;

  const liftShares = [
    {
      key: 'bench',
      label: '벤치',
      kg: bench,
      pct: benchPct,
      barColor: 'bg-[#1B64DA]',
      dotColor: 'bg-[#1B64DA]',
    },
    {
      key: 'squat',
      label: '스쿼트',
      kg: squat,
      pct: squatPct,
      barColor: 'bg-[#03B26C]',
      dotColor: 'bg-[#03B26C]',
    },
    {
      key: 'deadlift',
      label: '데드',
      kg: deadlift,
      pct: deadliftPct,
      barColor: 'bg-[#FF9F0A]',
      dotColor: 'bg-[#FF9F0A]',
    },
  ] as const;

  return (
    <section
      aria-label="6주 주기화 및 근력 균형"
      className="rounded-[24px] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold tracking-tight text-[#191F28]">
          6주 주기화 및 근력 균형
        </h2>
        <span className="inline-flex items-center rounded-full bg-[#E8F3FF] px-3 py-1 text-[12px] font-bold text-[#1B64DA] tabular-nums">
          {currentCycleWeek === 6
            ? '6주차 디로드'
            : `${currentCycleWeek}주차 과부하`}
        </span>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5 min-[400px]:grid-cols-6">
          {CYCLE_WEEKS.map((week) => {
            const isCurrent = week === currentCycleWeek;
            const isPast = week < currentCycleWeek;
            const isDeload = week === 6;

            let cellStyle = 'bg-[#F2F4F6] text-[#4E5968]';
            if (isCurrent) {
              cellStyle = isDeload
                ? 'bg-[#027A48] text-white'
                : 'bg-[#1B64DA] text-white';
            } else if (isPast) {
              cellStyle = 'bg-[#E8F3FF] text-[#1B64DA]';
            }

            return (
              <div
                key={week}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center rounded-[14px] px-1 py-1.5 text-center tabular-nums ${cellStyle}`}
              >
                <span className="whitespace-nowrap text-[13px] font-bold">{week}주</span>
                <span className="mt-0.5 whitespace-nowrap text-[12px] font-medium">
                  {isDeload ? '디로드' : '과부하'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 border-t border-[#F2F4F6] pt-4">
        <div className="flex items-center justify-between gap-2 tabular-nums">
          <div>
            <p className="text-[12px] font-semibold text-[#6B7684]">
              체중 대비 근력 비율
            </p>
            <p className="mt-0.5 text-[18px] font-bold text-[#191F28]">
              체중 대비 {bwRatio}배
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold text-[#6B7684]">
              표준 근력 지수
            </p>
            <p className="mt-0.5 text-[18px] font-bold text-[#1B64DA]">
              DOTS {forecast.dotsCurrent}
            </p>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="flex h-3 w-full overflow-hidden rounded-full bg-[#F2F4F6]"
        >
          {liftShares.map((item) => (
            <div
              key={item.key}
              style={{ width: `${item.pct}%` }}
              className={`h-full ${item.barColor}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 divide-x divide-[#F2F4F6]">
          {liftShares.map((item) => (
            <div
              key={item.key}
              className="px-2 first:pl-0 last:pr-0 tabular-nums"
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${item.dotColor}`}
                />
                <span className="text-[12px] font-semibold text-[#6B7684]">
                  {item.label}
                </span>
              </div>
              <p className="mt-1 text-[15px] font-bold text-[#191F28]">
                {item.kg}kg
              </p>
              <p className="text-[12px] font-medium text-[#6B7684]">
                {item.pct}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
