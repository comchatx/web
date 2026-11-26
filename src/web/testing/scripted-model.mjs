// A scripted model provider on loopback, so a box runs a session with no paid call: OpenAI chat-completions and Anthropic Messages
// answers in SSE (and OpenAI Responses, for a maker's package that speaks it), and /providers naming those the rig names as reachable. A user message "CALL <tool> <json-args>" is answered with that tool call,
// which is how a turn runs a command inside the box's own session; any other message is answered "Done.".
// A call on a road the rig names as refusing the balance (`/providers/platform/…`) is answered 403 `balance_off`, as the proxy answers it.
// usage: node scripted-model.mjs <port> <request-log.jsonl> [<reachable providers, comma-separated>] [refuse-balance]
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";
const [port, log] = [Number(process.argv[2]), process.argv[3]];
const reachable = (process.argv[4] ?? "openrouter,anthropic").split(",");
const refuseBalance = process.argv[5] === "refuse-balance";
const textOf = (c) => typeof c === "string" ? c : (c ?? []).filter(b => b.type === "text").map(b => b.text).join("");
createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  if (req.method === "GET" && req.url === "/providers") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ providers: reachable })); }
  const path = req.url.split("?")[0]; const anth = path.endsWith("/messages"), oai = path.endsWith("/chat/completions"), resp = path.endsWith("/responses");
  if (!anth && !oai && !resp) { appendFileSync(log + ".other", `${req.method} ${req.url}\n`); res.writeHead(404); return res.end("{}"); }
  const body = JSON.parse(raw);
  // The Responses shape carries its turns in `input`; the rest of this script reads them as messages.
  if (resp) body.messages = (body.input ?? []).map((item) => item.type === "function_call_output" ? { role: "user", content: [{ type: "tool_result", content: item.output }] } : item.role === undefined ? { role: "assistant", content: [] } : { role: item.role, content: typeof item.content === "string" ? item.content : (item.content ?? []).map((part) => ({ type: "text", text: part.text ?? "" })) });
  // Which credential the request carried, by header name and the authorization's scheme alone, never its value.
  const credential = { headers: Object.keys(req.headers).filter((name) => /authorization|api-key|account/i.test(name)).sort(), scheme: String(req.headers.authorization ?? "").split(" ")[0] };
  if (refuseBalance && path.startsWith("/providers/platform/")) {
    appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), url: req.url, model: body.model, credential, refused: "balance_off", messages: body.messages }) + "\n");
    res.writeHead(403, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: { code: "balance_off", message: "balance_off: the balance is off for openai" } }));
  }
  const names = (body.tools ?? []).map(t => t.function?.name ?? t.name);
  // What the model may call in this request. A model that takes tool changes mid-conversation is sent every definition it ever had, the
  // later ones marked defer_loading, and tool_addition / tool_removal blocks in system messages say which of those are in force.
  const offered = new Set((body.tools ?? []).filter(t => t.defer_loading !== true).map(t => t.function?.name ?? t.name));
  for (const message of body.messages) if (message.role === "system" && Array.isArray(message.content)) for (const block of message.content) {
    if (block.type === "tool_addition") offered.add(block.tool.name);
    if (block.type === "tool_removal") offered.delete(block.tool.name);
  }
  appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), url: req.url, model: body.model, credential, tools: names, offered: [...offered], deferred: (body.tools ?? []).filter(t => t.defer_loading === true).map(t => t.name), messages: body.messages }) + "\n");
  appendFileSync(log + ".raw", raw + "\n");
  const last = body.messages.filter(x => x.role !== "system").at(-1);
  const m = last.role === "user" && !(Array.isArray(last.content) && last.content.some(b => b.type === "tool_result")) ? /^CALL (\S+) (.*)$/s.exec(textOf(last.content).trim()) : null;
  res.writeHead(200, { "content-type": "text/event-stream" });
  const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  if (anth) {
    ev("message_start", { message: { id: "msg_scripted", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
    if (m) { ev("content_block_start", { index: 0, content_block: { type: "tool_use", id: `toolu_${Date.now()}`, name: m[1], input: {} } }); ev("content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: m[2] } }); }
    else { ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }); ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: "Done." } }); }
    ev("content_block_stop", { index: 0 });
    ev("message_delta", { delta: { stop_reason: m ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } });
    ev("message_stop", {}); return res.end();
  }
  if (resp) {
    const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    const item = m ? { type: "function_call", id: "fc_scripted", call_id: `call_${Date.now()}`, name: m[1], arguments: m[2], status: "completed" }
      : { type: "message", id: "msg_scripted", role: "assistant", status: "completed", content: [{ type: "output_text", text: "Done.", annotations: [] }] };
    const response = { id: "resp_scripted", object: "response", model: body.model, status: "in_progress", output: [] };
    send("response.created", { response });
    send("response.output_item.added", { output_index: 0, item: m ? { ...item, arguments: "", status: "in_progress" } : { ...item, status: "in_progress", content: [] } });
    if (m) send("response.function_call_arguments.delta", { output_index: 0, item_id: item.id, delta: m[2] });
    else { send("response.content_part.added", { output_index: 0, item_id: item.id, content_index: 0, part: { type: "output_text", text: "", annotations: [] } }); send("response.output_text.delta", { output_index: 0, item_id: item.id, content_index: 0, delta: "Done." }); }
    if (m) send("response.function_call_arguments.done", { output_index: 0, item_id: item.id, arguments: m[2] });
    send("response.output_item.done", { output_index: 0, item });
    send("response.completed", { response: { ...response, status: "completed", output: [item], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } } });
    return res.end();
  }
  const delta = m ? { role: "assistant", tool_calls: [{ index: 0, id: `call-${Date.now()}`, type: "function", function: { name: m[1], arguments: m[2] } }] } : { role: "assistant", content: "Done." };
  const common = { id: "scripted", object: "chat.completion.chunk", created: 1, model: body.model };
  res.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
  res.write(`data: ${JSON.stringify({ ...common, choices: [{ index: 0, delta: {}, finish_reason: m ? "tool_calls" : "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })}\n\n`);
  res.end("data: [DONE]\n\n");
}).listen(port, "0.0.0.0", () => console.log(`model on ${port}`));
