"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Locale = "ko" | "en";
type ViewId = "home" | "checkin" | "rules";

type LocalizedText = Record<Locale, string>;

type AmbiguousSpend = {
  label: string;
  amount: number;
  author: string;
  createdAt: string;
};

type RuleMemory = {
  text: string;
  sourceLabel: string;
  createdAt: string;
  createdWeekStart: string;
  resurfacedWeekStart: string | null;
};

type PersistedState = {
  locale: Locale;
  currentView: ViewId;
  checkinStep: number;
  sessionCode: string;
  currentUserName: string;
  hasJoinedSession: boolean;
  participantNames: string[];
  weekStart: string;
  revision: number;
  goalName: string;
  weeklyBuffer: number;
  bufferUpdatedBy: string;
  ambiguousSpend: AmbiguousSpend | null;
  ruleMemory: RuleMemory | null;
  savedAt: string;
};

type RemoteStateStatus =
  | "local-only"
  | "syncing"
  | "connected"
  | "missing-table"
  | "error"
  | "conflict";

type CheckinPrompt = {
  step: LocalizedText;
  title: LocalizedText;
  helper: LocalizedText;
};

type CopyShape = Record<string, LocalizedText>;

const STORAGE_KEY_PREFIX = "bbodong.home-state.v4";
const DEFAULT_BUFFER = 180000;
const REMOTE_SAVE_DEBOUNCE_MS = 250;

const prompts: CheckinPrompt[] = [
  {
    step: { ko: "1. 이번 주 여유 확인", en: "1. Check this week's flex" },
    title: {
      ko: "이번 주 같이 쓰기로 남겨둔 돈을 확인하세요",
      en: "Confirm how much you both agreed to leave for this week",
    },
    helper: {
      ko: "자동 계산처럼 보이지 않게, 직접 합의한 숫자만 적습니다.",
      en: "Only use the number you agreed on. Do not fake automatic precision.",
    },
  },
  {
    step: { ko: "2. 가장 애매한 소비", en: "2. Most ambiguous spend" },
    title: {
      ko: "이번 주 가장 다시 얘기해야 할 소비를 하나 고르세요",
      en: "Pick the one spend that needs a second conversation",
    },
    helper: {
      ko: "추천 항목을 고르거나 직접 입력할 수 있습니다.",
      en: "Use a suggestion or write your own.",
    },
  },
  {
    step: { ko: "3. 다음 주 기준 남기기", en: "3. Leave next week's rule" },
    title: {
      ko: "다음 주에도 다시 볼 한 줄 규칙을 남기세요",
      en: "Write the one-line rule you want to reuse next week",
    },
    helper: {
      ko: "통제가 아니라, 우리 둘이 덜 힘들어지기 위한 기준이어야 합니다.",
      en: "This should feel like a shared standard, not control.",
    },
  },
];

const spendSuggestions = [
  { ko: "배달", en: "Delivery", amount: 28000 },
  { ko: "주말 외식", en: "Weekend dinner", amount: 42000 },
  { ko: "모임 약속", en: "Social plans", amount: 60000 },
];

const ruleStarters = [
  {
    ko: "배달이 3만원 넘으면 먼저 공유하기",
    en: "Share it first if delivery goes over ₩30,000",
  },
  {
    ko: "여행 적금 주에는 주말 외식 1번만",
    en: "During travel-saving weeks, keep weekend dinner to once",
  },
  {
    ko: "밤 10시 이후 결제는 아침에 다시 보기",
    en: "Revisit after-10PM purchases in the morning",
  },
];

