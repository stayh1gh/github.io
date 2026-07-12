// Renders the featured work cards, career list, "other stuff" gallery,
// footer links, and wires up the theme toggle.

function placeholderHTML(dark) {
  return (
    '<div class="placeholder' + (dark ? " placeholder--dark" : "") + '">' +
    "<span>Image coming soon</span></div>"
  );
}

function mediaHTML(image, alt, dark, opts) {
  if (image) {
    opts = opts || {};
    const styles = [];
    if (opts.position) styles.push("object-position:" + opts.position);
    if (opts.fit) styles.push("object-fit:" + opts.fit);
    if (opts.bg) styles.push("background:" + opts.bg);
    const style = styles.length ? ' style="' + styles.join(";") + '"' : "";
    return '<img src="' + image + '" alt="' + alt + '" loading="lazy"' + style + " />";
  }
  return placeholderHTML(dark);
}

const ARROW_RIGHT =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M5 12h14M13 6l6 6-6 6"></path></svg>';

// Large featured project cards (the "Recent work" section).
function renderFeatures() {
  const el = document.getElementById("work-cards");
  if (!el) return;
  el.style.setProperty("--n", PROJECTS.length);
  el.innerHTML = PROJECTS.map(function (p, i) {
    const c = p.card || {};
    const style =
      ' style="--i:' + i + ";--card-bg:" + (c.bg || "#242424") +
      ";--card-fg:" + (c.fg || "#ffffff") + '"';

    if (c.full) {
      return (
        '<a class="feature feature--full" href="project.html?project=' + p.slug + '"' + style +
          ' aria-label="' + p.title + ' — view case study">' +
          '<img class="feature-bg" src="' + c.full + '" alt="' + p.title + '" loading="lazy" />' +
          '<span class="feature-btn">Learn more ' + ARROW_RIGHT + "</span>" +
        "</a>"
      );
    }

    const logo = c.logo
      ? '<img class="feature-logo" src="' + c.logo + '" alt="' + p.title + ' logo" />'
      : "";
    const heading = c.title || p.title;
    const tags = (c.tags || [])
      .map(function (t) { return '<span>' + t + "</span>"; })
      .join("");
    const tagsHTML = tags ? '<div class="feature-tags">' + tags + "</div>" : "";

    if (c.bgImage) {
      return (
        '<a class="feature feature--bg" href="project.html?project=' + p.slug + '"' + style +
          ' aria-label="' + p.title + ' — view case study">' +
          '<img class="feature-bg" src="' + c.bgImage + '" alt="' + p.title + '" loading="lazy" />' +
          '<div class="feature-copy">' +
            logo +
            '<div class="feature-text">' +
              '<h3 class="feature-title">' + heading + "</h3>" +
              '<p class="feature-tagline">' + (c.tagline || p.description) + "</p>" +
            "</div>" +
            '<span class="feature-btn">Learn more ' + ARROW_RIGHT + "</span>" +
          "</div>" +
          tagsHTML +
        "</a>"
      );
    }

    if (c.phone || c.screen) {
      const mediaSrc = c.phone || c.screen;
      const mediaMod = c.phone ? "feature-media--phone" : "feature-media--screen";
      const featureMod = c.phone ? "feature--phone" : "feature--screen";
      return (
        '<a class="feature ' + featureMod + '" href="project.html?project=' + p.slug + '"' + style +
          ' aria-label="' + p.title + ' — view case study">' +
          '<div class="feature-copy">' +
            logo +
            '<div class="feature-text">' +
              '<h3 class="feature-title">' + heading + "</h3>" +
              '<p class="feature-tagline">' + (c.tagline || p.description) + "</p>" +
            "</div>" +
            '<span class="feature-btn">Learn more ' + ARROW_RIGHT + "</span>" +
          "</div>" +
          tagsHTML +
          '<div class="feature-media ' + mediaMod + '">' +
            '<img src="' + mediaSrc + '" alt="' + p.title + ' app screen" loading="lazy" />' +
          "</div>" +
        "</a>"
      );
    }

    const media = mediaHTML(c.image || p.image, p.title, true, {
      position: c.imagePosition || p.imagePosition,
      fit: c.imageFit || p.imageFit,
    });
    return (
      '<a class="feature" href="project.html?project=' + p.slug + '"' + style +
        ' aria-label="' + p.title + ' — view case study">' +
        '<div class="feature-copy">' +
          logo +
          '<div class="feature-text">' +
            '<h3 class="feature-title">' + heading + "</h3>" +
            '<p class="feature-tagline">' + (c.tagline || p.description) + "</p>" +
          "</div>" +
          '<span class="feature-btn">Learn more ' + ARROW_RIGHT + "</span>" +
        "</div>" +
        tagsHTML +
        '<div class="feature-media">' + media + "</div>" +
      "</a>"
    );
  }).join("");
}

