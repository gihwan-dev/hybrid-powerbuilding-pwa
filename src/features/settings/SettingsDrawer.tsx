import { Download, Smartphone, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { BottomSheet, NumberStepper, showToast } from '../../components/ui';
import type { CycleWeek } from '../../domain/types';
import { useSoundHaptics } from '../../hooks/useSoundHaptics';
import { getLocalTodayIso, useWorkoutStore } from '../../store/workout-store';

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
}

const CYCLE_WEEKS: readonly { week: CycleWeek; label: string }[] = [
  { week: 1, label: '1주' },
  { week: 2, label: '2주' },
  { week: 3, label: '3주' },
  { week: 4, label: '4주' },
  { week: 5, label: '5주' },
  { week: 6, label: '6주(디로드)' },
];

const APK_DOWNLOAD_URL =
  'https://github.com/gihwan-dev/hybrid-powerbuilding-pwa/releases/latest/download/power-hybrid-release.apk';

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(new Error('파일을 읽지 못했어요'));
    };
    reader.readAsText(file);
  });
}

export function SettingsDrawer({
  open,
  onClose,
  canInstallPwa = false,
  onInstallPwa,
}: SettingsDrawerProps) {
  const isDemoMode = useWorkoutStore((s) => s.isDemoMode);
  const currentCycleWeek = useWorkoutStore((s) => s.currentCycleWeek);
  const userProfile = useWorkoutStore((s) => s.userProfile);
  const weightLogs = useWorkoutStore((s) => s.weightLogs);
  const f45Logs = useWorkoutStore((s) => s.f45Logs);
  const recoveryLogs = useWorkoutStore((s) => s.recoveryLogs);
  const settings = useWorkoutStore((s) => s.settings);

  const loadDemoData = useWorkoutStore((s) => s.loadDemoData);
  const resetToLiveCleanState = useWorkoutStore((s) => s.resetToLiveCleanState);
  const setCycleWeek = useWorkoutStore((s) => s.setCycleWeek);
  const updateBaseOneRm = useWorkoutStore((s) => s.updateBaseOneRm);
  const updateUserProfile = useWorkoutStore((s) => s.updateUserProfile);
  const updateSettings = useWorkoutStore((s) => s.updateSettings);
  const exportBackupJson = useWorkoutStore((s) => s.exportBackupJson);
  const importBackupJson = useWorkoutStore((s) => s.importBackupJson);

  const { triggerTapHaptic } = useSoundHaptics();

  const [confirmLiveReset, setConfirmLiveReset] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.geminiApiKey);
  const [backupFeedback, setBackupFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setConfirmLiveReset(false);
      setBackupFeedback(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setApiKeyDraft(settings.geminiApiKey);
    }
  }, [open, settings.geminiApiKey]);

  const hasLiveLogs =
    !isDemoMode &&
    (weightLogs.length > 0 || f45Logs.length > 0 || recoveryLogs.length > 0);

  const handleLoadDemo = () => {
    triggerTapHaptic();
    loadDemoData();
    setConfirmLiveReset(false);
    showToast('3주 샘플 기록을 불러왔어요');
  };

  const handleResetToLiveClick = () => {
    triggerTapHaptic();
    if (hasLiveLogs) {
      setConfirmLiveReset(true);
      return;
    }
    resetToLiveCleanState();
    setConfirmLiveReset(false);
    showToast('내 기록 모드로 1주차부터 시작해요');
  };

  const handleConfirmLiveReset = () => {
    triggerTapHaptic();
    resetToLiveCleanState();
    setConfirmLiveReset(false);
    showToast('실전 기록을 비우고 1주차부터 새로 시작해요');
  };

  const handleSaveApiKey = () => {
    triggerTapHaptic();
    updateSettings({ geminiApiKey: apiKeyDraft.trim() });
    showToast('Gemini API 키를 저장했어요');
  };

  const handleDeleteApiKey = () => {
    triggerTapHaptic();
    setApiKeyDraft('');
    updateSettings({ geminiApiKey: '' });
    showToast('Gemini API 키를 삭제했어요');
  };

  const handleExportBackup = () => {
    triggerTapHaptic();
    const filename = `liftlog-backup-${getLocalTodayIso()}.json`;

    try {
      const json = exportBackupJson();
      if (typeof URL.createObjectURL !== 'function') {
        setBackupFeedback({
          tone: 'error',
          text: '이 브라우저에서는 파일 다운로드를 지원하지 않아요.',
        });
        return;
      }

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      setBackupFeedback({
        tone: 'success',
        text: `${filename} 백업 파일을 내려받았어요.`,
      });
      showToast('JSON 백업 파일을 내보냈어요');
    } catch {
      setBackupFeedback({
        tone: 'error',
        text: '백업 파일 생성에 실패했어요. 다시 시도해 주세요.',
      });
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const rawText = await readFileAsText(file);
      const result = importBackupJson(rawText);
      if (result.ok) {
        setBackupFeedback({
          tone: 'success',
          text: '백업 데이터를 성공적으로 불러왔어요.',
        });
        showToast('백업 데이터를 복원했어요');
      } else {
        setBackupFeedback({
          tone: 'error',
          text: result.error,
        });
      }
    } catch {
      setBackupFeedback({
        tone: 'error',
        text: '파일을 읽지 못했어요. JSON 파일인지 확인해 주세요.',
      });
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="설정 및 데이터 관리"
      description="주기화 주차, 기준 1RM, 알림 및 백업을 한곳에서 관리해요"
    >
      <div className="divide-y divide-[#F2F4F6]">
        <section className="space-y-3 pb-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-bold text-[#191F28]">데이터 모드</h3>
            <span className="inline-flex items-center rounded-full bg-[#E8F3FF] px-3 py-1 text-[12px] font-bold text-[#1B64DA]">
              {isDemoMode ? '체험 데이터 사용 중' : '내 실전 기록 모드'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleLoadDemo}
              className="min-h-12 cursor-pointer rounded-[14px] bg-[#F2F4F6] px-4 text-[14px] font-bold text-[#191F28] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              3주 샘플 기록 불러오기
            </button>
            <button
              type="button"
              onClick={handleResetToLiveClick}
              className="min-h-12 cursor-pointer rounded-[14px] bg-[#F2F4F6] px-4 text-[14px] font-bold text-[#4E5968] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              내 실전 기록으로 초기화
            </button>
          </div>

          {confirmLiveReset ? (
            <div
              role="alert"
              className="space-y-3 rounded-[14px] bg-[#FFEBEE] p-4"
            >
              <p className="text-[14px] font-semibold leading-relaxed text-[#C92A2A]">
                정말 실전 기록을 비우고 1주차부터 시작할까요?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleConfirmLiveReset}
                  className="min-h-12 cursor-pointer rounded-[14px] bg-[#C92A2A] px-3 text-[14px] font-bold text-white hover:bg-[#A61E1E] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
                >
                  기록 초기화하기
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLiveReset(false)}
                  className="min-h-12 cursor-pointer rounded-[14px] bg-white px-3 text-[14px] font-semibold text-[#191F28] hover:bg-[#F2F4F6] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
                >
                  취소
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3 py-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-bold text-[#191F28]">
              주기화 주차 관리
            </h3>
            <span className="text-[13px] font-semibold text-[#6B7684] tabular-nums">
              현재 {currentCycleWeek}주차
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {CYCLE_WEEKS.map(({ week, label }) => {
              const isSelected = currentCycleWeek === week;
              return (
                <button
                  key={week}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerTapHaptic();
                    setCycleWeek(week);
                    showToast(`${label}로 변경했어요`);
                  }}
                  className={`min-h-12 min-w-12 cursor-pointer rounded-[14px] px-2 text-[14px] font-bold tabular-nums active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                    isSelected
                      ? 'bg-[#1B64DA] text-white hover:bg-[#1552B8]'
                      : 'bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 py-5">
          <h3 className="text-[16px] font-bold text-[#191F28]">
            기준 1RM 및 체중
          </h3>

          <div className="space-y-4">
            <NumberStepper
              label="벤치프레스 1RM"
              value={userProfile.baseOneRm.bench}
              step={2.5}
              min={0}
              max={400}
              unitLabel="kg"
              allowDecimal
              onChange={(bench) => updateBaseOneRm({ bench })}
              onStepFeedback={triggerTapHaptic}
            />
            <NumberStepper
              label="백 스쿼트 1RM"
              value={userProfile.baseOneRm.squat}
              step={2.5}
              min={0}
              max={500}
              unitLabel="kg"
              allowDecimal
              onChange={(squat) => updateBaseOneRm({ squat })}
              onStepFeedback={triggerTapHaptic}
            />
            <NumberStepper
              label="데드리프트 1RM"
              value={userProfile.baseOneRm.deadlift}
              step={2.5}
              min={0}
              max={500}
              unitLabel="kg"
              allowDecimal
              onChange={(deadlift) => updateBaseOneRm({ deadlift })}
              onStepFeedback={triggerTapHaptic}
            />
            <NumberStepper
              label="OHP 1RM"
              value={userProfile.baseOneRm.ohp}
              step={2.5}
              min={0}
              max={300}
              unitLabel="kg"
              allowDecimal
              onChange={(ohp) => updateBaseOneRm({ ohp })}
              onStepFeedback={triggerTapHaptic}
            />
            <NumberStepper
              label="체중 (kg)"
              value={userProfile.weightKg}
              step={0.5}
              min={30}
              max={250}
              unitLabel="kg"
              allowDecimal
              onChange={(weightKg) => updateUserProfile({ weightKg })}
              onStepFeedback={triggerTapHaptic}
            />
          </div>
        </section>

        <section className="space-y-4 py-5">
          <h3 className="text-[16px] font-bold text-[#191F28]">
            알림 및 개인 API 키
          </h3>

          <div className="space-y-2">
            <button
              type="button"
              role="switch"
              aria-checked={settings.soundEnabled}
              onClick={() => {
                triggerTapHaptic();
                updateSettings({ soundEnabled: !settings.soundEnabled });
              }}
              className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] bg-[#F2F4F6] px-4 py-2.5 text-left active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              <span className="text-[14px] font-semibold text-[#191F28]">
                휴식 종료 차임벨 소리 켜기
              </span>
              <span
                aria-hidden="true"
                className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 ${
                  settings.soundEnabled ? 'bg-[#1B64DA]' : 'bg-[#6B7684]'
                }`}
              >
                <span
                  className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                    settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={settings.vibrationEnabled}
              onClick={() => {
                updateSettings({ vibrationEnabled: !settings.vibrationEnabled });
              }}
              className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] bg-[#F2F4F6] px-4 py-2.5 text-left active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              <span className="text-[14px] font-semibold text-[#191F28]">
                터치 및 타이머 진동 켜기
              </span>
              <span
                aria-hidden="true"
                className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 ${
                  settings.vibrationEnabled ? 'bg-[#1B64DA]' : 'bg-[#6B7684]'
                }`}
              >
                <span
                  className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                    settings.vibrationEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="gemini-api-key"
              className="block text-[14px] font-semibold text-[#191F28]"
            >
              개인 Gemini API 키
            </label>
            <input
              id="gemini-api-key"
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder="AIza로 시작하는 키를 입력해요"
              autoComplete="off"
              className="min-h-12 w-full rounded-[14px] bg-[#F2F4F6] px-4 text-base text-[#191F28] placeholder:text-[#4E5968] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="min-h-12 cursor-pointer rounded-[14px] bg-[#1B64DA] px-4 text-[14px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
              >
                저장
              </button>
              <button
                type="button"
                onClick={handleDeleteApiKey}
                className="min-h-12 cursor-pointer rounded-[14px] bg-[#F2F4F6] px-4 text-[14px] font-bold text-[#4E5968] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
              >
                삭제
              </button>
            </div>
            <p className="text-[12px] leading-relaxed text-[#6B7684]">
              입력한 API 키는 외부 서버에 저장되지 않고 현재 브라우저 저장소에만 보관돼요.
            </p>
          </div>
        </section>

        <section className="space-y-3 pt-5">
          <h3 className="text-[16px] font-bold text-[#191F28]">
            백업 및 앱 설치
          </h3>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-[14px] bg-[#F2F4F6] px-3 text-[14px] font-bold text-[#191F28] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>JSON 백업 내보내기</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-[14px] bg-[#F2F4F6] px-3 text-[14px] font-bold text-[#191F28] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>JSON 백업 불러오기</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="JSON 백업 파일 선택"
            onChange={(event) => void handleFileChange(event)}
            className="sr-only text-base"
          />

          {backupFeedback ? (
            <p
              role={backupFeedback.tone === 'error' ? 'alert' : 'status'}
              className={`rounded-[14px] px-4 py-3 text-[13px] font-semibold ${
                backupFeedback.tone === 'error'
                  ? 'bg-[#FFEBEE] text-[#C92A2A]'
                  : 'bg-[#E8FAF0] text-[#027A48]'
              }`}
            >
              {backupFeedback.text}
            </p>
          ) : null}

          {canInstallPwa && onInstallPwa ? (
            <button
              type="button"
              onClick={() => {
                triggerTapHaptic();
                onInstallPwa();
              }}
              className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#1B64DA] px-4 text-[14px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              <span>홈 화면에 앱 설치하기</span>
            </button>
          ) : null}

          <a
            href={APK_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#E8F3FF] px-4 text-[14px] font-bold text-[#1B64DA] hover:bg-[#D5E8FF] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            <span>Android 설치 파일(APK) 받기</span>
          </a>
        </section>
      </div>
    </BottomSheet>
  );
}
