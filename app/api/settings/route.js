import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/route.js";
import { getUserSettings, updateUserTokens } from "../../../src/lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await getUserSettings(session.user.id);

  return Response.json({
    githubToken: tokens.githubToken ? "••••" + tokens.githubToken.slice(-4) : "",
    anthropicKey: tokens.anthropicKey ? "••••" + tokens.anthropicKey.slice(-4) : "",
    jiraEmail: tokens.jiraEmail || "",
    jiraToken: tokens.jiraToken ? "••••" + tokens.jiraToken.slice(-4) : "",
    hasGithub: !!tokens.githubToken,
    hasAnthropic: !!tokens.anthropicKey,
    hasJira: !!(tokens.jiraEmail && tokens.jiraToken),
  });
}

export async function PUT(request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const existing = await getUserSettings(session.user.id);

  const tokens = {
    githubToken: body.githubToken?.startsWith("••••")
      ? existing.githubToken
      : (body.githubToken || existing.githubToken || ""),
    anthropicKey: body.anthropicKey?.startsWith("••••")
      ? existing.anthropicKey
      : (body.anthropicKey || existing.anthropicKey || ""),
    jiraEmail: body.jiraEmail ?? existing.jiraEmail ?? "",
    jiraToken: body.jiraToken?.startsWith("••••")
      ? existing.jiraToken
      : (body.jiraToken || existing.jiraToken || ""),
  };

  await updateUserTokens(session.user.id, tokens);

  return Response.json({ success: true });
}