function renderCareer() {
  document.getElementById("career-list").innerHTML = CAREER.map(function (job) {
    const logoClass = job.logoClass ? " " + job.logoClass : "";
    const img = '<img src="' + job.logo + '" alt="' + job.company + ' logo" loading="lazy" />';
    let logoInner;
    if (/\blogo--mask\b/.test(job.logoClass || "")) {
      logoInner =
        '<span class="logo-mask" role="img" aria-label="' + job.company +
        ' logo" style="-webkit-mask-image:url(' + job.logo +
        ');mask-image:url(' + job.logo + ')"></span>';
    } else {
      logoInner = img;
    }
    return (
      '<div class="career-row">' +
        '<div class="who">' +
          '<div class="logo-box' + logoClass + '">' + logoInner + "</div>" +
          '<div class="meta">' +
            '<div class="company">' + job.company + "</div>" +
            '<div class="sub">' +
              "<span>" + job.role + "</span>" +
              '<span class="sep"></span>' +
              "<span>" + job.location + "</span>" +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="period">' + job.period + "</div>" +
      "</div>"
    );
  }).join("");
}

// Lays out tiles in the design's repeating pattern:
// full-width, two halves, three thirds, full-width.
function renderGallery(container, items, altPrefix) {
  const PATTERN = [
    { count: 1, cls: "tile--full" },
    { count: 2, cls: "tile--half" },
    { count: 3, cls: "tile--third" },
    { count: 1, cls: "tile--full" },
  ];
  let html = "";
  let i = 0;
  let step = 0;
  while (i < items.length) {
    const block = PATTERN[step % PATTERN.length];
    const rowItems = items.slice(i, i + block.count);
    html +=
      '<div class="row">' +
      rowItems
        .map(function (item, j) {
          const alt = item.title || altPrefix + " image " + (i + j + 1);
          const tag = item.slug ? "a" : "div";
          const href = item.slug ? ' href="project.html?project=' + item.slug + '"' : "";
          const natural = item.natural ? " tile--natural" : "";
          return (
            "<" + tag + ' class="tile ' + block.cls + natural + '"' + href + ">" +
            mediaHTML(item.image, alt, false, {
              position: item.imagePosition,
              fit: item.imageFit,
              bg: item.imageBg,
            }) +
            "</" + tag + ">"
          );
        })
        .join("") +
      "</div>";
    i += block.count;
    step++;
  }
  container.innerHTML = html;
}

function renderSocialLinks() {
  const el = document.getElementById("social-links");
  if (!el) return;
  el.innerHTML = SOCIAL_LINKS.map(function (link) {
    var extra = link.url.endsWith(".pdf") ? ' download' : '';
    var targetAttr = link.url.startsWith("mailto:") ? '' : ' target="_blank" rel="noopener"';
    return '<a href="' + link.url + '"' + targetAttr + extra + '>' + link.label + "</a>";
  }).join("");
}

// Light / dark theme toggle, persisted in localStorage.
function setupThemeToggle() {
  const root = document.documentElement;
  const btn = document.getElementById("theme-toggle");
  let saved;
  try {
    saved = localStorage.getItem("theme");
  } catch (e) {
    saved = null;
  }
  if (saved === "light") root.setAttribute("data-theme", "light");
  if (!btn) return;
  btn.addEventListener("click", function () {
    const light = root.getAttribute("data-theme") === "light";
    if (light) {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", "light");
    }
    try {
      localStorage.setItem("theme", light ? "dark" : "light");
    } catch (e) {
      /* ignore */
    }
  });
}

