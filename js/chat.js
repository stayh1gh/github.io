// "Chat with Bruno" — shared logic for the home hero input and the chat page.
// Home: captures the question and hands off to chat.html.
// Chat page: renders the conversation and talks to /api/chat.

(function () {
  var CALENDLY_URL = "https://calendly.com/bruno-paradas/30min";
  var SEED_KEY = "bruno-chat-seed";
  var HISTORY_KEY = "bruno-chat-history";

  var isChatPage = document.body.classList.contains("chat-page");
  var form = document.getElementById("chat-box");
  var input = document.getElementById("chat-input");
  var chips = document.getElementById("chat-chips");
  var thread = document.getElementById("chat-thread");
  if (!form || !input) return;

  // The chat page doesn't load main.js, so apply the saved theme here.
  if (isChatPage) {
    try {
      if (localStorage.getItem("theme") === "light") {
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch (e) {
      /* ignore */
    }
  }

  /* ---------------- markdown-lite renderer ---------------- */

  function escapeHTML(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inlineMD(s) {
    // images — only local portfolio images are allowed
    s = s.replace(/!\[([^\]]*)\]\((images\/[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
    // links — http(s) and same-site pages only
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|project\.html[^)\s]*|resume\.pdf)\)/g, function (m, text, url) {
      var external = /^https?:/.test(url) ? ' target="_blank" rel="noopener"' : "";
      return '<a href="' + url + '"' + external + ">" + text + "</a>";
    });
    // bare URLs the model didn't wrap in markdown link syntax — auto-link them too
    // (skip if already inside an href="" or right after a tag, to avoid double-linking)
    s = s.replace(/(^|[^">(])\b(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, function (m, pre, url) {
      return pre + '<a href="' + url + '" target="_blank" rel="noopener">' + url + "</a>";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return s;
  }

  function renderMarkdown(text) {
    var blocks = escapeHTML(text.trim()).split(/\n{2,}/);
    return blocks
      .map(function (block) {
        var lines = block.split("\n");
        var isList = lines.every(function (l) {
          return /^\s*[-*]\s+/.test(l) || l.trim() === "";
        });
        if (isList && lines.length) {
          var items = lines
            .filter(function (l) { return l.trim() !== ""; })
            .map(function (l) { return "<li>" + inlineMD(l.replace(/^\s*[-*]\s+/, "")) + "</li>"; })
            .join("");
          return "<ul>" + items + "</ul>";
        }
        return "<p>" + inlineMD(block.replace(/\n/g, "<br />")) + "</p>";
      })
      .join("");
  }

  /* ---------------- shared input behavior ---------------- */

  function submitQuestion() {
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    if (isChatPage) {
      sendMessage(text);
    } else {
      try {
        sessionStorage.setItem(SEED_KEY, text);
      } catch (e) {
        /* ignore */
      }
      // Let the hero fade out briefly before navigating (see chat.css);
      // skipped for users who prefer reduced motion.
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        window.location.href = "chat.html";
        return;
      }
      document.body.classList.add("is-leaving");
      setTimeout(function () {
        window.location.href = "chat.html";
      }, 180);
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    submitQuestion();
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  });

  if (chips) {
    chips.addEventListener("click", function (e) {
      var chip = e.target.closest(".chat-chip");
      if (!chip) return;
      input.value = chip.textContent.trim();
      submitQuestion();
    });
  }

  if (!isChatPage) return;

  /* ---------------- chat page ---------------- */

  var history = []; // [{role, content}]
  try {
    history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
  } catch (e) {
    history = [];
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      /* ignore */
    }
  }

  function timeLabel() {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function scrollToBottom() {
    thread.scrollTop = thread.scrollHeight;
  }

  function appendUser(text) {
    var el = document.createElement("div");
    el.className = "chat-msg chat-msg--user";
    el.innerHTML =
      '<div class="chat-bubble"></div><span class="chat-msg-time">' + timeLabel() + "</span>";
    el.querySelector(".chat-bubble").textContent = text;
    thread.appendChild(el);
    scrollToBottom();
  }

  var COPY_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="9" width="12" height="12" rx="2"></rect>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

  // Reveals `el`'s text nodes gradually (structure/links/bold stay intact,
  // only the visible character count grows) to mimic a live-typed reply.
  function typewriterReveal(el, done) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue) {
        nodes.push({ node: node, full: node.nodeValue });
        node.nodeValue = "";
      }
    }
    var totalChars = nodes.reduce(function (sum, n) { return sum + n.full.length; }, 0);
    if (totalChars === 0) {
      done();
      return;
    }

    var CHARS_PER_SECOND = 260;
    var revealed = 0;
    var lastTime = null;

    function frame(ts) {
      if (lastTime == null) lastTime = ts;
      revealed += ((ts - lastTime) * CHARS_PER_SECOND) / 1000;
      lastTime = ts;

      var target = Math.floor(revealed);
      var cursor = 0;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var charsForNode = Math.max(0, Math.min(n.full.length, target - cursor));
        if (n.node.nodeValue.length !== charsForNode) {
          n.node.nodeValue = n.full.slice(0, charsForNode);
        }
        cursor += n.full.length;
      }
      scrollToBottom();

      if (target >= totalChars) {
        done();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // `instant` skips the typing animation — used when restoring past messages
  // (page refresh, back navigation) so only newly-arriving replies type out.
  function appendAssistant(text, instant) {
    var showCalendly = text.indexOf("[[SHOW_CALENDLY]]") !== -1;
    var clean = text.replace(/\[\[SHOW_CALENDLY\]\]/g, "").trim();

    var el = document.createElement("div");
    el.className = "chat-msg chat-msg--assistant";
    el.innerHTML = renderMarkdown(clean);
    thread.appendChild(el);

    function finish() {
      var copy = document.createElement("button");
      copy.className = "chat-copy";
      copy.type = "button";
      copy.setAttribute("aria-label", "Copy answer");
      copy.innerHTML = COPY_ICON;
      copy.addEventListener("click", function () {
        navigator.clipboard && navigator.clipboard.writeText(clean);
        copy.innerHTML = COPY_ICON + "<span>Copied!</span>";
        setTimeout(function () { copy.innerHTML = COPY_ICON; }, 1500);
      });
      el.appendChild(copy);

      if (showCalendly) mountCalendly(el);
      scrollToBottom();
    }

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant || reduceMotion) {
      finish();
    } else {
      typewriterReveal(el, finish);
    }
  }

  function mountCalendly(afterEl) {
    var holder = document.createElement("div");
    holder.className = "chat-calendly";
    holder.setAttribute("data-url", CALENDLY_URL);
    afterEl.appendChild(holder);

    function init() {
      if (window.Calendly) {
        window.Calendly.initInlineWidget({ url: CALENDLY_URL, parentElement: holder });
        scrollToBottom();
      }
    }
    if (window.Calendly) {
      init();
    } else {
      var s = document.createElement("script");
      s.src = "https://assets.calendly.com/assets/external/widget.js";
      s.async = true;
      s.onload = init;
      document.head.appendChild(s);
    }
  }

  var typingEl = null;
  function setTyping(on) {
    if (on && !typingEl) {
      typingEl = document.createElement("div");
      typingEl.className = "chat-msg chat-msg--assistant is-typing";
      typingEl.textContent = "Bruno is typing…";
      thread.appendChild(typingEl);
      scrollToBottom();
    } else if (!on && typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  var pending = false;
  function sendMessage(text) {
    if (pending) return;
    pending = true;
    document.getElementById("chat-send").disabled = true;

    appendUser(text);
    history.push({ role: "user", content: text });
    saveHistory();
    setTyping(true);

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Request failed");
          return data;
        });
      })
      .then(function (data) {
        setTyping(false);
        history.push({ role: "assistant", content: data.reply });
        saveHistory();
        appendAssistant(data.reply);
      })
      .catch(function (err) {
        setTyping(false);
        appendAssistant(
          (err && err.message ? err.message : "Something went wrong.") +
            " You can also just email me at **bruno.paradas1@gmail.com**."
        );
      })
      .then(function () {
        pending = false;
        document.getElementById("chat-send").disabled = false;
        input.focus();
      });
  }

  // A seed means the visitor deliberately started a new chat from the home
  // hero — reset any prior conversation so each new question begins clean.
  // (Refresh / back-navigation carries no seed, so an active chat is kept.)
  var seed = null;
  try {
    seed = sessionStorage.getItem(SEED_KEY);
    sessionStorage.removeItem(SEED_KEY);
  } catch (e) {
    /* ignore */
  }

  if (seed) {
    history = [];
    saveHistory();
    sendMessage(seed);
  } else {
    // Restore an existing conversation (back-button, refresh)…
    history.forEach(function (m) {
      if (m.role === "user") appendUser(m.content);
      else appendAssistant(m.content, true);
    });
    // …or greet a fresh visitor who landed directly on the chat page.
    if (history.length === 0) {
      appendAssistant(
        "Olá! I'm an AI version of Bruno. Ask me anything about his work, projects or " +
          "experience — or ask to **schedule a call** and I'll set it up."
      );
    }
  }

  input.focus();
})();
