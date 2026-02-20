import { getServerSession } from "next-auth";
import { getAuthOptions } from "../auth/[...nextauth]/route.js";
import { getUserSettings, hasRequiredTokens } from "../../../src/lib/db.js";
import { buildConfig } from "../../../src/config.js";
import { Orchestrator } from "../../../src/orchestrator.js";
import { pushMessage } from "../../../src/lib/db.js";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { owner, repo, description, conversationId } = await request.json();

  if (!owner || !repo || !description) {
    return new Response("Missing owner, repo, or description", { status: 400 });
  }

  const tokens = await getUserSettings(session.user.id);
  if (!hasRequiredTokens(tokens)) {
    return new Response("Missing required tokens. Please add GitHub and Anthropic tokens in Settings.", { status: 403 });
  }

  let config;
  try {
    config = buildConfig(tokens);
  } catch (err) {
    return new Response(err.message, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      function onProgress(label) {
        send({ type: "step", label });
      }

      function onStepDone() {
        send({ type: "step_done" });
      }

      try {
        const orchestrator = new Orchestrator(owner, repo, config);
        const result = await orchestrator.run(description, { onProgress, onStepDone });

        send({ type: "step_done" });
        send({ type: "result", data: result });

        if (conversationId) {
          await pushMessage(conversationId, session.user.id, {
            role: "agent",
            text: null,
            steps: [{ label: "Pipeline complete", status: "done" }],
            result,
          });
        }
      } catch (err) {
        send({ type: "error", message: err.message || "Unknown error" });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