function setupCardStack() {
  var list = document.getElementById("work-cards");
  if (!list) return;
  var cards = Array.from(list.querySelectorAll(".feature"));
  var n = cards.length;
  if (n < 2) return;

  // Mobile: skip the scroll-driven stacking entirely — cards just list
  // vertically (styled by the max-width:760px CSS). Re-evaluate on breakpoint
  // change so rotating / resizing across the boundary picks the right mode.
  var mq = window.matchMedia("(max-width: 760px)");
  if (mq.addEventListener) {
    mq.addEventListener("change", function () {
      window.location.reload();
    });
  }
  if (mq.matches) return;

  var section = document.getElementById("work");
  var title = section ? section.querySelector(".h2") : null;

  // Tall container that provides the scroll space
  var wrap = document.createElement("div");
  wrap.className = "feature-stack-wrap";
  list.parentNode.insertBefore(wrap, list);

  // Sticky stage pins to the viewport; it holds the title + the cards so the
  // title stays next to the cards throughout the stacking scroll.
  var stage = document.createElement("div");
  stage.className = "feature-stage";
  wrap.appendChild(stage);
  if (title) stage.appendChild(title);
  stage.appendChild(list);
  wrap.style.height = n * 100 + "vh";

  var PEEK = 30;    // px each stacked card peeks above the one in front
  var SCALE = 0.04; // scale reduction per stack depth

  var targetProgress = 0;  // where the scroll position says we should be
  var renderProgress = 0;  // where we currently are (eased toward target)
  var rafId = null;

  function computeTarget() {
    var wrapRect = wrap.getBoundingClientRect();
    var wrapH = wrap.offsetHeight;
    var viewH = window.innerHeight;
    var maxScroll = wrapH - viewH;
    var scrolled = Math.max(0, Math.min(-wrapRect.top, maxScroll));
    // progress: 0 (only card 0 visible) → n-1 (card n-1 is front)
    targetProgress = maxScroll > 0 ? (scrolled / maxScroll) * (n - 1) : 0;
    startLoop();
  }

  function render(progress) {
    var activeIdx = Math.min(n - 1, Math.floor(progress));
    var entering = progress - activeIdx; // 0..1 fraction of next card entering

    cards.forEach(function (card, i) {
      var transform, zIndex;

      if (i > activeIdx + 1) {
        // Not yet reached — below viewport, invisible
        transform = "translateY(110vh)";
        zIndex = i;
      } else if (i === activeIdx + 1) {
        // Currently sliding up into view
        var yPct = (1 - entering) * 110;
        transform = "translateY(" + yPct + "vh)";
        zIndex = n + 2;
      } else {
        // Stacked card (i <= activeIdx): shrink and peek above front
        var depth = (activeIdx - i) + entering;
        var scale = Math.max(0.75, 1 - depth * SCALE);
        var ty = -(depth * PEEK);
        transform = "translateY(" + ty + "px) scale(" + scale + ")";
        zIndex = n - Math.round(activeIdx - i);
      }

      card.style.transform = transform;
      card.style.zIndex = zIndex;
    });
  }

  function loop() {
    // Ease the rendered progress toward the scroll target so motion glides
    // to a stop instead of snapping when the user stops scrolling.
    var diff = targetProgress - renderProgress;
    if (Math.abs(diff) < 0.0005) {
      renderProgress = targetProgress;
      render(renderProgress);
      rafId = null; // settled — stop the loop until the next scroll
      return;
    }
    renderProgress += diff * 0.085; // smaller = smoother/slower ease-out
    render(renderProgress);
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId == null) rafId = requestAnimationFrame(loop);
  }

  window.addEventListener("scroll", computeTarget, { passive: true });
  window.addEventListener("resize", computeTarget);
  computeTarget();
  renderProgress = targetProgress; // no intro animation on first paint
  render(renderProgress);
}

