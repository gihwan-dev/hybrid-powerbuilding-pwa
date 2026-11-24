import { useState } from 'react';
import { clamp } from '../../domain/math';
import { NumericPadSheet } from './NumericPadSheet';

export interface NumberStepperProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  unitLabel: string;
  padUnitLabel?: string;
  allowDecimal?: boolean;
  prefix?: string;
  zeroOverrideLabel?: string;
  padTitle?: string;
  onChange: (nextValue: number) => void;
  onStepFeedback?: () => void;
}

export function NumberStepper({
  label,
  value,
  step,
  min,
  max,
  unitLabel,
  padUnitLabel,
  allowDecimal = false,
  prefix = '',
  zeroOverrideLabel,
  padTitle,
  onChange,
  onStepFeedback,
}: NumberStepperProps) {
  const [isPadOpen, setIsPadOpen] = useState(false);

  const effectivePadUnit = padUnitLabel ?? unitLabel;

  const commitStep = (direction: -1 | 1) => {
    const rawNext = value + direction * step;
    const clamped = clamp(rawNext, min, max);
    const rounded = allowDecimal
      ? Number(clamped.toFixed(2))
      : Math.round(clamped);
    if (rounded !== value) {
      onChange(rounded);
      onStepFeedback?.();
    }
  };

  const showZeroOverride = value === 0 && Boolean(zeroOverrideLabel);
  const accessibleValueText = showZeroOverride
    ? zeroOverrideLabel
    : `${prefix}${value}${unitLabel}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#4E5968]">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => commitStep(-1)}
          disabled={value <= min}
          aria-label={`${label} ${step}${effectivePadUnit} 감소`}
          className="min-h-[56px] min-w-[64px] shrink-0 cursor-pointer rounded-[14px] bg-[#F2F4F6] px-3 text-[16px] font-bold text-[#191F28] tabular-nums hover:bg-[#E5E8EB] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          -{step}
        </button>

        <button
          type="button"
          onClick={() => setIsPadOpen(true)}
          aria-label={`${label} ${accessibleValueText}, 직접 입력 열기`}
          className="flex min-h-[56px] min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[14px] bg-[#F2F4F6] px-3 tabular-nums hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          {showZeroOverride ? (
            <span className="text-[22px] font-bold leading-none text-[#191F28]">
              {zeroOverrideLabel}
            </span>
          ) : (
            <span className="inline-flex items-baseline gap-1">
              <span className="text-[26px] font-bold leading-none tracking-tight text-[#191F28]">
                {prefix}
                {value}
              </span>
              <span className="text-[14px] font-semibold leading-none text-[#4E5968]">
                {unitLabel}
              </span>
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => commitStep(1)}
          disabled={value >= max}
          aria-label={`${label} ${step}${effectivePadUnit} 증가`}
          className="min-h-[56px] min-w-[64px] shrink-0 cursor-pointer rounded-[14px] bg-[#F2F4F6] px-3 text-[16px] font-bold text-[#191F28] tabular-nums hover:bg-[#E5E8EB] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          +{step}
        </button>
      </div>

      <NumericPadSheet
        open={isPadOpen}
        onClose={() => setIsPadOpen(false)}
        title={padTitle ?? `${label} 입력`}
        value={value}
        min={min}
        max={max}
        allowDecimal={allowDecimal}
        unitLabel={effectivePadUnit}
        onConfirm={(nextVal) => {
          onChange(nextVal);
          onStepFeedback?.();
        }}
      />
    </div>
  );
}
