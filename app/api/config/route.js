import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/route.js";
import { getUserSettings } from "../../../src/lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return Response.json({ jiraEnabled: false, hasTokens: false });
  }

  const tokens = await getUserSettings(session.user.id);
  const jiraEnabled = !!(tokens.jiraEmail && tokens.jiraToken);
  const hasTokens = !!(tokens.githubToken && tokens.anthropicKey);

  return Response.json({ jiraEnabled, hasTokens });
}
