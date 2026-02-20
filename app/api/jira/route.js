import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/route.js";
import { getUserSettings } from "../../../src/lib/db.js";
import { buildConfig } from "../../../src/config.js";
import { JiraFetcher } from "../../../src/modules/jiraFetcher.js";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketUrl } = await request.json();

  if (!ticketUrl) {
    return Response.json({ error: "Missing ticketUrl" }, { status: 400 });
  }

  const tokens = await getUserSettings(session.user.id);
  let config;
  try {
    config = buildConfig(tokens);
  } catch {
    return Response.json({ error: "Missing required tokens in Settings" }, { status: 403 });
  }

  if (!config.jira.enabled) {
    return Response.json({ error: "Jira is not configured. Add Jira email and token in Settings." }, { status: 400 });
  }

  try {
    const fetcher = new JiraFetcher(config);
    const parsed = fetcher.parseTicketUrl(ticketUrl);

    if (!parsed) {
      return Response.json(
        { error: "Could not parse that Jira URL. Paste a full ticket link like https://company.atlassian.net/browse/PROJ-123." },
        { status: 400 }
      );
    }

    const ticket = await fetcher.fetchTicket(parsed.key, parsed.baseUrl);
    const description = fetcher.formatAsDescription(ticket);

    return Response.json({ ticket, description });
  } catch (err) {
    const message = err.message || "Unknown error";

    if (message.includes("404")) {
      return Response.json({
        error: `Ticket not found or access denied. Check your Jira credentials in Settings. (${message})`,
      }, { status: 500 });
    }

    if (message.includes("401") || message.includes("403")) {
      return Response.json({
        error: `Jira authentication failed. Verify your Jira credentials in Settings. (${message})`,
      }, { status: 500 });
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
