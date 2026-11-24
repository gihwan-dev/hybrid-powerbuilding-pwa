import { Delete } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clamp } from '../../domain/math';
import { BottomSheet } from './BottomSheet';

export interface NumericPadSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  value: number;
  min: number;
  max: number;
  allowDecimal?: boolean;
  unitLabel: string;
  onConfirm: (nextValue: number) => void;
}

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function NumericPadSheet({
  open,
  onClose,
  title,
  value,
  min,
  max,
  allowDecimal = false,
  unitLabel,
  onConfirm,
}: NumericPadSheetProps) {
  const [draft, setDraft] = useState<string>(() => String(value));
  const [replaceOnNextDigit, setReplaceOnNextDigit] = useState<boolean>(true);

  useEffect(() => {
    if (open) {
      setDraft(String(value));
      setReplaceOnNextDigit(true);
    }
  }, [open, value]);

  const handleDigitPress = (digit: string) => {
    if (replaceOnNextDigit) {
      setDraft(digit);
      setReplaceOnNextDigit(false);
      return;
    }

    setDraft((prev) => {
      if (prev === '0') {
        return digit;
      }
      if (prev.length >= 7) {
        return prev;
      }
      return `${prev}${digit}`;
    });
  };

  const handleDecimalPress = () => {
    if (!allowDecimal) return;
    if (replaceOnNextDigit) {
      setDraft('0.');
      setReplaceOnNextDigit(false);
      return;
    }
    setDraft((prev) => {
      if (prev.includes('.')) return prev;
      return prev === '' ? '0.' : `${prev}.`;
    });
  };

  const handleHalfPress = () => {
    if (!allowDecimal) return;
    setReplaceOnNextDigit(false);
    setDraft((prev) => {
      const integerPart = prev.split('.')[0];
      const base = integerPart && integerPart !== '' ? integerPart : '0';
      return `${base}.5`;
    });
  };

  const handleClear = () => {
    setDraft('0');
    setReplaceOnNextDigit(false);
  };

  const handleBackspace = () => {
    if (replaceOnNextDigit) {
      setDraft('0');
      setReplaceOnNextDigit(false);
      return;
    }
    setDraft((prev) => {
      const next = prev.slice(0, -1);
      return next === '' ? '0' : next;
    });
  };

  const handleConfirm = () => {
    const parsed =
      draft === '.' ? value : draft.trim() === '' ? 0 : Number(draft);
    const safeNumber = Number.isFinite(parsed) ? parsed : value;
    const clamped = clamp(safeNumber, min, max);
    const finalValue = allowDecimal
      ? Number(clamped.toFixed(2))
      : Math.round(clamped);
    onConfirm(finalValue);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={`${min}~${max}${unitLabel} 범위에서 입력할 수 있어요`}
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-center gap-1.5 rounded-[18px] bg-[#F2F4F6] px-4 py-4 tabular-nums">
          <span className="text-[36px] font-bold leading-none tracking-tight text-[#191F28]">
            {draft === '' ? '0' : draft}
          </span>
          <span className="text-[16px] font-semibold text-[#4E5968]">
            {unitLabel}
          </span>
        </div>

        <div className="flex gap-2">
          {allowDecimal ? (
            <button
              type="button"
              onClick={handleHalfPress}
              className="flex-1 min-h-12 cursor-pointer rounded-[14px] bg-[#E8F3FF] px-3 text-[15px] font-bold text-[#1B64DA] tabular-nums active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              .5 단위
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 min-h-12 cursor-pointer rounded-[14px] bg-[#F2F4F6] px-3 text-[15px] font-semibold text-[#4E5968] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            초기화
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYPAD_DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="min-h-[54px] cursor-pointer rounded-[14px] bg-[#F2F4F6] text-[20px] font-bold text-[#191F28] tabular-nums hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              {digit}
            </button>
          ))}

          {allowDecimal ? (
            <button
              type="button"
              onClick={handleDecimalPress}
              aria-label="소수점"
              className="min-h-[54px] cursor-pointer rounded-[14px] bg-[#F2F4F6] text-[22px] font-bold text-[#191F28] tabular-nums hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              .
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[54px] cursor-pointer rounded-[14px] bg-[#F2F4F6] text-[15px] font-semibold text-[#4E5968] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              지우기
            </button>
          )}

          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className="min-h-[54px] cursor-pointer rounded-[14px] bg-[#F2F4F6] text-[20px] font-bold text-[#191F28] tabular-nums hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            aria-label="한 글자 지우기"
            className="inline-flex min-h-[54px] cursor-pointer items-center justify-center rounded-[14px] bg-[#F2F4F6] text-[#191F28] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            <Delete className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="mt-1 min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          적용하기
        </button>
      </div>
    </BottomSheet>
  );
}
