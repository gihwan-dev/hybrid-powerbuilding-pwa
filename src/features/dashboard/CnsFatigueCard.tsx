import type { CnsFatigueResult, CnsStatus } from '../../domain/types';

export interface CnsFatigueCardProps {
  cns: CnsFatigueResult;
}

const STATUS_STYLES: Record<
  CnsStatus,
  { pill: string; dot: string; fill: string }
> = {
  optimal: {
    pill: 'bg-[#E8FAF0] text-[#027A48]',
    dot: 'bg-[#03B26C]',
    fill: 'bg-[#03B26C]',
  },
  caution: {
    pill: 'bg-[#FFF5E6] text-[#B45309]',
    dot: 'bg-[#FF9F0A]',
    fill: 'bg-[#FF9F0A]',
  },
  overload: {
    pill: 'bg-[#FFEBEE] text-[#C92A2A]',
    dot: 'bg-[#F04452]',
    fill: 'bg-[#F04452]',
  },
};

const SEGMENT_COUNT = 10;

export function CnsFatigueCard({ cns }: CnsFatigueCardProps) {
  const style = STATUS_STYLES[cns.status];
  const filledSegments = Math.max(
    0,
    Math.min(SEGMENT_COUNT, Math.round((cns.score / 100) * SEGMENT_COUNT)),
  );

  return (
    <section
      aria-label="신경계 피로도"
      className="rounded-[24px] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold tracking-tight text-[#191F28]">
          신경계 피로도 (CNS)
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold tabular-nums ${style.pill}`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${style.dot}`}
          />
          <span>{cns.statusLabel}</span>
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2 tabular-nums">
          <div className="flex items-baseline gap-1">
            <span className="text-[32px] font-bold leading-none tracking-tight text-[#191F28]">
              {cns.score}
            </span>
            <span className="text-[15px] font-semibold text-[#6B7684]">
              / 100
            </span>
          </div>
          <span className="text-[12px] font-semibold text-[#6B7684]">
            0~100 피로 지수
          </span>
        </div>

        <div
          role="meter"
          aria-label="신경계 피로도 점수"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={cns.score}
          className="grid grid-cols-10 gap-1"
        >
          {Array.from({ length: SEGMENT_COUNT }, (_, idx) => {
            const isFilled = idx < filledSegments;
            return (
              <div
                key={idx}
                className={`h-2.5 rounded-full ${
                  isFilled ? style.fill : 'bg-[#F2F4F6]'
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[12px] font-medium text-[#6B7684] tabular-nums">
          <span>0 쾌적</span>
          <span>55 보통</span>
          <span>80 고피로</span>
        </div>

        <div className="space-y-1 pt-1">
          <p className="text-[15px] font-bold text-[#191F28]">{cns.headline}</p>
          <p className="text-[14px] leading-relaxed text-[#4E5968]">
            {cns.advice}
          </p>
        </div>
      </div>

      <div className="border-t border-[#F2F4F6] pt-4">
        {cns.factors.length > 0 ? (
          <div className="divide-y divide-[#F2F4F6]">
            {cns.factors.map((factor) => {
              const deltaText =
                factor.delta > 0 ? `+${factor.delta}` : `${factor.delta}`;
              const deltaColor =
                factor.delta > 0
                  ? 'text-[#C92A2A]'
                  : factor.delta < 0
                    ? 'text-[#027A48]'
                    : 'text-[#6B7684]';
              return (
                <div
                  key={factor.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[#191F28]">
                      {factor.label}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[#6B7684]">
                      {factor.detail}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[14px] font-bold tabular-nums ${deltaColor}`}
                  >
                    {deltaText}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] font-medium text-[#6B7684]">
            최근 며칠간 피로도를 크게 높이거나 낮춘 추가 요인이 없어요.
          </p>
        )}
      </div>
    </section>
  );
}
