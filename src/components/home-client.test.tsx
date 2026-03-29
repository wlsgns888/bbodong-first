import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeClient } from "@/components/home-client";

const {
  maybeSingleMock,
  upsertMock,
  eqMock,
  selectMock,
  fromMock,
} = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const upsertMock = vi.fn();
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
    upsert: upsertMock,
  }));

  return {
    maybeSingleMock,
    upsertMock,
    eqMock,
    selectMock,
    fromMock,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  hasSupabaseConfig: true,
  supabase: {
    from: fromMock,
  },
}));

describe("HomeClient", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    upsertMock.mockReset();
    eqMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();

    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    upsertMock.mockResolvedValue({ error: null });
  });

  it("filters the timeline by selected category", async () => {
    const user = userEvent.setup();

    render(<HomeClient hasSupabaseConfig enableRemoteSync={false} />);

    await user.click(screen.getByRole("button", { name: "타임라인" }));
    await user.click(screen.getByRole("button", { name: "메모" }));

    expect(screen.getByRole("heading", { name: "공유 상태" })).toBeTruthy();
    expect(screen.queryByText("배달 저녁")).toBeNull();
    expect(screen.queryByText("커피 구매")).toBeNull();
  });

  it("completes and resets the weekly check-in flow", async () => {
    const user = userEvent.setup();

    render(<HomeClient hasSupabaseConfig={false} enableRemoteSync={false} />);

    await user.click(screen.getByRole("button", { name: "같이 확인하기" }));
    await user.click(screen.getByRole("button", { name: "안전해 보여" }));
    await user.click(screen.getByRole("button", { name: "배달" }));
    await user.click(screen.getByRole("button", { name: "배달 상한 낮추기" }));

    expect(
      screen.getByRole("heading", { name: "다음 주를 위한 구체적인 합의가 생겼어요" }),
    ).toBeTruthy();
    expect(screen.getByText("배달 상한 낮추기")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "다시 하기" }));

    expect(
      screen.getByRole("heading", {
        name: "이번 주 남은 버퍼가 충분히 안전하다고 느껴지나요?",
      }),
    ).toBeTruthy();
  });

  it("updates the enabled rule count when a rule is toggled", async () => {
    const user = userEvent.setup();

    render(<HomeClient hasSupabaseConfig enableRemoteSync={false} />);

    await user.click(screen.getByRole("button", { name: "규칙" }));
    expect(screen.getByText("2 활성")).toBeTruthy();

    const toggles = screen.getAllByRole("button", { pressed: false });
    await user.click(toggles[0]);

    expect(screen.getByText("3 활성")).toBeTruthy();
  });

  it("switches to English and updates document language", async () => {
    const user = userEvent.setup();

    render(<HomeClient hasSupabaseConfig enableRemoteSync={false} />);

    await user.click(screen.getByRole("button", { name: "영어" }));

    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("button", { name: "Timeline" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check together" })).toBeTruthy();
  });

  it("restores the saved local state on load and resets back to the default home view", async () => {
    const user = userEvent.setup();

    window.localStorage.setItem(
      "bbodong.home-state.v2",
      JSON.stringify({
        locale: "en",
        activeTab: "rules",
        activeFilter: "notes",
        checkinIndex: 2,
        checkinAnswers: ["Feels safe", "Delivery"],
        rules: [
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
            enabled: true,
          },
        ],
        focusLocked: true,
        savedAt: "2026-03-29T00:00:00.000Z",
      }),
    );

    render(<HomeClient hasSupabaseConfig={false} enableRemoteSync={false} />);

    expect(await screen.findByRole("button", { name: "English" })).toBeTruthy();
    expect(screen.getByText("3 enabled")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");

    await user.click(screen.getByRole("button", { name: "Reset local" }));

    expect(await screen.findByRole("button", { name: "한국어" })).toBeTruthy();
    expect(
      screen.getByText("돈 얘기가 괜한 긴장으로 번지기 전에 같이 보는 주간 버퍼 보드."),
    ).toBeTruthy();
    expect(screen.getByText("아직 저장된 상태가 없습니다.")).toBeTruthy();
    expect(screen.queryByText("3 enabled")).toBeNull();
    expect(document.documentElement.lang).toBe("ko");
  });

  it("shows the missing-table state when Supabase is configured but the table is absent", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST205" },
    });
    upsertMock.mockResolvedValueOnce({
      error: { code: "PGRST205" },
    });

    render(<HomeClient hasSupabaseConfig enableRemoteSync />);

    expect(
      await screen.findByText("Supabase는 설정됐지만 app_state 테이블이 아직 없습니다."),
    ).toBeTruthy();
    expect(fromMock).toHaveBeenCalledWith("app_state");
  });
});
