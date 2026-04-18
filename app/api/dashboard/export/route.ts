import { prisma } from "@/lib/prisma";
import { guardApiRequest, trackApiUsage } from "@/lib/server/api-platform";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type ExportRow = {
  disease: string;
  vaccine: string;
  vaccineType: string;
  coveragePercent: number | null;
  region: string | null;
  severity: string;
  mandatory: boolean;
};

function csvEscape(value: string | number | boolean | null | undefined) {
  const safe = value === null || value === undefined ? "" : String(value);
  if (!safe.includes(",") && !safe.includes("\"") && !safe.includes("\n")) {
    return safe;
  }

  return `"${safe.replace(/\"/g, '""')}"`;
}

async function buildPdfReport(rows: ExportRow[]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  let y = 560;
  page.drawText("VaxInfo Dashboard Export", {
    x: 40,
    y,
    size: 20,
    font,
    color: rgb(0.1, 0.2, 0.5)
  });

  y -= 30;
  page.drawText(`Generated at: ${new Date().toISOString()}`, {
    x: 40,
    y,
    size: 10,
    font,
    color: rgb(0.25, 0.25, 0.25)
  });

  y -= 24;
  const header = "Disease | Vaccine | Type | Coverage | Region | Severity";
  page.drawText(header, {
    x: 40,
    y,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });

  y -= 16;
  for (const row of rows.slice(0, 22)) {
    const line = `${row.disease ?? "-"} | ${row.vaccine ?? "-"} | ${row.vaccineType ?? "-"} | ${row.coveragePercent ?? "-"} | ${row.region ?? "-"} | ${row.severity ?? "-"}`;

    page.drawText(line.slice(0, 118), {
      x: 40,
      y,
      size: 9,
      font,
      color: rgb(0.18, 0.18, 0.18)
    });

    y -= 14;
    if (y < 36) {
      break;
    }
  }

  return pdf.save();
}

export async function GET(request: NextRequest) {
  const apiGuard = await guardApiRequest(request, {
    endpoint: "/api/dashboard/export"
  });

  if (!apiGuard.ok) {
    return apiGuard.response;
  }

  const format = (request.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  const region = request.nextUrl.searchParams.get("region")?.trim();

  const diseases = await prisma.disease.findMany({
    include: {
      vaccines: true
    },
    orderBy: {
      name: "asc"
    }
  });

  const rows: ExportRow[] = diseases.flatMap((disease): ExportRow[] => {
    const filteredVaccines = region
      ? disease.vaccines.filter(
          (vaccine) =>
            vaccine.region?.toLowerCase() === region.toLowerCase() ||
            vaccine.region?.toLowerCase() === "global"
        )
      : disease.vaccines;

    if (filteredVaccines.length === 0) {
      return [
        {
          disease: disease.name,
          vaccine: "N/A",
          vaccineType: "N/A",
          coveragePercent: null,
          region: region ?? "N/A",
          severity: String(disease.severity),
          mandatory: disease.mandatory
        }
      ];
    }

    return filteredVaccines.map((vaccine) => ({
      disease: disease.name,
      vaccine: vaccine.name,
      vaccineType: String(vaccine.vaccineType),
      coveragePercent: vaccine.coveragePercent,
      region: vaccine.region,
      severity: String(disease.severity),
      mandatory: disease.mandatory
    }));
  });

  await trackApiUsage({
    endpoint: "/api/dashboard/export",
    method: "GET",
    statusCode: 200,
    apiKeyId: apiGuard.context.apiKeyId,
    ipAddress: apiGuard.context.ipAddress
  });

  if (format === "pdf") {
    const bytes = await buildPdfReport(rows);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=dashboard-export.pdf"
      }
    });
  }

  const headers: Array<keyof ExportRow> = [
    "disease",
    "vaccine",
    "vaccineType",
    "coveragePercent",
    "region",
    "severity",
    "mandatory"
  ];

  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => csvEscape(row[header]))
        .join(",")
    )
  ];

  return new NextResponse(csvLines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=dashboard-export.csv"
    }
  });
}
