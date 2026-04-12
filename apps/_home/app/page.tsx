type AppCard = {
  title: string;
  description: string;
  subdomain: string;
  status: 'live' | 'building' | 'planned';
};

const apps: AppCard[] = [
  {
    title: 'Wallet Health',
    description: 'Review approvals granted and revoke risky contracts.',
    subdomain: 'health',
    status: 'planned',
  },
  {
    title: 'Gas Tracker',
    description: 'Live Ink gas price with short-horizon history.',
    subdomain: 'gas',
    status: 'live',
  },
  {
    title: 'Wallet Dashboard',
    description: 'Activity, gas spent, token balances, and NFTs for any Ink wallet.',
    subdomain: 'wallet',
    status: 'live',
  },
  {
    title: 'Whale Watcher',
    description: 'Feed of large on-chain movements across Ink.',
    subdomain: 'whales',
    status: 'planned',
  },
  {
    title: 'Test Yourself',
    description: 'Science & math quiz — Geometry, Math, Physics, Biology, Chemistry. 100 questions, achievements.',
    subdomain: 'quiz',
    status: 'live',
  },
  {
    title: 'Fantasy PL',
    description: 'Build your dream Premier League squad with a £100M budget. Live FPL data.',
    subdomain: 'fantasy',
    status: 'live',
  },
  {
    title: 'Game Hub',
    description: '7 games — Hangman, Minesweeper, Snake, Tetris, Solo Test, Crossword, Checkers.',
    subdomain: 'games',
    status: 'live',
  },
  {
    title: 'GM Widget',
    description: 'Daily on-chain gm with streak tracking. Connect wallet, say gm, build your streak.',
    subdomain: 'gm',
    status: 'live',
  },
  {
    title: 'InkPress',
    description: 'Decentralized blog on Ink. Read and collect articles as ERC-1155 NFTs. Apply to write.',
    subdomain: 'inkpress',
    status: 'live',
  },
];

function StatusBadge({ status }: { status: AppCard['status'] }) {
  const styles =
    status === 'live'
      ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40'
      : status === 'building'
      ? 'bg-amber-500/20 text-amber-300 ring-amber-500/40'
      : 'bg-purple-100 text-ink-600 ring-purple-300';
  const label = status === 'live' ? 'Live' : status === 'building' ? 'Building' : 'Planned';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <header className="mb-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-ink-700 ring-1 ring-inset ring-purple-300">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-500" />
          Built for Ink — Kraken&apos;s Ethereum L2
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-ink-900 sm:text-6xl">
          Ink Suite
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-700">
          A portfolio of small, focused apps for anyone using or building on Ink.
          Track wallets, play games, say gm on-chain, publish articles as NFTs, and more — all
          under one roof, all open source.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href="https://github.com/erdemcrypto3/inksuite"
            className="rounded-lg bg-ink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-500"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
          <a
            href="https://inkonchain.com"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-purple-200 hover:bg-purple-50 shadow-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            What is Ink? →
          </a>
        </div>
      </header>

      <section>
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-ink-600">
          Apps in the suite
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <a
              key={app.subdomain}
              href={app.status === 'live' ? `https://${app.subdomain}.inksuite.xyz` : undefined}
              target={app.status === 'live' ? '_blank' : undefined}
              rel={app.status === 'live' ? 'noopener noreferrer' : undefined}
              className={`group block rounded-xl bg-white p-5 ring-1 ring-inset ring-purple-100 shadow-sm transition ${
                app.status === 'live'
                  ? 'hover:bg-purple-50 hover:ring-ink-500 cursor-pointer'
                  : 'opacity-70'
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-ink-900">{app.title}</h3>
                <StatusBadge status={app.status} />
              </div>
              <p className="mb-4 text-sm leading-relaxed text-ink-700">
                {app.description}
              </p>
              <div className="font-mono text-xs text-ink-500 group-hover:text-ink-500">
                {app.subdomain}.inksuite.xyz
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer className="mt-24 border-t border-purple-200 pt-8 text-sm text-ink-500">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span>
            Ink Suite · MIT license ·{' '}
            <a
              href="https://github.com/erdemcrypto3/inksuite"
              className="hover:text-ink-500"
              target="_blank"
              rel="noopener noreferrer"
            >
              erdemcrypto3/inksuite
            </a>
          </span>
          <span>Not affiliated with Kraken or Ink Foundation.</span>
        </div>
      </footer>
    </main>
  );
}
