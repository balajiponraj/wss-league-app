const featureCards = [
  {
    title: "Specify match settings",
    subtitle: "New Match",
    accent: "from-violet-500 to-purple-600",
    tone: "purple",
    rows: [
      { label: "Settings", value: "Max games (sets)" },
      { label: "Configuration", value: "Singles" },
      { label: "Use deuce", value: "On" },
    ],
  },
  {
    title: "Keep track of player statistics",
    subtitle: "Player Statistics",
    accent: "from-indigo-500 to-sky-500",
    tone: "indigo",
    rows: [
      { label: "Jake Lee", value: "2" },
      { label: "Service faults", value: "3" },
      { label: "Unforced errors", value: "6" },
    ],
  },
  {
    title: "Keep track of shuttlecocks, challenges, misconduct cards, and more!",
    subtitle: "Seven-Twelve",
    accent: "from-slate-500 to-slate-700",
    tone: "neutral",
    rows: [
      { label: "Add shuttlecock...", value: "" },
      { label: "Player statistics...", value: "" },
      { label: "Give misconduct card...", value: "" },
    ],
  },
  {
    title: "Share match scores with other people",
    subtitle: "Share score",
    accent: "from-zinc-500 to-zinc-700",
    tone: "dark",
    rows: [
      { label: "Jake Lee", value: "21" },
      { label: "Xian Huang", value: "19" },
      { label: "Score text", value: "" },
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f3f1ef] px-4 py-8 text-[#1d1d1f] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-10 flex items-center justify-between rounded-full border border-[#d9d4d0] bg-[#f5f5f3]/80 px-5 py-3 shadow-[0_8px_26px_rgba(0,0,0,0.04)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1d1f] text-lg font-bold text-white">
              W
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#5d5d62]">WHITBY SMASH SQUAD</p>
              <h1 className="text-lg font-semibold text-[#1b1b1d]">WSS League Desk</h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {['Dashboard', 'Players', 'Matches', 'Standings', 'Settings'].map((item) => (
              <button
                key={item}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  item === 'Dashboard'
                    ? 'bg-[#1d1e22] text-white shadow-md'
                    : 'bg-white text-[#36363a] hover:bg-[#eceae8]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </header>

        <main className="flex min-h-[760px] items-center justify-center overflow-hidden rounded-[34px] border border-[#dad5d1] bg-[radial-gradient(circle_at_top,#f7f4f2_0%,#ece8e5_35%,#e7e3e0_100%)] px-2 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:px-6 lg:px-8">
          <div className="flex w-full max-w-[1480px] items-center justify-center gap-4 lg:gap-6">
            {[0, 1, 2, 3].map((cardIndex) => (
              <div
                key={cardIndex}
                className="relative h-[720px] w-[290px] rounded-[36px] border border-[#2d2f34] bg-[linear-gradient(180deg,#2c2e32_0%,#1d1f23_40%,#181a1e_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_22px_rgba(0,0,0,0.18)]"
              >
                <div className="relative h-full rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-3">
                  <div className="mb-3 flex items-center justify-between px-2 pt-1 text-white">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#b0b4bb]">
                      <span>{cardIndex === 0 ? '9:20' : cardIndex === 1 ? '5:40' : cardIndex === 2 ? '5:40' : '9:18'}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    </div>
                  </div>

                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-lg text-white">
                      {cardIndex === 3 ? '‹' : '<'}
                    </div>
                    {cardIndex === 0 && (
                      <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">
                        Match
                      </div>
                    )}
                    {cardIndex === 1 && (
                      <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">
                        Stats
                      </div>
                    )}
                    {cardIndex === 2 && (
                      <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">
                        Rules
                      </div>
                    )}
                    {cardIndex === 3 && (
                      <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">
                        Score
                      </div>
                    )}
                  </div>

                  <div className="mb-4 rounded-[22px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-white/60">
                      <span>{featureCards[cardIndex].subtitle}</span>
                      <span>{cardIndex === 0 ? '↗' : cardIndex === 1 ? '⤴' : cardIndex === 2 ? '✦' : '⇪'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-white/8">
                        <div className={`h-full w-2/3 rounded-full bg-gradient-to-r ${featureCards[cardIndex].accent}`} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,#2a2d31,#1d1f23)] p-3 shadow-inner shadow-black/10">
                      <h2 className="mb-3 text-[18px] font-medium leading-snug text-white/95">
                        {featureCards[cardIndex].title}
                      </h2>

                      {cardIndex === 0 && (
                        <div className="space-y-3 text-sm text-white/80">
                          <div className="grid grid-cols-2 gap-2">
                            <button className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-2 py-2 text-xs font-medium text-white shadow-md shadow-violet-500/20">
                              Singles
                            </button>
                            <button className="rounded-xl bg-white/8 px-2 py-2 text-xs font-medium text-slate-200">
                              Doubles
                            </button>
                          </div>
                          <div className="rounded-xl bg-[#17181b] p-2 text-xs">
                            <div className="mb-2 flex items-center justify-between text-slate-300">
                              <span>Max games (sets)</span>
                              <span className="text-white">3</span>
                            </div>
                            <div className="mb-2 flex items-center justify-between text-slate-300">
                              <span>Points per game</span>
                              <span className="text-white">21</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-300">
                              <span>Use deuce</span>
                              <span className="h-4 w-8 rounded-full bg-violet-500/80 p-0.5">
                                <span className="ml-4 block h-3 w-3 rounded-full bg-white" />
                              </span>
                            </div>
                          </div>
                          <button className="mt-2 w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2.5 text-sm font-medium text-white">
                            Next
                          </button>
                        </div>
                      )}

                      {cardIndex === 1 && (
                        <div className="space-y-3 text-sm text-white/80">
                          <div className="rounded-lg bg-[#1b1d22] p-2">
                            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                              <span>Jae Lee</span>
                              <span className="text-white">21</span>
                            </div>
                            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                              <span>Alex S</span>
                              <span className="text-white">13</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px]">
                                <span>Service faults</span>
                                <span className="rounded bg-white/6 px-2 py-1">2</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span>Unforced errors</span>
                                <span className="rounded bg-white/6 px-2 py-1">3</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span>Winner</span>
                                <span className="rounded bg-white/6 px-2 py-1">6</span>
                              </div>
                            </div>
                          </div>
                          <button className="w-full rounded-xl bg-white/8 px-3 py-2 text-sm text-white">
                            Save stats
                          </button>
                        </div>
                      )}

                      {cardIndex === 2 && (
                        <div className="space-y-3 text-sm text-white/80">
                          <div className="rounded-lg bg-[#1b1d22] p-2">
                            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                              <span>Add shuttlecock...</span>
                              <span>+</span>
                            </div>
                            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                              <span>Player statistics...</span>
                              <span>◌</span>
                            </div>
                            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                              <span>Challenge</span>
                              <span>⚑</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-300">
                              <span>Misconduct card...</span>
                              <span>!</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {cardIndex === 3 && (
                        <div className="space-y-3 text-sm text-white/80">
                          <div className="rounded-lg bg-[#17181b] p-2">
                            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                              <span>Jake Lee</span>
                              <span className="font-medium text-white">21</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-300">
                              <span>Xian Huang</span>
                              <span className="font-medium text-white">19</span>
                            </div>
                          </div>
                          <div className="rounded-lg border border-white/8 bg-white/4 p-2 text-[11px] text-slate-300">
                            Score text
                          </div>
                          <button className="w-full rounded-xl bg-white/8 px-3 py-2 text-sm text-white">
                            Share result
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