const copy = {
  appTagline: {
    ko: "신혼, 맞벌이",
    en: "Newly married, dual-income",
  },
  appDescription: {
    ko: "돈 얘기가 싸움으로 번지기 전에, 이번 주 기준만 빠르게 맞추는 공유 체크인.",
    en: "A shared check-in that aligns this week's standard before money talk turns into friction.",
  },
  language: {
    ko: "언어",
    en: "Language",
  },
  languageKo: {
    ko: "한국어",
    en: "Korean",
  },
  languageEn: {
    ko: "영어",
    en: "English",
  },
  connection: {
    ko: "연결 상태",
    en: "Connection",
  },
  storage: {
    ko: "저장",
    en: "Storage",
  },
  resetLocal: {
    ko: "로컬 초기화",
    en: "Reset local",
  },
  noSavedState: {
    ko: "아직 저장된 상태가 없습니다.",
    en: "No saved state yet.",
  },
  remoteLocalOnly: {
    ko: "이 세션에서는 원격 동기화가 꺼져 있습니다.",
    en: "Remote sync is off for this session.",
  },
  remoteSyncing: {
    ko: "Supabase 상태를 확인하는 중입니다...",
    en: "Checking Supabase state...",
  },
  remoteConnected: {
    ko: "같은 세션 코드로 들어오면 같은 상태를 같이 봅니다.",
    en: "Anyone opening this session code sees the same shared state.",
  },
  remoteMissingTable: {
    ko: "Supabase는 설정됐지만 공유 세션 테이블이 아직 없습니다.",
    en: "Supabase is configured, but the shared session tables are not created yet.",
  },
  remoteError: {
    ko: "Supabase 동기화에 실패했습니다. 로컬 저장은 계속 동작합니다.",
    en: "Supabase sync failed. Local persistence still works.",
  },
  remoteConflict: {
    ko: "다른 사람이 더 최신 상태를 저장해서 지금 변경은 자동 저장하지 않았습니다. 화면을 다시 확인하세요.",
    en: "Someone else saved a newer version first, so this change was not auto-saved. Refresh your view.",
  },
  connected: {
    ko: "Supabase 연결됨",
    en: "Supabase connected",
  },
  notConfigured: {
    ko: "Supabase 미설정",
    en: "Supabase not configured",
  },
  session: {
    ko: "공유 세션",
    en: "Shared session",
  },
  sessionCode: {
    ko: "세션 코드",
    en: "Session code",
  },
  sessionHelp: {
    ko: "같은 링크나 코드로 들어오면 같은 체크인 상태를 봅니다.",
    en: "Open the same link or code to land in the same shared check-in state.",
  },
  shareLink: {
    ko: "공유 링크",
    en: "Share link",
  },
  joinCode: {
    ko: "다른 세션 코드로 이동",
    en: "Switch to another session code",
  },
  newSession: {
    ko: "새 세션 만들기",
    en: "Create new session",
  },
  joinSession: {
    ko: "이 코드로 열기",
    en: "Open this code",
  },
  joinCurrentSession: {
    ko: "세션 참여하기",
    en: "Join this session",
  },
  yourName: {
    ko: "내 이름",
    en: "Your name",
  },
  participantStatus: {
    ko: "참여 상태",
    en: "Participants",
  },
  youJoined: {
    ko: "내 참여 상태",
    en: "Your join state",
  },
  joinedAs: {
    ko: "이 이름으로 참여 중",
    en: "Joined as",
  },
  notJoinedYet: {
    ko: "아직 이 세션에 참여하지 않았습니다.",
    en: "You have not joined this session yet.",
  },
  waitingPartner: {
    ko: "아직 상대가 안 들어왔습니다.",
    en: "The other person has not joined yet.",
  },
  partnerJoined: {
    ko: "둘 다 같은 세션에 들어왔습니다.",
    en: "Both people have joined the same session.",
  },
  goal: {
    ko: "공유 목표",
    en: "Shared goal",
  },
  buffer: {
    ko: "이번 주 같이 쓰기로 남겨둔 돈",
    en: "Money you both left for this week",
  },
  bufferHelp: {
    ko: "자동 계산값이 아니라, 둘이 직접 합의한 주간 여유분입니다.",
    en: "This is not an automatic calculation. It is the weekly flex amount you agreed on.",
  },
  updatedBy: {
    ko: "최근 수정",
    en: "Latest update",
  },
  revisionLabel: {
    ko: "버전",
    en: "Revision",
  },
  ambiguousSpend: {
    ko: "이번 주 가장 애매한 소비",
    en: "This week's most ambiguous spend",
  },
  noAmbiguousSpend: {
    ko: "아직 적어둔 애매한 소비가 없습니다.",
    en: "No ambiguous spend recorded yet.",
  },
  currentRule: {
    ko: "우리의 현재 규칙",
    en: "Our current rule",
  },
  resurfacedRule: {
    ko: "이번 주 다시 떠오른 규칙",
    en: "Rule resurfaced this week",
  },
  noRule: {
    ko: "아직 남겨둔 규칙이 없습니다.",
    en: "No shared rule yet.",
  },
  noRuleThisWeek: {
    ko: "이번 주에 다시 떠오를 규칙은 아직 없습니다.",
    en: "No rule has resurfaced for this week yet.",
  },
  checkinStatus: {
    ko: "이번 주 체크인 상태",
    en: "This week's check-in",
  },
  checkinIncomplete: {
    ko: "아직 기준을 정하지 않았습니다.",
    en: "You have not locked this week's standard yet.",
  },
  checkinComplete: {
    ko: "다음 주에도 다시 볼 기준이 저장됐습니다.",
    en: "A rule for next week has been saved.",
  },
  beginCheckin: {
    ko: "이번 주 기준 정하기",
    en: "Set this week's standard",
  },
  reviewRuleMemory: {
    ko: "규칙 메모 보기",
    en: "Open rule memory",
  },
  backHome: {
    ko: "홈으로",
    en: "Back home",
  },
  checkinProgress: {
    ko: "체크인 진행",
    en: "Check-in progress",
  },
  bufferLabel: {
    ko: "합의된 주간 여유분",
    en: "Agreed weekly flex amount",
  },
  updatedByLabel: {
    ko: "누가 마지막으로 수정했나요?",
    en: "Who last updated it?",
  },
  continue: {
    ko: "계속하기",
    en: "Continue",
  },
  back: {
    ko: "이전",
    en: "Back",
  },
  customSpendLabel: {
    ko: "직접 입력한 항목",
    en: "Custom spend label",
  },
  amountLabel: {
    ko: "금액",
    en: "Amount",
  },
  chooseSuggestion: {
    ko: "추천 항목",
    en: "Suggested items",
  },
  ruleStarter: {
    ko: "시작 문장",
    en: "Rule starters",
  },
  ruleTextarea: {
    ko: "우리 규칙",
    en: "Our rule",
  },
  saveRule: {
    ko: "규칙 저장하기",
    en: "Save rule",
  },
  restartCheckin: {
    ko: "체크인 다시 하기",
    en: "Restart check-in",
  },
  sourceSpend: {
    ko: "출발점 소비",
    en: "Source spend",
  },
  savedRuleMemory: {
    ko: "저장된 규칙 메모",
    en: "Saved rule memory",
  },
  noRuleHistory: {
    ko: "다음 주에도 다시 볼 규칙이 아직 없습니다.",
    en: "There is no rule ready to resurface next week yet.",
  },
  reopenCheckin: {
    ko: "다시 기준 정하기",
    en: "Set a new rule",
  },
  stickyHint: {
    ko: "3분 안에 끝내는 흐름으로만 남깁니다.",
    en: "This flow is intentionally constrained to stay under three minutes.",
  },
  joinBeforeCheckin: {
    ko: "체크인을 시작하기 전에 먼저 세션에 참여하세요.",
    en: "Join the session before starting the check-in.",
  },
  currentWeekLabel: {
    ko: "이번 주 시작",
    en: "Week start",
  },
  ruleCreatedWeek: {
    ko: "규칙 작성 주",
    en: "Rule written in week",
  },
} satisfies CopyShape;

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  const storage = window.localStorage;

  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null;
  }

  return storage;
}

