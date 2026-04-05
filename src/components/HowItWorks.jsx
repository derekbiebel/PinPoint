export default function HowItWorks() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm px-5 py-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          How PinPoint Works
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          A plain-English breakdown of the model, what it does, and where it falls short.
        </p>
      </div>

      {/* 1 — Data Sources */}
      <Section number="1" title="Data Sources">
        <SourceCard
          name="FanDuel Odds"
          provider="via The Odds API"
          detail="Live moneyline, spread, and totals odds. Costs API credits, so they only load when you click Pull Odds."
          badge="On Demand"
          badgeColor="amber"
        />
        <SourceCard
          name="ESPN Team Stats"
          provider="free, loads automatically"
          detail="Win/loss records, home/away splits, and current streaks for every team on today's slate."
          badge="Auto"
          badgeColor="green"
        />
      </Section>

      {/* 2 — Win Probability */}
      <Section number="2" title="How PinPoint Builds Its Own Win Probability">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          For every game, PinPoint calculates its own estimated win percentage (PP%) using the steps below. The result is clamped between 20% and 80% so no team ever gets a crazy-extreme number.
        </p>
        <div className="space-y-2">
          <Step
            label="Start at 50%"
            description="Every team begins at an even 50/50 baseline."
          />
          <Step
            label="Overall win percentage"
            description="The strongest signal. A .600 team gets boosted; a .400 team gets penalized."
            tag="Biggest factor"
          />
          <Step
            label="Opponent strength"
            description="Facing a .600 team means a tougher matchup, so PinPoint applies a penalty. Facing a .400 team means the opposite."
          />
          <Step
            label="Home / away record"
            description="If a team has a strong home record and they're playing at home, they get a boost (and vice versa on the road)."
          />
          <Step
            label="Streak momentum"
            description="Teams on a 4+ game win streak get a small boost. Teams on a 4+ game losing streak get a small penalty."
          />
        </div>
      </Section>

      {/* 3 — Finding Value */}
      <Section number="3" title="Finding Value">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Once PinPoint has its own probability and FanDuel has theirs, the app looks for gaps.
        </p>
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <FormulaRow label="Edge" formula="PP%  minus  FD%" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            A positive edge means PinPoint thinks this outcome happens more often than FanDuel's price implies.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <EdgeBadge color="green" label="High Value" rule="Edge >= 5%" />
            <EdgeBadge color="amber" label="Moderate Value" rule="Edge >= 3%" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <Note text="For spreads, the edge signal is dampened by 0.7x since covering a spread is less directly tied to overall win probability." />
          <Note text="Totals (over/under) are displayed but no edge is calculated yet -- there's no scoring model in v1." />
        </div>
      </Section>

      {/* 4 — Phantom Bankroll */}
      <Section number="4" title="Phantom Bankroll">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          PinPoint auto-places a virtual $10 bet on every pick with an edge of 3% or higher. Nothing is real money -- it's a paper-trading tracker so you can see how the model performs over time.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Bet Size" value="$10" />
          <MiniStat label="Threshold" value=">= 3% edge" />
          <MiniStat label="Tracks" value="P&L, ROI, Win %" />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Bets resolve automatically when final scores come in from the Odds API.
        </p>
      </Section>

      {/* 5 — Model Health */}
      <Section number="5" title="Model Health / Self-Learning">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          After enough bets resolve, PinPoint analyzes its own track record to find weak spots.
        </p>
        <div className="space-y-2">
          <BulletItem text="Breaks down results by sport, market type, edge band, and book." />
          <BulletItem text='Flags any segment with a 60%+ loss rate as "danger."' />
          <BulletItem text='Suggests concrete changes like "raise minimum edge to 5%" or "skip NBA spreads."' />
          <BulletItem text="Requires at least 8 resolved bets in a segment before making any calls -- small samples are ignored." />
        </div>
      </Section>

      {/* 6 — Confidence Factors */}
      <Section number="6" title="Confidence Factors">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Each bet card shows small tags that explain why PinPoint feels stronger or weaker about a pick.
        </p>
        <div className="flex flex-wrap gap-2">
          <ConfTag label="Strong record" color="green" />
          <ConfTag label="Poor record" color="red" />
          <ConfTag label="Hot streak (4+)" color="green" />
          <ConfTag label="Cold streak (4+)" color="red" />
          <ConfTag label="Strong at home" color="green" />
          <ConfTag label="Weak on road" color="red" />
        </div>
      </Section>

      {/* 7 — Limitations */}
      <Section number="7" title="Honest Limitations">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          PinPoint v1 is intentionally simple. Here's what it does not account for:
        </p>
        <div className="space-y-2">
          <LimitItem text="Only uses team-level stats, not individual player performance." />
          <LimitItem text="No injury data factored in -- a star player sitting out won't change the number." />
          <LimitItem text="No pace or scoring data, which is why totals have no edge calculation." />
          <LimitItem text="ESPN data is standings-based, not play-by-play advanced metrics." />
          <LimitItem text="The model is simple by design. It's v1 -- a starting point, not a finished product." />
        </div>
      </Section>

      {/* What's Next */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-sm px-5 py-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-indigo-600 dark:text-indigo-400 text-lg">&#9889;</span>
          <h2 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
            What's Next
          </h2>
        </div>
        <p className="text-sm text-indigo-800 dark:text-indigo-300 mb-3">
          An NFL Power Rankings model is in the works. It will be a major upgrade over the current approach:
        </p>
        <div className="space-y-2">
          <NextItem text="Play-by-play EPA (Expected Points Added) data for much deeper team evaluation." />
          <NextItem text="Injury adjustments that account for missing starters and key rotation players." />
          <NextItem text="Positional matchup analysis (e.g., elite pass rush vs. weak offensive line)." />
          <NextItem text="Weather data for outdoor games -- wind, rain, and temperature all affect scoring." />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function Section({ number, title, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm px-5 py-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
          {number}
        </span>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function SourceCard({ name, provider, detail, badge, badgeColor }) {
  const colors = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  };
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-2 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{name}</span>
        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${colors[badgeColor]}`}>
          {badge}
        </span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{provider}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{detail}</p>
    </div>
  );
}

function Step({ label, description, tag }) {
  return (
    <div className="flex gap-3 items-start bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
          {tag && (
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
              {tag}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function FormulaRow({ label, formula }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
      <span className="text-xs text-gray-400">=</span>
      <code className="text-sm font-mono bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded">
        {formula}
      </code>
    </div>
  );
}

function EdgeBadge({ color, label, rule }) {
  const colors = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${colors[color]}`}>
      {label}: {rule}
    </span>
  );
}

function Note({ text }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-gray-300 dark:text-gray-600 mt-0.5 shrink-0">&#8226;</span>
      <p className="text-xs text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{value}</div>
    </div>
  );
}

function BulletItem({ text }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
      <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
    </div>
  );
}

function ConfTag({ label, color }) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${colors[color]}`}>
      {label}
    </span>
  );
}

function LimitItem({ text }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="mt-1 text-amber-500 shrink-0 text-xs">&#9888;</span>
      <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
    </div>
  );
}

function NextItem({ text }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 shrink-0" />
      <p className="text-sm text-indigo-800 dark:text-indigo-300">{text}</p>
    </div>
  );
}
