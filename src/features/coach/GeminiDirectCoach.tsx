import { Loader2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface GeminiDirectCoachProps {
  prompt: string;
  apiKey: string;
  onOpenSettings: () => void;
}

interface GeminiResponsePayload {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function sanitizeCoachOutput(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/—/g, ', ')
    .replace(/·/g, ' ')
    .trim();
}

async function requestGeminiSummary(
  model: 'gemini-2.5-flash' | 'gemini-2.0-flash',
  apiKey: string,
  prompt: string,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${prompt}\n\n위 데이터를 바탕으로 한국어 ~해요 체로 핵심 3줄만 간결하게 조언해 주세요.`,
              },
            ],
          },
        ],
      }),
    },
  );
}

export function GeminiDirectCoach({
  prompt,
  apiKey,
  onOpenSettings,
}: GeminiDirectCoachProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsKeyCheck, setNeedsKeyCheck] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const trimmedKey = apiKey.trim();

  useEffect(() => {
    setErrorMessage(null);
    setNeedsKeyCheck(false);
  }, [trimmedKey, prompt]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  if (!trimmedKey) {
    return (
      <div className="border-t border-[#F2F4F6] pt-4">
        <button
          type="button"
          onClick={onOpenSettings}
          className="min-h-12 w-full cursor-pointer rounded-[14px] bg-[#F2F4F6] px-4 py-3 text-left text-[13px] font-semibold leading-relaxed text-[#4E5968] hover:bg-[#E5E8EB] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
        >
          설정에서 개인 Gemini API 키를 연결하면 앱 안에서 바로 3줄 요약을 볼 수 있어요
        </button>
      </div>
    );
  }

  const handleRequestCoaching = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 15000);

    setIsLoading(true);
    setErrorMessage(null);
    setNeedsKeyCheck(false);

    try {
      let response = await requestGeminiSummary(
        'gemini-2.5-flash',
        trimmedKey,
        prompt,
        controller.signal,
      );

      if (response.status === 404 && !controller.signal.aborted) {
        response = await requestGeminiSummary(
          'gemini-2.0-flash',
          trimmedKey,
          prompt,
          controller.signal,
        );
      }

      if (controller.signal.aborted) {
        return;
      }

      if (!response.ok) {
        if (
          response.status === 400 ||
          response.status === 401 ||
          response.status === 403
        ) {
          setNeedsKeyCheck(true);
          setErrorMessage(
            'Gemini API 키가 올바르지 않거나 권한이 부족해요. 설정에서 키를 다시 확인해 주세요',
          );
        } else if (response.status === 429) {
          setErrorMessage(
            '요청 횟수가 많아 잠시 대기 중이에요. 잠시 후 다시 시도해 주세요',
          );
        } else {
          setErrorMessage(
            '코칭 요약을 불러오지 못했어요. 잠시 후 다시 시도해 주세요',
          );
        }
        setSummaryText(null);
        return;
      }

      const data = (await response.json()) as GeminiResponsePayload;
      const rawText =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? '')
          .join('\n') ?? '';
      const cleanText = sanitizeCoachOutput(rawText);

      if (!cleanText) {
        setErrorMessage(
          '응답 내용이 비어 있어요. 프롬프트를 복사해 직접 질문해 보세요',
        );
        setSummaryText(null);
        return;
      }

      setSummaryText(cleanText);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (didTimeout) {
          setErrorMessage(
            '응답 시간이 초과되었어요. 잠시 후 다시 시도해 주세요',
          );
          setSummaryText(null);
        }
        return;
      }
      setErrorMessage(
        '네트워크 연결을 확인하지 못했어요. 와이파이 또는 데이터 상태를 확인해 주세요',
      );
      setSummaryText(null);
    } finally {
      clearTimeout(timeoutId);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-3 border-t border-[#F2F4F6] pt-4">
      <button
        type="button"
        disabled={isLoading}
        onClick={() => void handleRequestCoaching()}
        className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#F2F4F6] px-4 text-[15px] font-bold text-[#191F28] hover:bg-[#E5E8EB] disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>3줄 코칭 요약을 정리하고 있어요</span>
          </>
        ) : (
          <>
            <Sparkles
              className="h-4 w-4 text-[#1B64DA]"
              aria-hidden="true"
            />
            <span>앱 안에서 3줄 코칭 받기</span>
          </>
        )}
      </button>

      {errorMessage ? (
        <div
          role="alert"
          className="space-y-2 rounded-[14px] bg-[#FFEBEE] px-4 py-3 text-[13px] font-semibold leading-relaxed text-[#C92A2A]"
        >
          <p>{errorMessage}</p>
          {needsKeyCheck ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-12 cursor-pointer rounded-[12px] bg-white px-3.5 text-[13px] font-bold text-[#1B64DA] hover:bg-[#F8FBFF] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
            >
              설정에서 API 키 확인하기
            </button>
          ) : null}
        </div>
      ) : null}

      {summaryText ? (
        <div
          aria-live="polite"
          className="space-y-1.5 border-t border-[#F2F4F6] pt-3"
        >
          <p className="text-[13px] font-bold text-[#1B64DA]">
            Gemini 3줄 요약 코칭
          </p>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-[#191F28] tabular-nums">
            {summaryText}
          </p>
        </div>
      ) : null}
    </div>
  );
}
