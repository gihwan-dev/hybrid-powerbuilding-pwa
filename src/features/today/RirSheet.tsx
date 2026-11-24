import { BottomSheet } from '../../components/ui';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import { useWorkoutStore } from '../../store/workout-store';

interface RirOption {
  value: number;
  label: string;
  description: string;
}

const RIR_OPTIONS: readonly RirOption[] = [
  {
    value: 0,
    label: 'RIR 0',
    description: '한계 도달 (더 못 들었어요)',
  },
  {
    value: 1,
    label: 'RIR 1',
    description: '1회 더 할 수 있었어요',
  },
  {
    value: 2,
    label: 'RIR 2',
    description: '2회 여유 (목표 강도에 딱 맞아요)',
  },
  {
    value: 3,
    label: 'RIR 3+',
    description: '3회 이상 가볍게 남았어요',
  },
];

export function RirSheet() {
  const awaitingRirForPointer = useWorkoutStore(
    (s) => s.activeSession?.awaitingRirForPointer ?? null,
  );
  const confirmCurrentSetRir = useWorkoutStore((s) => s.confirmCurrentSetRir);
  const cancelPendingRir = useWorkoutStore((s) => s.cancelPendingRir);
  const { triggerTapHaptic } = useSoundHaptics();

  const isOpen = awaitingRirForPointer !== null;

  return (
    <BottomSheet
      open={isOpen}
      onClose={cancelPendingRir}
      title="방금 세트 여유가 몇 회였나요?"
      description="남긴 반복 여유(RIR)를 선택하면 다음 세트와 다음 주 중량을 자동으로 맞춰요"
    >
      <div className="space-y-2.5">
        {RIR_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              triggerTapHaptic();
              confirmCurrentSetRir(option.value);
            }}
            className="flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-3 rounded-[16px] bg-[#F2F4F6] px-4 py-3 text-left hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            <span className="shrink-0 text-[16px] font-bold text-[#1B64DA] tabular-nums">
              {option.label}
            </span>
            <span className="text-right text-[14px] font-semibold text-[#191F28]">
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
