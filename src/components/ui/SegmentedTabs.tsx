import { useRef, type KeyboardEvent } from 'react';

export interface SegmentedTabOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedTabsProps<T extends string> {
  options: readonly SegmentedTabOption<T>[];
  value: T;
  onChange: (nextValue: T) => void;
  ariaLabel: string;
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedTabsProps<T>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusAndSelect = (index: number) => {
    const target = options[index];
    if (!target) return;
    tabRefs.current[index]?.focus();
    onChange(target.value);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (options.length === 0) return;

    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault();
        focusAndSelect((currentIndex + 1) % options.length);
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        focusAndSelect((currentIndex - 1 + options.length) % options.length);
        break;
      }
      case 'Home': {
        event.preventDefault();
        focusAndSelect(0);
        break;
      }
      case 'End': {
        event.preventDefault();
        focusAndSelect(options.length - 1);
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))`,
      }}
      className="grid gap-1 rounded-[16px] bg-[#E5E8EB]/70 p-1"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`min-h-12 cursor-pointer whitespace-nowrap rounded-[12px] px-1 text-[13px] font-semibold min-[380px]:px-2.5 min-[380px]:text-[14px] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
              isSelected
                ? 'bg-white text-[#191F28] shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-[#4E5968] hover:text-[#191F28]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
