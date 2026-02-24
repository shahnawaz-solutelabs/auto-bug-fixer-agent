import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/route.js";
import { getUserSettings } from "../../../src/lib/db.js";

export const runtime = "nodejs";

const SENTRY_BASE = "https://sentry.io/api/0";
const PAGE_SIZE = 5;

function parseLinkHeader(header) {
  if (!header) return {};
  const links = {};
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"(?:;\s*results="([^"]+)")?(?:;\s*cursor="([^"]+)")?/);
    if (match) {
      links[match[2]] = {
        url: match[1],
        results: match[3] === "true",
        cursor: match[4] || null,
      };
    }
  }
  return links;
}

export async function POST(request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await getUserSettings(session.user.id);
  const sentryToken = tokens.sentryToken || process.env.SENTRY_AUTH_TOKEN || "";

  if (!sentryToken) {
    return Response.json(
      { error: "Sentry auth token not configured. Add it in Settings." },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgSlug, projectSlug, cursor } = body;

  if (!orgSlug || !projectSlug) {
    return Response.json(
      { error: "Missing orgSlug or projectSlug" },
      { status: 400 }
    );
  }

  const url = new URL(`${SENTRY_BASE}/projects/${encodeURIComponent(orgSlug)}/${encodeURIComponent(projectSlug)}/issues/`);
  url.searchParams.set("query", "is:unresolved");
  url.searchParams.set("limit", String(PAGE_SIZE));
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${sentryToken}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      return Response.json(
        { error: "Sentry authentication failed. Check your Sentry auth token in Settings." },
        { status: 401 }
      );
    }

    if (res.status === 404) {
      return Response.json(
        { error: `Sentry project not found: ${orgSlug}/${projectSlug}. Verify the org and project slugs.` },
        { status: 404 }
      );
    }

    if (res.status === 429) {
      return Response.json(
        { error: "Sentry rate limit exceeded. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`Sentry API error [${res.status}]:`, errText);
      return Response.json(
        { error: `Sentry API error (${res.status})` },
        { status: res.status }
      );
    }

    const issues = await res.json();
    const linkHeader = res.headers.get("Link");
    const links = parseLinkHeader(linkHeader);
    const nextCursor = links.next?.results ? links.next.cursor : null;

    const mapped = issues.map((issue) => ({
      id: issue.id,
      shortId: issue.shortId,
      title: issue.title,
      culprit: issue.culprit || "",
      level: issue.level,
      status: issue.status,
      count: issue.count,
      userCount: issue.userCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      permalink: issue.permalink,
    }));

    return Response.json({ issues: mapped, nextCursor });
  } catch (err) {
    console.error("Sentry fetch error:", err);
    return Response.json(
      { error: "Failed to connect to Sentry. Check your network and try again." },
      { status: 500 }
    );
  }
}
