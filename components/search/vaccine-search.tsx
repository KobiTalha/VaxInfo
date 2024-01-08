"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import Fuse from "fuse.js";
import { LayoutDashboard, Moon, Search, ShieldCheck, ShieldX, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Vaccine = {
  id: number;
  name: string;
  type: string;
  doses: string;
  coveragePercent: number | null;
  region: string | null;
  introductionYear: number | null;
};

type Disease = {
  id: number;
  name: string;
  category: string;
  aliases: string[];
  hasVaccine: boolean;
  vaccines: Vaccine[];
};

type SearchResult = Disease & {
  score: number;
};

type SearchSuggestion = {
  name: string;
  score: number;
};

const ALIAS_MAP: Record<string, string> = {
  polio: "Poliomyelitis",
  corona: "COVID-19",
  covid: "COVID-19",
  flu: "Influenza",
  tb: "Tuberculosis",
  "whooping cough": "Pertussis"
};

function scoreToPercent(score: number) {
  return Math.max(0, Math.min(100, Math.round((1 - Math.min(score, 1)) * 100)));
}

export default function VaccineSearch() {
  const [query, setQuery] = useState("");
  const [dataset, setDataset] = useState<Disease[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem("vaxinfo-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = storedTheme ? storedTheme === "dark" : prefersDark;

    setIsDarkMode(shouldUseDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("vaxinfo-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    const fetchDiseases = async () => {
      try {
        const response = await fetch("/api/vaccines", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to fetch disease dataset");
        }

        const payload = (await response.json()) as { diseases: Disease[] };
        setDataset(payload.diseases ?? []);
      } catch (error) {
        console.error(error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiseases();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = window.setTimeout(() => setIsSearching(false), 220);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const normalizedQuery = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return "";
    }

    const lower = trimmed.toLowerCase();
    return ALIAS_MAP[lower] ?? trimmed;
  }, [query]);

  const fuse = useMemo(
    () =>
      new Fuse(dataset, {
        keys: ["name", "aliases"],
        threshold: 0.3,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2
      }),
    [dataset]
  );

  const fuzzyHintEngine = useMemo(
    () =>
      new Fuse(dataset, {
        keys: ["name", "aliases"],
        threshold: 0.45,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2
      }),
    [dataset]
  );

  const results = useMemo(() => {
    if (!normalizedQuery) {
      return [] as SearchResult[];
    }

    return fuse
      .search(normalizedQuery)
      .map((result) => ({
        ...result.item,
        score: result.score ?? 1
      }))
      .sort((a, b) => a.score - b.score);
  }, [fuse, normalizedQuery]);

  const relatedDiseaseMap = useMemo(() => {
    const relatedByDisease = new Map<number, string[]>();

    for (const disease of dataset) {
      const sharedVaccines = new Set(disease.vaccines.map((vaccine) => vaccine.name.toLowerCase()));
      if (sharedVaccines.size === 0) {
        relatedByDisease.set(disease.id, []);
        continue;
      }

      const related = dataset
        .filter(
          (candidate) =>
            candidate.id !== disease.id &&
            candidate.vaccines.some((candidateVaccine) =>
              sharedVaccines.has(candidateVaccine.name.toLowerCase())
            )
        )
        .map((candidate) => candidate.name)
        .slice(0, 3);

      relatedByDisease.set(disease.id, related);
    }

    return relatedByDisease;
  }, [dataset]);

  const suggestions = useMemo(() => {
    if (!query.trim()) {
      return [] as SearchSuggestion[];
    }

    const loweredInput = query.trim().toLowerCase();
    const inclusiveMatches = dataset
      .filter(
        (disease) =>
          disease.name.toLowerCase().includes(loweredInput) ||
          disease.aliases.some((alias) => alias.toLowerCase().includes(loweredInput))
      )
      .map((disease) => ({ name: disease.name, score: 0.45 }));

    const fuzzyMatches = fuse
      .search(normalizedQuery || loweredInput, { limit: 5 })
      .map((result) => ({
        name: result.item.name,
        score: result.score ?? 1
      }));

    const merged = new Map<string, number>();
    for (const candidate of [...inclusiveMatches, ...fuzzyMatches]) {
      const existingScore = merged.get(candidate.name);
      if (existingScore === undefined || candidate.score < existingScore) {
        merged.set(candidate.name, candidate.score);
      }
    }

    return [...merged.entries()]
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 6);
  }, [dataset, fuse, normalizedQuery, query]);

  const didYouMean = useMemo(() => {
    if (!query.trim() || results.length > 0) {
      return null;
    }

    return fuzzyHintEngine.search(normalizedQuery || query.trim(), { limit: 1 })[0]?.item.name ?? null;
  }, [fuzzyHintEngine, normalizedQuery, query, results.length]);

  const hasQuery = query.trim().length > 0;
  const showSpinner = isLoading || isSearching;
  const showSuggestions = !isLoading && hasQuery && suggestions.length > 0;

  const handlePickSuggestion = (name: string) => {
    setQuery(name);
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
            Medical Vaccine Lookup System
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
            Type a disease name to instantly find vaccine availability, approved vaccine names, and WHO-style metadata.
          </p>
        </motion.header>

        <div className="flex items-center gap-2">
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
            placeholder="Search disease (e.g. polio, covd, whooping cough)"
            className="h-14 rounded-2xl border border-white/60 bg-white/55 pl-12 pr-12 text-base dark:border-slate-700/70 dark:bg-slate-900/55"
            aria-label="Search disease"
          />

          {showSpinner && (
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
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-sky-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => handlePickSuggestion(suggestion.name)}
                  >
                    <span>{suggestion.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {scoreToPercent(suggestion.score)}% match
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {normalizedQuery !== query.trim() && hasQuery && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Smart alias match: interpreted as <span className="font-semibold text-slate-900 dark:text-slate-100">{normalizedQuery}</span>
          </p>
        )}
      </motion.section>

      <section className="mx-auto mt-8 w-full max-w-3xl">
        {isLoading && (
          <Card className="border-slate-200/70 bg-white/80 dark:border-slate-700/70 dark:bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                Loading vaccine dataset...
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        {isError && (
          <Card className="border-rose-200 bg-rose-50/80">
            <CardHeader>
              <CardTitle className="text-xl text-rose-900">Unable to load data</CardTitle>
              <CardDescription className="text-rose-700">
                Check database connectivity and try again.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!isLoading && !isError && (
          <AnimatePresence mode="wait">
            {!hasQuery ? (
              <motion.div
                key="hint"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-slate-200/70 bg-white/75 dark:border-slate-700/70 dark:bg-slate-900/70">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-900 dark:text-slate-100">Start typing to search</CardTitle>
                    <CardDescription className="dark:text-slate-300">
                      Smart suggestions and alias AI are enabled for terms like covid, polio, tb, flu, and whooping cough.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ) : results.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-slate-200/70 bg-white/75 dark:border-slate-700/70 dark:bg-slate-900/70">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-900 dark:text-slate-100">Disease not found in database.</CardTitle>
                    {didYouMean && (
                      <CardDescription className="text-slate-600 dark:text-slate-300">
                        Did you mean: <button type="button" onClick={() => handlePickSuggestion(didYouMean)} className="font-semibold text-sky-700 underline underline-offset-2 dark:text-sky-300">{didYouMean}</button>?
                      </CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                className="space-y-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {results.slice(0, 5).map((disease, index) => {
                  const relatedDiseases = relatedDiseaseMap.get(disease.id) ?? [];

                  return (
                    <motion.div
                      key={disease.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06, duration: 0.28 }}
                    >
                      {disease.hasVaccine ? (
                        <Card className="border-sky-100/80 bg-white/80 dark:border-sky-500/40 dark:bg-slate-900/72">
                          <CardHeader className="space-y-2">
                            <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                              <ShieldCheck className="h-5 w-5" />
                              <span className="text-sm font-medium">Vaccine Available</span>
                            </div>
                            <CardTitle className="text-2xl text-slate-900 dark:text-slate-100">{disease.name}</CardTitle>
                            <CardDescription className="dark:text-slate-300">
                              {disease.aliases.length
                                ? `Aliases: ${disease.aliases.join(", ")}`
                                : "No aliases listed."}
                            </CardDescription>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                              Category: {disease.category}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Ranking score: {disease.score.toFixed(3)} ({scoreToPercent(disease.score)}% relevance)
                            </p>
                          </CardHeader>
                          <CardContent className="grid gap-3">
                            {disease.vaccines.map((vaccine) => (
                              <div
                                key={vaccine.id}
                                className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-700/70 dark:bg-slate-800/60"
                              >
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  Vaccine Name: <span className="font-normal">{vaccine.name}</span>
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  Vaccine Type: <span className="font-medium">{vaccine.type}</span>
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  Doses: <span className="font-medium">{vaccine.doses}</span>
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  Coverage: <span className="font-medium">{vaccine.coveragePercent ?? "N/A"}%</span>
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  Region: <span className="font-medium">{vaccine.region ?? "N/A"}</span>
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  Introduction Year: <span className="font-medium">{vaccine.introductionYear ?? "N/A"}</span>
                                </p>
                              </div>
                            ))}

                            {relatedDiseases.length > 0 && (
                              <div className="rounded-xl border border-sky-100/90 bg-sky-50/70 px-4 py-3 dark:border-sky-500/30 dark:bg-sky-950/20">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  Related diseases
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {relatedDiseases.map((related) => (
                                    <button
                                      key={related}
                                      type="button"
                                      onClick={() => handlePickSuggestion(related)}
                                      className="rounded-full border border-sky-200/90 bg-white/80 px-3 py-1 text-xs font-medium text-sky-800 transition hover:bg-white dark:border-sky-400/40 dark:bg-sky-900/30 dark:text-sky-200"
                                    >
                                      {related}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="border-amber-200/80 bg-warning/75 dark:border-amber-600/60 dark:bg-amber-900/30">
                          <CardHeader>
                            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
                              <ShieldX className="h-5 w-5" />
                              <span className="text-sm font-semibold">No approved vaccine available.</span>
                            </div>
                            <CardTitle className="text-2xl text-amber-950 dark:text-amber-100">{disease.name}</CardTitle>
                            <CardDescription className="text-amber-900/80 dark:text-amber-200/80">
                              Category: {disease.category}
                            </CardDescription>
                            <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                              Ranking score: {disease.score.toFixed(3)} ({scoreToPercent(disease.score)}% relevance)
                            </p>
                          </CardHeader>
                        </Card>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </section>

      <footer className="mx-auto mt-auto w-full max-w-3xl pt-10 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Data structured from WHO reporting categories. Not medical advice.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          WHO immunization information context: reported cases and incidence, vaccination coverage, programme indicators, vaccine introduction status, and vaccination schedules.
        </p>
      </footer>
    </main>
  );
}
