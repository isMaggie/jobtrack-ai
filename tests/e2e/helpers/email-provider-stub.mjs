import { createServer } from "node:http";

export async function startEmailProvider() {
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    const email = input.input?.find((message) => message.role === "user")?.content;
    if (request.method !== "POST" || request.url !== "/v1/responses" ||
        !["E2E confirmation email", "E2E interview email"].includes(email)) {
      response.writeHead(400).end("Unexpected fake provider request");
      return;
    }
    const draft = { emailType: email === "E2E confirmation email" ? "APPLICATION_CONFIRMATION" : "INTERVIEW",
      company: "Example Company", position: "Engineer", appliedDate: "2026-10-07",
      jobUrl: null, jobDescription: null };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ id: "resp_e2e", object: "response", status: "completed",
      output: [{ id: "msg_e2e", type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(draft), annotations: [] }] }] }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(3101, "127.0.0.1", resolve);
  });
  return server;
}
