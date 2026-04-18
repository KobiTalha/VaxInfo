"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowLeft,
    BarChart3,
    Download,
    Filter,
    Globe2,
    LineChart,
    Moon,
    Share2,
    Sun,
    TrendingUp
} from "lucide-react";
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
  severity: string;
  mandatory: boolean;
  vaccines: Vaccine[];
};

type AnalyticsPayload = {
  search: {
    totalSearches: number;
    mostSearchedDiseases: Array<{ disease: string; count: number }>;
    regionDemand: Array<{ region: string; count: number }>;
    frequencyOverTime: Array<{ date: string; count: number }>;
  };
  userSnapshot: {
    preferredRegion: string | null;
    savedDiseases: Array<{
      id: number;
      name: string;
      severity: string;
      mandatory: boolean;
    }>;
  } | null;
};

const WHO_REGIONS = [
  "All regions",
  "Africa",
  "Americas",
  "South-East Asia",
  "Europe",
  "Eastern Mediterranean",
  "Western Pacific"
] as const;

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function WhoDashboard() {
  const [dataset, setDataset] = useState<Disease[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("All regions");
  const [hasCopiedShare, setHasCopiedShare] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem("vaxinfo-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = storedTheme ? storedTheme === "dark" : prefersDark;
    setIsDarkMode(shouldUseDark);

    const params = new URLSearchParams(window.location.search);
    const regionFromUrl = params.get("region");
    if (regionFromUrl && WHO_REGIONS.includes(regionFromUrl as (typeof WHO_REGIONS)[number])) {
      setSelectedRegion(regionFromUrl);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("vaxinfo-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setIsError(false);

      try {
        const [diseaseResponse, analyticsResponse] = await Promise.all([
          fetch("/api/vaccines?page=1&pageSize=300", { cache: "no-store" }),
          fetch("/api/analytics?days=30", { cache: "no-store" })
        ]);

        if (!diseaseResponse.ok || !analyticsResponse.ok) {
          throw new Error("Failed to load dashboard data");
        }

        const diseasePayload = (await diseaseResponse.json()) as {
          diseases: Disease[];
        };
        const analyticsPayload = (await analyticsResponse.json()) as AnalyticsPayload;

        setDataset(diseasePayload.diseases ?? []);
        setAnalytics(analyticsPayload);

        if (
          selectedRegion === "All regions" &&
          analyticsPayload.userSnapshot?.preferredRegion &&
          WHO_REGIONS.includes(
            analyticsPayload.userSnapshot.preferredRegion as (typeof WHO_REGIONS)[number]
          )
        ) {
          setSelectedRegion(analyticsPayload.userSnapshot.preferredRegion);
        }
      } catch {
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedRegion !== "All regions") {
      params.set("region", selectedRegion);
    } else {
      params.delete("region");
    }

    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);

    const syncPreference = async () => {
      await fetch("/api/user/dashboard-preference", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          preferredRegion: selectedRegion === "All regions" ? null : selectedRegion
        })
      }).catch(() => {
        // Preference is optional for unauthenticated users.
      });
    };

    if (!isLoading) {
      void syncPreference();
    }
  }, [isLoading, selectedRegion]);

  const filteredDiseases = useMemo(() => {
    if (selectedRegion === "All regions") {
      return dataset;
    }

    return dataset.map((disease) => ({
      ...disease,
      vaccines: disease.vaccines.filter(
        (vaccine) => vaccine.region === selectedRegion || vaccine.region === "Global"
      )
    }));
  }, [dataset, selectedRegion]);

  const scopedVaccines = useMemo(
    () => filteredDiseases.flatMap((disease) => disease.vaccines),
    [filteredDiseases]
  );

  const averageCoverage = useMemo(
    () => average(scopedVaccines.map((vaccine) => vaccine.coveragePercent ?? 0)),
    [scopedVaccines]
  );

  const availabilityPercent = useMemo(() => {
    if (filteredDiseases.length === 0) {
      return 0;
    }

    const withVaccines = filteredDiseases.filter((disease) => disease.vaccines.length > 0).length;
    return Math.round((withVaccines / filteredDiseases.length) * 100);
  }, [filteredDiseases]);

  const topCoverageVaccines = useMemo(
    () =>
      [...scopedVaccines]
        .sort((a, b) => (b.coveragePercent ?? 0) - (a.coveragePercent ?? 0))
        .slice(0, 6),
    [scopedVaccines]
  );

  const mostSearchedDisease = analytics?.search.mostSearchedDiseases[0] ?? null;
  const hottestRegion = analytics?.search.regionDemand[0] ?? null;

  const copyShareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    await navigator.clipboard.writeText(url);
    setHasCopiedShare(true);
    window.setTimeout(() => setHasCopiedShare(false), 1200);
  };

  const exportCsvUrl = `/api/dashboard/export?format=csv${
    selectedRegion !== "All regions" ? `&region=${encodeURIComponent(selectedRegion)}` : ""
  }`;

  const exportPdfUrl = `/api/dashboard/export?format=pdf${
    selectedRegion !== "All regions" ? `&region=${encodeURIComponent(selectedRegion)}` : ""
  }`;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-12 pt-10 md:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-lg transition hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyShareLink}
            className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-lg dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <Share2 className="h-4 w-4" />
            {hasCopiedShare ? "Copied" : "Share"}
          </button>

          <a
            href={exportCsvUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-lg dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <Download className="h-4 w-4" />
            CSV
          </a>

          <a
            href={exportPdfUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-lg dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100"
          >
            <Download className="h-4 w-4" />
            PDF
          </a>

          <button
            type="button"
            onClick={() => setIsDarkMode((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/60 bg-white/65 text-slate-700 shadow-sm backdrop-blur-lg transition hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-8"
      >
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 dark:border-sky-500/40 dark:bg-sky-900/30 dark:text-sky-200">
          <Globe2 className="h-3.5 w-3.5" />
          WHO Analytics Dashboard
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
          Production Vaccine Intelligence Dashboard
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
          Monitor vaccine availability, search demand trends, and personalized risk-focused insights.
        </p>
      </motion.header>

      <Card className="mb-6 border-white/60 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
        <CardContent className="pt-6">
          <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <Filter className="h-4 w-4" />
            Region filter
          </label>
          <select
            value={selectedRegion}
            onChange={(event) => setSelectedRegion(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {WHO_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Loading dashboard intelligence...</CardTitle>
          </CardHeader>
        </Card>
      )}

      {isError && (
        <Card className="border-rose-200 bg-rose-50/80">
          <CardHeader>
            <CardTitle className="text-rose-900">Unable to load dashboard data</CardTitle>
            <CardDescription className="text-rose-700">
              Check API and database connectivity.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && !isError && (
        <AnimatePresence mode="wait">
          <motion.section
            key={selectedRegion}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-sky-100/80 bg-sky-50/70 dark:border-sky-500/30 dark:bg-sky-900/20">
                <CardHeader>
                  <CardDescription>Average Coverage</CardDescription>
                  <CardTitle className="text-3xl">{averageCoverage.toFixed(1)}%</CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-emerald-100/80 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-900/20">
                <CardHeader>
                  <CardDescription>Availability</CardDescription>
                  <CardTitle className="text-3xl">{availabilityPercent}%</CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-violet-100/80 bg-violet-50/70 dark:border-violet-500/30 dark:bg-violet-900/20">
                <CardHeader>
                  <CardDescription>Total Searches (30d)</CardDescription>
                  <CardTitle className="text-3xl">{analytics?.search.totalSearches ?? 0}</CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-amber-100/80 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-900/20">
                <CardHeader>
                  <CardDescription>Most Searched Disease</CardDescription>
                  <CardTitle className="text-xl">
                    {mostSearchedDisease
                      ? `${mostSearchedDisease.disease} (${mostSearchedDisease.count})`
                      : "N/A"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <TrendingUp className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                    Region Demand Analytics
                  </CardTitle>
                  <CardDescription>
                    Top demand region: {hottestRegion ? `${hottestRegion.region} (${hottestRegion.count})` : "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(analytics?.search.regionDemand ?? []).slice(0, 8).map((item) => (
                    <div
                      key={item.region}
                      className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/50"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{item.region}</p>
                        <p className="text-slate-700 dark:text-slate-300">{item.count}</p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{
                            width: `${Math.max(
                              4,
                              Math.round(
                                (item.count /
                                  Math.max(1, (analytics?.search.regionDemand[0]?.count ?? 1))) *
                                  100
                              )
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <LineChart className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                    Search Frequency Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(analytics?.search.frequencyOverTime ?? []).slice(-10).map((point) => (
                    <div
                      key={point.date}
                      className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/50"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{point.date}</p>
                        <p className="text-slate-700 dark:text-slate-300">{point.count}</p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{
                            width: `${Math.max(
                              4,
                              Math.round(
                                (point.count /
                                  Math.max(
                                    1,
                                    ...((analytics?.search.frequencyOverTime ?? []).map((entry) => entry.count) || [1])
                                  )) *
                                  100
                              )
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <BarChart3 className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  Top Coverage Vaccines
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topCoverageVaccines.map((vaccine) => (
                  <div
                    key={`${vaccine.id}-${vaccine.name}`}
                    className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/50"
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{vaccine.name}</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      Coverage: {(vaccine.coveragePercent ?? 0).toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Region: {vaccine.region ?? "N/A"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {analytics?.userSnapshot?.savedDiseases && analytics.userSnapshot.savedDiseases.length > 0 && (
              <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
                <CardHeader>
                  <CardTitle>Your Saved Diseases</CardTitle>
                  <CardDescription>
                    Personalized snapshot for your profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {analytics.userSnapshot.savedDiseases.map((disease) => (
                    <span
                      key={disease.id}
                      className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {disease.name}
                    </span>
                  ))}
                </CardContent>
              </Card>
            )}
          </motion.section>
        </AnimatePresence>
      )}
    </main>
  );
}
