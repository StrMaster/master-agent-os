import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const { html, title } = await req.json();

    if (!html || typeof html !== "string") {
      return NextResponse.json(
        { error: "Missing HTML content." },
        { status: 400 }
      );
    }

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    await page.setContent(html, {
  waitUntil: "networkidle0",
});

    await page.evaluateHandle("document.fonts.ready").catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 1500));


    const pdf = await page.pdf({
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 }, // Pakeista į grynus skaičius 0
});

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${(title || "digital-product")
          .replace(/[^a-z0-9]/gi, "-")
          .toLowerCase()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF export error", error);

    return NextResponse.json(
      {
        error: "Failed to generate PDF.",
      },
      { status: 500 }
    );
  } finally {
    await browser?.close().catch(() => null);
  }
}
