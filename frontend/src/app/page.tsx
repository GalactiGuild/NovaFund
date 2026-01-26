

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">NovaFund</h1>
      </header>
      <section className="p-8">
        <h2 className="text-xl">Welcome to NovaFund Collective</h2>
        <p className="mt-2 text-muted-foreground">
          The decentralized micro-investment platform on Stellar.
        </p>
        <div className="mt-6 space-x-4">
          <a
            href="/dashboard"
            className="inline-block bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-600 transition-colors"
          >
            View Dashboard
          </a>
          <a
            href="/explore"
            className="inline-block bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            Explore Projects
          </a>
        </div>
      </section>
    </main>
  );
}
