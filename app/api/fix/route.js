import { Orchestrator } from "../../../src/orchestrator.js";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request) {
  const { owner, repo, description } = await request.json();

  if (!owner || !repo || !description) {
    return new Response("Missing owner, repo, or description", { status: 400 });
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
        const orchestrator = new Orchestrator(owner, repo);
        const result = await orchestrator.run(description, { onProgress, onStepDone });

        send({ type: "step_done" });
        send({ type: "result", data: result });
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
