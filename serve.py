#!/usr/bin/env python3
"""Static file server for local preview.

Sends no-cache headers so edits to HTML/CSS/JS/images always show up on
reload — no hard-refresh needed. Run with: python3 serve.py [port]

Also emulates the production /api/chat serverless function so the AI chat
works locally: with ANTHROPIC_API_KEY set it calls the real Claude API
(mirroring api/chat.js); without it, it returns a canned mock reply so the
UI is still testable offline.
"""
import http.server
import json
import os
import socketserver
import sys
import urllib.request
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
ROOT = Path(__file__).resolve().parent

MOCK_REPLY = (
    "*(Local mock — set ANTHROPIC_API_KEY to talk to the real AI.)*\n\n"
    "Olá! I'm Bruno's AI. I have **8+ years** of product design experience — "
    "currently at BuzzFeed, previously Walmart Marketplace, Smartify, frete.com "
    "and more.\n\n![Smartify app screens](images/smartify/CZjpj7M4So9ps53GjuFUeDBQ.png)"
)


def build_system_prompt():
    knowledge = (ROOT / "content" / "knowledge.md").read_text(encoding="utf-8")
    # Keep in sync with api/chat.js
    return "\n".join([
        "You are an AI version of Bruno Paradas, a product designer, chatting with "
        "visitors (mostly recruiters) on his portfolio site, brunoparadas.com. "
        "Speak in first person as Bruno, in a friendly, concise, professional tone.",
        "",
        "Rules:",
        "- Answer ONLY from the knowledge base below. If the answer isn't there, say "
        "you don't have that detail and suggest booking a call or emailing "
        "bruno.paradas1@gmail.com. Never invent projects, dates, employers or numbers.",
        "- Keep answers short (1-3 short paragraphs). Use markdown: **bold**, links, "
        "and lists when helpful.",
        "- When a screenshot or image would genuinely help the answer, embed one of the "
        'paths from the "Referenceable images" section using markdown image syntax '
        "![alt](path). Use at most one image per reply and only the listed paths.",
        "- When the visitor wants to schedule a call, meeting or interview, briefly "
        "confirm and end your reply with the exact token [[SHOW_CALENDLY]] on its own "
        "line. Don't paste the Calendly URL as a link in that case; the site renders "
        "a booking widget in place of the token.",
        "- Politely refuse anything unrelated to Bruno's work, experience or hiring him.",
        "",
        "=== KNOWLEDGE BASE ===",
        knowledge,
    ])


def call_claude(messages):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        text = MOCK_REPLY
        if any("call" in m["content"].lower() or "schedule" in m["content"].lower()
               for m in messages if m["role"] == "user"):
            text = "Sounds great — pick a time that works for you below!\n\n[[SHOW_CALENDLY]]"
        return text
    body = json.dumps({
        "model": "claude-haiku-4-5",
        "max_tokens": 1024,
        "system": build_system_prompt(),
        "messages": messages[-20:],
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return "".join(b.get("text", "") for b in data["content"] if b.get("type") == "text")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            messages = [
                {"role": m["role"], "content": m["content"][:2000]}
                for m in payload.get("messages", [])
                if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str)
            ]
            if not messages or messages[-1]["role"] != "user":
                raise ValueError("last message must be from the user")
            reply = call_claude(messages)
            out = json.dumps({"reply": reply}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
        except Exception as exc:  # noqa: BLE001 — dev server, report everything
            out = json.dumps({"error": str(exc)}).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving on http://localhost:{PORT} (no-cache)")
        httpd.serve_forever()
