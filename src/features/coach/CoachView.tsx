import { Check, ChevronDown, Copy, ExternalLink, Settings } from 'lucide-react';
import { useState } from 'react';
import { showToast } from '../../components/ui';
import {
  AI_FOCUS_TOPICS,
  buildAiCoachingPrompt,
} from '../../domain/ai-prompt-builder';
import { build12WeekForecast } from '../../domain/e1rm-engine';
import {
  calculateCnsFatigue,
  getMondayIsoDate,
} from '../../domain/fatigue-engine';
import type { AiFocusTopic } from '../../domain/types';
import { calculateWeeklyMuscleVolume } from '../../domain/volume-engine';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import { getLocalTodayIso, useWorkoutStore } from '../../store/workout-store';
import { GeminiDirectCoach } from './GeminiDirectCoach';

export interface CoachViewProps {
  onOpenSettings: () => void;
}

const CONDITION_TAGS = [
  '컨디션 가벼움',
  '수면 부족',
  '하체 피로 누적',
  '허리 뻐근함',
] as const;

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to execCommand when clipboard permissions fail
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function CoachView({ onOpenSettings }: CoachViewProps) {
  const currentCycleWeek = useWorkoutStore((s) => s.currentCycleWeek);
  const userProfile = useWorkoutStore((s) => s.userProfile);
  const weightLogs = useWorkoutStore((s) => s.weightLogs);
  const f45Logs = useWorkoutStore((s) => s.f45Logs);
  const recoveryLogs = useWorkoutStore((s) => s.recoveryLogs);
  const geminiApiKey = useWorkoutStore((s) => s.settings.geminiApiKey);

  const { triggerTapHaptic } = useSoundHaptics();

  const [selectedTopics, setSelectedTopics] = useState<AiFocusTopic[]>([
    'strength_plateau',
  ]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const todayISO = getLocalTodayIso();
  const mondayISO = getMondayIsoDate(todayISO);

  const forecast = build12WeekForecast({
    weightLogs,
    baseOneRm: userProfile.baseOneRm,
    currentCycleWeek,
    bodyweightKg: userProfile.weightKg,
  });

  const cnsFatigue = calculateCnsFatigue({
    referenceDateISO: todayISO,
    cycleWeek: currentCycleWeek,
    weightLogs,
    f45Logs,
    recoveryLogs,
  });

  const weeklyVolume = calculateWeeklyMuscleVolume({
    weekStartISO: mondayISO,
    weightLogs,
    cycleWeek: currentCycleWeek,
  });

  const customNote =
    selectedConditions.length > 0
      ? `현재 컨디션 체크: ${selectedConditions.join(', ')}`
      : undefined;

  const prompt = buildAiCoachingPrompt({
    referenceDateISO: todayISO,
    cycleWeek: currentCycleWeek,
    profile: userProfile,
    cnsFatigue,
    forecast,
    weeklyVolume,
    recentWeightLogs: weightLogs,
    recentF45Logs: f45Logs,
    recentRecoveryLogs: recoveryLogs,
    focusTopics: selectedTopics,
    customNote,
  });

  const handleToggleTopic = (topicId: AiFocusTopic) => {
    triggerTapHaptic();
    setSelectedTopics((prev) => {
      if (prev.includes(topicId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== topicId);
      }
      return [...prev, topicId];
    });
  };

  const handleToggleCondition = (tag: string) => {
    triggerTapHaptic();
    setSelectedConditions((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const handleCopyPrompt = async () => {
    triggerTapHaptic();
    const copied = await copyTextToClipboard(prompt);
    if (copied) {
      showToast('복사했어요. Claude나 Gemini에 붙여넣으세요');
    } else {
      showToast('복사에 실패했어요. 미리보기를 열어 직접 복사해 주세요');
      setIsPreviewOpen(true);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-[#191F28]">
            AI 코치
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-[#4E5968]">
            최근 14일 훈련 기록과 피로도를 정리해 드려요
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="설정 열기"
          className="inline-flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-[#4E5968] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-[#E5E8EB]/60 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <section
        aria-label="코칭 질문 주제 및 컨디션 선택"
        className="rounded-[24px] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-5"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold text-[#191F28]">
              어떤 주제로 조언을 받을까요?
            </h2>
            <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-[#6B7684] tabular-nums">
              {selectedTopics.length}개 선택됨
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AI_FOCUS_TOPICS.map((topic) => {
              const isSelected = selectedTopics.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleToggleTopic(topic.id)}
                  className={`flex min-h-12 min-w-12 cursor-pointer items-center justify-between gap-2 rounded-[14px] px-4 py-3 text-left active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                    isSelected
                      ? 'bg-[#1B64DA] text-white hover:bg-[#1552B8]'
                      : 'bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]'
                  }`}
                >
                  <span className="text-[14px] font-bold">{topic.label}</span>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 border-t border-[#F2F4F6] pt-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] font-bold text-[#191F28]">
              오늘 몸 상태 메모 추가
            </h2>
            <span className="shrink-0 whitespace-nowrap text-[12px] font-medium text-[#6B7684]">
              선택 사항
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {CONDITION_TAGS.map((tag) => {
              const isSelected = selectedConditions.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleToggleCondition(tag)}
                  className={`inline-flex min-h-12 min-w-12 cursor-pointer items-center whitespace-nowrap rounded-full px-4 text-[13px] font-bold active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                    isSelected
                      ? 'bg-[#1B64DA] text-white hover:bg-[#1552B8]'
                      : 'bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-label="프롬프트 복사 및 AI 연결"
        className="rounded-[24px] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-4"
      >
        <div>
          <button
            type="button"
            aria-expanded={isPreviewOpen}
            onClick={() => setIsPreviewOpen((prev) => !prev)}
            className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] bg-[#F2F4F6] px-4 text-left active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            <span className="text-[14px] font-semibold text-[#191F28]">
              {isPreviewOpen
                ? '프롬프트 미리보기 접기'
                : '프롬프트 미리보기 펼치기'}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-5 w-5 shrink-0 text-[#4E5968] transition-transform duration-150 ${
                isPreviewOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isPreviewOpen ? (
            <div className="mt-3 rounded-[14px] bg-[#F2F4F6] p-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-[#4E5968] tabular-nums">
                {prompt}
              </pre>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void handleCopyPrompt()}
          className="inline-flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-[18px] bg-[#1B64DA] px-5 text-[17px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          <Copy className="h-5 w-5" aria-hidden="true" />
          <span>프롬프트 복사하기</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[14px] bg-[#F2F4F6] px-2.5 text-[13px] font-bold text-[#191F28] min-[380px]:px-3 min-[380px]:text-[14px] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            <span>Claude 열기</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-[#4E5968]" aria-hidden="true" />
          </a>

          <a
            href="https://gemini.google.com/app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[14px] bg-[#F2F4F6] px-2.5 text-[13px] font-bold text-[#191F28] min-[380px]:px-3 min-[380px]:text-[14px] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            <span>Gemini 열기</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-[#4E5968]" aria-hidden="true" />
          </a>
        </div>

        <GeminiDirectCoach
          prompt={prompt}
          apiKey={geminiApiKey}
          onOpenSettings={onOpenSettings}
        />
      </section>
    </main>
  );
}
