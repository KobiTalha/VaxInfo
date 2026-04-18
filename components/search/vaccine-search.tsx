"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import {
    BookmarkPlus,
    ClipboardCheck,
    Copy,
    LayoutDashboard,
    Moon,
    Search,
    ShieldCheck,
    ShieldX,
    Sparkles,
    Sun
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Vaccine = {
  id: number;
  name: string;
  type: string;
  vaccineType: string;
  doses: string;
  dosageSchedule: string;
  ageGroup: string;
  sideEffects: string[];
  coveragePercent: number | null;
  region: string | null;
  introductionYear: number | null;
};

type SearchResult = {
  id: number;
  disease: string;
  category: string;
  severity: string;
  mandatory: boolean;
  aliases: string[];
  matchType: "exact" | "alias" | "multi" | "fuzzy";
  score: number | null;
  vaccines: Vaccine[];
};

type SearchPayload = {
  query: string;
  intent: "search" | "explanation" | "recommendation" | "analytics";
  recommendationType?: "child_schedule" | "travel" | "general";
  recommendation?: string;
  totalMatches: number;
  results: SearchResult[];
};

type DiseaseListItem = {
  id: number;
  name: string;
  aliases: string[];
};

function scoreToPercent(score: number | null) {
  if (score === null) {
    return 100;
  }

  return Math.max(0, Math.min(100, Math.round((1 - Math.min(score, 1)) * 100)));
}

function severityTone(severity: string) {
  if (severity === "mandatory") {
    return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700/60";
  }

  if (severity === "high-risk") {
    return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700/60";
  }

  if (severity === "moderate") {
    return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700/60";
  }

  return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700/60";
}

