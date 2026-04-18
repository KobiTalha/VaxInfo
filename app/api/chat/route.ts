import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guardApiRequest, trackApiUsage } from "@/lib/server/api-platform";
import { logServerError } from "@/lib/server/error-log";
import { recordSearchLog } from "@/lib/server/search-analytics";
import {
    buildRecommendationAnswer,
    detectIntent,
    detectRecommendationKind,
    extractRegionHint,
    formatSeverityTag,
    matchDiseasesFromQuery,
    normalizeText,
    type SearchDiseaseRecord
} from "@/lib/server/search-intelligence";
import Fuse from "fuse.js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AssistantKind =
  | "greeting"
  | "disease"
  | "explanation"
  | "recommendation"
  | "analytics"
  | "multi"
  | "fallback";

type ChatAssistantPayload = {
  answer: string;
  kind: AssistantKind;
  disease?: string;
  score?: number | null;
  matchedDiseaseIds?: number[];
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
  "I am your vaccine assistant. Ask me about diseases, vaccine schedules, side effects, travel recommendations, or regional coverage insights.";

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

function sanitizeSessionId(sessionId: string | null | undefined) {
  const cleaned = sessionId?.trim();
  return cleaned ? cleaned : null;
}

function getBoundedHistoryLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("limit") ?? "50");

  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(100, Math.max(1, Math.floor(value)));
}

function buildDiseaseAnswer(disease: SearchDiseaseRecord, allDiseases: SearchDiseaseRecord[]) {
  if (disease.vaccines.length === 0) {
    return `${disease.name} currently has no approved vaccine in this WHO-structured dataset.`;
  }

  const vaccineSummary = disease.vaccines
    .map((vaccine) => {
      const detailParts = [vaccine.type, vaccine.doses, `age: ${vaccine.ageGroup}`];
      if (vaccine.coveragePercent !== null) {
        detailParts.push(`${vaccine.coveragePercent}% coverage`);
      }
      if (vaccine.region) {
        detailParts.push(vaccine.region);
      }
      return `${vaccine.name} (${detailParts.join(", ")})`;
    })
    .join("; ");

  const relatedDiseases = allDiseases
    .filter((candidate) => {
      if (candidate.id === disease.id) {
        return false;
      }

      const vaccineSet = new Set(disease.vaccines.map((vaccine) => vaccine.name.toLowerCase()));
      return candidate.vaccines.some((candidateVaccine) => vaccineSet.has(candidateVaccine.name.toLowerCase()));
    })
    .map((candidate) => candidate.name)
    .slice(0, 3);

  const relatedText =
    relatedDiseases.length > 0
      ? ` Related diseases by shared vaccine: ${relatedDiseases.join(", ")}.`
      : "";

  const severity = formatSeverityTag(disease.severity, disease.mandatory);
  const mandatoryText = disease.mandatory ? " Mandatory status: yes." : "";

  return `For ${disease.name} (${severity}), vaccine options include ${vaccineSummary}.${mandatoryText}${relatedText}`;
}

function buildExplanationAnswer(disease: SearchDiseaseRecord) {
  const severity = formatSeverityTag(disease.severity, disease.mandatory);

  if (disease.vaccines.length === 0) {
    return `${disease.name} is tracked as ${severity}, but this dataset currently has no approved vaccine entry for it.`;
  }

  const rationale = disease.vaccines
    .slice(0, 2)
    .map(
      (vaccine) =>
        `${vaccine.name} is used because it targets ${disease.name} with ${vaccine.vaccineType.toUpperCase()} technology and follows ${vaccine.dosageSchedule}`
    )
    .join(". ");

  return `${disease.name} is considered ${severity}. ${rationale}. Protection helps lower severe outcomes and transmission risk.`;
}

function buildAnalyticsAnswer(diseases: SearchDiseaseRecord[], prompt: string) {
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

  const topVaccineText =
    topVaccines.length > 0
      ? topVaccines
          .map((vaccine) => `${vaccine.name} (${vaccine.coveragePercent.toFixed(1)}%)`)
          .join(", ")
      : "No ranked vaccine data";

  const regionText = selectedRegion
    ? ` in ${selectedRegion.replace(/\b\w/g, (char) => char.toUpperCase())}`
    : " globally";

  return `Analytics snapshot${regionText}: average coverage is ${avgCoverage.toFixed(1)}%, vaccine availability spans ${availableDiseaseCount}/${diseases.length} diseases, top coverage vaccines are ${topVaccineText}.`;
}

