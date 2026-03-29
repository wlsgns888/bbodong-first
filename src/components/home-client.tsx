"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Locale = "ko" | "en";
type TabId = "home" | "timeline" | "checkin" | "rules";
type FilterId = "all" | "alerts" | "rituals" | "notes";

type LocalizedText = Record<Locale, string>;

type TimelineItem = {
  title: LocalizedText;
  amount: LocalizedText;
  impact: LocalizedText;
  state: LocalizedText;
  category: Exclude<FilterId, "all">;
};

type CheckinStep = {
  label: LocalizedText;
  prompt: LocalizedText;
  helper: LocalizedText;
  choices: LocalizedText[];
};

type Rule = {
  title: LocalizedText;
  description: LocalizedText;
  impact: LocalizedText;
  enabled: boolean;
};

type PersistedState = {
  locale: Locale;
  activeTab: TabId;
  activeFilter: FilterId;
  checkinIndex: number;
  checkinAnswers: string[];
  rules: Rule[];
  focusLocked: boolean;
  savedAt: string;
};

type RemoteStateStatus =
  | "local-only"
  | "syncing"
  | "connected"
  | "missing-table"
  | "error";

const STORAGE_KEY = "bbodong.home-state.v2";

const tabs: Record<TabId, LocalizedText> = {
  home: { ko: "홈", en: "Home" },
  timeline: { ko: "타임라인", en: "Timeline" },
  checkin: { ko: "체크인", en: "Check-in" },
  rules: { ko: "규칙", en: "Rules" },
};

const filters: { id: FilterId; label: LocalizedText }[] = [
  { id: "all", label: { ko: "전체", en: "All" } },
  { id: "alerts", label: { ko: "알림", en: "Alerts" } },
  { id: "rituals", label: { ko: "루틴", en: "Rituals" } },
  { id: "notes", label: { ko: "메모", en: "Notes" } },
];

const timeline: TimelineItem[] = [
  {
    title: { ko: "배달 저녁", en: "Delivery dinner" },
    amount: { ko: "-₩28,000", en: "-₩28,000" },
    impact: { ko: "버퍼 영향: -₩28,000", en: "Buffer impact: -₩28,000" },
    state: { ko: "빠르게 같이 확인 필요", en: "Needs a quick check" },
    category: "alerts",
  },
  {
    title: { ko: "이번 주 체크인", en: "This week's check-in" },
    amount: { ko: "일요일 밤 9:00", en: "Sunday, 9:00 PM" },
    impact: { ko: "3단계, 3분 이내", en: "3 steps, under 3 minutes" },
    state: { ko: "내일 예정", en: "Due tomorrow" },
    category: "rituals",
  },
  {
    title: { ko: "공유 상태", en: "Shared state" },
    amount: { ko: "이번 주는 조금 타이트함", en: "A little tight this week" },
    impact: { ko: "민지가 추가함", en: "Added by Minji" },
    state: { ko: "둘 다 확인함", en: "Seen by both" },
    category: "notes",
  },
  {
    title: { ko: "커피 구매", en: "Coffee run" },
    amount: { ko: "-₩9,200", en: "-₩9,200" },
    impact: { ko: "하루 유동 예산 안쪽", en: "Under your daily flex budget" },
    state: { ko: "추가 조치 없음", en: "No action needed" },
    category: "alerts",
  },
];

