import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/route.js";
import {
  getConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  pushMessage as dbPushMessage,
} from "../../../src/lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const conv = await getConversation(id, session.user.id);
    if (!conv) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(conv);
  }

  const conversations = await getConversations(session.user.id);
  return Response.json(conversations);
}

export async function POST(request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "create") {
    const conv = await createConversation(session.user.id, body.title);
    return Response.json(conv);
  }

  if (body.action === "pushMessage" && body.conversationId) {
    await dbPushMessage(body.conversationId, session.user.id, body.message);
    return Response.json({ success: true });
  }

  if (body.action === "update" && body.conversationId) {
    await updateConversation(body.conversationId, session.user.id, body.updates);
    return Response.json({ success: true });
  }

  if (body.action === "delete" && body.conversationId) {
    await deleteConversation(body.conversationId, session.user.id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
