// Vercel serverless function powering the "chat with Bruno" AI.
// Reads content/knowledge.md as its only knowledge source and answers as an
// AI version of Bruno. Requires the GROQ_API_KEY env var on Vercel (free
// tier at https://console.groq.com/keys).

const fs = require("fs");
const path = require("path");

const MAX_HISTORY = 20; // messages kept server-side as an abuse/cost guardrail
const MAX_MESSAGE_CHARS = 2000;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

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

function buildReviewPrompt() {
  return [
    "You are Bruno's careful editor. You'll see the VISITOR'S LAST MESSAGE and a " +
      "DRAFT reply his AI assistant is about to send in response. Check the draft " +
      "against these rules and fix any violation, otherwise leave it as-is:",
    "",
    "- No repetition: if two sentences say the same thing in different words (e.g. " +
      'both "I\'d love to schedule a call" and "Sure, let\'s schedule some time"), ' +
      "merge them into a single sentence.",
    "- At most ONE question in the whole reply. If the draft asks two different " +
      "questions (e.g. offering to show a project AND asking to schedule a call), " +
      "keep only the single most relevant one and remove or rephrase the other into " +
      "a plain statement, so the visitor is never asked to answer two things at once.",
    "- The marker [[SHOW_CALENDLY]] may ONLY appear if the visitor's last message " +
      "explicitly asked to schedule/book a call, meeting or interview, OR was a " +
      "clear yes/confirmation replying to an earlier offer to schedule one. If the " +
      "draft includes the marker but the visitor's last message does not meet that " +
      "bar, REMOVE the marker entirely and rewrite the ending as a simple, warm " +
      "yes/no question offering to schedule a call instead (do not show a calendar " +
      "in that case).",
    "- When the marker legitimately stays, everything before it must be exactly ONE " +
      "short, warm sentence confirming the call — never more than one — and it must " +
      "never mention the word \"Calendly\", the booking URL, or how the scheduling " +
      "mechanism works. The marker itself must stay on its own last line, exactly as " +
      "[[SHOW_CALENDLY]], unchanged.",
    "- Keep the same meaning, facts, tone, and any markdown (links, **bold**, " +
      "images) from the draft — don't add or remove information, don't invent " +
      "anything new, just tighten the wording.",
    "",
    "Output ONLY the corrected reply text. No preamble, no explanation, no quotes " +
      "around it — just the final text exactly as it should be sent to the visitor.",
  ].join("\n");
}

async function callGroq(apiKey, chatMessages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 1024,
        messages: chatMessages,
      }),
    });
    const data = await groqRes.json();
    if (!groqRes.ok) {
      return { ok: false, status: groqRes.status, error: data && data.error && data.error.message };
    }
    const text =
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
      "";
    return { ok: true, text };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
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

  const chatMessages = [
    { role: "system", content: buildSystemPrompt() },
    ...messages,
  ];

  try {
    const draft = await callGroq(apiKey, chatMessages);

    if (!draft.ok) {
      console.error("chat error:", draft.error);
      const status = draft.status === 429 ? 429 : 502;
      res.status(status).json({
        error:
          status === 429
            ? "I'm getting a lot of questions right now — try again in a minute."
            : "Something went wrong talking to the AI. Please try again.",
      });
      return;
    }

    // Self-review pass: catch repetition or rule slip-ups before sending the
    // reply out. If this second call fails for any reason, fall back to the
    // unreviewed draft rather than blocking the response.
    let reply = draft.text;
    try {
      const lastUserMessage = messages[messages.length - 1].content;
      const reviewed = await callGroq(apiKey, [
        { role: "system", content: buildReviewPrompt() },
        {
          role: "user",
          content:
            'VISITOR\'S LAST MESSAGE: "' +
            lastUserMessage +
            '"\n\nDRAFT:\n' +
            draft.text,
        },
      ]);
      if (reviewed.ok && reviewed.text.trim()) {
        reply = reviewed.text.trim();
      }
    } catch (reviewErr) {
      console.error("review pass failed, using draft:", reviewErr && reviewErr.message);
    }

    res.status(200).json({ reply });
  } catch (err) {
    console.error("chat error:", err && err.message);
    res.status(502).json({
      error: "Something went wrong talking to the AI. Please try again.",
    });
  }
};
