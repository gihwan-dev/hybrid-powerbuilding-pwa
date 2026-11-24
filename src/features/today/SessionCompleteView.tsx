import { Award, Check, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { ROUTINE_DAYS } from '../../domain/routine-model-a';
import type { LastCompletedSummary } from '../../store/schemas';

export interface SessionCompleteViewProps {
  summary: LastCompletedSummary;
  onGoCoach: () => void;
  onDone: () => void;
}

export function SessionCompleteView({
  summary,
  onGoCoach,
  onDone,
}: SessionCompleteViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dayLabel = ROUTINE_DAYS[summary.dayKey].fullLabel;

  useEffect(() => {
    headingRef.current?.focus();
  }, [summary.sessionId]);

  return (
    <main className="min-h-dvh bg-[#F2F4F6] text-[#191F28] px-5 pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto flex w-full max-w-md flex-col space-y-5">
        <div className="flex flex-col items-center pt-4 text-center">
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.15 }
                : { type: 'spring', duration: 0.3, bounce: 0 }
            }
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8FAF0] text-[#027A48]"
          >
            <Check className="h-8 w-8 stroke-[3]" aria-hidden="true" />
          </motion.div>
          <p className="mt-4 text-[14px] font-semibold text-[#1B64DA]">
            {dayLabel} {summary.title} 완료
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 text-[24px] font-bold tracking-tight text-[#191F28] focus:outline-none"
          >
            오늘 훈련을 멋지게 마쳤어요
          </h1>
        </div>

        <section className="rounded-[24px] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="divide-y divide-[#F2F4F6]">
            <div className="flex items-center justify-between py-3.5 first:pt-0">
              <span className="text-[14px] font-medium text-[#4E5968]">
                완료한 세트
              </span>
              <span className="text-[18px] font-bold text-[#191F28] tabular-nums">
                {summary.completedSetCount}세트
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5">
              <span className="text-[14px] font-medium text-[#4E5968]">
                총 훈련 볼륨
              </span>
              <span className="text-[18px] font-bold text-[#191F28] tabular-nums">
                {summary.tonnageKg.toLocaleString()}kg
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5">
              <span className="text-[14px] font-medium text-[#4E5968]">
                운동 시간
              </span>
              <span className="text-[18px] font-bold text-[#191F28] tabular-nums">
                {summary.durationMinutes}분
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5 last:pb-0">
              <span className="text-[14px] font-medium text-[#4E5968]">
                예상 3대 합계
              </span>
              <span className="text-[20px] font-bold text-[#1B64DA] tabular-nums">
                {summary.sbdTotalKg}kg
              </span>
            </div>
          </div>

          {summary.newPrLabels.length > 0 ? (
            <div className="mt-4 border-t border-[#F2F4F6] pt-4 space-y-2">
              <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#027A48]">
                <Award className="h-4 w-4" aria-hidden="true" />
                <span>신규 e1RM 기록을 달성했어요</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {summary.newPrLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full bg-[#E8FAF0] px-3 py-1 text-[13px] font-bold text-[#027A48] tabular-nums"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={onGoCoach}
            className="inline-flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <span>코치에게 오늘 세션 분석 맡기기</span>
          </button>

          <button
            type="button"
            onClick={onDone}
            className="min-h-[52px] w-full cursor-pointer rounded-[18px] bg-white px-5 text-[16px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB]/60 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </main>
  );
}
