import { diffIsoDays } from './fatigue-engine';
import type {
  AiFocusTopic,
  CnsFatigueResult,
  CycleWeek,
  F45SessionLog,
  ForecastResult,
  LowerBodyImpact,
  MuscleVolumeSummary,
  RecoveryCheckLog,
  UserProfile,
  WeightSessionLog,
} from './types';

export interface AiFocusTopicOption {
  id: AiFocusTopic;
  label: string;
  description: string;
  promptQuestion: string;
}

const LOWER_BODY_IMPACT_LABELS: Record<LowerBodyImpact, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
};

export const AI_FOCUS_TOPICS: readonly AiFocusTopicOption[] = [
  {
    id: 'strength_plateau',
    label: '다음 주 중량 조정',
    description: '탑세트 중량 및 e1RM 추이로 다음 주 목표를 점검해요',
    promptQuestion:
      '최근 3대 리프트(벤치프레스, 스쿼트, 데드리프트) e1RM 추이와 RIR 기록을 바탕으로 다음 주 중량 증량/유지/조절 전략을 제안해 주세요.',
  },
  {
    id: 'f45_fatigue',
    label: 'F45 피로도 관리',
    description: '유산소 컨디셔닝과 하체 스트렝스 간섭을 줄여요',
    promptQuestion:
      '최근 F45 세션의 RPE와 하체 부하가 금요일/일요일 하체 탑세트에 미치는 영향을 분석하고, 피로 조절 가이드를 알려 주세요.',
  },
  {
    id: 'deload_strategy',
    label: '6주차 디로딩 점검',
    description: '6주차 디로드와 다음 사이클 진입 계획을 세워요',
    promptQuestion:
      '현재 CNS 피로도와 누적 볼륨을 고려해 6주차 디로딩 시 유지할 동작, 줄여야 할 세트 비율, 다음 1주차 시작 중량을 설계해 주세요.',
  },
  {
    id: 'overall_balance',
    label: '약점과 비율 분석',
    description: '부위별 볼륨과 3대 비율이 균형 잡혀 있는지 확인해요',
    promptQuestion:
      '현재 F45 2회와 파워빌딩 4분할의 부위별 볼륨 및 3대 리프트 비율이 균형 잡혀 있는지 평가하고, 보완 포인트를 제안해 주세요.',
  },
];

export interface BuildAiCoachingPromptInput {
  referenceDateISO: string;
  cycleWeek: CycleWeek;
  profile: UserProfile;
  cnsFatigue: CnsFatigueResult;
  forecast: ForecastResult;
  weeklyVolume: MuscleVolumeSummary[];
  recentWeightLogs: WeightSessionLog[];
  recentF45Logs: F45SessionLog[];
  recentRecoveryLogs: RecoveryCheckLog[];
  focusTopic?: AiFocusTopic;
  focusTopics?: AiFocusTopic[];
  customNote?: string;
}

