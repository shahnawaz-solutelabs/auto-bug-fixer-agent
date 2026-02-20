import { JiraFetcher } from "../../../src/modules/jiraFetcher.js";

export const runtime = "nodejs";

export async function POST(request) {
  const { ticketUrl } = await request.json();

  if (!ticketUrl) {
    return Response.json({ error: "Missing ticketUrl" }, { status: 400 });
  }

  try {
    const fetcher = new JiraFetcher();
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
        error: `Ticket not found or access denied. Check that your JIRA_EMAIL and JIRA_API_TOKEN in .env are correct and have read access to this project. (${message})`,
      }, { status: 500 });
    }

    if (message.includes("401") || message.includes("403")) {
      return Response.json({
        error: `Jira authentication failed. Verify JIRA_EMAIL and JIRA_API_TOKEN in your .env file. (${message})`,
      }, { status: 500 });
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
