import type { MuscleVolumeSummary } from '../../domain/types';

export interface MuscleVolumeCardProps {
  summaries: MuscleVolumeSummary[];
  isDeloadWeek: boolean;
}

const VOLUME_STATUS_STYLES: Record<
  MuscleVolumeSummary['status'],
  { label: string; textColor: string; barColor: string }
> = {
  optimal: {
    label: '적정',
    textColor: 'text-[#027A48]',
    barColor: 'bg-[#03B26C]',
  },
  below: {
    label: '부족',
    textColor: 'text-[#1B64DA]',
    barColor: 'bg-[#1B64DA]',
  },
  high: {
    label: '높음',
    textColor: 'text-[#B45309]',
    barColor: 'bg-[#FF9F0A]',
  },
};

const TRACK_MAX_SETS = 20;

export function MuscleVolumeCard({
  summaries,
  isDeloadWeek,
}: MuscleVolumeCardProps) {
  return (
    <section
      aria-label="주간 부위별 볼륨"
      className="rounded-[24px] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold tracking-tight text-[#191F28]">
          주간 부위별 볼륨
        </h2>
        <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[#E8F3FF] px-3 py-1 text-[12px] font-bold text-[#1B64DA] tabular-nums">
          {isDeloadWeek ? '5~7세트 디로드 권장' : '10~14세트 권장'}
        </span>
      </div>

      <div className="divide-y divide-[#F2F4F6]">
        {summaries.map((item) => {
          const style = VOLUME_STATUS_STYLES[item.status];
          const maxScale = Math.max(
            TRACK_MAX_SETS,
            item.targetMaxSets + 4,
            item.completedSets,
          );
          const targetStartPct = Math.min(
            100,
            Math.max(0, (item.targetMinSets / maxScale) * 100),
          );
          const targetEndPct = Math.min(
            100,
            Math.max(targetStartPct, (item.targetMaxSets / maxScale) * 100),
          );
          const targetWidthPct = Math.max(2, targetEndPct - targetStartPct);
          const fillPct = Math.min(
            100,
            Math.max(0, (item.completedSets / maxScale) * 100),
          );

          return (
            <div
              key={item.muscleGroup}
              className="space-y-2 py-3.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="whitespace-nowrap text-[14px] font-semibold text-[#191F28]">
                  {item.label}
                </span>
                <div className="flex shrink-0 items-center gap-2 whitespace-nowrap tabular-nums">
                  <span className="text-[13px] font-semibold text-[#6B7684]">
                    {item.completedSets} / {item.targetMinSets}~
                    {item.targetMaxSets}세트
                  </span>
                  <span className={`text-[12px] font-bold ${style.textColor}`}>
                    {style.label}
                  </span>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="relative h-3 w-full overflow-hidden rounded-full bg-[#F2F4F6]"
              >
                <div
                  style={{
                    left: `${targetStartPct}%`,
                    width: `${targetWidthPct}%`,
                  }}
                  className="absolute inset-y-0 rounded-full bg-[#E8F3FF]"
                />
                {fillPct > 0 ? (
                  <div
                    style={{ width: `${fillPct}%` }}
                    className={`relative h-full rounded-full ${style.barColor}`}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
