import { useEffect, useState } from 'react';
import { BottomSheet, showToast } from '../../components/ui';
import type { DayKey, F45SessionLog, LowerBodyImpact } from '../../domain/types';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import { useWorkoutStore } from '../../store/workout-store';

export interface F45CheckinSheetProps {
  open: boolean;
  onClose: () => void;
  dateISO: string;
  dayKey: DayKey;
  defaultFocus?: string;
  existingLog?: F45SessionLog;
}

const FOCUS_PRESETS = [
  { id: '하이브리드', title: 'F45 하이브리드' },
  { id: '카디오', title: 'F45 카디오' },
  { id: '하체 집중', title: 'F45 하체 집중' },
  { id: '상체 집중', title: 'F45 상체 집중' },
] as const;

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const IMPACT_OPTIONS: readonly {
  value: LowerBodyImpact;
  label: string;
  helper: string;
}[] = [
  { value: 'low', label: '낮음', helper: '하체 부담 적음' },
  { value: 'medium', label: '보통', helper: '전신 고르게' },
  { value: 'high', label: '높음', helper: '하체 부담 많음' },
];

function resolveInitialTitle(
  existingLog?: F45SessionLog,
  defaultFocus?: string,
): string {
  if (existingLog?.classTitle) {
    return existingLog.classTitle;
  }
  if (defaultFocus?.includes('카디오')) {
    return 'F45 카디오';
  }
  return 'F45 하이브리드';
}

export function F45CheckinSheet({
  open,
  onClose,
  dateISO,
  dayKey,
  defaultFocus,
  existingLog,
}: F45CheckinSheetProps) {
  const logF45Session = useWorkoutStore((s) => s.logF45Session);
  const { triggerTapHaptic } = useSoundHaptics();

  const [classTitle, setClassTitle] = useState<string>(() =>
    resolveInitialTitle(existingLog, defaultFocus),
  );
  const [rpe, setRpe] = useState<number>(existingLog?.rpe ?? 7);
  const [lowerBodyImpact, setLowerBodyImpact] = useState<LowerBodyImpact>(
    existingLog?.lowerBodyImpact ?? (dayKey === 'wed' ? 'low' : 'medium'),
  );

  useEffect(() => {
    if (open) {
      setClassTitle(resolveInitialTitle(existingLog, defaultFocus));
      setRpe(existingLog?.rpe ?? 7);
      setLowerBodyImpact(
        existingLog?.lowerBodyImpact ?? (dayKey === 'wed' ? 'low' : 'medium'),
      );
    }
  }, [open, existingLog, defaultFocus, dayKey]);

  const handleSave = () => {
    triggerTapHaptic();
    logF45Session({
      dateISO,
      dayKey,
      classTitle,
      rpe,
      lowerBodyImpact,
      durationMinutes: 45,
    });
    showToast('F45 출석과 피로도를 기록했어요');
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="F45 출석 기록하기"
      description="수업 유형과 체감 강도를 터치 한 번으로 기록해요"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-[#4E5968]">수업 유형</p>
          <div className="grid grid-cols-2 gap-2">
            {FOCUS_PRESETS.map((preset) => {
              const isSelected = classTitle === preset.title;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerTapHaptic();
                    setClassTitle(preset.title);
                  }}
                  className={`min-h-12 cursor-pointer whitespace-nowrap rounded-[14px] px-3 text-[14px] font-semibold active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                    isSelected
                      ? 'bg-[#1B64DA] text-white'
                      : 'bg-[#F2F4F6] text-[#191F28] hover:bg-[#E5E8EB]'
                  }`}
                >
                  {preset.id}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#4E5968]">
              운동 강도 (RPE)
            </p>
            <span className="text-[13px] font-bold text-[#1B64DA] tabular-nums">
              RPE {rpe} / 10
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {RPE_VALUES.map((val) => {
              const isSelected = rpe === val;
              return (
                <button
                  key={val}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerTapHaptic();
                    setRpe(val);
                  }}
                  className={`min-h-12 cursor-pointer rounded-[14px] text-[16px] font-bold tabular-nums active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                    isSelected
                      ? 'bg-[#1B64DA] text-white'
                      : 'bg-[#F2F4F6] text-[#191F28] hover:bg-[#E5E8EB]'
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-[#4E5968]">
            하체 피로 부담
          </p>
          <div className="grid grid-cols-3 gap-2">
            {IMPACT_OPTIONS.map((option) => {
              const isSelected = lowerBodyImpact === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerTapHaptic();
                    setLowerBodyImpact(option.value);
                  }}
                  className={`flex min-h-[56px] cursor-pointer flex-col items-center justify-center rounded-[14px] px-1.5 py-2 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                    isSelected
                      ? 'bg-[#1B64DA] text-white'
                      : 'bg-[#F2F4F6] text-[#191F28] hover:bg-[#E5E8EB]'
                  }`}
                >
                  <span className="whitespace-nowrap text-[14px] min-[380px]:text-[15px] font-bold">
                    {option.label}
                  </span>
                  <span
                    className={`mt-0.5 whitespace-nowrap text-[11px] min-[380px]:text-[12px] font-medium ${
                      isSelected ? 'text-[#E8F3FF]' : 'text-[#4E5968]'
                    }`}
                  >
                    {option.helper}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          출석 기록 저장하기
        </button>
      </div>
    </BottomSheet>
  );
}
