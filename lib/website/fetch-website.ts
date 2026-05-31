export type FetchedWebsite = {
  url: string;
  finalUrl: string;
  status: number;
  title: string;
  metaDescription: string;
  headings: string[];
  links: string[];
  textContent: string;
  error?: string;
};

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Missing URL");
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function matchFirst(html: string, pattern: RegExp): string {
  return html.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function matchAll(html: string, pattern: RegExp): string[] {
  return Array.from(html.matchAll(pattern))
    .map((match) => stripHtml(match[1] ?? ""))
    .filter(Boolean)
    .slice(0, 20);
}

function extractLinks(html: string, baseUrl: string): string[] {
  const rawLinks = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => match[1])
    .filter(Boolean);

  const links = rawLinks
    .map((href) => {
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  return Array.from(new Set(links)).slice(0, 30);
}

export async function fetchWebsite(rawUrl: string): Promise<FetchedWebsite> {
  const url = normalizeUrl(rawUrl);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "MasterOS-WebsiteAnalyzer/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeout);

    const html = await response.text();
    const finalUrl = response.url || url;
    const title = matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription =
      matchFirst(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
      matchFirst(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
    const headings = matchAll(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
    const links = extractLinks(html, finalUrl);
    const textContent = stripHtml(html).slice(0, 12000);

    return {
      url,
      finalUrl,
      status: response.status,
      title,
      metaDescription,
      headings,
      links,
      textContent,
    };
  } catch (error) {
    return {
      url,
      finalUrl: url,
      status: 0,
      title: "",
      metaDescription: "",
      headings: [],
      links: [],
      textContent: "",
      error: error instanceof Error ? error.message : "Unknown website fetch error",
    };
  }
}
