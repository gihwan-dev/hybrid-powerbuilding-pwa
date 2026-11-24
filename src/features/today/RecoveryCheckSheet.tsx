import { Check } from 'lucide-react';
import { BottomSheet } from '../../components/ui';
import { ROUTINE_DAYS } from '../../domain/routine-model-a';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';

export interface RecoveryCheckSheetProps {
  open: boolean;
  onClose: () => void;
  dateISO: string;
  checkedItemIds: string[];
  onToggleItem: (dateISO: string, itemId: string) => void;
}

export function RecoveryCheckSheet({
  open,
  onClose,
  dateISO,
  checkedItemIds,
  onToggleItem,
}: RecoveryCheckSheetProps) {
  const { triggerTapHaptic } = useSoundHaptics();
  const checklist = ROUTINE_DAYS.thu.recoveryChecklist;
  const totalReduction = Math.min(20, checkedItemIds.length * 5);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="목요일 회복 체크리스트"
      description="항목을 체크할 때마다 신경계 피로도가 즉시 5점씩 줄어들어요"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-[16px] bg-[#E8FAF0] px-4 py-3 text-[#027A48]">
          <span className="text-[14px] font-semibold">현재 회복 반영 효과</span>
          <span className="text-[15px] font-bold tabular-nums">
            CNS -{totalReduction}점
          </span>
        </div>

        <div className="space-y-2.5">
          {checklist.map((item) => {
            const isChecked = checkedItemIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isChecked}
                onClick={() => {
                  triggerTapHaptic();
                  onToggleItem(dateISO, item.id);
                }}
                className={`flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-3 rounded-[16px] px-4 py-3 text-left active:scale-[0.98] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                  isChecked ? 'bg-[#E8F3FF]' : 'bg-[#F2F4F6] hover:bg-[#E5E8EB]'
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      isChecked
                        ? 'bg-[#3182F6] text-white'
                        : 'bg-white text-transparent ring-1 ring-[#D1D6DB]'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-[#191F28]">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug text-[#4E5968]">
                      {item.detail}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-[#027A48] tabular-nums">
                  -5점
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[56px] w-full cursor-pointer rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          회복 체크 완료
        </button>
      </div>
    </BottomSheet>
  );
}