export default function VaccineSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dataset, setDataset] = useState<DiseaseListItem[]>([]);
  const [isLoadingDataset, setIsLoadingDataset] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchPayload, setSearchPayload] = useState<SearchPayload | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem("vaxinfo-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = storedTheme ? storedTheme === "dark" : prefersDark;

    setIsDarkMode(shouldUseDark);

    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q") ?? params.get("disease") ?? "";
    if (initial) {
      setQuery(initial);
      setDebouncedQuery(initial);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("vaxinfo-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 320);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const fetchDataset = async () => {
      try {
        const response = await fetch("/api/vaccines?page=1&pageSize=300", {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load diseases");
        }

        const payload = (await response.json()) as {
          diseases: Array<{ id: number; name: string; aliases: string[] }>;
        };

        setDataset(
          (payload.diseases ?? []).map((entry) => ({
            id: entry.id,
            name: entry.name,
            aliases: entry.aliases
          }))
        );
      } catch {
        setDataset([]);
      } finally {
        setIsLoadingDataset(false);
      }
    };

    void fetchDataset();
  }, []);

  useEffect(() => {
    if (!debouncedQuery) {
      setSearchPayload(null);
      setSearchError(null);

      const params = new URLSearchParams(window.location.search);
      params.delete("q");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const params = new URLSearchParams(window.location.search);
    params.set("q", debouncedQuery);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);

    const controller = new AbortController();

    const run = async () => {
      try {
        const response = await fetch(
          `/api/search?disease=${encodeURIComponent(debouncedQuery)}&page=1&pageSize=5`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({ message: "Search failed" }))) as {
            message?: string;
          };
          throw new Error(payload.message ?? "Search failed");
        }

        const payload = (await response.json()) as SearchPayload;
        setSearchPayload(payload);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSearchPayload(null);
        setSearchError(error instanceof Error ? error.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  const suggestions = useMemo(() => {
    if (!query.trim() || dataset.length === 0) {
      return [] as string[];
    }

    const lower = query.trim().toLowerCase();
    return dataset
      .filter(
        (entry) =>
          entry.name.toLowerCase().includes(lower) ||
          entry.aliases.some((alias) => alias.toLowerCase().includes(lower))
      )
      .map((entry) => entry.name)
      .slice(0, 6);
  }, [dataset, query]);

  const showSuggestions = query.trim().length > 0 && suggestions.length > 0;

  const saveDisease = async (diseaseId: number) => {
    try {
      const response = await fetch("/api/user/saved-diseases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ diseaseId })
      });

      if (!response.ok) {
        throw new Error("Could not save disease");
      }
    } catch {
      // The action remains optional for unauthenticated users.
    }
  };

  const copyShareLink = async () => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedQuery) {
      params.set("q", debouncedQuery);
    }

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-10 pt-12 md:px-8 md:pt-20">
      <div className="mb-8 flex items-start justify-between gap-4">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-left md:text-center"
        >
          <p className="mb-3 inline-block rounded-full border border-sky-200/70 bg-white/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 backdrop-blur-lg dark:border-sky-500/40 dark:bg-sky-900/30 dark:text-sky-200">
            VaxInfo
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
            Intelligent Vaccine Search
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
            Search single or multiple diseases, ask recommendation-style queries, and share exact result links.
          </p>
        </motion.header>

        <div className="flex items-center gap-2">
          <Link
            href="/auth/signin"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/60 bg-white/65 px-4 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-lg transition hover:scale-[1.02] hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Account
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/60 bg-white/65 px-4 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-lg transition hover:scale-[1.02] hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>

          <button
            type="button"
            onClick={() => setIsDarkMode((value) => !value)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/65 text-slate-700 shadow-sm backdrop-blur-lg transition hover:scale-[1.03] hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="mx-auto w-full max-w-3xl"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: measles and polio vaccines, child schedule, travel vaccines"
            className="h-14 rounded-2xl border border-white/60 bg-white/55 pl-12 pr-12 text-base dark:border-slate-700/70 dark:bg-slate-900/55"
            aria-label="Search disease"
          />

          {(isSearching || isLoadingDataset) && (
            <div className="absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-2 border-sky-200 border-t-sky-500 animate-spin dark:border-slate-600 dark:border-t-sky-400" />
          )}

          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
                className="absolute z-20 mt-3 w-full overflow-hidden rounded-2xl border border-white/50 bg-white/80 p-2 shadow-xl backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/82"
              >
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-sky-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => setQuery(name)}
                  >
                    <span>{name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Suggestion</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={copyShareLink}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {copied ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Share search"}
          </button>
          <Link
            href="/developers"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            API docs
          </Link>
        </div>
      </motion.section>

      <section className="mx-auto mt-8 w-full max-w-3xl space-y-4">
        {!query.trim() && (
          <Card className="border-slate-200/70 bg-white/75 dark:border-slate-700/70 dark:bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">Start typing to search</CardTitle>
              <CardDescription className="dark:text-slate-300">
                Intelligent mode supports multi-disease queries, explanation prompts, and recommendation intent.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {searchError && query.trim() && (
          <Card className="border-rose-200 bg-rose-50/80">
            <CardHeader>
              <CardTitle className="text-xl text-rose-900">Search error</CardTitle>
              <CardDescription className="text-rose-700">{searchError}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {searchPayload?.recommendation && (
          <Card className="border-sky-200/80 bg-sky-50/80 dark:border-sky-500/40 dark:bg-sky-900/20">
            <CardHeader>
              <CardTitle className="text-xl text-sky-900 dark:text-sky-100">Recommendation</CardTitle>
              <CardDescription className="text-sky-800 dark:text-sky-200">
                {searchPayload.recommendation}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {searchPayload?.results?.length === 0 && query.trim() && !searchError && (
          <Card className="border-slate-200/70 bg-white/75 dark:border-slate-700/70 dark:bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">No diseases matched</CardTitle>
              <CardDescription className="dark:text-slate-300">
                Try a disease name, alias, or recommendation-style prompt.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <AnimatePresence mode="popLayout">
          {(searchPayload?.results ?? []).map((result, index) => (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, delay: index * 0.03 }}
            >
              {result.vaccines.length > 0 ? (
                <Card className="border-sky-100/80 bg-white/80 dark:border-sky-500/40 dark:bg-slate-900/72">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="text-sm font-medium">Vaccine Available</span>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${severityTone(result.severity)}`}
                      >
                        {result.severity}
                      </span>
                      {result.mandatory && (
                        <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:border-rose-700 dark:bg-rose-900/35 dark:text-rose-200">
                          mandatory
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-2xl text-slate-900 dark:text-slate-100">{result.disease}</CardTitle>
                    <CardDescription className="dark:text-slate-300">
                      {result.aliases.length ? `Aliases: ${result.aliases.join(", ")}` : "No aliases listed."}
                    </CardDescription>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Category: {result.category}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Match: {result.matchType} ({scoreToPercent(result.score)}% confidence)
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {result.vaccines.map((vaccine) => (
                      <div
                        key={vaccine.id}
                        className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-800/60"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {vaccine.name}
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Type: <span className="font-medium">{vaccine.type}</span> ({vaccine.vaccineType})
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Doses: <span className="font-medium">{vaccine.doses}</span>
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Schedule: <span className="font-medium">{vaccine.dosageSchedule}</span>
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Age group: <span className="font-medium">{vaccine.ageGroup}</span>
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Coverage: <span className="font-medium">{vaccine.coveragePercent ?? "N/A"}%</span>
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Region: <span className="font-medium">{vaccine.region ?? "N/A"}</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          Side effects: {vaccine.sideEffects.length ? vaccine.sideEffects.join(", ") : "Not listed"}
                        </p>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => saveDisease(result.id)}
                      className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      Save disease
                    </button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-amber-200/80 bg-warning/75 dark:border-amber-600/60 dark:bg-amber-900/30">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
                      <ShieldX className="h-5 w-5" />
                      <span className="text-sm font-semibold">No approved vaccine available.</span>
                    </div>
                    <CardTitle className="text-2xl text-amber-950 dark:text-amber-100">{result.disease}</CardTitle>
                    <CardDescription className="text-amber-900/80 dark:text-amber-200/80">
                      Category: {result.category} | Severity: {result.severity}
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </section>

      <footer className="mx-auto mt-auto w-full max-w-3xl pt-10 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Data is provided for vaccine intelligence exploration and is not medical advice.
        </p>
      </footer>
    </main>
  );
}
