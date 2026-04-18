"use client";

import { useMemo, useState } from "react";

type WidgetResult = {
  id: number;
  disease: string;
  severity: string;
  mandatory: boolean;
  vaccines: Array<{ name: string; doses: string; ageGroup: string }>;
};

type SearchPayload = {
  recommendation?: string;
  results: WidgetResult[];
};

export default function EmbedWidgetPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SearchPayload | null>(null);

  const canSearch = useMemo(() => query.trim().length > 1, [query]);

  const runSearch = async () => {
    if (!canSearch) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?disease=${encodeURIComponent(query)}&page=1&pageSize=3`, {
        cache: "no-store"
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({ message: "Search failed" }))) as {
          message?: string;
        };
        throw new Error(data.message ?? "Search failed");
      }

      setPayload((await response.json()) as SearchPayload);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-gradient-to-b from-sky-50 to-white p-4">
      <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
        <p className="mb-2 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
          VaxInfo Widget
        </p>
        <h1 className="text-xl font-semibold text-slate-900">Search Vaccines</h1>
        <p className="mt-1 text-xs text-slate-600">
          Embed-ready search widget for disease vaccine lookup and recommendations.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. measles and polio"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={!canSearch || loading}
            className="h-10 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "..." : "Go"}
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

        {payload?.recommendation && (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
            {payload.recommendation}
          </div>
        )}

        <div className="mt-3 space-y-2">
          {(payload?.results ?? []).map((result) => (
            <article key={result.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{result.disease}</h2>
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                  {result.severity}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {result.vaccines.map((vaccine) => (
                  <li key={`${result.id}-${vaccine.name}`}>
                    {vaccine.name} ({vaccine.doses}; {vaccine.ageGroup})
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
