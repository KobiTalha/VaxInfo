import { prisma } from "@/lib/prisma";
import Fuse from "fuse.js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type VaccineRecord = {
  id: number;
  name: string;
  type: string;
  doses: string;
  coveragePercent: number | null;
  region: string | null;
  introductionYear: number | null;
};

type DiseaseRecord = {
  id: number;
  name: string;
  aliases: string[];
  category: string;
  vaccines: VaccineRecord[];
};

type AssistantKind = "greeting" | "disease" | "analytics" | "fallback";

type ChatAssistantPayload = {
  answer: string;
  kind: AssistantKind;
  disease?: string;
  score?: number | null;
};

type ChatRequestBody = {
  message?: string;
  sessionId?: string;
};

const WHO_REGIONS = [
  "africa",
  "americas",
  "south-east asia",
  "europe",
  "eastern mediterranean",
  "western pacific"
] as const;

const GREETING_WORDS = ["hi", "hello", "hey", "yo", "hola"];

const INTRO_MESSAGE =
  "I am your vaccine assistant. Ask me about a disease, coverage, top vaccines, or region-specific insights.";

const STOP_WORDS = new Set([
  "a",
  "an",
  "about",
  "any",
  "can",
  "do",
  "for",
  "give",
  "how",
  "i",
  "in",
  "is",
  "me",
  "of",
  "on",
  "show",
  "tell",
  "the",
  "to",
  "what",
  "with"
]);

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function findRegionInPrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  return WHO_REGIONS.find((region) => lower.includes(region)) ?? null;
}

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveDiseaseFromMessage(message: string, diseases: DiseaseRecord[]) {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) {
    return null;
  }

  const paddedMessage = ` ${normalizedMessage} `;
  let bestMatch: { disease: DiseaseRecord; overlapScore: number } | null = null;

  for (const disease of diseases) {
    const candidates = [disease.name, ...disease.aliases]
      .map((name) => normalizeText(name))
      .filter(Boolean);

    for (const candidate of candidates) {
      if (candidate.length < 3) {
        continue;
      }

      if (paddedMessage.includes(` ${candidate} `)) {
        return disease;
      }

      const candidateTokens = candidate.split(" ").filter((token) => token.length >= 3);
      const overlapCount = candidateTokens.filter((token) => paddedMessage.includes(` ${token} `)).length;

      if (overlapCount === 0 || candidateTokens.length === 0) {
        continue;
      }

      const overlapScore = overlapCount / candidateTokens.length;

      if (!bestMatch || overlapScore > bestMatch.overlapScore) {
        bestMatch = { disease, overlapScore };
      }
    }
  }

  return bestMatch && bestMatch.overlapScore >= 0.6 ? bestMatch.disease : null;
}

function extractSearchQueries(message: string) {
  const normalized = normalizeText(message);
  const tokenQuery = normalized
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    .join(" ");

  return [...new Set([message, normalized, tokenQuery].filter(Boolean))];
}

function buildDiseaseAnswer(disease: DiseaseRecord, allDiseases: DiseaseRecord[]) {
  if (disease.vaccines.length === 0) {
    return `${disease.name} currently has no approved vaccine in this WHO-structured dataset.`;
  }

  const vaccineSummary = disease.vaccines
    .map((vaccine) => {
      const detailParts = [vaccine.type, vaccine.doses];
      if (vaccine.coveragePercent !== null) {
        detailParts.push(`${vaccine.coveragePercent}% coverage`);
      }
      if (vaccine.region) {
        detailParts.push(vaccine.region);
      }
      return `${vaccine.name} (${detailParts.join(", ")})`;
    })
    .join("; ");

  const vaccineNameSet = new Set(disease.vaccines.map((vaccine) => vaccine.name.toLowerCase()));
  const relatedDiseases = allDiseases
    .filter(
      (candidate) =>
        candidate.id !== disease.id &&
        candidate.vaccines.some((candidateVaccine) =>
          vaccineNameSet.has(candidateVaccine.name.toLowerCase())
        )
    )
    .map((candidate) => candidate.name)
    .slice(0, 3);

  const relatedText =
    relatedDiseases.length > 0
      ? ` Related diseases by shared vaccine: ${relatedDiseases.join(", ")}.`
      : "";

  const aliasText =
    disease.aliases.length > 0
      ? ` Known aliases: ${disease.aliases.join(", ")}.`
      : "";

  return `For ${disease.name}, vaccine options include ${vaccineSummary}.${aliasText}${relatedText}`;
}