const checkinSteps: CheckinStep[] = [
  {
    label: { ko: "1. 버퍼", en: "1. Buffer" },
    prompt: {
      ko: "이번 주 남은 버퍼가 충분히 안전하다고 느껴지나요?",
      en: "Does this week's remaining buffer feel safe enough?",
    },
    helper: {
      ko: "숫자를 먼저 보고, 그 다음 느낌을 말해보세요.",
      en: "Start with the number, then say the feeling out loud.",
    },
    choices: [
      { ko: "안전해 보여", en: "Feels safe" },
      { ko: "조금 타이트해", en: "A bit tight" },
      { ko: "속도를 줄여야 해", en: "We should slow down" },
    ],
  },
  {
    label: { ko: "2. 가장 큰 흔들림", en: "2. Biggest wobble" },
    prompt: {
      ko: "이번 주 가장 크게 흔들린 지점은 무엇이었나요?",
      en: "What created the most friction this week?",
    },
    helper: {
      ko: "확신을 바꾼 지출이나 패턴 하나만 고르세요.",
      en: "Pick the one spend or pattern that changed your confidence.",
    },
    choices: [
      { ko: "배달", en: "Delivery" },
      { ko: "교통", en: "Transport" },
      { ko: "모임 약속", en: "Social plans" },
    ],
  },
  {
    label: { ko: "3. 규칙 하나 조정", en: "3. Adjust one rule" },
    prompt: {
      ko: "다음 주를 더 쉽게 만들 규칙 하나는 무엇인가요?",
      en: "What one rule would make next week easier?",
    },
    helper: {
      ko: "현실적으로 반복 가능하도록 하나만 바꾸세요.",
      en: "Only choose one change so it stays realistic.",
    },
    choices: [
      { ko: "배달 상한 낮추기", en: "Lower delivery cap" },
      { ko: "무지출 저녁 추가", en: "Add no-spend night" },
      { ko: "유동 예산 늘리기", en: "Increase flex budget" },
    ],
  },
];

const initialRules: Rule[] = [
  {
    title: {
      ko: "배달 25,000원 초과",
      en: "Delivery above ₩25,000",
    },
    description: {
      ko: "한 주 흐름이 틀어지기 전에 둘 다 볼 수 있도록 표시합니다.",
      en: "Flag the spend so both people can see it before the week drifts.",
    },
    impact: {
      ko: "버퍼를 흔들 가능성이 큰 지출을 가장 먼저 잡습니다.",
      en: "Catches the one purchase most likely to move the buffer.",
    },
    enabled: true,
  },
  {
    title: {
      ko: "주말 유동 예산 70,000원",
      en: "Weekend flex budget ₩70,000",
    },
    description: {
      ko: "제주 목표를 지키면서도 주말마다 토론으로 번지지 않게 합니다.",
      en: "Protects the Jeju goal without turning every weekend into a debate.",
    },
    impact: {
      ko: "즉흥 지출을 금지하지 않고 보이게 만듭니다.",
      en: "Keeps spontaneous spending visible, not forbidden.",
    },
    enabled: true,
  },
  {
    title: {
      ko: "밤 10시 이후 깜짝 지출 금지",
      en: "No surprises after 10 PM",
    },
    description: {
      ko: "늦은 밤 결제는 다음 날 아침 확인 전까지 보류합니다.",
      en: "Late-night spending gets parked until the morning check.",
    },
    impact: {
      ko: "둘 다 피곤할 때 감정적인 결정을 줄입니다.",
      en: "Reduces emotional decisions when both people are tired.",
    },
    enabled: false,
  },
];

