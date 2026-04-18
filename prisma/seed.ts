import { DiseaseSeverity, PrismaClient, VaccineType } from "@prisma/client";
import { createHash, randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@vaxinfo.dev";
const DEMO_PASSWORD = "demo12345";
const DEMO_API_KEY = "vax_demo_key_local_123456";

type SeedVaccine = {
  name: string;
  type: string;
  vaccineType: VaccineType;
  doses: string;
  dosageSchedule: string;
  ageGroup: string;
  sideEffects: string[];
  coveragePercent: number;
  region: string;
  introductionYear: number;
};

type SeedDisease = {
  name: string;
  category: string;
  aliases: string[];
  severity: DiseaseSeverity;
  mandatory: boolean;
  vaccines?: SeedVaccine[];
};

const DISEASES: SeedDisease[] = [
  {
    name: "Measles",
    category: "viral",
    aliases: [],
    severity: DiseaseSeverity.mandatory,
    mandatory: true,
    vaccines: [
      {
        name: "MMR",
        type: "Live attenuated",
        vaccineType: VaccineType.live,
        doses: "2 doses",
        dosageSchedule: "Dose 1 at 9-12 months, dose 2 at 15-18 months",
        ageGroup: "Infants and children",
        sideEffects: ["Mild fever", "Injection-site soreness", "Temporary rash"],
        coveragePercent: 83,
        region: "Africa",
        introductionYear: 1971
      }
    ]
  },
  {
    name: "Rubella",
    category: "viral",
    aliases: [],
    severity: DiseaseSeverity.moderate,
    mandatory: false,
    vaccines: [
      {
        name: "MMR",
        type: "Live attenuated",
        vaccineType: VaccineType.live,
        doses: "2 doses",
        dosageSchedule: "Dose 1 at 9-12 months, dose 2 at 15-18 months",
        ageGroup: "Children and adolescents",
        sideEffects: ["Mild fever", "Soreness", "Joint pain"],
        coveragePercent: 69,
        region: "Europe",
        introductionYear: 1971
      }
    ]
  },
  {
    name: "Mumps",
    category: "viral",
    aliases: [],
    severity: DiseaseSeverity.moderate,
    mandatory: false,
    vaccines: [
      {
        name: "MMR",
        type: "Live attenuated",
        vaccineType: VaccineType.live,
        doses: "2 doses",
        dosageSchedule: "Dose 1 at 9-12 months, dose 2 at 15-18 months",
        ageGroup: "Children and adolescents",
        sideEffects: ["Fever", "Parotid tenderness", "Injection-site soreness"],
        coveragePercent: 65,
        region: "Americas",
        introductionYear: 1971
      }
    ]
  },
  {
    name: "Diphtheria",
    category: "bacterial",
    aliases: [],
    severity: DiseaseSeverity.high_risk,
    mandatory: true,
    vaccines: [
      {
        name: "DTP",
        type: "Toxoid",
        vaccineType: VaccineType.toxoid,
        doses: "3 primary doses + boosters",
        dosageSchedule: "6, 10, 14 weeks with booster in childhood",
        ageGroup: "Infants and children",
        sideEffects: ["Mild fever", "Redness at site", "Irritability"],
        coveragePercent: 84,
        region: "Europe",
        introductionYear: 1949
      }
    ]
  },
  {
    name: "Tetanus",
    category: "bacterial",
    aliases: [],
    severity: DiseaseSeverity.high_risk,
    mandatory: true,
    vaccines: [
      {
        name: "DTP",
        type: "Toxoid",
        vaccineType: VaccineType.toxoid,
        doses: "3 primary doses + boosters",
        dosageSchedule: "Infancy doses with booster every 10 years",
        ageGroup: "All age groups",
        sideEffects: ["Localized pain", "Fatigue", "Low-grade fever"],
        coveragePercent: 84,
        region: "South-East Asia",
        introductionYear: 1949
      }
    ]
  },
  {
    name: "Pertussis",
    category: "bacterial",
    aliases: ["whooping cough"],
    severity: DiseaseSeverity.high_risk,
    mandatory: true,
    vaccines: [
      {
        name: "DTP",
        type: "Inactivated / Acellular",
        vaccineType: VaccineType.inactive,
        doses: "3 primary doses + boosters",
        dosageSchedule: "2, 4, 6 months with booster at 15-18 months",
        ageGroup: "Infants and children",
        sideEffects: ["Swelling at injection site", "Fever", "Drowsiness"],
        coveragePercent: 79,
        region: "Americas",
        introductionYear: 1949
      }
    ]
  },
  {
    name: "Poliomyelitis",
    category: "viral",
    aliases: ["polio"],
    severity: DiseaseSeverity.mandatory,
    mandatory: true,
    vaccines: [
      {
        name: "OPV",
        type: "Live attenuated",
        vaccineType: VaccineType.live,
        doses: "3 doses + campaigns",
        dosageSchedule: "Birth, 6, 10, 14 weeks plus campaigns",
        ageGroup: "Infants and children",
        sideEffects: ["Mild diarrhea", "Transient weakness"],
        coveragePercent: 80,
        region: "Global",
        introductionYear: 1961
      },
      {
        name: "IPV",
        type: "Inactivated",
        vaccineType: VaccineType.inactive,
        doses: "2 to 4 doses",
        dosageSchedule: "2, 4 months with booster at 4-6 years",
        ageGroup: "Infants, children, and travelers",
        sideEffects: ["Injection-site pain", "Mild fever"],
        coveragePercent: 80,
        region: "Western Pacific",
        introductionYear: 1955
      }
    ]
  },
  {
    name: "COVID-19",
    category: "viral",
    aliases: ["covid", "corona"],
    severity: DiseaseSeverity.high_risk,
    mandatory: false,
    vaccines: [
      {
        name: "mRNA",
        type: "mRNA",
        vaccineType: VaccineType.mrna,
        doses: "Primary series + boosters",
        dosageSchedule: "2-dose primary series with periodic boosters",
        ageGroup: "Adults and high-risk adolescents",
        sideEffects: ["Fatigue", "Headache", "Muscle pain"],
        coveragePercent: 67,
        region: "Global",
        introductionYear: 2020
      },
      {
        name: "Viral Vector",
        type: "Viral vector",
        vaccineType: VaccineType.vector,
        doses: "1 to 2 doses + boosters",
        dosageSchedule: "Single or double-dose regimen, booster per guidance",
        ageGroup: "Adults",
        sideEffects: ["Fever", "Injection-site pain", "Fatigue"],
        coveragePercent: 67,
        region: "Eastern Mediterranean",
        introductionYear: 2020
      }
    ]
  },
  {
    name: "Tuberculosis",
    category: "bacterial",
    aliases: ["tb"],
    severity: DiseaseSeverity.high_risk,
    mandatory: true,
    vaccines: [
      {
        name: "BCG",
        type: "Live attenuated",
        vaccineType: VaccineType.live,
        doses: "Single neonatal dose",
        dosageSchedule: "At birth",
        ageGroup: "Neonates",
        sideEffects: ["Local ulcer", "Scar formation", "Mild lymph node swelling"],
        coveragePercent: 86,
        region: "Global",
        introductionYear: 1921
      }
    ]
  },
  {
    name: "Hepatitis B",
    category: "viral",
    aliases: [],
    severity: DiseaseSeverity.high_risk,
    mandatory: true,
    vaccines: [
      {
        name: "HepB",
        type: "Subunit",
        vaccineType: VaccineType.subunit,
        doses: "3 doses",
        dosageSchedule: "Birth dose then at 6 and 14 weeks",
        ageGroup: "Neonates and adults at risk",
        sideEffects: ["Injection-site soreness", "Mild fever"],
        coveragePercent: 84,
        region: "Western Pacific",
        introductionYear: 1981
      }
    ]
  },
  {
    name: "Hepatitis A",
    category: "viral",
    aliases: [],
    severity: DiseaseSeverity.moderate,
    mandatory: false,
    vaccines: [
      {
        name: "HepA",
        type: "Inactivated",
        vaccineType: VaccineType.inactive,
        doses: "2 doses",
        dosageSchedule: "0 and 6-12 months",
        ageGroup: "Children and travelers",
        sideEffects: ["Headache", "Fatigue", "Injection-site pain"],
        coveragePercent: 47,
        region: "Eastern Mediterranean",
        introductionYear: 1995
      }
    ]
  },
  {
    name: "HPV",
    category: "viral",
    aliases: [],
    severity: DiseaseSeverity.moderate,
    mandatory: false,
    vaccines: [
      {
        name: "HPV Subunit",
        type: "Subunit",
        vaccineType: VaccineType.subunit,
        doses: "1 to 2 doses",
        dosageSchedule: "Single or two-dose regimen depending on age",
        ageGroup: "Adolescents",
        sideEffects: ["Injection-site swelling", "Headache", "Fatigue"],
        coveragePercent: 24,
        region: "Europe",
        introductionYear: 2006
      }
    ]
  },
  {
    name: "Influenza",
    category: "viral",
    aliases: ["flu"],
    severity: DiseaseSeverity.moderate,
    mandatory: false,
    vaccines: [
      {
        name: "Seasonal Flu Inactivated",
        type: "Inactivated",
        vaccineType: VaccineType.inactive,
        doses: "Annual dose",
        dosageSchedule: "One dose annually before seasonal peak",
        ageGroup: "Adults, elderly, and high-risk groups",
        sideEffects: ["Soreness", "Low fever", "Malaise"],
        coveragePercent: 42,
        region: "Americas",
        introductionYear: 1945
      }
    ]
  },
  {
    name: "Malaria",
    category: "parasitic",
    aliases: [],
    severity: DiseaseSeverity.high_risk,
    mandatory: false,
    vaccines: [
      {
        name: "Malaria Recombinant",
        type: "Recombinant",
        vaccineType: VaccineType.recombinant,
        doses: "4 doses",
        dosageSchedule: "Monthly for first 3 doses then booster",
        ageGroup: "Children in endemic zones",
        sideEffects: ["Fever", "Irritability", "Injection-site pain"],
        coveragePercent: 18,
        region: "Africa",
        introductionYear: 2021
      }
    ]
  },
  {
    name: "Rabies",
    category: "viral",
    aliases: [],
    severity: DiseaseSeverity.high_risk,
    mandatory: true,
    vaccines: [
      {
        name: "Rabies Inactivated",
        type: "Inactivated",
        vaccineType: VaccineType.inactive,
        doses: "3 to 5 doses",
        dosageSchedule: "Pre-exposure 0, 7, 21 days; booster as needed",
        ageGroup: "Travelers and high-risk occupational groups",
        sideEffects: ["Injection-site pain", "Headache", "Nausea"],
        coveragePercent: 30,
        region: "South-East Asia",
        introductionYear: 1967
      }
    ]
  },
  {
    name: "Common Cold",
    category: "viral",
    aliases: [],
    severity: DiseaseSeverity.low,
    mandatory: false
  },
  {
    name: "HIV/AIDS",
    category: "viral",
    aliases: [],
    severity: DiseaseSeverity.high_risk,
    mandatory: false
  }
];

function hashValue(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(value, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  await prisma.apiUsage.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.userDashboardPreference.deleteMany();
  await prisma.savedDisease.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.searchLog.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.errorLog.deleteMany();
  await prisma.vaccine.deleteMany();
  await prisma.disease.deleteMany();
  await prisma.user.deleteMany();

  for (const disease of DISEASES) {
    await prisma.disease.create({
      data: {
        name: disease.name,
        category: disease.category,
        aliases: disease.aliases,
        severity: disease.severity,
        mandatory: disease.mandatory,
        vaccines: disease.vaccines?.length
          ? {
              create: disease.vaccines
            }
          : undefined
      }
    });
  }

  const demoUser = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "VaxInfo Demo",
      passwordHash: hashValue(DEMO_PASSWORD),
      dashboardPreference: {
        create: {
          preferredRegion: "Global"
        }
      }
    }
  });

  const keyHash = hashApiKey(DEMO_API_KEY);
  await prisma.apiKey.create({
    data: {
      userId: demoUser.id,
      name: "Demo Local Key",
      keyHash,
      prefix: DEMO_API_KEY.slice(0, 10),
      rateLimitPerMinute: 120
    }
  });

  const savedDiseaseNames = ["Measles", "Poliomyelitis", "COVID-19"];
  const savedDiseases = await prisma.disease.findMany({
    where: {
      name: {
        in: savedDiseaseNames
      }
    },
    select: {
      id: true
    }
  });

  if (savedDiseases.length > 0) {
    await prisma.savedDisease.createMany({
      data: savedDiseases.map((disease) => ({
        userId: demoUser.id,
        diseaseId: disease.id
      }))
    });
  }

  const trackedDiseases = await prisma.disease.findMany({
    where: {
      name: {
        in: ["Measles", "Poliomyelitis", "COVID-19", "Rabies", "Influenza"]
      }
    },
    select: {
      id: true,
      name: true
    }
  });

  const diseaseByName = new Map(trackedDiseases.map((entry) => [entry.name, entry.id]));

  const now = Date.now();
  const logs = [
    { query: "measles vaccine", region: "Africa", disease: "Measles", offsetDays: 0 },
    { query: "measles and polio vaccines", region: "Global", disease: "Poliomyelitis", offsetDays: 0 },
    { query: "travel vaccine for rabies", region: "South-East Asia", disease: "Rabies", offsetDays: 1 },
    { query: "covid booster schedule", region: "Global", disease: "COVID-19", offsetDays: 1 },
    { query: "child vaccination schedule", region: "Africa", disease: "Measles", offsetDays: 2 },
    { query: "flu shot side effects", region: "Americas", disease: "Influenza", offsetDays: 2 },
    { query: "polio mandatory countries", region: "Western Pacific", disease: "Poliomyelitis", offsetDays: 3 },
    { query: "travel vaccines for europe", region: "Europe", disease: "Measles", offsetDays: 4 },
    { query: "why is mmr important", region: "Global", disease: "Measles", offsetDays: 5 },
    { query: "covid and flu recommendations", region: "Global", disease: "COVID-19", offsetDays: 5 }
  ];

  await prisma.searchLog.createMany({
    data: logs.map((entry) => ({
      query: entry.query,
      region: entry.region,
      diseaseId: diseaseByName.get(entry.disease) ?? null,
      userId: demoUser.id,
      createdAt: new Date(now - entry.offsetDays * 24 * 60 * 60 * 1000)
    }))
  });

  const chatSession = await prisma.chatSession.create({
    data: {
      userId: demoUser.id
    }
  });

  await prisma.chatMessage.createMany({
    data: [
      {
        sessionId: chatSession.id,
        role: "user",
        content: "Why is MMR important for children?",
        kind: "user_input"
      },
      {
        sessionId: chatSession.id,
        role: "assistant",
        content:
          "MMR protects against measles, mumps, and rubella. It reduces severe complications and supports herd protection among children.",
        kind: "explanation",
        disease: "Measles",
        score: 0
      }
    ]
  });

  console.log("Seed completed");
  console.log(`Demo user: ${DEMO_EMAIL}`);
  console.log(`Demo password: ${DEMO_PASSWORD}`);
  console.log(`Demo API key: ${DEMO_API_KEY}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
