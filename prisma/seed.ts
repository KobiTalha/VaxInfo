import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedVaccine = {
  name: string;
  type: string;
  doses: string;
  coveragePercent: number;
  region: string;
  introductionYear: number;
};

type SeedDisease = {
  name: string;
  category: string;
  aliases: string[];
  vaccines?: SeedVaccine[];
};

const DISEASES: SeedDisease[] = [
  {
    name: "Measles",
    category: "viral",
    aliases: [],
    vaccines: [
      {
        name: "MMR",
        type: "Live attenuated",
        doses: "2 doses",
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
    vaccines: [
      {
        name: "MMR",
        type: "Live attenuated",
        doses: "2 doses",
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
    vaccines: [
      {
        name: "MMR",
        type: "Live attenuated",
        doses: "2 doses",
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
    vaccines: [
      {
        name: "DTP",
        type: "Toxoid",
        doses: "3 primary doses + boosters",
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
    vaccines: [
      {
        name: "DTP",
        type: "Toxoid",
        doses: "3 primary doses + boosters",
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
    vaccines: [
      {
        name: "DTP",
        type: "Inactivated / Acellular",
        doses: "3 primary doses + boosters",
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
    vaccines: [
      {
        name: "OPV",
        type: "Live attenuated",
        doses: "3 doses + campaigns",
        coveragePercent: 80,
        region: "Global",
        introductionYear: 1961
      },
      {
        name: "IPV",
        type: "Inactivated",
        doses: "2 to 4 doses",
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
    vaccines: [
      {
        name: "mRNA",
        type: "mRNA",
        doses: "Primary series + boosters",
        coveragePercent: 67,
        region: "Global",
        introductionYear: 2020
      },
      {
        name: "Viral Vector",
        type: "Viral vector",
        doses: "1 to 2 doses + boosters",
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
    vaccines: [
      {
        name: "BCG",
        type: "Live attenuated",
        doses: "Single neonatal dose",
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
    vaccines: [
      {
        name: "HepB",
        type: "Subunit",
        doses: "3 doses",
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
    vaccines: [
      {
        name: "HepA",
        type: "Inactivated",
        doses: "2 doses",
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
    vaccines: [
      {
        name: "HPV Subunit",
        type: "Subunit",
        doses: "1 to 2 doses",
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
    vaccines: [
      {
        name: "Seasonal Flu Inactivated",
        type: "Inactivated",
        doses: "Annual dose",
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
    vaccines: [
      {
        name: "Malaria Recombinant",
        type: "Recombinant",
        doses: "4 doses",
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
    vaccines: [
      {
        name: "Rabies Inactivated",
        type: "Inactivated",
        doses: "3 to 5 doses",
        coveragePercent: 30,
        region: "South-East Asia",
        introductionYear: 1967
      }
    ]
  },
  {
    name: "Common Cold",
    category: "viral",
    aliases: []
  },
  {
    name: "HIV/AIDS",
    category: "viral",
    aliases: []
  }
];

async function main() {
  await prisma.vaccine.deleteMany();
  await prisma.disease.deleteMany();

  for (const disease of DISEASES) {
    await prisma.disease.create({
      data: {
        name: disease.name,
        category: disease.category,
        aliases: disease.aliases,
        vaccines: disease.vaccines?.length
          ? {
              create: disease.vaccines
            }
          : undefined
      }
    });
  }
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