const copy = {
  appTagline: {
    ko: "신혼, 맞벌이",
    en: "Newly married, dual-income",
  },
  appDescription: {
    ko: "돈 얘기가 괜한 긴장으로 번지기 전에 같이 보는 주간 버퍼 보드.",
    en: "A shared weekly buffer board for the moments that usually turn into unnecessary tension.",
  },
  connection: {
    ko: "연결 상태",
    en: "Connection",
  },
  weekSummary: {
    ko: "이번 주",
    en: "This week",
  },
  oneAlertOneRitualOneNote: {
    ko: "알림 1개, 루틴 1개, 메모 1개",
    en: "One alert, one ritual, one note",
  },
  enoughContext: {
    ko: "돈 관리가 숙제가 되지 않을 만큼만, 빠르게 맞출 수 있는 정보만 보여줍니다.",
    en: "Enough context to align fast without turning finance into homework.",
  },
  connectionHelp: {
    ko: "환경 변수가 없어도 화면은 깨지지 않고, 연결 상태만 분명하게 보여줍니다.",
    en: "The UI stays usable even if env vars are missing, and shows the connection state clearly.",
  },
  storage: {
    ko: "저장",
    en: "Storage",
  },
  savedOnDevice: {
    ko: "이 기기에 저장됨",
    en: "Saved on this device",
  },
  noSavedState: {
    ko: "아직 저장된 상태가 없습니다.",
    en: "No saved state yet.",
  },
  resetLocal: {
    ko: "로컬 초기화",
    en: "Reset local",
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
    ko: "Supabase 테이블에 연결 가능합니다. 로컬 변경을 원격으로 동기화할 수 있습니다.",
    en: "Supabase table is reachable. Local changes can sync remotely.",
  },
  remoteMissingTable: {
    ko: "Supabase는 설정됐지만 app_state 테이블이 아직 없습니다.",
    en: "Supabase is configured, but the app_state table is not created yet.",
  },
  remoteError: {
    ko: "Supabase 동기화에 실패했습니다. 로컬 저장은 계속 동작합니다.",
    en: "Supabase sync failed. Local persistence still works.",
  },
  weeklyBuffer: {
    ko: "주간 버퍼",
    en: "Weekly buffer",
  },
  bufferDescription: {
    ko: "아직은 괜찮지만, 충동적인 주문 한 번이면 이번 주 체감이 훨씬 더 타이트해집니다.",
    en: "You are still on track, but one more impulse order makes the week feel tighter than it needs to.",
  },
  seenByBoth: {
    ko: "둘 다 확인함",
    en: "Seen by both",
  },
  jejuInSixWeeks: {
    ko: "제주까지 6주",
    en: "Jeju in 6 weeks",
  },
  focusLocked: {
    ko: "집중 잠금",
    en: "Focus locked",
  },
  focusOpen: {
    ko: "집중 열림",
    en: "Focus open",
  },
  remoteSyncReady: {
    ko: "원격 동기화 준비됨",
    en: "Remote sync ready",
  },
  jejuTripFund: {
    ko: "제주 여행 적립",
    en: "Jeju trip fund",
  },
  goalPace: {
    ko: "현재 속도면 배달 규칙이 유지될 때 6주 안에 목표에 도달합니다.",
    en: "At this pace, you hit the goal in 6 weeks if the delivery rule holds.",
  },
  oneThingToCheck: {
    ko: "함께 볼 한 가지",
    en: "One thing to check",
  },
  deliveryOffCourse: {
    ko: "배달 저녁이 이번 주 흐름을 흔들고 있어요",
    en: "Delivery dinner is pushing this week off course",
  },
  needsBoth: {
    ko: "둘 다 필요",
    en: "Needs both",
  },
  amount: {
    ko: "금액",
    en: "Amount",
  },
  ruleHit: {
    ko: "걸린 규칙",
    en: "Rule hit",
  },
  goalDelay: {
    ko: "목표 지연",
    en: "Goal delay",
  },
  checkTogether: {
    ko: "같이 확인하기",
    en: "Check together",
  },
  keepAsIs: {
    ko: "그대로 두기",
    en: "Keep as is",
  },
  workspace: {
    ko: "공유 공간",
    en: "Workspace",
  },
  workspaceTitle: {
    ko: "복잡하지 않게 공유 상태 보기",
    en: "Shared state, without the clutter",
  },
  openTimeline: {
    ko: "타임라인 열기",
    en: "Open timeline",
  },
  sharedStateDesc: {
    ko: "민지가 추가함. 다음 결정을 바꾸기엔 충분히 보이게 유지합니다.",
    en: "Added by Minji. Visible enough to guide the next decision.",
  },
  weeklyCheckin: {
    ko: "주간 체크인",
    en: "Weekly check-in",
  },
  tomorrowNine: {
    ko: "내일 밤 9:00",
    en: "Tomorrow, 9:00 PM",
  },
  noExtraAdmin: {
    ko: "버퍼, 흔들림, 규칙 하나. 추가 행정은 없습니다.",
    en: "Buffer, wobble, one rule change. No extra admin.",
  },
  ruleCoverage: {
    ko: "규칙 커버리지",
    en: "Rule coverage",
  },
  activeGuardrails: {
    ko: "활성 가드레일",
    en: "active guardrails",
  },
  lightStructure: {
    ko: "작은 문제가 계속 작게 남도록 최소한의 구조만 둡니다.",
    en: "Light structure so small issues stay small.",
  },
  quickJump: {
    ko: "빠른 이동",
    en: "Quick jump",
  },
  plannedFlow: {
    ko: "계획된 흐름, 실제 동작까지 연결",
    en: "Planned flow, fully wired",
  },
  tabDescriptions: {
    home: {
      ko: "버퍼, 포커스 카드, 공유 맥락",
      en: "Buffer, focus card, and shared context",
    },
    timeline: {
      ko: "중요한 순간만 빠르게 필터링",
      en: "Moments that matter, filtered fast",
    },
    checkin: {
      ko: "답이 저장되는 3단계 루틴",
      en: "Three-step ritual with saved answers",
    },
    rules: {
      ko: "켜고 끌 수 있는 가벼운 규칙",
      en: "Guardrails you can switch on and off",
    },
  },
  open: {
    ko: "열림",
    en: "Open",
  },
  view: {
    ko: "보기",
    en: "View",
  },
  sharedTimeline: {
    ko: "공유 타임라인",
    en: "Shared timeline",
  },
  momentsThatMatter: {
    ko: "중요한 순간만 남기기",
    en: "Only the moments that matter",
  },
  currentPosture: {
    ko: "현재 톤",
    en: "Current posture",
  },
  planSmallOnPurpose: {
    ko: "이 플랜은 일부러 작게 만들었습니다",
    en: "The plan is small on purpose",
  },
  postureDescription: {
    ko: "논의할 알림 하나, 맥락을 붙잡는 메모 하나, 주를 다시 보는 루틴 하나. 첫 버전에서 실제로 계속 쓰게 만들기엔 그 정도면 충분합니다.",
    en: "One alert to discuss, one shared note to hold context, one ritual to revisit the week. That is enough for a first version people will actually keep using.",
  },
  timelineTitle: {
    ko: "주의가 필요한 기준으로 이번 주 보기",
    en: "Filter the week by what needs attention",
  },
  checkinTitle: {
    ko: "3단계, 3분 이내",
    en: "Three steps, under three minutes",
  },
  completed: {
    ko: "완료됨",
    en: "Completed",
  },
  concretePlan: {
    ko: "다음 주를 위한 구체적인 합의가 생겼어요",
    en: "You have a concrete plan for next week",
  },
  runAgain: {
    ko: "다시 하기",
    en: "Run it again",
  },
  whyThisWorks: {
    ko: "왜 이게 먹히는가",
    en: "Why this works",
  },
  ritualRepeats: {
    ko: "이 루틴은 반복 가능한 정도로만 좁혀져 있습니다",
    en: "The ritual is focused enough to repeat",
  },
  ritualDescription: {
    ko: "이 앱은 전체 예산 관리를 요구하지 않습니다. 느낌 하나, 흔들림 하나, 다음 조정 하나만 꺼내도록 돕습니다.",
    en: "The app does not ask for full budgeting. It only helps the couple surface the one feeling, one wobble, and one next adjustment.",
  },
  rulesTitle: {
    ko: "가볍고, 보이고, 조정 가능한 규칙 유지하기",
    en: "Keep guardrails light, visible, and adjustable",
  },
  enabled: {
    ko: "활성",
    en: "enabled",
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
  connected: {
    ko: "Supabase 연결됨",
    en: "Supabase connected",
  },
  notConfigured: {
    ko: "Supabase 미설정",
    en: "Supabase not configured",
  },
} as const;

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

function translate(text: LocalizedText, locale: Locale) {
  return text[locale];
}

function renderBadge(hasConfig: boolean, locale: Locale) {
  return hasConfig ? copy.connected[locale] : copy.notConfigured[locale];
}

export function HomeClient({
  hasSupabaseConfig,
  enableRemoteSync = true,
}: {
  hasSupabaseConfig: boolean;
  enableRemoteSync?: boolean;
}) {
  const [locale, setLocale] = useState<Locale>("ko");
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [checkinIndex, setCheckinIndex] = useState(0);
  const [checkinAnswers, setCheckinAnswers] = useState<string[]>([]);
  const [rules, setRules] = useState(initialRules);
  const [focusLocked, setFocusLocked] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [remoteStateStatus, setRemoteStateStatus] =
    useState<RemoteStateStatus>("local-only");
  const skipNextPersistRef = useRef(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  useEffect(() => {
    const applyPersistedState = (parsedState: Partial<PersistedState>) => {
      if (parsedState.locale) {
        setLocale(parsedState.locale);
      }

      if (parsedState.activeTab) {
        setActiveTab(parsedState.activeTab);
      }

      if (parsedState.activeFilter) {
        setActiveFilter(parsedState.activeFilter);
      }

      if (typeof parsedState.checkinIndex === "number") {
        setCheckinIndex(parsedState.checkinIndex);
      }

      if (Array.isArray(parsedState.checkinAnswers)) {
        setCheckinAnswers(parsedState.checkinAnswers);
      }

      if (Array.isArray(parsedState.rules) && parsedState.rules.length === initialRules.length) {
        setRules(parsedState.rules);
      }

      if (typeof parsedState.focusLocked === "boolean") {
        setFocusLocked(parsedState.focusLocked);
      }

      if (typeof parsedState.savedAt === "string") {
        setLastSavedAt(parsedState.savedAt);
      }
    };

    const loadState = async () => {
      const storage = getBrowserStorage();

      try {
        const storedState = storage?.getItem(STORAGE_KEY);

        if (storedState) {
          applyPersistedState(JSON.parse(storedState) as Partial<PersistedState>);
        }
      } catch {
        storage?.removeItem(STORAGE_KEY);
      }

      if (!enableRemoteSync || !hasSupabaseConfig || !supabase) {
        setRemoteStateStatus("local-only");
        setIsHydrated(true);
        return;
      }

      try {
        setRemoteStateStatus("syncing");

        const { data, error } = await supabase
          .from("app_state")
          .select(
            "active_tab, active_filter, checkin_index, checkin_answers, rules, focus_locked, updated_at",
          )
          .eq("id", "default")
          .maybeSingle();

        if (error) {
          if (error.code === "PGRST205") {
            setRemoteStateStatus("missing-table");
          } else {
            setRemoteStateStatus("error");
          }
        } else if (data) {
          applyPersistedState({
            activeTab: data.active_tab as TabId,
            activeFilter: data.active_filter as FilterId,
            checkinIndex: data.checkin_index,
            checkinAnswers: data.checkin_answers as string[],
            rules: data.rules as Rule[],
            focusLocked: data.focus_locked,
            savedAt: data.updated_at,
          });
          setRemoteStateStatus("connected");
        } else {
          setRemoteStateStatus("connected");
        }
      } catch {
        setRemoteStateStatus("error");
      } finally {
        setIsHydrated(true);
      }
    };

    void loadState();
  }, [enableRemoteSync, hasSupabaseConfig]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    const savedAt = new Date().toISOString();
    const nextState: PersistedState = {
      locale,
      activeTab,
      activeFilter,
      checkinIndex,
      checkinAnswers,
      rules,
      focusLocked,
      savedAt,
    };

    getBrowserStorage()?.setItem(STORAGE_KEY, JSON.stringify(nextState));
    setLastSavedAt(savedAt);

    if (!enableRemoteSync || !hasSupabaseConfig || !supabase) {
      return;
    }

    void supabase
      .from("app_state")
      .upsert(
        {
          id: "default",
          active_tab: activeTab,
          active_filter: activeFilter,
          checkin_index: checkinIndex,
          checkin_answers: checkinAnswers,
          rules,
          focus_locked: focusLocked,
          updated_at: savedAt,
        },
        { onConflict: "id" },
      )
      .then(({ error }) => {
        if (!error) {
          setRemoteStateStatus("connected");
          return;
        }

        if (error.code === "PGRST205") {
          setRemoteStateStatus("missing-table");
          return;
        }

        setRemoteStateStatus("error");
      });
  }, [
    activeFilter,
    activeTab,
    checkinAnswers,
    checkinIndex,
    enableRemoteSync,
    focusLocked,
    hasSupabaseConfig,
    isHydrated,
    locale,
    rules,
  ]);

  const filteredTimeline =
    activeFilter === "all"
      ? timeline
      : timeline.filter((item) => item.category === activeFilter);

  const currentStep = checkinSteps[checkinIndex];
  const completedCheckin = checkinAnswers.length === checkinSteps.length;

  const selectAnswer = (choice: string) => {
    const nextAnswers = [...checkinAnswers];
    nextAnswers[checkinIndex] = choice;
    setCheckinAnswers(nextAnswers);

    if (checkinIndex < checkinSteps.length - 1) {
      setCheckinIndex(checkinIndex + 1);
      setActiveTab("checkin");
    }
  };

  const toggleRule = (index: number) => {
    setRules((currentRules) =>
      currentRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, enabled: !rule.enabled } : rule,
      ),
    );
  };

  const clearSavedState = () => {
    skipNextPersistRef.current = true;
    getBrowserStorage()?.removeItem(STORAGE_KEY);
    setLocale("ko");
    setActiveTab("home");
    setActiveFilter("all");
    setCheckinIndex(0);
    setCheckinAnswers([]);
    setRules(initialRules);
    setFocusLocked(false);
    setLastSavedAt(null);
  };

  const localizedSavedAt = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")
    : null;

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
                    onClick={() => setLocale("ko")}
                  >
                    {copy.languageKo[locale]}
                  </button>
                  <button
                    className={`filter-pill ${locale === "en" ? "filter-pill-active" : ""}`}
                    type="button"
                    onClick={() => setLocale("en")}
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
                {copy.connectionHelp[locale]}
              </p>
            </article>
            <article className="mini-panel">
              <p className="section-label">{copy.weekSummary[locale]}</p>
              <strong className="mt-2 block text-base">
                {copy.oneAlertOneRitualOneNote[locale]}
              </strong>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                {copy.enoughContext[locale]}
              </p>
            </article>
            <article className="mini-panel sm:col-span-2 md:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-label">{copy.storage[locale]}</p>
                  <strong className="mt-2 block text-base">
                    {copy.savedOnDevice[locale]}
                  </strong>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                    {localizedSavedAt
                      ? locale === "ko"
                        ? `마지막 저장 ${localizedSavedAt}.`
                        : `Last saved ${localizedSavedAt}.`
                      : copy.noSavedState[locale]}
                  </p>
                </div>
                <button
                  className="secondary-button !min-h-0 !flex-none !px-4 !py-2 text-sm"
                  type="button"
                  onClick={clearSavedState}
                >
                  {copy.resetLocal[locale]}
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                {remoteStateStatus === "local-only" && copy.remoteLocalOnly[locale]}
                {remoteStateStatus === "syncing" && copy.remoteSyncing[locale]}
                {remoteStateStatus === "connected" && copy.remoteConnected[locale]}
                {remoteStateStatus === "missing-table" && copy.remoteMissingTable[locale]}
                {remoteStateStatus === "error" && copy.remoteError[locale]}
              </p>
            </article>
          </div>
        </header>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="hero-panel">
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent-ink)]">
              {copy.weeklyBuffer[locale]}
            </p>
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-5xl font-semibold tracking-[-0.08em] sm:text-6xl">
                  ₩184,000
                </p>
                <p className="mt-3 max-w-[24rem] text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.bufferDescription[locale]}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="status-chip">{copy.seenByBoth[locale]}</span>
                <span className="status-chip">{copy.jejuInSixWeeks[locale]}</span>
                <span className="status-chip">
                  {focusLocked ? copy.focusLocked[locale] : copy.focusOpen[locale]}
                </span>
                {remoteStateStatus === "connected" && (
                  <span className="status-chip">{copy.remoteSyncReady[locale]}</span>
                )}
              </div>
            </div>

            <div className="rounded-[1.4rem] bg-white/70 p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-[var(--muted-ink)]">
                  {copy.jejuTripFund[locale]}
                </span>
                <span className="font-semibold">₩1.24M / ₩2.00M</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[var(--line)]">
                <div className="h-full w-[62%] rounded-full bg-[var(--accent)]" />
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                {copy.goalPace[locale]}
              </p>
            </div>
          </article>

          <article className="action-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--alert-ink)]">
                  {copy.oneThingToCheck[locale]}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
                  {copy.deliveryOffCourse[locale]}
                </h2>
              </div>
              <span className="status-chip status-chip-alert">{copy.needsBoth[locale]}</span>
            </div>

            <div className="grid gap-3 rounded-[1.4rem] bg-white p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--muted-ink)]">{copy.amount[locale]}</span>
                <strong>-₩28,000</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--muted-ink)]">{copy.ruleHit[locale]}</span>
                <strong>{translate(initialRules[0].title, locale)}</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--muted-ink)]">{copy.goalDelay[locale]}</span>
                <strong>+1 day</strong>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setFocusLocked(true);
                  setActiveTab("checkin");
                }}
              >
                {copy.checkTogether[locale]}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setFocusLocked(false)}
              >
                {copy.keepAsIs[locale]}
              </button>
            </div>
          </article>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="soft-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="section-label">{copy.workspace[locale]}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                  {copy.workspaceTitle[locale]}
                </h2>
              </div>
              <button
                className="secondary-button !min-h-0 !flex-none !px-4 !py-2 text-sm"
                type="button"
                onClick={() => setActiveTab("timeline")}
              >
                {copy.openTimeline[locale]}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <article className="mini-panel">
                <p className="section-label">{copy.sharedTimeline[locale]}</p>
                <h3 className="mt-2 text-lg font-semibold">
                  {translate(timeline[2].amount, locale)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.sharedStateDesc[locale]}
                </p>
              </article>
              <article className="mini-panel">
                <p className="section-label">{copy.weeklyCheckin[locale]}</p>
                <h3 className="mt-2 text-lg font-semibold">{copy.tomorrowNine[locale]}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.noExtraAdmin[locale]}
                </p>
              </article>
              <article className="mini-panel">
                <p className="section-label">{copy.ruleCoverage[locale]}</p>
                <h3 className="mt-2 text-lg font-semibold">
                  {rules.filter((rule) => rule.enabled).length} {copy.activeGuardrails[locale]}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.lightStructure[locale]}
                </p>
              </article>
            </div>
          </article>

          <article className="soft-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="section-label">{copy.quickJump[locale]}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                  {copy.plannedFlow[locale]}
                </h2>
              </div>
            </div>
            <div className="grid gap-3">
              {(Object.keys(tabs) as TabId[]).map((tab) => (
                <button
                  key={tab}
                  className={`tab-card ${activeTab === tab ? "tab-card-active" : ""}`}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                >
                  <span className="text-left">
                    <span className="block text-sm font-semibold">{tabs[tab][locale]}</span>
                    <span className="mt-1 block text-sm text-[var(--muted-ink)]">
                      {copy.tabDescriptions[tab][locale]}
                    </span>
                  </span>
                  <span className="status-chip">
                    {activeTab === tab ? copy.open[locale] : copy.view[locale]}
                  </span>
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="mb-6 flex-1">
          {activeTab === "home" && (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="soft-card">
                <div className="mb-3">
                  <p className="section-label">{copy.sharedTimeline[locale]}</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                    {copy.momentsThatMatter[locale]}
                  </h2>
                </div>
                <div className="grid gap-3">
                  {timeline.slice(0, 3).map((item) => (
                    <article key={item.title.en} className="timeline-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold">
                            {translate(item.title, locale)}
                          </h3>
                          <p className="mt-1 text-sm text-[var(--muted-ink)]">
                            {translate(item.impact, locale)}
                          </p>
                        </div>
                        <strong className="text-sm">{translate(item.amount, locale)}</strong>
                      </div>
                      <p className="mt-3 text-sm font-medium text-[var(--muted-ink)]">
                        {translate(item.state, locale)}
                      </p>
                    </article>
                  ))}
                </div>
              </article>
              <article className="soft-card">
                <p className="section-label">{copy.currentPosture[locale]}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  {copy.planSmallOnPurpose[locale]}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.postureDescription[locale]}
                </p>
              </article>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="soft-card">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="section-label">{copy.sharedTimeline[locale]}</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                    {copy.timelineTitle[locale]}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <button
                      key={filter.id}
                      className={`filter-pill ${
                        activeFilter === filter.id ? "filter-pill-active" : ""
                      }`}
                      type="button"
                      onClick={() => setActiveFilter(filter.id)}
                    >
                      {filter.label[locale]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                {filteredTimeline.map((item) => (
                  <article key={`${item.category}-${item.title.en}`} className="timeline-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="section-label">
                          {filters.find((filter) => filter.id === item.category)?.label[locale]}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold">
                          {translate(item.title, locale)}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                          {translate(item.impact, locale)}
                        </p>
                      </div>
                      <strong className="text-sm">{translate(item.amount, locale)}</strong>
                    </div>
                    <p className="mt-4 text-sm font-medium text-[var(--muted-ink)]">
                      {translate(item.state, locale)}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === "checkin" && (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <article className="soft-card">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="section-label">{copy.weeklyCheckin[locale]}</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                      {copy.checkinTitle[locale]}
                    </h2>
                  </div>
                  <span className="status-chip">
                    {Math.min(checkinAnswers.length + 1, checkinSteps.length)} /{" "}
                    {checkinSteps.length}
                  </span>
                </div>

                <div className="mb-5 h-2 overflow-hidden rounded-full bg-[var(--line)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                    style={{
                      width: `${(checkinAnswers.length / checkinSteps.length) * 100}%`,
                    }}
                  />
                </div>

                {!completedCheckin ? (
                  <>
                    <p className="section-label">{translate(currentStep.label, locale)}</p>
                    <h3 className="mt-2 text-xl font-semibold">
                      {translate(currentStep.prompt, locale)}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                      {translate(currentStep.helper, locale)}
                    </p>
                    <div className="mt-5 grid gap-3">
                      {currentStep.choices.map((choice) => (
                        <button
                          key={choice.en}
                          className="choice-card"
                          type="button"
                          onClick={() => selectAnswer(choice.en)}
                        >
                          {translate(choice, locale)}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="section-label">{copy.completed[locale]}</p>
                    <h3 className="mt-2 text-xl font-semibold">
                      {copy.concretePlan[locale]}
                    </h3>
                    <div className="mt-5 grid gap-3">
                      {checkinSteps.map((step, index) => (
                        <article key={step.label.en} className="timeline-card">
                          <p className="section-label">{translate(step.label, locale)}</p>
                          <h4 className="mt-2 text-base font-semibold">
                            {translate(step.prompt, locale)}
                          </h4>
                          <p className="mt-3 text-sm text-[var(--muted-ink)]">
                            {locale === "ko"
                              ? step.choices.find((choice) => choice.en === checkinAnswers[index])?.ko
                              : checkinAnswers[index]}
                          </p>
                        </article>
                      ))}
                    </div>
                    <button
                      className="primary-button mt-5"
                      type="button"
                      onClick={() => {
                        setCheckinAnswers([]);
                        setCheckinIndex(0);
                      }}
                    >
                      {copy.runAgain[locale]}
                    </button>
                  </>
                )}
              </article>

              <article className="soft-card">
                <p className="section-label">{copy.whyThisWorks[locale]}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  {copy.ritualRepeats[locale]}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
                  {copy.ritualDescription[locale]}
                </p>
              </article>
            </div>
          )}

          {activeTab === "rules" && (
            <div className="soft-card">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="section-label">{copy.rulesTitle[locale]}</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                    {copy.rulesTitle[locale]}
                  </h2>
                </div>
                <span className="status-chip">
                  {rules.filter((rule) => rule.enabled).length} {copy.enabled[locale]}
                </span>
              </div>

              <div className="grid gap-3">
                {rules.map((rule, index) => (
                  <article key={rule.title.en} className="rule-card">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold">{translate(rule.title, locale)}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
                          {translate(rule.description, locale)}
                        </p>
                        <p className="mt-3 text-sm font-medium text-[var(--accent-ink)]">
                          {translate(rule.impact, locale)}
                        </p>
                      </div>
                      <button
                        aria-pressed={rule.enabled}
                        className={`toggle-button ${rule.enabled ? "toggle-button-on" : ""}`}
                        type="button"
                        onClick={() => toggleRule(index)}
                      >
                        <span className="toggle-thumb" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <nav className="bottom-nav fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-5xl items-center justify-around border-t border-[var(--line)] bg-[var(--paper)] px-4 py-3">
          {(Object.keys(tabs) as TabId[]).map((tab) => (
            <button
              key={tab}
              className={`nav-item ${activeTab === tab ? "nav-item-active" : ""}`}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tabs[tab][locale]}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
