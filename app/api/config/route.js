export const runtime = "nodejs";

export async function GET() {
  const jiraEnabled = !!(
    process.env.JIRA_EMAIL &&
    process.env.JIRA_API_TOKEN
  );

  return Response.json({ jiraEnabled });
}
