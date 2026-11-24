import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { PlateBreakdown } from '../../domain/types';
import { buildWarmupSets } from '../../domain/warmup-builder';

export interface WarmupDisclosureProps {
  exerciseId: string;
  workingWeightKg: number;
  checkedSteps: number[];
  onToggleStep: (exerciseId: string, setNumber: number) => void;
}

function formatWarmupPlates(breakdown: PlateBreakdown | null): string {
  if (!breakdown || breakdown.isBarOnly) {
    return '빈 바벨 20kg';
  }
  const parts = breakdown.platesPerSide.map((item) =>
    item.pairs > 1 ? `${item.weightKg}×${item.pairs}` : `${item.weightKg}`,
  );
  return `한쪽 ${parts.join(' + ')}kg`;
}

export function WarmupDisclosure({
  exerciseId,
  workingWeightKg,
  checkedSteps,
  onToggleStep,
}: WarmupDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const warmupSets = buildWarmupSets(workingWeightKg);

  if (warmupSets.length === 0) {
    return null;
  }

  const completedCount = warmupSets.filter((step) =>
    checkedSteps.includes(step.setNumber),
  ).length;

  return (
    <div className="rounded-[16px] bg-[#F2F4F6] px-4 py-1">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 text-left active:scale-[0.99] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
      >
        <span className="text-[14px] font-semibold text-[#191F28] tabular-nums">
          워밍업 {warmupSets.length}세트 보기
        </span>
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[#1B64DA] tabular-nums">
          <span>
            {completedCount}/{warmupSets.length} 완료
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {isOpen ? (
        <div className="divide-y divide-[#E5E8EB]/80 pb-2">
          {warmupSets.map((step) => {
            const isChecked = checkedSteps.includes(step.setNumber);
            const plateLabel = formatWarmupPlates(step.plateBreakdown);
            return (
              <button
                key={step.setNumber}
                type="button"
                aria-pressed={isChecked}
                onClick={() => onToggleStep(exerciseId, step.setNumber)}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 py-2 text-left active:scale-[0.99] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      isChecked
                        ? 'bg-[#3182F6] text-white'
                        : 'bg-white text-transparent ring-1 ring-[#D1D6DB]'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                  <span
                    className={`text-[14px] font-semibold tabular-nums ${
                      isChecked
                        ? 'text-[#4E5968] line-through'
                        : 'text-[#191F28]'
                    }`}
                  >
                    {step.weightKg}kg × {step.reps}회 ({step.percentage}%)
                  </span>
                </div>
                <span className="shrink-0 text-[12px] font-medium text-[#4E5968] tabular-nums">
                  {plateLabel}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
