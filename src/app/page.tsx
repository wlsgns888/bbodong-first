import { supabase } from "@/lib/supabase/client";

export default function Home() {
  void supabase;
  const supabaseHost = new URL(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
  ).host;
  const timeline = [
    {
      title: "Delivery dinner",
      amount: "-₩28,000",
      impact: "Buffer impact: -₩28,000",
      state: "Needs a quick check",
    },
    {
      title: "This week's check-in",
      amount: "Sunday, 9:00 PM",
      impact: "3 steps, under 3 minutes",
      state: "Due tomorrow",
    },
    {
      title: "Shared state",
      amount: "A little tight this week",
      impact: "Added by Minji",
      state: "Seen by both",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[var(--paper)] px-5 pb-24 pt-6 text-[var(--ink)]">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--muted-ink)]">
            Newly married, dual-income
          </p>
          <h1 className="font-[family-name:var(--font-geist-sans)] text-3xl font-semibold tracking-[-0.04em]">
            Bbodong
          </h1>
        </div>
        <button
          className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)]"
          type="button"
        >
          Settings
        </button>
      </header>

      <section className="hero-panel mb-4">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent-ink)]">
          Weekly buffer
        </p>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-5xl font-semibold tracking-[-0.08em]">₩184,000</p>
            <p className="mt-2 max-w-[18rem] text-sm leading-6 text-[var(--muted-ink)]">
              You are still on track. One big delivery order or a weekend impulse
              buy changes that.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="status-chip">Seen by both</span>
            <span className="status-chip">{supabaseHost}</span>
          </div>
        </div>

        <div className="rounded-[1.4rem] bg-white/70 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--muted-ink)]">Jeju trip fund</span>
            <span className="font-semibold">₩1.24M / ₩2.00M</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--line)]">
            <div className="h-full w-[62%] rounded-full bg-[var(--accent)]" />
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-ink)]">
            At this pace, you hit the goal in 6 weeks.
          </p>
        </div>
      </section>

      <section className="action-panel mb-4">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--alert-ink)]">
              One thing to check
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
              Delivery dinner is pushing this week off course
            </h2>
          </div>
          <span className="status-chip status-chip-alert">Needs both</span>
        </div>

        <div className="grid gap-3 rounded-[1.4rem] bg-white p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted-ink)]">Amount</span>
            <strong>-₩28,000</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted-ink)]">Rule hit</span>
            <strong>Delivery above ₩25,000</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted-ink)]">Goal delay</span>
            <strong>+1 day</strong>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button className="primary-button" type="button">
            Check together
          </button>
          <button className="secondary-button" type="button">
            Keep as is
          </button>
        </div>
      </section>

      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        <article className="soft-card">
          <p className="section-label">Shared state</p>
          <h3 className="mt-2 text-lg font-semibold">A little tight this week</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
            Added by Minji. The app keeps this visible so the next spend does not
            feel like a surprise.
          </p>
        </article>
        <article className="soft-card">
          <p className="section-label">Weekly check-in</p>
          <h3 className="mt-2 text-lg font-semibold">Due tomorrow, 9:00 PM</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">
            A fixed 3-step ritual. Buffer, biggest wobble, next rule adjustment.
          </p>
        </article>
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="section-label">Shared timeline</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              Only the moments that matter
            </h2>
          </div>
          <button className="text-sm font-medium text-[var(--accent-ink)]" type="button">
            See all
          </button>
        </div>
        <div className="grid gap-3">
          {timeline.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.25rem] border border-[var(--line)] bg-white px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">{item.impact}</p>
                </div>
                <strong className="text-sm">{item.amount}</strong>
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--muted-ink)]">
                {item.state}
              </p>
            </article>
          ))}
        </div>
      </section>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md items-center justify-around border-t border-[var(--line)] bg-[var(--paper)] px-4 py-3">
        <button className="nav-item nav-item-active" type="button">
          Home
        </button>
        <button className="nav-item" type="button">
          Timeline
        </button>
        <button className="nav-item" type="button">
          Check-in
        </button>
        <button className="nav-item" type="button">
          Rules
        </button>
      </nav>
    </main>
  );
}