function splitUserPrompt(message: string) {
  const fromQuestions = message
    .split(/[?]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (fromQuestions.length > 1) {
    return fromQuestions;
  }

  const fromAnd = message
    .split(/\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return fromAnd.length > 1 ? fromAnd : [message.trim()];
}

function resolveContextDisease(
  segment: string,
  diseases: SearchDiseaseRecord[],
  historyMessages: string[]
) {
  const direct = matchDiseasesFromQuery(segment, diseases)[0];
  if (direct) {
    return direct;
  }

  const mergedHistory = historyMessages.join(" ").toLowerCase();
  return diseases.find((disease) => {
    const candidates = [disease.name, ...disease.aliases].map((value) => normalizeText(value));
    return candidates.some((candidate) => candidate && mergedHistory.includes(candidate));
  });
}

async function maybeGenerateLlmResponse(input: {
  userMessage: string;
  baselineAnswer: string;
  history: Array<{ role: string; content: string }>;
}) {
  if (process.env.VAXINFO_ENABLE_LLM !== "true") {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are VaxInfo assistant. Keep answers factual, concise, and vaccine-focused. Avoid medical diagnosis."
          },
          ...input.history.slice(-6),
          {
            role: "user",
            content: `User message: ${input.userMessage}\n\nStructured baseline answer: ${input.baselineAnswer}`
          }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}

async function getOrCreateSession(sessionId: string | null, userId: string | null) {
  if (sessionId) {
    const existing = await prisma.chatSession.findUnique({
      where: {
        id: sessionId
      }
    });

    if (existing) {
      if (userId && !existing.userId) {
        return prisma.chatSession.update({
          where: {
            id: existing.id
          },
          data: {
            userId
          }
        });
      }

      if (userId && existing.userId && existing.userId !== userId) {
        return prisma.chatSession.create({
          data: {
            userId
          }
        });
      }

      return existing;
    }
  }

  return prisma.chatSession.create({
    data: {
      userId: userId ?? undefined
    }
  });
}

async function buildAssistantPayload(
  message: string,
  diseases: SearchDiseaseRecord[],
  historyMessages: Array<{ role: string; content: string }>
): Promise<ChatAssistantPayload> {
  const lowerMessage = message.toLowerCase().trim();

  if (GREETING_WORDS.some((word) => lowerMessage === word || lowerMessage.startsWith(`${word} `))) {
    return {
      answer: INTRO_MESSAGE,
      kind: "greeting",
      matchedDiseaseIds: []
    };
  }

  const segments = splitUserPrompt(message);
  const answers: string[] = [];
  const matchedDiseaseIds = new Set<number>();
  let strongestKind: AssistantKind = "fallback";

  for (const segment of segments) {
    const intent = detectIntent(segment);
    const matched = matchDiseasesFromQuery(segment, diseases);
    const contextualDisease = resolveContextDisease(
      segment,
      diseases,
      historyMessages.map((entry) => entry.content)
    );

    const selectedDisease = matched[0] ?? contextualDisease ?? null;

    for (const disease of matched) {
      matchedDiseaseIds.add(disease.id);
    }

    if (intent === "analytics") {
      answers.push(buildAnalyticsAnswer(diseases, segment));
      strongestKind = strongestKind === "fallback" ? "analytics" : strongestKind;
      continue;
    }

    if (intent === "recommendation") {
      const recommendationType = detectRecommendationKind(segment);
      const regionHint = extractRegionHint(segment);
      const recommendationSource = matched.length > 0 ? matched : diseases;
      answers.push(
        buildRecommendationAnswer(recommendationType, recommendationSource.slice(0, 10), regionHint)
      );
      strongestKind = strongestKind === "fallback" ? "recommendation" : strongestKind;
      continue;
    }

    if (intent === "explanation") {
      if (selectedDisease) {
        matchedDiseaseIds.add(selectedDisease.id);
        answers.push(buildExplanationAnswer(selectedDisease));
        strongestKind = strongestKind === "fallback" ? "explanation" : strongestKind;
      } else {
        answers.push(
          "I can explain vaccine importance if you include a disease name, for example: Why is MMR important?"
        );
      }
      continue;
    }

    if (selectedDisease) {
      matchedDiseaseIds.add(selectedDisease.id);
      answers.push(buildDiseaseAnswer(selectedDisease, diseases));
      strongestKind = strongestKind === "fallback" ? "disease" : strongestKind;
      continue;
    }

    const fuse = new Fuse(diseases, {
      keys: ["name", "aliases", "vaccines.name", "vaccines.type", "category", "severity"],
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2
    });

    const fuzzy = fuse.search(segment, { limit: 1 })[0];
    if (fuzzy && (fuzzy.score ?? 1) <= 0.55) {
      matchedDiseaseIds.add(fuzzy.item.id);
      answers.push(buildDiseaseAnswer(fuzzy.item, diseases));
      strongestKind = strongestKind === "fallback" ? "disease" : strongestKind;
      continue;
    }

    answers.push(
      "I could not confidently map that request. Try asking with disease names like polio, measles, covid, rabies, or ask for travel recommendations."
    );
  }

  const joined = answers.join("\n\n");
  const llmAnswer = await maybeGenerateLlmResponse({
    userMessage: message,
    baselineAnswer: joined,
    history: historyMessages
  });

  const outputKind: AssistantKind = segments.length > 1 ? "multi" : strongestKind;

  return {
    answer: llmAnswer ?? joined,
    kind: outputKind,
    disease: undefined,
    score: null,
    matchedDiseaseIds: [...matchedDiseaseIds]
  };
}

export async function GET(request: NextRequest) {
  const authSession = await getAuthSession();
  const currentUserId = authSession?.user?.id ?? null;
  const sessionId = sanitizeSessionId(request.nextUrl.searchParams.get("sessionId"));
  const historyLimit = getBoundedHistoryLimit(request);

  if (!sessionId) {
    return NextResponse.json({ sessionId: null, introMessage: INTRO_MESSAGE, messages: [] }, { status: 200 });
  }

  try {
    const session = await prisma.chatSession.findUnique({
      where: {
        id: sessionId
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc"
          },
          take: historyLimit
        }
      }
    });

    if (!session) {
      return NextResponse.json({ sessionId: null, introMessage: INTRO_MESSAGE, messages: [] }, { status: 200 });
    }

    if (currentUserId && session.userId && session.userId !== currentUserId) {
      return NextResponse.json({ message: "Unauthorized chat session access." }, { status: 403 });
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
    await logServerError({
      path: request.nextUrl.pathname,
      method: "GET",
      message: error instanceof Error ? error.message : "Chat history API failed",
      stack: error instanceof Error ? error.stack : null,
      metadata: {
        sessionId,
        historyLimit
      }
    });

    return NextResponse.json({ message: "Unable to load chat history." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const apiGuard = await guardApiRequest(request, {
    endpoint: "/api/chat"
  });

  if (!apiGuard.ok) {
    return apiGuard.response;
  }

  const authSession = await getAuthSession();
  const currentUserId = authSession?.user?.id ?? apiGuard.context.userId ?? null;

  let message = "";
  let incomingSessionId: string | null = null;

  try {
    const body = (await request.json()) as ChatRequestBody;
    message = body.message?.trim() ?? "";
    incomingSessionId = sanitizeSessionId(body.sessionId);
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const finalize = async (body: unknown, status: number) => {
    await trackApiUsage({
      endpoint: "/api/chat",
      method: "POST",
      statusCode: status,
      apiKeyId: apiGuard.context.apiKeyId,
      ipAddress: apiGuard.context.ipAddress
    });

    return NextResponse.json(body, {
      status,
      headers: {
        "x-rate-limit-remaining": String(apiGuard.rateLimit.remaining),
        "x-rate-limit-reset": String(apiGuard.rateLimit.resetAt)
      }
    });
  };

  if (!message) {
    return finalize({ message: "Message is required." }, 400);
  }

  try {
    const diseases = (await prisma.disease.findMany({
      select: {
        id: true,
        name: true,
        aliases: true,
        category: true,
        severity: true,
        mandatory: true,
        vaccines: {
          select: {
            id: true,
            name: true,
            type: true,
            doses: true,
            dosageSchedule: true,
            ageGroup: true,
            sideEffects: true,
            vaccineType: true,
            coveragePercent: true,
            region: true,
            introductionYear: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    })) as SearchDiseaseRecord[];

    const session = await getOrCreateSession(incomingSessionId, currentUserId);

    const history = await prisma.chatMessage.findMany({
      where: {
        sessionId: session.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8,
      select: {
        role: true,
        content: true
      }
    });

    const assistant = await buildAssistantPayload(
      message,
      diseases,
      history.reverse().map((entry) => ({
        role: entry.role,
        content: entry.content
      }))
    );

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

    await recordSearchLog({
      query: message,
      region: extractRegionHint(message),
      userId: currentUserId,
      diseaseIds: assistant.matchedDiseaseIds ?? []
    });

    return finalize(
      {
        answer: assistant.answer,
        kind: assistant.kind,
        sessionId: session.id
      },
      200
    );
  } catch (error) {
    await logServerError({
      path: request.nextUrl.pathname,
      method: "POST",
      message: error instanceof Error ? error.message : "Chat API failed",
      stack: error instanceof Error ? error.stack : null,
      metadata: {
        hasSessionId: Boolean(incomingSessionId)
      }
    });

    return finalize({ message: "Unable to process chatbot request." }, 500);
  }
}