// Global smooth (momentum-eased) scrolling. Intercepts wheel input and eases
// the page toward a target scroll position so it glides to a stop instead of
// stopping abruptly. Falls back to native scrolling on touch devices and when
// the user prefers reduced motion.
function setupSmoothScroll() {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(pointer: coarse)").matches;
  if (reduce || coarse) return;

  // Our rAF loop drives scroll per-frame, so disable CSS smooth scrolling to
  // avoid the two easing mechanisms fighting each other.
  document.documentElement.style.scrollBehavior = "auto";

  var target = window.scrollY;
  var current = window.scrollY;
  var rafId = null;
  var animating = false;

  function maxScroll() {
    return Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
  }

  function clamp(v) {
    return Math.max(0, Math.min(v, maxScroll()));
  }

  function loop() {
    var diff = target - current;
    if (Math.abs(diff) < 0.5) {
      current = target;
      window.scrollTo(0, current);
      rafId = null;
      animating = false;
      return;
    }
    current += diff * 0.04; // smaller = smoother/longer glide
    window.scrollTo(0, current);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (rafId == null) rafId = requestAnimationFrame(loop);
  }

  window.addEventListener(
    "wheel",
    function (e) {
      if (e.ctrlKey) return; // let pinch-zoom through
      e.preventDefault();
      animating = true;
      target = clamp(target + e.deltaY * 0.8); // <1 = slower travel per scroll
      start();
    },
    { passive: false }
  );

  // Keep our target in sync when scrolling happens by other means
  // (keyboard, scrollbar drag, anchor jumps) so we don't fight them.
  window.addEventListener(
    "scroll",
    function () {
      if (!animating) {
        target = window.scrollY;
        current = window.scrollY;
      }
    },
    { passive: true }
  );

  window.addEventListener("resize", function () {
    target = clamp(target);
  });

  // Ease in-page anchor links through the same loop instead of jumping.
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href").slice(1);
      var dest = id ? document.getElementById(id) : null;
      if (!dest) return;
      e.preventDefault();
      animating = true;
      var rect = dest.getBoundingClientRect();
      target = clamp(window.scrollY + rect.top);
      start();
    });
  });
}

// Mobile only: a subtle scroll-linked depth effect for the listed cards —
// the card centred in the viewport is full size/opacity, and cards move toward
// slightly smaller + faded as they scroll away (the stack feel, no stacking).
function setupCardFade() {
  var mq = window.matchMedia("(max-width: 760px)");
  if (!mq.matches) return;
  var cards = Array.from(document.querySelectorAll("#work-cards .feature"));
  if (!cards.length) return;

  var ticking = false;
  function update() {
    var vh = window.innerHeight;
    var center = vh / 2;
    cards.forEach(function (card) {
      var r = card.getBoundingClientRect();
      var cardCenter = r.top + r.height / 2;
      var t = Math.min(1, Math.abs(cardCenter - center) / (vh * 0.85));
      var scale = (1 - t * 0.1).toFixed(3);   // down to 0.90
      var opacity = (1 - t * 0.8).toFixed(3); // down to 0.20
      card.style.transform = "scale(" + scale + ")";
      card.style.opacity = opacity;
    });
    ticking = false;
  }
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

// Hero tabs: "Talk to me" (chat-only, page scroll locked) vs. "See my work"
// (classic hero + the scrollable portfolio below). Defaults to chat.
function setupHeroTabs() {
  var tabs = Array.from(document.querySelectorAll(".hero-tab[data-mode]"));
  if (!tabs.length) return;

  function setMode(mode) {
    document.body.classList.toggle("mode-chat", mode === "chat");
    document.body.classList.toggle("mode-work", mode === "work");
    tabs.forEach(function (t) {
      var active = t.getAttribute("data-mode") === mode;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (mode === "chat") window.scrollTo(0, 0);
    // The portfolio sections are display:none in chat mode, so the card-stack
    // and card-fade code measured a zero-height layout at load — remeasure
    // once the sections are actually visible.
    if (mode === "work") window.dispatchEvent(new Event("resize"));
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      setMode(t.getAttribute("data-mode"));
    });
  });

  // Landing straight on a section (e.g. #work) opens in work mode.
  var startMode = window.location.hash === "#work" ? "work" : "chat";
  setMode(startMode);
}

setupHeroTabs();
renderFeatures();
renderCareer();
renderGallery(document.getElementById("other-gallery"), OTHER_WORKS, "Other work");
renderSocialLinks();
setupThemeToggle();
setupCardStack();
setupCardFade();
setupSmoothScroll();