export function buildAiCoachingPrompt(
  input: BuildAiCoachingPromptInput,
): string {
  const {
    referenceDateISO,
    cycleWeek,
    profile,
    cnsFatigue,
    forecast,
    weeklyVolume,
    recentWeightLogs,
    recentF45Logs,
    recentRecoveryLogs,
    focusTopic,
    focusTopics,
    customNote,
  } = input;

  const activeTopicIds =
    focusTopics && focusTopics.length > 0
      ? focusTopics
      : [focusTopic ?? 'strength_plateau'];

  const selectedTopics = activeTopicIds
    .map((id) => AI_FOCUS_TOPICS.find((item) => item.id === id))
    .filter((item): item is AiFocusTopicOption => Boolean(item));

  const effectiveTopics =
    selectedTopics.length > 0 ? selectedTopics : [AI_FOCUS_TOPICS[0]!];

  const isWithin14Days = (dateISO: string): boolean => {
    const diff = diffIsoDays(dateISO, referenceDateISO);
    return diff >= 0 && diff <= 14;
  };

  const sortedWeights = recentWeightLogs
    .filter((log) => isWithin14Days(log.dateISO))
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  const sortedF45 = recentF45Logs
    .filter((log) => isWithin14Days(log.dateISO))
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  const sortedRecovery = recentRecoveryLogs
    .filter((log) => isWithin14Days(log.dateISO))
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));

  const weightSummaryLines =
    sortedWeights.length > 0
      ? sortedWeights.map((session) => {
          const topSummary = session.exercises
            .slice(0, 3)
            .map((ex) => {
              const firstCompleted = ex.sets.find((s) => s.completed);
              if (!firstCompleted) return ex.exerciseName;
              const rirText =
                firstCompleted.rir !== null ? ` RIR ${firstCompleted.rir}` : '';
              return `${ex.exerciseName} ${firstCompleted.weightKg}kg x ${firstCompleted.actualReps}회${rirText}`;
            })
            .join(', ');
          return `- ${session.dateISO} (${session.title}, ${session.cycleWeek}주차): ${topSummary}`;
        })
      : ['- 최근 14일 내 기록된 웨이트 세션이 아직 없어요.'];

  const f45SummaryLines =
    sortedF45.length > 0
      ? sortedF45.map(
          (f45) =>
            `- ${f45.dateISO} (${f45.classTitle}): RPE ${f45.rpe}/10, 하체 부하 ${LOWER_BODY_IMPACT_LABELS[f45.lowerBodyImpact]}`,
        )
      : ['- 최근 14일 내 기록된 F45 세션이 아직 없어요.'];

  const recoverySummaryLines =
    sortedRecovery.length > 0
      ? sortedRecovery.map(
          (rec) =>
            `- ${rec.dateISO}: 회복 항목 ${rec.checkedItemIds.length}/4개 완료`,
        )
      : ['- 최근 14일 내 기록된 목요일 회복 체크가 없어요.'];

  const volumeSummaryLines = weeklyVolume.map(
    (item) =>
      `- ${item.label}: 완료 ${item.completedSets}세트 / 계획 ${item.plannedSets}세트 (권장 ${item.targetMinSets}~${item.targetMaxSets}세트)`,
  );

  const factorSummary =
    cnsFatigue.factors.length > 0
      ? cnsFatigue.factors
          .map((factor) => `${factor.label}(${factor.delta >= 0 ? `+${factor.delta}` : factor.delta})`)
          .join(', ')
      : '특이 피로 가중치 없음';

  const topicHeading = effectiveTopics.map((t) => t.label).join(', ');
  const questionLines =
    effectiveTopics.length === 1
      ? [effectiveTopics[0]!.promptQuestion]
      : effectiveTopics.map((t, idx) => `${idx + 1}. [${t.label}] ${t.promptQuestion}`);

  const sections: string[] = [
    '# 하이브리드 파워빌딩 코칭 요청',
    '',
    `기준 날짜: ${referenceDateISO} (6주 사이클 ${cycleWeek}주차)`,
    '',
    '## 1. 선수 프로필 및 현재 퍼포먼스',
    `- 신체 정보: 키 ${profile.heightCm}cm, 체중 ${profile.weightKg}kg, 체지방률 ${profile.bodyFatPct}%`,
    `- 현재 추정 1RM: 벤치프레스 ${forecast.currentOneRm.bench}kg, 스쿼트 ${forecast.currentOneRm.squat}kg, 데드리프트 ${forecast.currentOneRm.deadlift}kg, OHP ${forecast.currentOneRm.ohp}kg`,
    `- 현재 3대 합계: ${forecast.currentSbdTotalKg}kg (DOTS ${forecast.dotsCurrent})`,
    `- 12주 예측 3대 합계: ${forecast.projected12WeekSbdTotalKg}kg (DOTS ${forecast.dotsProjected12Week})`,
    '',
    '## 2. CNS 피로도 상태',
    `- 종합 점수: ${cnsFatigue.score}/100 (${cnsFatigue.statusLabel})`,
    `- 상태 요약: ${cnsFatigue.headline}`,
    `- 반영 요인: ${factorSummary}`,
    '',
    '## 3. 주간 부위별 볼륨 현황',
    ...volumeSummaryLines,
    '',
    '## 4. 최근 14일 웨이트 세션 기록',
    ...weightSummaryLines,
    '',
    '## 5. 최근 14일 F45 컨디셔닝 기록',
    ...f45SummaryLines,
    '',
    '## 6. 최근 14일 회복 체크 기록',
    ...recoverySummaryLines,
    '',
    `## 7. 핵심 질문 (${topicHeading})`,
    ...questionLines,
  ];

  const trimmedNote = customNote?.trim();
  if (trimmedNote) {
    sections.push('', '## 추가 컨디션 메모', trimmedNote);
  }

  sections.push(
    '',
    '답변은 한국어로 구체적인 세트, 중량(kg), RIR 숫자를 포함해 실전 적용 가능하게 정리해 주세요.',
  );

  return sections.join('\n');
}
