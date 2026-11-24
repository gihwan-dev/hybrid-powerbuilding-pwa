import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../App';
import { useToastStore } from '../../../components/ui';
import { useWorkoutStore } from '../../../store/workout-store';

function assertNoAiSlop(root: HTMLElement) {
  const text = root.textContent ?? '';
  expect(text).not.toContain('—');
  expect(text).not.toContain('·');
  expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false);

  const allElements = root.querySelectorAll('*');
  allElements.forEach((el) => {
    const className =
      typeof el.className === 'string'
        ? el.className
        : el.getAttribute('class') ?? '';
    expect(className).not.toMatch(/\bborder-l-/);
    expect(className).not.toContain('transition-all');
  });
}

describe('Dashboard, Coach, Settings Drawer & App Shell (Slice 4)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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

  it('switches across 오늘 -> 대시보드 -> 코치 tabs cleanly without AI slop', () => {
    const { container } = render(<App />);

    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(
      within(nav).getByRole('button', { name: '오늘' }),
    ).toHaveAttribute('aria-current', 'page');
    assertNoAiSlop(container);

    fireEvent.click(within(nav).getByRole('button', { name: '대시보드' }));
    expect(
      screen.getByRole('heading', { name: '대시보드' }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: '대시보드' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('신경계 피로도 (CNS)')).toBeInTheDocument();
    expect(screen.getByText('주간 부위별 볼륨')).toBeInTheDocument();
    expect(screen.getByText('6주 주기화 및 근력 균형')).toBeInTheDocument();
    assertNoAiSlop(container);

    fireEvent.click(within(nav).getByRole('button', { name: '코치' }));
    expect(screen.getByRole('heading', { name: 'AI 코치' })).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: '코치' }),
    ).toHaveAttribute('aria-current', 'page');
    assertNoAiSlop(container);
  });

  it('switches E1rmForecastChart lift tabs, selects quick-pills, and scrubs SVG points', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '대시보드' }));

    expect(
      screen.getByRole('img', { name: 'SBD 합계 12주 e1RM 예측 차트' }),
    ).toBeInTheDocument();
    expect(screen.getByText('선택 시점: 현재')).toBeInTheDocument();

    // Quick week pills update the 1-line readout bar (weekOffset 8 from cycleWeek 4 lands on deload week 6)
    fireEvent.click(screen.getByRole('button', { name: '8주' }));
    expect(screen.getByText('선택 시점: 8주 후 (디로드)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '12주' }));
    expect(screen.getByText('선택 시점: 12주 후')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '4주' }));
    expect(screen.getByText('선택 시점: 4주 후')).toBeInTheDocument();

    // Switch SegmentedTabs across lifts
    const tablist = screen.getByRole('tablist', { name: '리프트 종목 선택' });
    fireEvent.click(within(tablist).getByRole('tab', { name: '벤치' }));
    expect(
      screen.getByRole('img', { name: '벤치프레스 12주 e1RM 예측 차트' }),
    ).toBeInTheDocument();

    fireEvent.click(within(tablist).getByRole('tab', { name: '스쿼트' }));
    expect(
      screen.getByRole('img', { name: '백 스쿼트 12주 e1RM 예측 차트' }),
    ).toBeInTheDocument();

    fireEvent.click(within(tablist).getByRole('tab', { name: '데드' }));
    const chartSvg = screen.getByRole('img', {
      name: '컨벤셔널 데드리프트 12주 e1RM 예측 차트',
    });
    expect(chartSvg).toBeInTheDocument();

    // Pointer scrubbing along SVG selects points near pointer X
    vi.spyOn(chartSvg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 360,
      bottom: 210,
      width: 360,
      height: 210,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent(
      chartSvg,
      new MouseEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 346,
        clientY: 80,
      }),
    );
    expect(screen.getByText('선택 시점: 12주 후')).toBeInTheDocument();

    fireEvent(
      chartSvg,
      new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 147,
        clientY: 90,
      }),
    );
    expect(screen.getByText('선택 시점: 2주 후 (디로드)')).toBeInTheDocument();

    fireEvent(
      chartSvg,
      new MouseEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: 147,
        clientY: 90,
      }),
    );

    // Keyboard navigation on forecast slider reaches intermediate and end weeks
    const slider = screen.getByRole('slider', {
      name: '컨벤셔널 데드리프트 12주 e1RM 예측 시점 선택',
    });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(screen.getByText('선택 시점: 1주 후')).toBeInTheDocument();
    fireEvent.keyDown(slider, { key: 'End' });
    expect(screen.getByText('선택 시점: 12주 후')).toBeInTheDocument();
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(screen.getByText('선택 시점: 현재')).toBeInTheDocument();

    assertNoAiSlop(container);
  });

  it('supports CoachView topic multi-select, condition chips, preview, clipboard copy, and GeminiDirectCoach 404 fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '코치' }));

    // Initially strength_plateau is selected; trying to deselect last chip keeps it active
    const plateauChip = screen.getByRole('button', {
      name: '다음 주 중량 조정',
    });
    expect(plateauChip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(plateauChip);
    expect(plateauChip).toHaveAttribute('aria-pressed', 'true');

    // Add second focus topic and quick condition tag
    const f45Chip = screen.getByRole('button', { name: 'F45 피로도 관리' });
    fireEvent.click(f45Chip);
    expect(f45Chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2개 선택됨')).toBeInTheDocument();

    const sleepChip = screen.getByRole('button', { name: '수면 부족' });
    fireEvent.click(sleepChip);
    expect(sleepChip).toHaveAttribute('aria-pressed', 'true');

    // Expand prompt preview and verify contents
    fireEvent.click(
      screen.getByRole('button', { name: '프롬프트 미리보기 펼치기' }),
    );
    const previewPre = container.querySelector('pre');
    expect(previewPre).not.toBeNull();
    expect(previewPre?.textContent).toContain('다음 주 중량 조정');
    expect(previewPre?.textContent).toContain('F45 피로도 관리');
    expect(previewPre?.textContent).toContain('수면 부족');

    // Copy prompt to clipboard -> toast confirms
    fireEvent.click(screen.getByRole('button', { name: '프롬프트 복사하기' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByText('복사했어요. Claude나 Gemini에 붙여넣으세요'),
    ).toBeInTheDocument();

    // Without API key, GeminiDirectCoach shows quiet setup trigger opening SettingsDrawer
    fireEvent.click(
      screen.getByRole('button', {
        name: /설정에서 개인 Gemini API 키를 연결하면/,
      }),
    );
    const settingsDialog = screen.getByRole('dialog', {
      name: '설정 및 데이터 관리',
    });
    expect(settingsDialog).toBeInTheDocument();

    const apiInput = within(settingsDialog).getByLabelText('개인 Gemini API 키');
    expect(apiInput).toHaveClass('text-base');
    fireEvent.change(apiInput, { target: { value: 'AIzaTestKey1234' } });
    fireEvent.click(within(settingsDialog).getByRole('button', { name: '저장' }));
    fireEvent.click(within(settingsDialog).getByRole('button', { name: '닫기' }));

    // Now test GeminiDirectCoach with 404 on gemini-2.5-flash -> retry gemini-2.0-flash
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: '1. 다음 주 스쿼트 중량을 2.5kg 올려 보세요.\n2. F45 뒤에는 수면 시간을 넉넉히 확보해요.\n3. 백오프 세트는 RIR 2를 지켜 주세요.',
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    fireEvent.click(
      screen.getByRole('button', { name: '앱 안에서 3줄 코칭 받기' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/다음 주 스쿼트 중량을 2.5kg 올려 보세요/),
      ).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('gemini-2.5-flash');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('gemini-2.0-flash');

    assertNoAiSlop(document.body);
  });

  it('manages cycle week 6 deload targets, settings toggles, JSON export/import, and two-step live reset inside SettingsDrawer', async () => {
    render(<App />);

    // Open Dashboard first, then SettingsDrawer via gear button
    fireEvent.click(screen.getByRole('button', { name: '대시보드' }));
    expect(screen.getByText('10~14세트 권장')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '설정 열기' }));
    let dialog = screen.getByRole('dialog', { name: '설정 및 데이터 관리' });

    // Switch cycle week to 6주(디로드) and verify Dashboard volume targets drop to 5~7세트
    fireEvent.click(within(dialog).getByRole('button', { name: '6주(디로드)' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));

    expect(screen.getByText('5~7세트 디로드 권장')).toBeInTheDocument();
    expect(screen.getAllByText(/5~7세트/).length).toBeGreaterThanOrEqual(6);

    // Reopen SettingsDrawer and toggle switches + save/delete API key + export/import backup
    fireEvent.click(screen.getByRole('button', { name: '설정 열기' }));
    dialog = screen.getByRole('dialog', { name: '설정 및 데이터 관리' });

    const soundSwitch = within(dialog).getByRole('switch', {
      name: '휴식 종료 차임벨 소리 켜기',
    });
    expect(soundSwitch).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(soundSwitch);
    expect(soundSwitch).toHaveAttribute('aria-checked', 'false');

    // Opening nested NumericPadSheet from SettingsDrawer and pressing Escape closes ONLY the pad
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: /벤치프레스 1RM .* 직접 입력 열기/,
      }),
    );
    expect(
      screen.getByRole('dialog', { name: '벤치프레스 1RM 입력' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: '벤치프레스 1RM 입력' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: '설정 및 데이터 관리' }),
    ).toBeInTheDocument();

    const apiInput = within(dialog).getByLabelText('개인 Gemini API 키');
    fireEvent.change(apiInput, { target: { value: 'AIzaSample' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(useWorkoutStore.getState().settings.geminiApiKey).toBe('AIzaSample');
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    expect(useWorkoutStore.getState().settings.geminiApiKey).toBe('');

    // Export JSON backup
    const createObjectUrlSpy = vi.fn().mockReturnValue('blob:mock-backup');
    const revokeObjectUrlSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrlSpy,
    });
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'JSON 백업 내보내기' }),
    );
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(
      within(dialog).getByText(/백업 파일을 내려받았어요/),
    ).toBeInTheDocument();

    // Import valid JSON backup (week 2) and invalid JSON backup
    const exportedSnapshot = useWorkoutStore.getState().exportBackupJson();
    const parsed = JSON.parse(exportedSnapshot) as { currentCycleWeek: number };
    parsed.currentCycleWeek = 2;

    const fileInput = within(dialog).getByLabelText('JSON 백업 파일 선택');
    expect(fileInput).toHaveClass('text-base');

    const validFile = new File([JSON.stringify(parsed)], 'backup.json', {
      type: 'application/json',
    });
    fireEvent.change(fileInput, { target: { files: [validFile] } });
    await waitFor(() => {
      expect(
        within(dialog).getByText('백업 데이터를 성공적으로 불러왔어요.'),
      ).toBeInTheDocument();
    });
    expect(useWorkoutStore.getState().currentCycleWeek).toBe(2);

    const invalidFile = new File(['{not-valid'], 'bad.json', {
      type: 'application/json',
    });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    await waitFor(() => {
      expect(
        within(dialog).getByText('올바른 JSON 백업 파일 형식이 아니에요'),
      ).toBeInTheDocument();
    });

    // Reset from demo mode to live clean mode
    fireEvent.click(
      within(dialog).getByRole('button', { name: '내 실전 기록으로 초기화' }),
    );
    expect(useWorkoutStore.getState().isDemoMode).toBe(false);
    expect(useWorkoutStore.getState().currentCycleWeek).toBe(1);

    // Log a real F45 session so live reset requires two-step inline confirmation
    act(() => {
      useWorkoutStore.getState().logF45Session({
        dateISO: '2026-11-27',
        classTitle: 'F45 아틀레티카',
        rpe: 8,
        lowerBodyImpact: 'high',
      });
    });

    fireEvent.click(
      within(dialog).getByRole('button', { name: '내 실전 기록으로 초기화' }),
    );
    expect(
      within(dialog).getByText('정말 실전 기록을 비우고 1주차부터 시작할까요?'),
    ).toBeInTheDocument();
    expect(useWorkoutStore.getState().f45Logs).toHaveLength(1);

    assertNoAiSlop(document.body);

    fireEvent.click(
      within(dialog).getByRole('button', { name: '기록 초기화하기' }),
    );
    expect(useWorkoutStore.getState().f45Logs).toHaveLength(0);

    // Log a real recovery entry so recoveryLogs also trigger two-step confirmation
    act(() => {
      useWorkoutStore
        .getState()
        .toggleRecoveryCheckItem('2026-11-26', 'sleep_7h');
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: '내 실전 기록으로 초기화' }),
    );
    expect(
      within(dialog).getByText('정말 실전 기록을 비우고 1주차부터 시작할까요?'),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: '기록 초기화하기' }),
    );
    expect(useWorkoutStore.getState().recoveryLogs).toHaveLength(0);

    // Reload demo mode
    fireEvent.click(
      within(dialog).getByRole('button', { name: '3주 샘플 기록 불러오기' }),
    );
    expect(useWorkoutStore.getState().isDemoMode).toBe(true);
    expect(useWorkoutStore.getState().currentCycleWeek).toBe(4);

    assertNoAiSlop(document.body);
  });
});
