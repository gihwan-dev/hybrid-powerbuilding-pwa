import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../App';
import { useToastStore } from '../../../components/ui';
import { DAY_ORDER, DAY_SHORT_LABELS } from '../../../domain/routine-model-a';
import { useWorkoutStore } from '../../../store/workout-store';

function assertNoAiSlop(container: HTMLElement) {
  const text = container.textContent ?? '';
  expect(text).not.toContain('—');
  expect(text).not.toContain('·');
  expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false);

  const allElements = container.querySelectorAll('*');
  allElements.forEach((el) => {
    const className =
      typeof el.className === 'string'
        ? el.className
        : el.getAttribute('class') ?? '';
    expect(className).not.toMatch(/\bborder-l-/);
    expect(className).not.toContain('transition-all');
  });
}

describe('TodayView & One-Funnel Workout Flow (Slice 3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Friday, 2026-11-27 10:00 KST
    vi.setSystemTime(new Date(2026, 10, 27, 10, 0, 0));
    useToastStore.getState().dismiss();
    useWorkoutStore.getState().loadDemoData();
  });

  afterEach(() => {
    cleanup();
    useToastStore.getState().dismiss();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders TodayView with cycle badge, 7-day strip, 3-point hero card, routine disclosure, and sticky CTA', () => {
    const { container } = render(<App />);

    expect(screen.getByText('4주차 (6주 주기)')).toBeInTheDocument();
    expect(screen.getByText('체험 데이터')).toBeInTheDocument();

    for (const dayKey of DAY_ORDER) {
      expect(screen.getByText(DAY_SHORT_LABELS[dayKey])).toBeInTheDocument();
    }

    expect(
      screen.getByRole('heading', { name: '금요일 하체 A' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('백 스쿼트 122.5kg 3~5회에 도전해요'),
    ).toBeInTheDocument();
    expect(screen.getByText(/신경계 피로도/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '오늘 운동 시작하기' }),
    ).toBeInTheDocument();

    const routineToggle = screen.getByRole('button', {
      name: /오늘 루틴 5종목 살펴보기/,
    });
    fireEvent.click(routineToggle);
    expect(screen.getByText('백 스쿼트 (탑세트)')).toBeInTheDocument();
    expect(screen.getByText('백 스쿼트 (백오프)')).toBeInTheDocument();
    expect(screen.getByText('루마니안 데드리프트')).toBeInTheDocument();

    assertNoAiSlop(container);
  });

  it('runs the full one-funnel workout flow: start -> step weight -> RIR 2 -> live backoff rest timer -> skip rest', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '오늘 운동 시작하기' }));

    expect(
      screen.getByRole('heading', { name: '백 스쿼트 (탑세트)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('탑세트')).toBeInTheDocument();
    expect(
      screen.getByText('한쪽 원판 25×2 + 1.25kg'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /워밍업 4세트 보기/ }),
    ).toBeInTheDocument();

    // Step top set weight from 122.5kg to 125kg (+2.5kg)
    fireEvent.click(screen.getByRole('button', { name: '중량 2.5kg 증가' }));
    expect(
      screen.getByRole('button', { name: '중량 125kg, 직접 입력 열기' }),
    ).toBeInTheDocument();
    expect(screen.getByText('한쪽 원판 25×2 + 2.5kg')).toBeInTheDocument();

    assertNoAiSlop(container);

    // Complete set -> opens RirSheet
    fireEvent.click(screen.getByRole('button', { name: '세트 완료' }));
    const rirDialog = screen.getByRole('dialog', {
      name: '방금 세트 여유가 몇 회였나요?',
    });
    expect(rirDialog).toBeInTheDocument();

    // Tap RIR 2 -> opens RestTimerOverlay with recalculated 88% backoff (125 * 0.88 = 110kg)
    fireEvent.click(within(rirDialog).getByRole('button', { name: /RIR 2/ }));

    expect(
      screen.queryByRole('dialog', { name: '방금 세트 여유가 몇 회였나요?' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '휴식 타이머' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('다음 세트: 백 스쿼트 (백오프) 1세트 (110kg × 6회)'),
    ).toBeInTheDocument();

    const skipButton = screen.getByRole('button', { name: '휴식 건너뛰기' });
    expect(skipButton).toBeInTheDocument();

    assertNoAiSlop(container);

    // Skip rest -> advances directly to backoff set 1/3 at 110kg
    fireEvent.click(skipButton);

    expect(
      screen.getByRole('heading', { name: '백 스쿼트 (백오프)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('백오프 1/3')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '중량 110kg, 직접 입력 열기' }),
    ).toBeInTheDocument();

    assertNoAiSlop(container);
  });

  it('opens custom NumericPadSheet from NumberStepper without any native <input> element', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '오늘 운동 시작하기' }));

    const centerWeightButton = screen.getByRole('button', {
      name: '중량 122.5kg, 직접 입력 열기',
    });
    fireEvent.click(centerWeightButton);

    const padDialog = screen.getByRole('dialog', {
      name: '백 스쿼트 (탑세트) 중량 입력',
    });
    expect(padDialog).toBeInTheDocument();
    expect(document.querySelectorAll('input')).toHaveLength(0);

    fireEvent.click(within(padDialog).getByRole('button', { name: '1' }));
    fireEvent.click(within(padDialog).getByRole('button', { name: '3' }));
    fireEvent.click(within(padDialog).getByRole('button', { name: '0' }));
    fireEvent.click(
      within(padDialog).getByRole('button', { name: '적용하기' }),
    );

    expect(
      screen.queryByRole('dialog', { name: '백 스쿼트 (탑세트) 중량 입력' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '중량 130kg, 직접 입력 열기' }),
    ).toBeInTheDocument();

    assertNoAiSlop(container);
  });

  it('supports F45 check-in, Thursday recovery checklist, Week 6 deload banner, and session completion summary', () => {
    const { container } = render(<App />);

    // Preview Monday F45 & log attendance without keyboard
    fireEvent.click(screen.getByRole('button', { name: /월요일/ }));
    expect(
      screen.getByRole('heading', { name: '월요일 F45 하이브리드' }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /F45/ }),
    );
    const f45Dialog = screen.getByRole('dialog', { name: 'F45 출석 기록하기' });
    fireEvent.click(within(f45Dialog).getByRole('button', { name: '9' }));
    fireEvent.click(
      within(f45Dialog).getByRole('button', { name: /높음/ }),
    );
    fireEvent.click(
      within(f45Dialog).getByRole('button', { name: '출석 기록 저장하기' }),
    );

    expect(screen.getByText('출석 완료 (RPE 9)')).toBeInTheDocument();

    // Preview Thursday Recovery & toggle checklist item
    fireEvent.click(screen.getByRole('button', { name: /목요일/ }));
    fireEvent.click(
      screen.getByRole('button', { name: '오늘 회복 체크하기' }),
    );
    const recoveryDialog = screen.getByRole('dialog', {
      name: '목요일 회복 체크리스트',
    });
    expect(within(recoveryDialog).getByText('CNS -20점')).toBeInTheDocument();
    fireEvent.click(
      within(recoveryDialog).getByRole('button', {
        name: /수면 7시간 이상 확보/,
      }),
    );
    expect(within(recoveryDialog).getByText('CNS -15점')).toBeInTheDocument();
    fireEvent.click(
      within(recoveryDialog).getByRole('button', { name: '회복 체크 완료' }),
    );

    // Return to today and verify Week 6 deload banner
    fireEvent.click(screen.getByRole('button', { name: '오늘로 돌아가기' }));
    act(() => {
      useWorkoutStore.getState().setCycleWeek(6);
    });
    expect(
      screen.getByText(
        '6주차 디로딩 주간이에요. 중량은 유지하고 세트 수만 절반으로 줄여요.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: '새 사이클 1주차 시작하기' }),
    );
    expect(screen.getByText('1주차 (6주 주기)')).toBeInTheDocument();

    // Complete 1 set and finish workout early via ExerciseJumpSheet -> SessionCompleteView
    fireEvent.click(screen.getByRole('button', { name: '오늘 운동 시작하기' }));
    fireEvent.click(screen.getByRole('button', { name: '세트 완료' }));
    fireEvent.click(screen.getByRole('button', { name: /RIR 2/ }));
    fireEvent.click(screen.getByRole('button', { name: '휴식 건너뛰기' }));

    fireEvent.click(screen.getByRole('button', { name: '전체 목록' }));
    fireEvent.click(screen.getByRole('button', { name: '운동 지금 마치기' }));

    expect(
      screen.getByRole('heading', { name: '오늘 훈련을 멋지게 마쳤어요' }),
    ).toBeInTheDocument();
    assertNoAiSlop(container);

    fireEvent.click(
      screen.getByRole('button', { name: '코치에게 오늘 세션 분석 맡기기' }),
    );
    expect(
      screen.getByRole('heading', { name: 'AI 코치' }),
    ).toBeInTheDocument();
  });

  it('supports .5 unit preserving integer base and backspace-to-zero inside NumericPadSheet', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '오늘 운동 시작하기' }));

    // Open weight pad on 122.5kg -> .5 단위 keeps 122.5 (integer base 122)
    fireEvent.click(
      screen.getByRole('button', { name: '중량 122.5kg, 직접 입력 열기' }),
    );
    let pad = screen.getByRole('dialog', { name: '백 스쿼트 (탑세트) 중량 입력' });
    fireEvent.click(within(pad).getByRole('button', { name: '1' }));
    fireEvent.click(within(pad).getByRole('button', { name: '2' }));
    fireEvent.click(within(pad).getByRole('button', { name: '0' }));
    fireEvent.click(within(pad).getByRole('button', { name: '.5 단위' }));
    fireEvent.click(within(pad).getByRole('button', { name: '적용하기' }));
    expect(
      screen.getByRole('button', { name: '중량 120.5kg, 직접 입력 열기' }),
    ).toBeInTheDocument();

    // Reopen, clear via backspace, and confirm 0
    fireEvent.click(
      screen.getByRole('button', { name: '중량 120.5kg, 직접 입력 열기' }),
    );
    pad = screen.getByRole('dialog', { name: '백 스쿼트 (탑세트) 중량 입력' });
    fireEvent.click(within(pad).getByRole('button', { name: '한 글자 지우기' }));
    fireEvent.click(within(pad).getByRole('button', { name: '적용하기' }));
    expect(
      screen.getByRole('button', { name: '중량 0kg, 직접 입력 열기' }),
    ).toBeInTheDocument();
  });
});
