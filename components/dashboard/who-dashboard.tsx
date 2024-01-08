"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BarChart3, Filter, Globe2, Moon, ShieldCheck, Sun, TrendingUp } from "lucide-react";
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

type RegionSummary = {
  region: string;
  avgCoverage: number;
  availabilityPercent: number;
  topVaccine: string;
};

type CategorySummary = {
  category: string;
  total: number;
  withVaccine: number;
};

type CoverageSegment = {
  label: string;
  count: number;
  percent: number;
  toneClassName: string;
};

type IntroductionBucket = {
  decade: string;
  count: number;
};

const WHO_REGIONS = [
  "Africa",
  "Americas",
  "South-East Asia",
  "Europe",
  "Eastern Mediterranean",
  "Western Pacific"
] as const;

function scoreTone(avgCoverage: number) {
  if (avgCoverage >= 80) {
    return "bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-600/30";
  }
  if (avgCoverage >= 60) {
    return "bg-sky-100 border-sky-200 dark:bg-sky-900/30 dark:border-sky-600/30";
  }
  if (avgCoverage >= 40) {
    return "bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-600/30";
  }
  return "bg-rose-100 border-rose-200 dark:bg-rose-900/30 dark:border-rose-600/30";
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatCategory(category: string) {
  return category
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export default function WhoDashboard() {
  const [dataset, setDataset] = useState<Disease[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("All regions");

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
          throw new Error("Failed to load dashboard dataset");
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

  const filteredDiseases = useMemo(() => {
    if (selectedRegion === "All regions") {
      return dataset;
    }

    return dataset.map((disease) => {
      const vaccines = disease.vaccines.filter(
        (vaccine) => vaccine.region === selectedRegion || vaccine.region === "Global"
      );

      return {
        ...disease,
        vaccines,
        hasVaccine: vaccines.length > 0
      };
    });
  }, [dataset, selectedRegion]);

  const scopedVaccines = useMemo(
    () => filteredDiseases.flatMap((disease) => disease.vaccines),
    [filteredDiseases]
  );

  const totalDiseases = filteredDiseases.length;

  const avgCoverage = useMemo(
    () => average(scopedVaccines.map((vaccine) => vaccine.coveragePercent ?? 0)),
    [scopedVaccines]
  );

  const vaccinatedDiseasesCount = useMemo(
    () => filteredDiseases.filter((disease) => disease.vaccines.length > 0).length,
    [filteredDiseases]
  );

  const availabilityPercent = totalDiseases
    ? Math.round((vaccinatedDiseasesCount / totalDiseases) * 100)
    : 0;

  const regionSummaries = useMemo<RegionSummary[]>(() => {
    return WHO_REGIONS.map((region) => {
      const regionDiseases = dataset.map((disease) => {
        const vaccines = disease.vaccines.filter(
          (vaccine) => vaccine.region === region || vaccine.region === "Global"
        );

        return {
          ...disease,
          vaccines
        };
      });

      const availableCount = regionDiseases.filter((disease) => disease.vaccines.length > 0).length;
      const regionVaccines = regionDiseases.flatMap((disease) => disease.vaccines);

      const topVaccine = regionVaccines
        .map((vaccine) => ({
          name: vaccine.name,
          coverage: vaccine.coveragePercent ?? 0
        }))
        .sort((a, b) => b.coverage - a.coverage)[0];

      return {
        region,
        avgCoverage: average(regionVaccines.map((vaccine) => vaccine.coveragePercent ?? 0)),
        availabilityPercent: dataset.length
          ? Math.round((availableCount / dataset.length) * 100)
          : 0,
        topVaccine: topVaccine
          ? `${topVaccine.name} (${topVaccine.coverage.toFixed(1)}%)`
          : "No vaccine data"
      };
    }).sort((a, b) => b.avgCoverage - a.avgCoverage);
  }, [dataset]);

  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const categoryMap = new Map<string, CategorySummary>();

    for (const disease of filteredDiseases) {
      const key = disease.category || "unknown";
      const current = categoryMap.get(key) ?? {
        category: key,
        total: 0,
        withVaccine: 0
      };

      current.total += 1;
      if (disease.vaccines.length > 0) {
        current.withVaccine += 1;
      }

      categoryMap.set(key, current);
    }

    return [...categoryMap.values()].sort((a, b) => b.total - a.total);
  }, [filteredDiseases]);

  const coverageSegments = useMemo<CoverageSegment[]>(() => {
    const segments = [
      {
        label: "High coverage (>=80%)",
        count: 0,
        percent: 0,
        toneClassName: "bg-emerald-500"
      },
      {
        label: "Moderate coverage (40%-79%)",
        count: 0,
        percent: 0,
        toneClassName: "bg-sky-500"
      },
      {
        label: "Low coverage (<40%)",
        count: 0,
        percent: 0,
        toneClassName: "bg-amber-500"
      }
    ];

    for (const vaccine of scopedVaccines) {
      const coverage = vaccine.coveragePercent ?? 0;
      if (coverage >= 80) {
        segments[0].count += 1;
      } else if (coverage >= 40) {
        segments[1].count += 1;
      } else {
        segments[2].count += 1;
      }
    }

    const total = scopedVaccines.length || 1;

    return segments.map((segment) => ({
      ...segment,
      percent: Math.round((segment.count / total) * 100)
    }));
  }, [scopedVaccines]);

  const introductionTimeline = useMemo<IntroductionBucket[]>(() => {
    const decadeMap = new Map<number, number>();

    for (const vaccine of scopedVaccines) {
      if (!vaccine.introductionYear) {
        continue;
      }

      const decade = Math.floor(vaccine.introductionYear / 10) * 10;
      decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1);
    }

    return [...decadeMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([decade, count]) => ({
        decade: `${decade}s`,
        count
      }));
  }, [scopedVaccines]);

  const topVaccines = useMemo(() => {
    return scopedVaccines
      .map((vaccine) => ({
        ...vaccine,
        coveragePercent: vaccine.coveragePercent ?? 0
      }))
      .sort((a, b) => b.coveragePercent - a.coveragePercent)
      .slice(0, 8);
  }, [scopedVaccines]);

  const insights = useMemo(() => {
    const topRegion = regionSummaries[0];
    const topCategory = categorySummaries[0];
    const lowCoverageSegment = coverageSegments[2];

    return [
      `Average vaccine coverage is ${avgCoverage.toFixed(1)}% in the current region scope.`,
      topRegion
        ? `${topRegion.region} leads regional average coverage at ${topRegion.avgCoverage.toFixed(1)}%.`
        : "Regional benchmark data is currently unavailable.",
      topCategory
        ? `${formatCategory(topCategory.category)} diseases are the largest category (${topCategory.total} tracked).`
        : "Category distribution is currently unavailable.",
      `${lowCoverageSegment.count} vaccines are in the low-coverage segment and need priority attention.`
    ];
  }, [avgCoverage, categorySummaries, coverageSegments, regionSummaries]);

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

        <button
          type="button"
          onClick={() => setIsDarkMode((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/60 bg-white/65 text-slate-700 shadow-sm backdrop-blur-lg transition hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100"
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
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
          Full Vaccine Intelligence Analytics
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
          Explore coverage, availability, category trends, and vaccine introduction timelines from WHO-structured records.
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
            <option value="All regions">All regions</option>
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
            <CardTitle>Loading WHO dashboard data...</CardTitle>
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
                  <CardTitle className="text-3xl">{avgCoverage.toFixed(1)}%</CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-emerald-100/80 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-900/20">
                <CardHeader>
                  <CardDescription>Vaccine Availability</CardDescription>
                  <CardTitle className="text-3xl">{availabilityPercent}%</CardTitle>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {vaccinatedDiseasesCount}/{totalDiseases} diseases
                  </p>
                </CardHeader>
              </Card>

              <Card className="border-violet-100/80 bg-violet-50/70 dark:border-violet-500/30 dark:bg-violet-900/20">
                <CardHeader>
                  <CardDescription>Tracked Vaccines</CardDescription>
                  <CardTitle className="text-3xl">{scopedVaccines.length}</CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-amber-100/80 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-900/20">
                <CardHeader>
                  <CardDescription>Low Coverage Watchlist</CardDescription>
                  <CardTitle className="text-3xl">{coverageSegments[2].count}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <TrendingUp className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  Automated Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {insights.map((insight) => (
                  <p
                    key={insight}
                    className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-700/70 dark:bg-slate-800/50 dark:text-slate-200"
                  >
                    {insight}
                  </p>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <ShieldCheck className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  Regional Performance Matrix
                </CardTitle>
                <CardDescription>
                  Region-level coverage and vaccine availability benchmark.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {regionSummaries.map((summary) => (
                  <div
                    key={summary.region}
                    className={`rounded-xl border p-4 ${scoreTone(summary.avgCoverage)} ${
                      selectedRegion === summary.region
                        ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-background"
                        : ""
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {summary.region}
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      Avg coverage: <span className="font-semibold">{summary.avgCoverage.toFixed(1)}%</span>
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Availability: <span className="font-semibold">{summary.availabilityPercent}%</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Top vaccine: {summary.topVaccine}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <BarChart3 className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                    Category Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {categorySummaries.map((category) => {
                    const percent = category.total ? Math.round((category.withVaccine / category.total) * 100) : 0;
                    return (
                      <div
                        key={category.category}
                        className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/50"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatCategory(category.category)}
                          </p>
                          <p className="text-slate-700 dark:text-slate-300">
                            {category.withVaccine}/{category.total}
                          </p>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-sky-500"
                            style={{ width: `${Math.max(4, percent)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                          Vaccine availability ratio: {percent}%
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="text-2xl">Coverage Segments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {coverageSegments.map((segment) => (
                    <div
                      key={segment.label}
                      className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/50"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{segment.label}</p>
                        <p className="text-slate-700 dark:text-slate-300">
                          {segment.count} ({segment.percent}%)
                        </p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={`h-full rounded-full ${segment.toneClassName}`}
                          style={{ width: `${Math.max(4, segment.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="text-2xl">Vaccine Introduction Timeline</CardTitle>
                  <CardDescription>
                    Count of vaccine entries grouped by introduction decade.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {introductionTimeline.length === 0 && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">No introduction year data available.</p>
                  )}

                  {introductionTimeline.map((bucket) => (
                    <div key={bucket.decade} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                        <p className="font-medium">{bucket.decade}</p>
                        <p>{bucket.count}</p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${Math.max(6, (bucket.count / (scopedVaccines.length || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/70 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="text-2xl">Top Coverage Vaccines</CardTitle>
                  <CardDescription>
                    Highest-coverage vaccines in the currently selected region scope.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topVaccines.map((vaccine) => (
                    <div
                      key={`${vaccine.name}-${vaccine.id}`}
                      className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/60"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{vaccine.name}</p>
                        <p className="text-slate-700 dark:text-slate-300">{vaccine.coveragePercent.toFixed(1)}%</p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${Math.max(4, vaccine.coveragePercent)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        Region: {vaccine.region ?? "N/A"} | Doses: {vaccine.doses}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </motion.section>
        </AnimatePresence>
      )}
    </main>
  );
}