function safeLocale(value: unknown): Locale {
  return value === "en" ? "en" : "ko";
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderBadge(hasConfig: boolean, locale: Locale) {
  return hasConfig ? copy.connected[locale] : copy.notConfigured[locale];
}

function formatCurrency(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "ko" ? "ko-KR" : "en-US");
}

function getWeekStartFromDate(value: Date) {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized.toISOString().slice(0, 10);
}

function getCurrentWeekStart() {
  return getWeekStartFromDate(new Date());
}

function normalizeSessionCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function createSessionCode() {
  return `BBO${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function getStorageKey(sessionCode: string) {
  return `${STORAGE_KEY_PREFIX}.${sessionCode}`;
}

function getUrlSessionCode() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  return normalizeSessionCode(params.get("session") ?? "");
}

function replaceUrlSessionCode(sessionCode: string) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionCode);
  window.history.replaceState({}, "", url.toString());
}

function getDefaultState(sessionCode: string): PersistedState {
  return {
    locale: "ko",
    currentView: "home",
    checkinStep: 0,
    sessionCode,
    currentUserName: "지훈",
    hasJoinedSession: false,
    participantNames: [],
    weekStart: getCurrentWeekStart(),
    revision: 0,
    goalName: "제주 여행 적금",
    weeklyBuffer: DEFAULT_BUFFER,
    bufferUpdatedBy: "지훈",
    ambiguousSpend: null,
    ruleMemory: null,
    savedAt: "",
  };
}

function buildShareUrl(sessionCode: string) {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionCode);
  return url.toString();
}

export function HomeClient({
  hasSupabaseConfig,
  enableRemoteSync = true,
}: {
  hasSupabaseConfig: boolean;
  enableRemoteSync?: boolean;
}) {
  const [sessionCode, setSessionCode] = useState("");
  const [locale, setLocale] = useState<Locale>("ko");
  const [currentView, setCurrentView] = useState<ViewId>("home");
  const [checkinStep, setCheckinStep] = useState(0);
  const [currentUserName, setCurrentUserName] = useState("지훈");
  const [hasJoinedSession, setHasJoinedSession] = useState(false);
  const [participantNames, setParticipantNames] = useState<string[]>([]);
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [revision, setRevision] = useState(0);
  const [goalName, setGoalName] = useState("제주 여행 적금");
  const [weeklyBuffer, setWeeklyBuffer] = useState(DEFAULT_BUFFER);
  const [bufferUpdatedBy, setBufferUpdatedBy] = useState("지훈");
  const [ambiguousSpend, setAmbiguousSpend] = useState<AmbiguousSpend | null>(null);
  const [ruleMemory, setRuleMemory] = useState<RuleMemory | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [remoteStateStatus, setRemoteStateStatus] =
    useState<RemoteStateStatus>("local-only");
  const [bufferInput, setBufferInput] = useState(String(DEFAULT_BUFFER));
  const [spendLabelInput, setSpendLabelInput] = useState("");
  const [spendAmountInput, setSpendAmountInput] = useState("");
  const [ruleDraft, setRuleDraft] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const skipNextPersistRef = useRef(false);
  const remoteSaveTimerRef = useRef<number | null>(null);
  const hasLocalEditsRef = useRef(false);

  const completedCheckin = Boolean(ruleMemory);
  const localizedSavedAt = lastSavedAt ? formatDate(lastSavedAt, locale) : null;
  const localizedBuffer = formatCurrency(weeklyBuffer, locale);
  const localizedSpendAmount = ambiguousSpend
    ? formatCurrency(ambiguousSpend.amount, locale)
    : null;
  const shareUrl = useMemo(() => buildShareUrl(sessionCode), [sessionCode]);
  const partnerJoined = participantNames.length > 1;
  const participantSummary = participantNames.join(", ");
  const resurfacedThisWeek = Boolean(
    ruleMemory && ruleMemory.resurfacedWeekStart === weekStart,
  );
  const remoteTablesMissing = remoteStateStatus === "missing-table";

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  useEffect(() => {
    const nextSessionCode = getUrlSessionCode() || createSessionCode();
    replaceUrlSessionCode(nextSessionCode);
    setSessionCode(nextSessionCode);
    setJoinCodeInput(nextSessionCode);
  }, []);

  useEffect(() => {
    if (!sessionCode) {
      return;
    }

    const defaultState = getDefaultState(sessionCode);

    const applyPersistedState = (parsedState: Partial<PersistedState>) => {
      setLocale(safeLocale(parsedState.locale));
      setCurrentView(
        parsedState.currentView === "checkin" || parsedState.currentView === "rules"
          ? parsedState.currentView
          : "home",
      );
      setCheckinStep(
        typeof parsedState.checkinStep === "number" ? parsedState.checkinStep : 0,
      );

      const nextName =
        typeof parsedState.currentUserName === "string" && parsedState.currentUserName
          ? parsedState.currentUserName
          : defaultState.currentUserName;
      setCurrentUserName(nextName);
      setHasJoinedSession(
        typeof parsedState.hasJoinedSession === "boolean"
          ? parsedState.hasJoinedSession
          : defaultState.hasJoinedSession,
      );

      const nextParticipants =
        Array.isArray(parsedState.participantNames) && parsedState.participantNames.length > 0
          ? Array.from(new Set(parsedState.participantNames.filter(Boolean)))
          : [];
      setParticipantNames(nextParticipants);
      setWeekStart(
        typeof parsedState.weekStart === "string" && parsedState.weekStart
          ? parsedState.weekStart
          : defaultState.weekStart,
      );
      setRevision(
        typeof parsedState.revision === "number" && parsedState.revision >= 0
          ? parsedState.revision
          : defaultState.revision,
      );

      setGoalName(
        typeof parsedState.goalName === "string" && parsedState.goalName
          ? parsedState.goalName
          : defaultState.goalName,
      );

      const nextBuffer =
        typeof parsedState.weeklyBuffer === "number"
          ? parsedState.weeklyBuffer
          : defaultState.weeklyBuffer;
      setWeeklyBuffer(nextBuffer);
      setBufferInput(String(nextBuffer));

      const nextBufferUpdatedBy =
        typeof parsedState.bufferUpdatedBy === "string" && parsedState.bufferUpdatedBy
          ? parsedState.bufferUpdatedBy
          : nextName;
      setBufferUpdatedBy(nextBufferUpdatedBy);

      setAmbiguousSpend(parsedState.ambiguousSpend ?? null);
      setRuleMemory(parsedState.ruleMemory ?? null);
      setSpendLabelInput(parsedState.ambiguousSpend?.label ?? "");
      setSpendAmountInput(
        parsedState.ambiguousSpend ? String(parsedState.ambiguousSpend.amount) : "",
      );
      setRuleDraft(parsedState.ruleMemory?.text ?? "");
      setLastSavedAt(
        typeof parsedState.savedAt === "string" && parsedState.savedAt
          ? parsedState.savedAt
          : null,
      );
    };

    const loadState = async () => {
      setIsHydrated(false);
      const storage = getBrowserStorage();

      try {
        const storedState = storage?.getItem(getStorageKey(sessionCode));

        if (storedState) {
          applyPersistedState(JSON.parse(storedState) as Partial<PersistedState>);
        } else {
          applyPersistedState(defaultState);
        }
      } catch {
        storage?.removeItem(getStorageKey(sessionCode));
        applyPersistedState(defaultState);
      }

      if (!enableRemoteSync || !hasSupabaseConfig || !supabase) {
        hasLocalEditsRef.current = false;
        setRemoteStateStatus("local-only");
        setIsHydrated(true);
        return;
      }

      try {
        setRemoteStateStatus("syncing");
        const client = supabase;
        const sessionResult = await client
          .from("shared_sessions")
          .select("id, locale, goal_name, updated_at")
          .eq("id", sessionCode)
          .maybeSingle();

        if (sessionResult.error?.code === "PGRST205") {
          setRemoteStateStatus("missing-table");
          return;
        }

        const [weeklyStateResult, ruleMemoryResult, participantsResult] =
          await Promise.all([
            client
              .from("weekly_states")
              .select(
                "session_id, week_start, revision, current_view, checkin_step, weekly_buffer, buffer_updated_by, ambiguous_spend, updated_at",
              )
              .eq("session_id", sessionCode)
              .maybeSingle(),
            client
              .from("rule_memories")
              .select("session_id, rule_text, source_spend_label, created_at, created_week_start, resurfaced_week_start")
              .eq("session_id", sessionCode)
              .maybeSingle(),
            client
              .from("session_participants")
              .select("session_id, participant_name")
              .eq("session_id", sessionCode),
          ]);

        const firstError =
          sessionResult.error ??
          weeklyStateResult.error ??
          ruleMemoryResult.error ??
          participantsResult.error;

        if (firstError) {
          if (firstError.code === "PGRST205") {
            setRemoteStateStatus("missing-table");
          } else {
            setRemoteStateStatus("error");
          }
        } else if (sessionResult.data || weeklyStateResult.data || ruleMemoryResult.data) {
          const remoteParticipants = Array.isArray(participantsResult.data)
            ? participantsResult.data
                .map((participant) => participant.participant_name)
                .filter(Boolean)
            : [];

          applyPersistedState({
            locale: sessionResult.data?.locale,
            currentView: weeklyStateResult.data?.current_view,
            checkinStep: weeklyStateResult.data?.checkin_step,
            participantNames: remoteParticipants,
            weekStart: weeklyStateResult.data?.week_start,
            revision: weeklyStateResult.data?.revision,
            goalName: sessionResult.data?.goal_name,
            weeklyBuffer: weeklyStateResult.data?.weekly_buffer,
            bufferUpdatedBy: weeklyStateResult.data?.buffer_updated_by,
            ambiguousSpend: weeklyStateResult.data?.ambiguous_spend,
            ruleMemory: ruleMemoryResult.data
              ? {
                  text: ruleMemoryResult.data.rule_text,
                  sourceLabel: ruleMemoryResult.data.source_spend_label,
                  createdAt: ruleMemoryResult.data.created_at,
                  createdWeekStart: ruleMemoryResult.data.created_week_start,
                  resurfacedWeekStart: ruleMemoryResult.data.resurfaced_week_start,
                }
              : null,
            savedAt: weeklyStateResult.data?.updated_at ?? sessionResult.data?.updated_at,
          });
          hasLocalEditsRef.current = false;
          setRemoteStateStatus("connected");
        } else {
          hasLocalEditsRef.current = false;
          setRemoteStateStatus("connected");
        }
      } catch {
        setRemoteStateStatus("error");
      } finally {
        setIsHydrated(true);
      }
    };

    void loadState();
  }, [enableRemoteSync, hasSupabaseConfig, sessionCode]);

  useEffect(() => {
    if (
      !enableRemoteSync ||
      !hasSupabaseConfig ||
      !supabase ||
      !sessionCode ||
      remoteStateStatus !== "connected"
    ) {
      return;
    }

    const client = supabase;

    const pollParticipants = async () => {
      const { data, error } = await client
        .from("session_participants")
        .select("session_id, participant_name")
        .eq("session_id", sessionCode);

      if (error) {
        return;
      }

      const remoteParticipants = Array.isArray(data)
        ? Array.from(
            new Set(data.map((participant) => participant.participant_name).filter(Boolean)),
          )
        : [];

      setParticipantNames(remoteParticipants);
      setHasJoinedSession(remoteParticipants.includes(currentUserName.trim()));
    };

    void pollParticipants();
    const intervalId = window.setInterval(() => {
      void pollParticipants();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [
    currentUserName,
    enableRemoteSync,
    hasSupabaseConfig,
    remoteStateStatus,
    sessionCode,
  ]);

  useEffect(() => {
    const currentWeekStart = getCurrentWeekStart();

    if (weekStart === currentWeekStart) {
      return;
    }

    setWeekStart(currentWeekStart);
    setCurrentView("home");
    setCheckinStep(0);

    setRuleMemory((currentRuleMemory) => {
      if (!currentRuleMemory) {
        return null;
      }

      return {
        ...currentRuleMemory,
        resurfacedWeekStart: currentWeekStart,
      };
    });
  }, [weekStart]);

  useEffect(() => {
    if (!sessionCode || !isHydrated) {
      return;
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    const savedAt = new Date().toISOString();
    const nextState: PersistedState = {
      locale,
      currentView,
      checkinStep,
      sessionCode,
      currentUserName,
      hasJoinedSession,
      participantNames,
      weekStart,
      revision,
      goalName,
      weeklyBuffer,
      bufferUpdatedBy,
      ambiguousSpend,
      ruleMemory,
      savedAt,
    };

    getBrowserStorage()?.setItem(getStorageKey(sessionCode), JSON.stringify(nextState));
    setLastSavedAt(savedAt);

    if (!enableRemoteSync || !hasSupabaseConfig || !supabase || remoteTablesMissing) {
      return;
    }

    if (!hasLocalEditsRef.current) {
      return;
    }

    const client = supabase;
    const uniqueParticipants = Array.from(
      new Set(participantNames.map((participant) => participant.trim()).filter(Boolean)),
    );

    if (remoteSaveTimerRef.current) {
      window.clearTimeout(remoteSaveTimerRef.current);
    }

    remoteSaveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const revisionResult = await client
          .from("weekly_states")
          .select("session_id, revision")
          .eq("session_id", sessionCode)
          .maybeSingle();

        if (revisionResult.error) {
          if (revisionResult.error.code === "PGRST205") {
            setRemoteStateStatus("missing-table");
            return;
          }

          setRemoteStateStatus("error");
          return;
        }

        const remoteRevision =
          typeof revisionResult.data?.revision === "number" ? revisionResult.data.revision : 0;

        if (remoteRevision > revision) {
          setRemoteStateStatus("conflict");
          return;
        }

        const nextRevision = remoteRevision + 1;
        const sharedSessionResult = await client
          .from("shared_sessions")
          .upsert(
            {
              id: sessionCode,
              locale,
              goal_name: goalName,
              updated_at: savedAt,
            },
            { onConflict: "id" },
          );

        if (sharedSessionResult.error) {
          if (sharedSessionResult.error.code === "PGRST205") {
            setRemoteStateStatus("missing-table");
            return;
          }

          setRemoteStateStatus("error");
          return;
        }

        const results = await Promise.all([
          client
            .from("weekly_states")
            .upsert(
              {
                session_id: sessionCode,
                week_start: weekStart,
                revision: nextRevision,
                current_view: currentView,
                checkin_step: checkinStep,
                weekly_buffer: weeklyBuffer,
                buffer_updated_by: bufferUpdatedBy,
                ambiguous_spend: ambiguousSpend,
                updated_at: savedAt,
              },
              { onConflict: "session_id" },
            ),
          ...(hasJoinedSession
            ? uniqueParticipants.map((participantName) =>
                client
                  .from("session_participants")
                  .upsert(
                    {
                      session_id: sessionCode,
                      participant_name: participantName,
                    },
                    { onConflict: "session_id,participant_name" },
                  ),
              )
            : []),
          ...(ruleMemory
            ? [
                client
                  .from("rule_memories")
                  .upsert(
                    {
                      session_id: sessionCode,
                      rule_text: ruleMemory.text,
                      source_spend_label: ruleMemory.sourceLabel,
                      created_at: ruleMemory.createdAt,
                      created_week_start: ruleMemory.createdWeekStart,
                      resurfaced_week_start: ruleMemory.resurfacedWeekStart,
                    },
                    { onConflict: "session_id" },
                  ),
              ]
            : []),
        ]);
        const errorResult = results.find((result) => result.error);

        if (!errorResult) {
          const syncedState: PersistedState = {
            ...nextState,
            revision: nextRevision,
          };
          hasLocalEditsRef.current = false;
          skipNextPersistRef.current = true;
          getBrowserStorage()?.setItem(
            getStorageKey(sessionCode),
            JSON.stringify(syncedState),
          );
          setRevision(nextRevision);
          setRemoteStateStatus("connected");
          return;
        }

        if (errorResult.error?.code === "PGRST205") {
          setRemoteStateStatus("missing-table");
          return;
        }

        setRemoteStateStatus("error");
      })();
    }, REMOTE_SAVE_DEBOUNCE_MS);

    return () => {
      if (remoteSaveTimerRef.current) {
        window.clearTimeout(remoteSaveTimerRef.current);
        remoteSaveTimerRef.current = null;
      }
    };
  }, [
    ambiguousSpend,
    bufferUpdatedBy,
    checkinStep,
    currentUserName,
    currentView,
    enableRemoteSync,
    goalName,
    hasJoinedSession,
    hasSupabaseConfig,
    isHydrated,
    locale,
    participantNames,
    revision,
    remoteTablesMissing,
    ruleMemory,
    sessionCode,
    weekStart,
    weeklyBuffer,
  ]);

  const handleStartCheckin = () => {
    if (!hasJoinedSession) {
      return;
    }

    setCurrentView("checkin");
    setCheckinStep(0);
  };

  const handleJoinCurrentSession = () => {
    const normalized = currentUserName.trim();

    if (!normalized) {
      return;
    }

    hasLocalEditsRef.current = true;
    setCurrentUserName(normalized);
    setHasJoinedSession(true);
    setParticipantNames((current) =>
      current.includes(normalized) ? current : [...current, normalized],
    );
  };

  const handleBufferContinue = () => {
    hasLocalEditsRef.current = true;
    setWeeklyBuffer(parseNumber(bufferInput));
    setCheckinStep(1);
  };

  const chooseSpendSuggestion = (label: string, amount: number) => {
    setSpendLabelInput(label);
    setSpendAmountInput(String(amount));
  };

  const handleSpendContinue = () => {
    const normalizedLabel = spendLabelInput.trim();
    const normalizedAmount = parseNumber(spendAmountInput);

    if (!normalizedLabel || normalizedAmount <= 0) {
      return;
    }

    hasLocalEditsRef.current = true;
    setAmbiguousSpend({
      label: normalizedLabel,
      amount: normalizedAmount,
      author: currentUserName,
      createdAt: new Date().toISOString(),
    });
    setCheckinStep(2);
  };

  const handleSaveRule = () => {
    const normalizedRule = ruleDraft.trim();

    if (!normalizedRule || !ambiguousSpend) {
      return;
    }

    hasLocalEditsRef.current = true;
    setRuleMemory({
      text: normalizedRule,
      sourceLabel: ambiguousSpend.label,
      createdAt: new Date().toISOString(),
      createdWeekStart: weekStart,
      resurfacedWeekStart: null,
    });
    setCurrentView("home");
    setCheckinStep(0);
  };

  const handleCreateNewSession = () => {
    const nextSessionCode = createSessionCode();
    skipNextPersistRef.current = true;
    replaceUrlSessionCode(nextSessionCode);
    setSessionCode(nextSessionCode);
    setJoinCodeInput(nextSessionCode);
  };

  const handleOpenJoinCode = () => {
    const normalized = normalizeSessionCode(joinCodeInput);

    if (!normalized) {
      return;
    }

    skipNextPersistRef.current = true;
    replaceUrlSessionCode(normalized);
    setSessionCode(normalized);
    setJoinCodeInput(normalized);
  };

  const clearSavedState = () => {
    if (!sessionCode) {
      return;
    }

    const nextState = getDefaultState(sessionCode);

    skipNextPersistRef.current = true;
    hasLocalEditsRef.current = false;
    getBrowserStorage()?.removeItem(getStorageKey(sessionCode));
    setLocale(nextState.locale);
    setCurrentView(nextState.currentView);
    setCheckinStep(nextState.checkinStep);
    setCurrentUserName(nextState.currentUserName);
    setHasJoinedSession(nextState.hasJoinedSession);
    setParticipantNames(nextState.participantNames);
    setWeekStart(nextState.weekStart);
    setRevision(nextState.revision);
    setGoalName(nextState.goalName);
    setWeeklyBuffer(nextState.weeklyBuffer);
    setBufferUpdatedBy(nextState.bufferUpdatedBy);
    setAmbiguousSpend(nextState.ambiguousSpend);
    setRuleMemory(nextState.ruleMemory);
    setBufferInput(String(nextState.weeklyBuffer));
    setSpendLabelInput("");
    setSpendAmountInput("");
    setRuleDraft("");
    setLastSavedAt(null);
  };

  if (!sessionCode) {
    return null;
  }

  return (
    <main className="page-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-28 pt-6 text-[var(--ink)] sm:px-6 lg:px-8">
        <header className="mb-6 grid gap-4 rounded-[2rem] border border-[var(--line)] bg-white/72 p-5 shadow-[0_25px_60px_rgba(54,36,12,0.08)] backdrop-blur md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm font-medium text-[var(--muted-ink)]">
              {copy.appTagline[locale]}
            </p>
            <h1 className="mt-1 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Bbodong
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-ink)] sm:text-base">
              {copy.appDescription[locale]}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <article className="mini-panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-label">{copy.language[locale]}</p>
                  <strong className="mt-2 block text-base">
                    {locale === "ko" ? copy.languageKo[locale] : copy.languageEn[locale]}
                  </strong>
                </div>
                <div className="flex gap-2">
                  <button
                    className={`filter-pill ${locale === "ko" ? "filter-pill-active" : ""}`}
                    type="button"
                    onClick={() => {
                      hasLocalEditsRef.current = true;
                      setLocale("ko");
                    }}
                  >
                    {copy.languageKo[locale]}
                  </button>
                  <button
                    className={`filter-pill ${locale === "en" ? "filter-pill-active" : ""}`}
                    type="button"
                    onClick={() => {
                      hasLocalEditsRef.current = true;
                      setLocale("en");
                    }}
                  >
                    {copy.languageEn[locale]}
                  </button>
                </div>
              </div>
            </article>
            <article className="mini-panel">
              <p className="section-label">{copy.connection[locale]}</p>
              <strong className="mt-2 block text-base">
                {renderBadge(hasSupabaseConfig, locale)}
              </strong>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                {remoteStateStatus === "local-only" && copy.remoteLocalOnly[locale]}
                {remoteStateStatus === "syncing" && copy.remoteSyncing[locale]}
                {remoteStateStatus === "connected" && copy.remoteConnected[locale]}
                {remoteStateStatus === "missing-table" && copy.remoteMissingTable[locale]}
                {remoteStateStatus === "error" && copy.remoteError[locale]}
                {remoteStateStatus === "conflict" && copy.remoteConflict[locale]}
              </p>
            </article>
            <article className="mini-panel sm:col-span-2 md:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-label">{copy.storage[locale]}</p>
                  <strong className="mt-2 block text-base">
                    {localizedSavedAt
                      ? locale === "ko"
                        ? `마지막 저장 ${localizedSavedAt}`
                        : `Last saved ${localizedSavedAt}`
                      : copy.noSavedState[locale]}
                  </strong>
                </div>
                <button
                  className="secondary-button !min-h-0 !flex-none !px-4 !py-2 text-sm"
                  type="button"
                  onClick={clearSavedState}
                >
                  {copy.resetLocal[locale]}
                </button>
              </div>
            </article>
          </div>
        </header>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="soft-card">
            <p className="section-label">{copy.session[locale]}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
              {copy.sessionCode[locale]}: {sessionCode}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
              {copy.sessionHelp[locale]}
            </p>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="section-label">{copy.yourName[locale]}</span>
                <input
                  className="min-h-11 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base"
                  value={currentUserName}
                  onChange={(event) => setCurrentUserName(event.target.value)}
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleJoinCurrentSession}
                >
                  {copy.joinCurrentSession[locale]}
                </button>
                <div className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted-ink)]">
                  <p className="section-label">{copy.youJoined[locale]}</p>
                  <p className="mt-2">
                    {hasJoinedSession
                      ? `${copy.joinedAs[locale]} ${currentUserName}`
                      : copy.notJoinedYet[locale]}
                  </p>
                </div>
              </div>

              <label className="grid gap-2">
                <span className="section-label">{copy.shareLink[locale]}</span>
                <input
                  readOnly
                  className="min-h-11 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted-ink)]"
                  value={shareUrl}
                />
              </label>

              <label className="grid gap-2">
                <span className="section-label">{copy.joinCode[locale]}</span>
                <input
                  className="min-h-11 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base uppercase"
                  value={joinCodeInput}
                  onChange={(event) => setJoinCodeInput(event.target.value.toUpperCase())}
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button className="secondary-button" type="button" onClick={handleOpenJoinCode}>
                  {copy.joinSession[locale]}
                </button>
                <button className="secondary-button" type="button" onClick={handleCreateNewSession}>
                  {copy.newSession[locale]}
                </button>
              </div>
            </div>
          </article>

          <article className="action-panel">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--alert-ink)]">
              {copy.participantStatus[locale]}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`status-chip ${partnerJoined ? "" : "status-chip-alert"}`}>
                {participantSummary || currentUserName}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--muted-ink)]">
              {partnerJoined ? copy.partnerJoined[locale] : copy.waitingPartner[locale]}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button className="primary-button" type="button" onClick={handleStartCheckin}>
                {copy.beginCheckin[locale]}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setCurrentView("rules")}
              >
                {copy.reviewRuleMemory[locale]}
              </button>
            </div>
            {!hasJoinedSession && (
              <p className="mt-4 text-sm leading-6 text-[var(--muted-ink)]">
                {copy.joinBeforeCheckin[locale]}
              </p>
            )}
          </article>
        </section>

        {currentView === "home" && (
          <section className="grid gap-4 lg:grid-cols-3">
            <article className="hero-panel">
              <p className="section-label">{copy.goal[locale]}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">
                {goalName}
              </h2>
              <div className="mt-6 rounded-[1.4rem] bg-white/70 p-4">
                <p className="section-label">{copy.buffer[locale]}</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
                  {localizedBuffer}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.bufferHelp[locale]}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="status-chip">
                    {copy.currentWeekLabel[locale]}: {weekStart}
                  </span>
                  <span className="status-chip">
                    {copy.updatedBy[locale]}: {bufferUpdatedBy}
                  </span>
                  <span className="status-chip">
                    {copy.revisionLabel[locale]}: {revision}
                  </span>
                  {localizedSavedAt && (
                    <span className="status-chip">
                      {locale === "ko" ? `저장 ${localizedSavedAt}` : `Saved ${localizedSavedAt}`}
                    </span>
                  )}
                </div>
              </div>
            </article>

            <article className="soft-card">
              <p className="section-label">{copy.ambiguousSpend[locale]}</p>
              {ambiguousSpend ? (
                <>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                    {ambiguousSpend.label}
                  </h2>
                  <p className="mt-3 text-lg font-semibold">{localizedSpendAmount}</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                    {locale === "ko"
                      ? `${ambiguousSpend.author} 님이 기록함`
                      : `Added by ${ambiguousSpend.author}`}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.noAmbiguousSpend[locale]}
                </p>
              )}
            </article>

            <article className="soft-card">
              <p className="section-label">
                {resurfacedThisWeek ? copy.resurfacedRule[locale] : copy.currentRule[locale]}
              </p>
              {ruleMemory && resurfacedThisWeek ? (
                <>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                    {ruleMemory.text}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                    {copy.sourceSpend[locale]}: {ruleMemory.sourceLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                    {copy.ruleCreatedWeek[locale]}: {ruleMemory.createdWeekStart}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                  {ruleMemory ? copy.noRuleThisWeek[locale] : copy.noRule[locale]}
                </p>
              )}
            </article>

            <article className="soft-card lg:col-span-3">
              <p className="section-label">{copy.checkinStatus[locale]}</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
                {completedCheckin
                  ? copy.checkinComplete[locale]
                  : copy.checkinIncomplete[locale]}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                {copy.stickyHint[locale]}
              </p>
              <button
                className="secondary-button mt-5"
                type="button"
                onClick={handleStartCheckin}
              >
                {completedCheckin ? copy.restartCheckin[locale] : copy.beginCheckin[locale]}
              </button>
            </article>
          </section>
        )}

        {currentView === "checkin" && (
          <section className="soft-card">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="section-label">{copy.checkinProgress[locale]}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                  {prompts[checkinStep]?.step[locale]}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                  {prompts[checkinStep]?.helper[locale]}
                </p>
              </div>
              <button
                className="secondary-button !min-h-0 !flex-none !px-4 !py-2 text-sm"
                type="button"
                onClick={() => setCurrentView("home")}
              >
                {copy.backHome[locale]}
              </button>
            </div>

            <div className="mb-6 h-2 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${((checkinStep + 1) / prompts.length) * 100}%` }}
              />
            </div>

            <h3 className="text-2xl font-semibold tracking-[-0.04em]">
              {prompts[checkinStep]?.title[locale]}
            </h3>

            {checkinStep === 0 && (
              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="section-label">{copy.bufferLabel[locale]}</span>
                  <input
                    className="min-h-11 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base"
                    inputMode="numeric"
                    value={bufferInput}
                    onChange={(event) => setBufferInput(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="section-label">{copy.updatedByLabel[locale]}</span>
                  <input
                    className="min-h-11 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base"
                    value={bufferUpdatedBy}
                    onChange={(event) => setBufferUpdatedBy(event.target.value)}
                  />
                </label>
              </div>
            )}

            {checkinStep === 1 && (
              <div className="mt-6 grid gap-6">
                <div>
                  <p className="section-label">{copy.chooseSuggestion[locale]}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {spendSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.ko}
                        className="choice-card"
                        type="button"
                        onClick={() => chooseSpendSuggestion(suggestion[locale], suggestion.amount)}
                      >
                        <span className="block">{suggestion[locale]}</span>
                        <span className="mt-2 block text-sm text-[var(--muted-ink)]">
                          {formatCurrency(suggestion.amount, locale)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <label className="grid gap-2">
                  <span className="section-label">{copy.customSpendLabel[locale]}</span>
                  <input
                    className="min-h-11 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base"
                    value={spendLabelInput}
                    onChange={(event) => setSpendLabelInput(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="section-label">{copy.amountLabel[locale]}</span>
                  <input
                    className="min-h-11 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base"
                    inputMode="numeric"
                    value={spendAmountInput}
                    onChange={(event) => setSpendAmountInput(event.target.value)}
                  />
                </label>
              </div>
            )}

            {checkinStep === 2 && (
              <div className="mt-6 grid gap-6">
                <div>
                  <p className="section-label">{copy.ruleStarter[locale]}</p>
                  <div className="mt-3 grid gap-3">
                    {ruleStarters.map((starter) => (
                      <button
                        key={starter.ko}
                        className="choice-card"
                        type="button"
                        onClick={() => setRuleDraft(starter[locale])}
                      >
                        {starter[locale]}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="grid gap-2">
                  <span className="section-label">{copy.ruleTextarea[locale]}</span>
                  <textarea
                    className="min-h-28 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base"
                    value={ruleDraft}
                    onChange={(event) => setRuleDraft(event.target.value)}
                  />
                </label>
              </div>
            )}

            <div className="sticky bottom-4 mt-8 flex flex-col gap-3 rounded-[1.4rem] border border-[var(--line)] bg-[rgba(246,240,231,0.92)] p-3 backdrop-blur sm:flex-row">
              {checkinStep > 0 && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setCheckinStep(checkinStep - 1)}
                >
                  {copy.back[locale]}
                </button>
              )}
              {checkinStep === 0 && (
                <button className="primary-button" type="button" onClick={handleBufferContinue}>
                  {copy.continue[locale]}
                </button>
              )}
              {checkinStep === 1 && (
                <button className="primary-button" type="button" onClick={handleSpendContinue}>
                  {copy.continue[locale]}
                </button>
              )}
              {checkinStep === 2 && (
                <button className="primary-button" type="button" onClick={handleSaveRule}>
                  {copy.saveRule[locale]}
                </button>
              )}
            </div>
          </section>
        )}

        {currentView === "rules" && (
          <section className="soft-card">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="section-label">{copy.savedRuleMemory[locale]}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                  {copy.currentRule[locale]}
                </h2>
              </div>
              <button
                className="secondary-button !min-h-0 !flex-none !px-4 !py-2 text-sm"
                type="button"
                onClick={() => setCurrentView("home")}
              >
                {copy.backHome[locale]}
              </button>
            </div>

            {ruleMemory ? (
              <article className="rule-card">
                <h3 className="text-2xl font-semibold tracking-[-0.04em]">
                  {ruleMemory.text}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.sourceSpend[locale]}: {ruleMemory.sourceLabel}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                  {locale === "ko"
                    ? `저장 시각 ${formatDate(ruleMemory.createdAt, locale)}`
                    : `Saved ${formatDate(ruleMemory.createdAt, locale)}`}
                </p>
                <button className="secondary-button mt-5" type="button" onClick={handleStartCheckin}>
                  {copy.reopenCheckin[locale]}
                </button>
              </article>
            ) : (
              <article className="rule-card">
                <p className="text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.noRuleHistory[locale]}
                </p>
                <button className="primary-button mt-5" type="button" onClick={handleStartCheckin}>
                  {copy.beginCheckin[locale]}
                </button>
              </article>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
