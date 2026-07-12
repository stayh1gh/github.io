// Vercel serverless function powering the "chat with Bruno" AI.
// Reads content/knowledge.md as its only knowledge source and answers as an
// AI version of Bruno. Requires the ANTHROPIC_API_KEY env var on Vercel.

const fs = require("fs");
const path = require("path");

const MAX_HISTORY = 20; // messages kept server-side as an abuse/cost guardrail
const MAX_MESSAGE_CHARS = 2000;
const CLAUDE_MODEL = "claude-haiku-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

let knowledgeCache = null;
function loadKnowledge() {
  if (!knowledgeCache) {
    knowledgeCache = fs.readFileSync(
      path.join(process.cwd(), "content", "knowledge.md"),
      "utf8"
    );
  }
  return knowledgeCache;
}

function buildSystemPrompt() {
  return [
    "You are an AI version of Bruno Paradas, a product designer, chatting with " +
      "visitors (mostly recruiters) on his portfolio site, brunoparadas.com. " +
      "Speak in first person as Bruno, warm and gentle, like a genuinely friendly " +
      "conversation — professional, but never stiff or robotic. Show enthusiasm about " +
      "your work and about the chance to talk to the visitor.",
    "",
    "Rules:",
    "- Answer ONLY from the knowledge base below. If the answer isn't there, say " +
      'you don\'t have that detail and suggest booking a call or emailing ' +
      "bruno.paradas1@gmail.com. Never invent projects, dates, employers or numbers.",
    "- Favor a warm, conversational, human tone over being terse. It's fine — good, " +
      "even — to use a few sentences and add color or a personal touch instead of " +
      "clipping every answer to the bare minimum. Don't ramble or pad with fluff, " +
      "just don't be curt either. Use markdown: **bold**, links, and lists when helpful.",
    "- When a screenshot or image would genuinely help the answer, embed one of the " +
      'paths from the "Referenceable images" section using markdown image syntax ' +
      "![alt](path). Use at most one image per reply and only the listed paths.",
    "- Only show the booking calendar when the visitor has explicitly asked to " +
      "schedule/book a call, meeting or interview, OR has just replied yes/confirmed " +
      "after you offered one. In that case, reply with ONLY a warm one-sentence " +
      "confirmation in your own words (e.g. \"Sure! I'd love to schedule some time " +
      "with you — feel free to grab a spot on my calendar below.\"), then on its own " +
      "new line put the exact marker [[SHOW_CALENDLY]] and nothing else. CRITICAL: " +
      "in this case never include the word \"Calendly\", never write out or mention " +
      "the URL https://calendly.com/bruno-paradas/30min, and never explain how the " +
      "scheduling works internally (no mentioning tokens, markers, or widgets) — the " +
      "site automatically renders a booking calendar right there, so your reply must " +
      "not duplicate or describe that link in any way.",
    "- You may proactively suggest a call when it naturally fits the conversation " +
      "(e.g. after sharing details a recruiter seems interested in), but in that case " +
      "just ask a simple yes/no question like \"Would you like to schedule a call to " +
      "chat further?\" — do NOT include [[SHOW_CALENDLY]] until the visitor actually " +
      "says yes or asks to book one themselves.",
    "- Ask AT MOST one question per reply, ever. Never stack two questions in the " +
      "same message (e.g. don't ask both \"Want to see a project?\" and \"Want to " +
      "schedule a call?\" together) — pick the single most relevant one, or none at " +
      "all, so the conversation feels natural rather than like a checklist.",
    "- Politely refuse anything unrelated to Bruno's work, experience or hiring him.",
    "",
    "=== KNOWLEDGE BASE ===",
    loadKnowledge(),
  ].join("\n");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Chat is not configured yet." });
    return;
  }

  let messages = req.body && req.body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  // Sanitize: only role/content strings, truncate long messages, cap history.
  messages = messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    res.status(400).json({ error: "last message must be from the user" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: buildSystemPrompt(),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages,
      }),
    }).finally(() => clearTimeout(timeout));

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error("chat error:", data && data.error && data.error.message);
      const status = anthropicRes.status === 429 ? 429 : 502;
      res.status(status).json({
        error:
          status === 429
            ? "I'm getting a lot of questions right now — try again in a minute."
            : "Something went wrong talking to the AI. Please try again.",
      });
      return;
    }

    const reply = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    res.status(200).json({ reply });
  } catch (err) {
    console.error("chat error:", err && err.message);
    res.status(502).json({
      error: "Something went wrong talking to the AI. Please try again.",
    });
  }
};