function buildAnalyticsAnswer(diseases: DiseaseRecord[], prompt: string) {
  const selectedRegion = findRegionInPrompt(prompt);

  const relevantVaccines = selectedRegion
    ? diseases.flatMap((disease) =>
        disease.vaccines.filter(
          (vaccine) =>
            vaccine.region?.toLowerCase() === selectedRegion ||
            vaccine.region?.toLowerCase() === "global"
        )
      )
    : diseases.flatMap((disease) => disease.vaccines);

  if (relevantVaccines.length === 0) {
    return "No vaccine analytics data is available for that region yet.";
  }

  const avgCoverage = average(
    relevantVaccines.map((vaccine) => vaccine.coveragePercent ?? 0)
  );

  const topVaccines = relevantVaccines
    .map((vaccine) => ({
      name: vaccine.name,
      coveragePercent: vaccine.coveragePercent ?? 0
    }))
    .sort((a, b) => b.coveragePercent - a.coveragePercent)
    .slice(0, 3);

  const availableDiseaseCount = selectedRegion
    ? diseases.filter((disease) =>
        disease.vaccines.some(
          (vaccine) =>
            vaccine.region?.toLowerCase() === selectedRegion ||
            vaccine.region?.toLowerCase() === "global"
        )
      ).length
    : diseases.filter((disease) => disease.vaccines.length > 0).length;

  const categoryCounts = new Map<string, number>();
  for (const disease of diseases) {
    const current = categoryCounts.get(disease.category) ?? 0;
    categoryCounts.set(disease.category, current + 1);
  }

  const topCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const topVaccineText =
    topVaccines.length > 0
      ? topVaccines
          .map((vaccine) => `${vaccine.name} (${vaccine.coveragePercent.toFixed(1)}%)`)
          .join(", ")
      : "No ranked vaccine data";

  const regionText = selectedRegion
    ? ` in ${selectedRegion.replace(/\b\w/g, (char) => char.toUpperCase())}`
    : " globally";

  return `Analytics snapshot${regionText}: average coverage is ${avgCoverage.toFixed(1)}%, vaccine availability spans ${availableDiseaseCount}/${diseases.length} diseases, top coverage vaccines are ${topVaccineText}. Dominant disease category is ${topCategory?.[0] ?? "unknown"}.`;
}

function buildAssistantPayload(message: string, diseases: DiseaseRecord[]): ChatAssistantPayload {
  const lowerMessage = message.toLowerCase();

  if (GREETING_WORDS.some((word) => lowerMessage === word || lowerMessage.startsWith(`${word} `))) {
    return {
      answer: INTRO_MESSAGE,
      kind: "greeting"
    };
  }

  const directDiseaseMatch = resolveDiseaseFromMessage(message, diseases);
  if (directDiseaseMatch) {
    return {
      answer: buildDiseaseAnswer(directDiseaseMatch, diseases),
      kind: "disease",
      disease: directDiseaseMatch.name,
      score: 0
    };
  }

  const analyticsIntentWords = ["coverage", "analytics", "dashboard", "region", "trend", "top vaccine"];
  const hasAnalyticsIntent = analyticsIntentWords.some((word) => lowerMessage.includes(word));

  if (hasAnalyticsIntent) {
    return {
      answer: buildAnalyticsAnswer(diseases, message),
      kind: "analytics"
    };
  }

  const fuse = new Fuse(diseases, {
    keys: ["name", "aliases", "vaccines.name", "vaccines.type", "category"],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2
  });

  const bestMatch = extractSearchQueries(message)
    .map((query) => fuse.search(query, { limit: 1 })[0])
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))[0];

  if (bestMatch && (bestMatch.score ?? 1) <= 0.55) {
    return {
      answer: buildDiseaseAnswer(bestMatch.item, diseases),
      kind: "disease",
      disease: bestMatch.item.name,
      score: bestMatch.score ?? null
    };
  }

  return {
    answer:
      "I could not confidently map that request yet. Try asking with a disease name such as polio, measles, covid, flu, or ask for coverage analytics by region.",
    kind: "fallback"
  };
}

function sanitizeSessionId(sessionId: string | null | undefined) {
  const cleaned = sessionId?.trim();
  return cleaned ? cleaned : null;
}

async function getOrCreateSession(sessionId: string | null) {
  if (sessionId) {
    const existing = await prisma.chatSession.findUnique({
      where: {
        id: sessionId
      }
    });

    if (existing) {
      return existing;
    }
  }

  return prisma.chatSession.create({
    data: {}
  });
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = sanitizeSessionId(request.nextUrl.searchParams.get("sessionId"));

    if (!sessionId) {
      return NextResponse.json({ sessionId: null, introMessage: INTRO_MESSAGE, messages: [] }, { status: 200 });
    }

    const session = await prisma.chatSession.findUnique({
      where: {
        id: sessionId
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc"
          },
          take: 200
        }
      }
    });

    if (!session) {
      return NextResponse.json({ sessionId: null, introMessage: INTRO_MESSAGE, messages: [] }, { status: 200 });
    }

    return NextResponse.json(
      {
        sessionId: session.id,
        introMessage: INTRO_MESSAGE,
        messages: session.messages.map((message) => ({
          id: message.id,
          role: message.role === "user" ? "user" : "assistant",
          content: message.content,
          createdAt: message.createdAt.toISOString()
        }))
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Chat history API failed", error);
    return NextResponse.json(
      { message: "Unable to load chat history." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let message = "";
  let incomingSessionId: string | null = null;

  try {
    const body = (await request.json()) as ChatRequestBody;
    message = body.message?.trim() ?? "";
    incomingSessionId = sanitizeSessionId(body.sessionId);
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  if (!message) {
    return NextResponse.json(
      { message: "Message is required." },
      { status: 400 }
    );
  }

  try {
    const diseases = (await prisma.disease.findMany({
      include: {
        vaccines: true
      },
      orderBy: {
        name: "asc"
      }
    })) as DiseaseRecord[];

    const assistant = buildAssistantPayload(message, diseases);
    const session = await getOrCreateSession(incomingSessionId);

    await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "user",
          content: message,
          kind: "user_input"
        }
      }),
      prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: assistant.answer,
          kind: assistant.kind,
          disease: assistant.disease ?? null,
          score: assistant.score ?? null
        }
      })
    ]);

    return NextResponse.json(
      {
        ...assistant,
        sessionId: session.id
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Chat API failed", error);
    return NextResponse.json(
      { message: "Unable to process chatbot request." },
      { status: 500 }
    );
  }
}
