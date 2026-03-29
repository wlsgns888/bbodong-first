import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeClient } from "@/components/home-client";

const {
  maybeSingleMock,
  participantQueryMock,
  upsertMock,
  eqMock,
  selectMock,
  fromMock,
} = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const participantQueryMock = vi.fn();
  const upsertMock = vi.fn();
  const eqMock = vi.fn((table: string, column: string, value: string) => {
    if (table === "session_participants") {
      return participantQueryMock(table, column, value);
    }

    return {
      maybeSingle: () => maybeSingleMock(table, column, value),
    };
  });
  const selectMock = vi.fn((table: string) => ({
    eq: (column: string, value: string) => eqMock(table, column, value),
  }));
  const fromMock = vi.fn((table: string) => ({
    select: () => selectMock(table),
    upsert: (payload: unknown, options?: unknown) => upsertMock(table, payload, options),
  }));

  return {
    maybeSingleMock,
    participantQueryMock,
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
    participantQueryMock.mockReset();
    upsertMock.mockReset();
    eqMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();
    window.localStorage.clear();
    window.history.replaceState({}, "", "http://localhost:3000/");

    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    participantQueryMock.mockResolvedValue({ data: [], error: null });
    upsertMock.mockResolvedValue({ error: null });
  });

  it("creates a session from the URL, completes the weekly check-in, and resurfaces the saved rule", async () => {
    const user = userEvent.setup();

    window.history.replaceState({}, "", "http://localhost:3000/?session=BBOTEST1");

    render(<HomeClient hasSupabaseConfig={false} enableRemoteSync={false} />);

    expect(await screen.findByText("세션 코드: BBOTEST1")).toBeTruthy();
    expect(screen.getByDisplayValue("http://localhost:3000/?session=BBOTEST1")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "세션 참여하기" }));
    expect(screen.getByText("이 이름으로 참여 중 지훈")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "이번 주 기준 정하기" })[0]);

    const bufferInput = screen.getByLabelText("합의된 주간 여유분");
    await user.clear(bufferInput);
    await user.type(bufferInput, "150000");
    await user.click(screen.getByRole("button", { name: "계속하기" }));

    await user.click(screen.getByRole("button", { name: /배달/ }));
    await user.click(screen.getByRole("button", { name: "계속하기" }));

    await user.click(
      screen.getByRole("button", { name: "배달이 3만원 넘으면 먼저 공유하기" }),
    );
    await user.click(screen.getByRole("button", { name: "규칙 저장하기" }));

    expect(
      screen.getByRole("heading", {
        name: "다음 주에도 다시 볼 기준이 저장됐습니다.",
      }),
    ).toBeTruthy();
    expect(screen.getByText("이번 주에 다시 떠오를 규칙은 아직 없습니다.")).toBeTruthy();
    expect(screen.getByText("₩150,000")).toBeTruthy();
  });

  it("switches to English and updates document language", async () => {
    const user = userEvent.setup();

    render(<HomeClient hasSupabaseConfig enableRemoteSync={false} />);

    await screen.findByRole("heading", { name: /세션 코드/ });
    await user.click(screen.getByRole("button", { name: "영어" }));

    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("heading", { name: /Session code:/ })).toBeTruthy();
    expect(screen.getByText(/You have not joined this session yet\./)).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Set this week's standard" })[0],
    ).toBeTruthy();
  });

  it("restores saved local state for a specific session and resets back to defaults", async () => {
    const user = userEvent.setup();

    window.history.replaceState({}, "", "http://localhost:3000/?session=BBOREST1");
    window.localStorage.setItem(
      "bbodong.home-state.v4.BBOREST1",
      JSON.stringify({
        locale: "en",
        currentView: "rules",
        checkinStep: 2,
        sessionCode: "BBOREST1",
        currentUserName: "Jin",
        hasJoinedSession: true,
        participantNames: ["Jin", "Minji"],
        weekStart: "2026-03-23",
        revision: 3,
        goalName: "Japan trip fund",
        weeklyBuffer: 125000,
        bufferUpdatedBy: "Jin",
        ambiguousSpend: {
          label: "Weekend dinner",
          amount: 42000,
          author: "Jin",
          createdAt: "2026-03-29T00:00:00.000Z",
        },
        ruleMemory: {
          text: "Keep weekend dinner to once",
          sourceLabel: "Weekend dinner",
          createdAt: "2026-03-29T00:00:00.000Z",
          createdWeekStart: "2026-03-23",
          resurfacedWeekStart: "2026-03-23",
        },
        savedAt: "2026-03-29T00:00:00.000Z",
      }),
    );

    render(<HomeClient hasSupabaseConfig={false} enableRemoteSync={false} />);

    expect(await screen.findByRole("button", { name: "Korean" })).toBeTruthy();
    expect(screen.getByText("Rule resurfaced this week")).toBeTruthy();
    expect(screen.getByText("Keep weekend dinner to once")).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");

    await user.click(screen.getByRole("button", { name: "Reset local" }));

    expect(await screen.findByRole("button", { name: "영어" })).toBeTruthy();
    expect(screen.getByText("제주 여행 적금")).toBeTruthy();
    expect(screen.getByText("아직 저장된 상태가 없습니다.")).toBeTruthy();
    expect(screen.queryByText("Keep weekend dinner to once")).toBeNull();
    expect(document.documentElement.lang).toBe("ko");
  });

  it("uses the session code as the remote row id", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/?session=BBOREM01");

    render(<HomeClient hasSupabaseConfig enableRemoteSync />);

    await waitFor(() => {
      expect(eqMock).toHaveBeenCalledWith("shared_sessions", "id", "BBOREM01");
      expect(eqMock).toHaveBeenCalledWith("weekly_states", "session_id", "BBOREM01");
      expect(eqMock).toHaveBeenCalledWith("rule_memories", "session_id", "BBOREM01");
      expect(eqMock).toHaveBeenCalledWith(
        "session_participants",
        "session_id",
        "BBOREM01",
      );
    });
  });

  it("resurfaces a saved rule when the stored week is older than the current week", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/?session=BBOOLD01");
    window.localStorage.setItem(
      "bbodong.home-state.v4.BBOOLD01",
      JSON.stringify({
        locale: "ko",
        currentView: "home",
        checkinStep: 0,
        sessionCode: "BBOOLD01",
        currentUserName: "지훈",
        hasJoinedSession: true,
        participantNames: ["지훈", "민지"],
        weekStart: "2026-03-17",
        revision: 1,
        goalName: "제주 여행 적금",
        weeklyBuffer: 180000,
        bufferUpdatedBy: "지훈",
        ambiguousSpend: {
          label: "배달",
          amount: 28000,
          author: "지훈",
          createdAt: "2026-03-17T00:00:00.000Z",
        },
        ruleMemory: {
          text: "배달이 3만원 넘으면 먼저 공유하기",
          sourceLabel: "배달",
          createdAt: "2026-03-17T00:00:00.000Z",
          createdWeekStart: "2026-03-17",
          resurfacedWeekStart: null,
        },
        savedAt: "2026-03-17T00:00:00.000Z",
      }),
    );

    render(<HomeClient hasSupabaseConfig={false} enableRemoteSync={false} />);

    expect(await screen.findByText("이번 주 다시 떠오른 규칙")).toBeTruthy();
    expect(screen.getByText("배달이 3만원 넘으면 먼저 공유하기")).toBeTruthy();
    expect(screen.getByText("규칙 작성 주: 2026-03-17")).toBeTruthy();
  });

  it("shows a conflict warning and skips overwrite when the remote revision is newer", async () => {
    const user = userEvent.setup();

    window.history.replaceState({}, "", "http://localhost:3000/?session=BBOCON01");

    let weeklyStateReadCount = 0;
    maybeSingleMock.mockImplementation(async (table: string) => {
      if (table === "weekly_states") {
        weeklyStateReadCount += 1;

        if (weeklyStateReadCount === 1) {
          return { data: null, error: null };
        }

        return {
          data: {
            session_id: "BBOCON01",
            revision: 2,
          },
          error: null,
        };
      }

      return { data: null, error: null };
    });

    render(<HomeClient hasSupabaseConfig enableRemoteSync />);
    await screen.findByText("같은 세션 코드로 들어오면 같은 상태를 같이 봅니다.");
    await user.click(screen.getByRole("button", { name: "영어" }));

    expect(
      await screen.findByText(
        "Someone else saved a newer version first, so this change was not auto-saved. Refresh your view.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Revision: 0")).toBeTruthy();
    expect(upsertMock).not.toHaveBeenCalledWith(
      "weekly_states",
      expect.objectContaining({ session_id: "BBOCON01" }),
      expect.anything(),
    );
  });

  it("stops extra remote requests when the shared session tables are missing", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/?session=BBOMISS1");

    maybeSingleMock.mockImplementation(async (table: string) => {
      if (table === "shared_sessions") {
        return {
          data: null,
          error: { code: "PGRST205" },
        };
      }

      return { data: null, error: null };
    });

    render(<HomeClient hasSupabaseConfig enableRemoteSync />);

    expect(
      await screen.findByText("Supabase는 설정됐지만 공유 세션 테이블이 아직 없습니다."),
    ).toBeTruthy();
    expect(eqMock).toHaveBeenCalledWith("shared_sessions", "id", "BBOMISS1");
    expect(eqMock).not.toHaveBeenCalledWith("weekly_states", "session_id", "BBOMISS1");
    expect(eqMock).not.toHaveBeenCalledWith("rule_memories", "session_id", "BBOMISS1");
    expect(eqMock).not.toHaveBeenCalledWith(
      "session_participants",
      "session_id",
      "BBOMISS1",
    );
  });
});
