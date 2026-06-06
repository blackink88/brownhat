/*!
 * Brown Hat Academy — Cyberbot Tutor (Frappe LMS Widget)
 * ───────────────────────────────────────────────────────
 * Vanilla JS, no dependencies. Injects a Socratic chatbot into Frappe LMS
 * lesson pages. Calls the Anthropic-backed /api/tutor endpoint on Vercel
 * (CORS-enabled) for streaming responses.
 *
 * Configure:
 *   window.BH_TUTOR_ENDPOINT  — full URL of the tutor endpoint
 *                                (default: https://portal.brownhat.academy/api/tutor)
 *
 * Activation: auto-mounts on any URL matching /lms/courses/<slug>/learn/<n>.<m>
 * Detaches when navigating away. Resets conversation on lesson change.
 *
 * License: internal Brown Hat Academy use only.
 */
(function () {
  "use strict";

  // ─── Configuration ───────────────────────────────────────────────────────
  var TUTOR_ENDPOINT =
    (typeof window !== "undefined" && window.BH_TUTOR_ENDPOINT) ||
    "https://portal.brownhat.academy/api/tutor";

  var LESSON_PATH_RE = /^\/lms\/courses\/([^\/]+)\/learn\/(\d+)\.(\d+)/;

  var SUGGESTED = [
    "Explain the key idea in plain language",
    "Walk me through a worked example",
    "What's the most common mistake here?",
    "Quiz me on this lesson",
  ];

  // ─── Inline mascot SVG ────────────────────────────────────────────────────
  var MASCOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600"
     role="img" aria-label="Friendly cybersecurity robot mascot wearing a brown fedora">

  <!-- ============================================================
       CYBERBOT — robot chatbot mascot in a brown fedora
       Drive states by setting ONE class on #bot:
         (default)     idle      ·  bob + blink + antenna pulse
         .is-thinking  look up, head tilt, antenna jiggle
         .is-scanning  scan line sweeps the face, eyes squint
         .is-talking   mouth bars bounce, quick bob
         .is-happy     eyes become ^_^ arcs, bouncy
       ============================================================ -->

  <defs>
    <linearGradient id="g-head" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#586A7C"/><stop offset="0.5" stop-color="#41505F"/><stop offset="1" stop-color="#313D49"/>
    </linearGradient>
    <linearGradient id="g-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#465464"/><stop offset="1" stop-color="#2B343F"/>
    </linearGradient>
    <linearGradient id="g-bolt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#46545f"/><stop offset="1" stop-color="#2c353f"/>
    </linearGradient>
    <radialGradient id="g-eye" cx="0.5" cy="0.4" r="0.7">
      <stop offset="0" stop-color="#E2FFF8"/><stop offset="0.45" stop-color="#5FE3C8"/><stop offset="1" stop-color="#1A9C84"/>
    </radialGradient>
    <radialGradient id="g-eyeglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#5FE3C8" stop-opacity="0.5"/><stop offset="1" stop-color="#5FE3C8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g-ball" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#D6FFF6"/><stop offset="0.5" stop-color="#5FE3C8"/><stop offset="1" stop-color="#188E78"/>
    </radialGradient>
    <!-- hat -->
    <linearGradient id="g-crown" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#B6804C"/><stop offset="0.55" stop-color="#A66B3A"/><stop offset="1" stop-color="#8A5529"/>
    </linearGradient>
    <linearGradient id="g-band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6E4622"/><stop offset="1" stop-color="#553418"/>
    </linearGradient>
    <linearGradient id="g-brim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#A66B3A"/><stop offset="0.6" stop-color="#965E30"/><stop offset="1" stop-color="#7C4A23"/>
    </linearGradient>
    <filter id="f-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>
    <clipPath id="clip-face"><rect x="215" y="260" width="170" height="150" rx="28"/></clipPath>

    <style>
      #bot{transform-box:fill-box;transform-origin:50% 80%;animation:bob 3.6s ease-in-out infinite}
      @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      #layer-shadow{transform-box:fill-box;transform-origin:50% 50%;animation:shadowPulse 3.6s ease-in-out infinite}
      @keyframes shadowPulse{0%,100%{transform:scale(1);opacity:.30}50%{transform:scale(.88);opacity:.2}}

      #eyes-round{transform-box:fill-box;transform-origin:50% 45%;animation:blink 4.8s ease-in-out infinite}
      @keyframes blink{0%,91%,100%{transform:scaleY(1)}94%{transform:scaleY(.08)}97%{transform:scaleY(1)}}
      #eyes-happy{opacity:0}

      #antenna-ball,#antenna-glow{transform-box:fill-box;transform-origin:50% 50%;animation:ping 2.4s ease-in-out infinite}
      @keyframes ping{0%,100%{transform:scale(.85);opacity:.8}50%{transform:scale(1.12);opacity:1}}

      .bar{transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(.4)}

      #scanline{opacity:0}

      /* THINKING */
      #bot.is-thinking{animation:tilt 3s ease-in-out infinite;transform-origin:50% 85%}
      @keyframes tilt{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
      #bot.is-thinking #eyes-wrap{animation:lookup 3s ease-in-out infinite}
      @keyframes lookup{0%,100%{transform:translate(-6px,-5px)}50%{transform:translate(6px,-5px)}}
      #bot.is-thinking #antenna-ball{animation:ping .7s ease-in-out infinite}

      /* SCANNING */
      #bot.is-scanning #scanline{opacity:1;animation:scan 1.6s ease-in-out infinite}
      @keyframes scan{0%{transform:translateY(0)}100%{transform:translateY(142px)}}
      #bot.is-scanning #eyes-round{animation:squint 1.6s ease-in-out infinite}
      @keyframes squint{0%,100%{transform:scaleY(.45)}50%{transform:scaleY(.7)}}

      /* TALKING */
      #bot.is-talking{animation:bob 1.1s ease-in-out infinite}
      #bot.is-talking .bar{animation:talk .55s ease-in-out infinite}
      #bot.is-talking .bar:nth-child(2){animation-delay:.12s}
      #bot.is-talking .bar:nth-child(3){animation-delay:.24s}
      #bot.is-talking .bar:nth-child(4){animation-delay:.08s}
      @keyframes talk{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}

      /* HAPPY */
      #bot.is-happy{animation:hop 1s ease-in-out infinite}
      @keyframes hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-16px)}60%{transform:translateY(-6px)}}
      #bot.is-happy #eyes-round{opacity:0;animation:none}
      #bot.is-happy #eyes-happy{opacity:1}
      #bot.is-happy .bar{transform:scaleY(.7)}

      @media (prefers-reduced-motion:reduce){
        #bot,#layer-shadow,#eyes-round,#antenna-ball,#antenna-glow,.bar,#scanline,#eyes-wrap{animation:none!important}
      }
    </style>
  </defs>

  <!-- 0 · SHADOW -->
  <g id="layer-shadow"><ellipse cx="300" cy="576" rx="150" ry="20" fill="#000" filter="url(#f-soft)"/></g>

  <g id="bot">

    <!-- 1 · BODY -->
    <g id="layer-body">
      <path d="M198 566 C 190 506, 216 466, 264 460 L 336 460 C 384 466, 410 506, 402 566 Z"
            fill="url(#g-body)" stroke="#20272F" stroke-width="6" stroke-linejoin="round"/>
      <!-- 2 · CHEST SHIELD (security badge) -->
      <g id="layer-shield">
        <path d="M300 486 L328 496 L328 518 C328 536 315 547 300 554 C285 547 272 536 272 518 L272 496 Z"
              fill="#0E1620" stroke="#5FE3C8" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M288 514 l9 9 16 -19" fill="none" stroke="#5FE3C8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </g>

    <!-- 3 · NECK -->
    <rect id="layer-neck" x="268" y="424" width="64" height="32" rx="11" fill="#2C353F" stroke="#20272F" stroke-width="5"/>

    <!-- 4 · SIDE BOLTS -->
    <g id="layer-bolts">
      <rect x="166" y="320" width="22" height="46" rx="11" fill="url(#g-bolt)" stroke="#20272F" stroke-width="5"/>
      <rect x="412" y="320" width="22" height="46" rx="11" fill="url(#g-bolt)" stroke="#20272F" stroke-width="5"/>
    </g>

    <!-- 5 · HEAD -->
    <g id="layer-head">
      <rect x="185" y="232" width="230" height="200" rx="46" fill="url(#g-head)" stroke="#20272F" stroke-width="6"/>
      <rect x="199" y="244" width="202" height="34" rx="17" fill="#6B7E90" opacity="0.45"/>
    </g>

    <!-- 6 · ANTENNA -->
    <g id="layer-antenna">
      <line x1="214" y1="250" x2="172" y2="170" stroke="#3A4654" stroke-width="7" stroke-linecap="round"/>
      <circle id="antenna-glow" cx="170" cy="164" r="20" fill="url(#g-eyeglow)"/>
      <circle id="antenna-ball" cx="170" cy="164" r="12" fill="url(#g-ball)"/>
    </g>

    <!-- 7 · FACE SCREEN -->
    <g id="layer-face">
      <rect x="215" y="260" width="170" height="150" rx="28" fill="#0C1117"
            stroke="#5FE3C8" stroke-width="2" stroke-opacity="0.25"/>
    </g>

    <!-- 8 · EYES -->
    <g id="layer-eyes" clip-path="url(#clip-face)">
      <ellipse cx="300" cy="322" rx="95" ry="40" fill="url(#g-eyeglow)"/>
      <g id="eyes-wrap">
        <g id="eyes-round">
          <rect x="250" y="300" width="32" height="44" rx="16" fill="url(#g-eye)"/>
          <rect x="318" y="300" width="32" height="44" rx="16" fill="url(#g-eye)"/>
          <circle cx="260" cy="312" r="5" fill="#EBFFFB"/>
          <circle cx="328" cy="312" r="5" fill="#EBFFFB"/>
        </g>
        <g id="eyes-happy">
          <path d="M250 332 Q266 310 282 332" fill="none" stroke="#5FE3C8" stroke-width="8" stroke-linecap="round"/>
          <path d="M318 332 Q334 310 350 332" fill="none" stroke="#5FE3C8" stroke-width="8" stroke-linecap="round"/>
        </g>
      </g>

      <!-- 9 · MOUTH (audio bars) -->
      <g id="layer-mouth">
        <rect class="bar" x="268" y="362" width="10" height="28" rx="5" fill="#5FE3C8"/>
        <rect class="bar" x="286" y="362" width="10" height="28" rx="5" fill="#5FE3C8"/>
        <rect class="bar" x="304" y="362" width="10" height="28" rx="5" fill="#5FE3C8"/>
        <rect class="bar" x="322" y="362" width="10" height="28" rx="5" fill="#5FE3C8"/>
      </g>

      <!-- 10 · SCAN LINE -->
      <rect id="scanline" x="215" y="262" width="170" height="6" fill="#9FFFEC" opacity="0"/>
    </g>

    <!-- 11 · HAT (scaled + tilted, sits on head) -->
    <g id="layer-hat" transform="translate(300 175) rotate(-8) scale(0.6) translate(-300 -335)">
      <path id="hat-brim" d="M92 418 C 92 388,200 372,300 372 C 400 372,508 388,508 418 C 508 452,398 474,300 474 C 202 474,92 452,92 418 Z"
            fill="url(#g-brim)" stroke="#2A1A0D" stroke-width="6" stroke-linejoin="round"/>
      <path d="M118 410 C 210 386,392 386,482 410" fill="none" stroke="#C58E58" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
      <path id="hat-crown" d="M178 392 C 170 312,184 232,232 196 C 254 180,268 184,278 200 C 288 216,296 220,300 220
               C 304 220,313 214,324 198 C 336 180,352 180,372 198 C 420 236,432 312,422 392 C 380 410,220 410,178 392 Z"
            fill="url(#g-crown)" stroke="#2A1A0D" stroke-width="6" stroke-linejoin="round"/>
      <path d="M276 206 C 288 220,312 220,324 204" fill="none" stroke="#6E4622" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
      <path id="hat-band" d="M183 332 C 240 348,360 348,417 332 L 421 384 C 380 400,220 400,179 384 Z"
            fill="url(#g-band)" stroke="#2A1A0D" stroke-width="5" stroke-linejoin="round"/>
      <path d="M150 430 C 230 460,370 460,450 430 C 388 452,212 452,150 430 Z" fill="#7C4A23" opacity="0.85"/>
    </g>

  </g>
</svg>
`;

  // ─── State ────────────────────────────────────────────────────────────────
  var state = {
    isOpen: false,
    messages: [],
    isStreaming: false,
    botState: "idle",
    error: null,
    lessonKey: null,   // <course>:<chapter>.<lesson>
    lessonContext: null, // { lessonTitle, lessonText, courseTitle }
    abort: null,
  };

  // ─── DOM refs ─────────────────────────────────────────────────────────────
  var hostEl, panelEl, launcherEl, messagesEl, inputEl, stateChipEl, titleEl,
      sendBtn, stopBtn, errEl, botSvgEl;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") {
        e.addEventListener(k.slice(2), attrs[k]);
      } else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (k) {
      if (k == null) return;
      if (typeof k === "string") e.appendChild(document.createTextNode(k));
      else e.appendChild(k);
    });
    return e;
  }
  function stripHtml(html) {
    if (!html) return "";
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    var t = tmp.textContent || tmp.innerText || "";
    return t.replace(/\s+/g, " ").trim();
  }
  function lessonKeyFromUrl() {
    var m = location.pathname.match(LESSON_PATH_RE);
    if (!m) return null;
    return m[1] + ":" + m[2] + "." + m[3];
  }
  function parseLessonKey(key) {
    if (!key) return null;
    var p = key.split(":");
    var lp = p[1].split(".");
    return { course: p[0], chapter: parseInt(lp[0], 10), lesson: parseInt(lp[1], 10) };
  }

  // ─── Frappe API: fetch the current lesson context ─────────────────────────
  function fetchLessonContext(lessonKey) {
    var pos = parseLessonKey(lessonKey);
    if (!pos) return Promise.resolve(null);
    var url = "/api/method/lms.lms.utils.get_lesson?course=" +
      encodeURIComponent(pos.course) + "&chapter=" + pos.chapter + "&lesson=" + pos.lesson;
    return fetch(url, { credentials: "same-origin", headers: { "X-Frappe-CSRF-Token": "token" } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var msg = (d && d.message) || {};
        return {
          lessonTitle: msg.title || "",
          lessonText: stripHtml(msg.body || ""),
          courseTitle: (msg.course_title || pos.course) || "",
        };
      })
      .catch(function () { return null; });
  }

  // ─── Bot avatar state ─────────────────────────────────────────────────────
  function setBotState(s) {
    state.botState = s;
    if (!botSvgEl) return;
    var bot = botSvgEl.querySelector("#bot");
    if (!bot) return;
    bot.classList.remove("is-thinking", "is-talking", "is-happy", "is-scanning");
    if (s === "thinking") bot.classList.add("is-thinking");
    else if (s === "talking") bot.classList.add("is-talking");
    else if (s === "happy") bot.classList.add("is-happy");
    if (stateChipEl) {
      stateChipEl.textContent = s;
      stateChipEl.className = "bh-state-chip bh-state-" + s;
    }
  }

  // ─── Rendering ────────────────────────────────────────────────────────────
  function renderMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = "";

    if (state.messages.length === 0) {
      var intro = el("div", { class: "bh-intro" }, [
        el("p", { class: "bh-intro-text" }, [
          "I'm here for this lesson. Ask me anything, or try a starter:",
        ]),
        el("div", { class: "bh-chips" }, SUGGESTED.map(function (p) {
          return el("button", {
            class: "bh-chip", type: "button",
            onclick: function () { send(p); },
          }, [p]);
        })),
      ]);
      messagesEl.appendChild(intro);
    } else {
      state.messages.forEach(function (m) {
        var bubble = el("div", { class: "bh-msg bh-msg-" + m.role }, []);
        var content = el("div", { class: "bh-bubble" }, []);
        if (m.content) {
          // Preserve newlines, escape HTML
          content.textContent = m.content;
        } else {
          content.appendChild(el("span", { class: "bh-dots" }, [
            el("span", {}, []), el("span", {}, []), el("span", {}, []),
          ]));
        }
        bubble.appendChild(content);
        messagesEl.appendChild(bubble);
      });
    }
    if (state.error) {
      messagesEl.appendChild(el("div", { class: "bh-error" }, [state.error]));
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setStreaming(s) {
    state.isStreaming = s;
    if (sendBtn) sendBtn.hidden = s;
    if (stopBtn) stopBtn.hidden = !s;
    if (inputEl) inputEl.disabled = s;
  }

  // ─── Send a message ───────────────────────────────────────────────────────
  function send(textOverride) {
    var text = (textOverride != null ? textOverride : (inputEl ? inputEl.value : "")).trim();
    if (!text || state.isStreaming) return;

    if (!state.lessonContext) {
      state.error = "Tutor is loading lesson context, try again in a moment.";
      renderMessages();
      return;
    }

    state.error = null;
    state.messages.push({ role: "user", content: text });
    state.messages.push({ role: "assistant", content: "" });
    if (inputEl) inputEl.value = "";
    setStreaming(true);
    setBotState("thinking");
    renderMessages();

    state.abort = new AbortController();
    var firstToken = false;

    fetch(TUTOR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: state.abort.signal,
      body: JSON.stringify({
        lessonTitle: state.lessonContext.lessonTitle,
        lessonText: state.lessonContext.lessonText,
        courseTitle: state.lessonContext.courseTitle,
        messages: state.messages.slice(0, -1).map(function (m) {
          return { role: m.role, content: m.content };
        }),
      }),
    }).then(function (resp) {
      if (!resp.ok || !resp.body) throw new Error("Tutor unavailable (" + resp.status + ")");
      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buffer += decoder.decode(r.value, { stream: true });
          var events = buffer.split("\n\n");
          buffer = events.pop() || "";
          events.forEach(function (evt) {
            evt.split("\n").forEach(function (line) {
              if (line.indexOf("data:") !== 0) return;
              var payload = line.slice(5).trim();
              if (!payload) return;
              try {
                var j = JSON.parse(payload);
                if (j.type === "delta" && typeof j.text === "string") {
                  if (!firstToken) { firstToken = true; setBotState("talking"); }
                  var last = state.messages[state.messages.length - 1];
                  last.content += j.text;
                  renderMessages();
                } else if (j.type === "error") {
                  state.error = j.message || "Tutor error";
                  renderMessages();
                }
              } catch (e) { /* ignore */ }
            });
          });
          return pump();
        });
      }
      return pump();
    }).then(function () {
      setBotState("happy");
      setTimeout(function () { setBotState("idle"); }, 1800);
    }).catch(function (err) {
      if (err && err.name === "AbortError") {
        // stopped by user
      } else {
        state.error = (err && err.message) || "Tutor error";
        renderMessages();
      }
      setBotState("idle");
    }).then(function () { setStreaming(false); });
  }

  function stop() {
    if (state.abort) state.abort.abort();
    setStreaming(false);
    setBotState("idle");
  }

  // ─── Build the UI ─────────────────────────────────────────────────────────
  function buildUI() {
    if (document.getElementById("bh-tutor-host")) return;
    injectStyles();

    hostEl = el("div", { id: "bh-tutor-host" }, []);

    // Launcher
    launcherEl = el("button", {
      id: "bh-tutor-launcher",
      class: "bh-launcher",
      type: "button",
      onclick: openPanel,
      "aria-label": "Open lesson tutor",
    }, [
      el("span", { class: "bh-launcher-icon", html: SPARKLE_SVG }, []),
      el("span", { class: "bh-launcher-label" }, ["Tutor"]),
    ]);

    // Panel
    var panelHeader = el("header", { class: "bh-panel-header" }, [
      el("div", { class: "bh-avatar", html: MASCOT_SVG }, []),
      el("div", { class: "bh-meta" }, [
        el("div", { class: "bh-meta-row" }, [
          (titleEl = el("h3", { class: "bh-title" }, ["Cyberbot Tutor"])),
          (stateChipEl = el("span", { class: "bh-state-chip bh-state-idle" }, ["idle"])),
        ]),
        el("p", { class: "bh-sub", id: "bh-lesson-title" }, ["Loading lesson..."]),
      ]),
      el("button", {
        class: "bh-close", type: "button", onclick: closePanel,
        "aria-label": "Close tutor",
      }, ["×"]),
    ]);

    messagesEl = el("div", { class: "bh-messages", id: "bh-messages" }, []);

    inputEl = el("textarea", {
      class: "bh-input",
      rows: "2",
      placeholder: "Ask about this lesson...",
      onkeydown: function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      },
    }, []);
    sendBtn = el("button", { class: "bh-send", type: "button", onclick: function () { send(); } }, ["Send"]);
    stopBtn = el("button", { class: "bh-stop", type: "button", onclick: stop }, ["Stop"]);
    stopBtn.hidden = true;

    var composer = el("footer", { class: "bh-composer" }, [
      inputEl,
      el("div", { class: "bh-composer-actions" }, [sendBtn, stopBtn]),
    ]);

    panelEl = el("aside", {
      id: "bh-tutor-panel",
      class: "bh-panel",
      "aria-label": "Lesson tutor panel",
    }, [panelHeader, messagesEl, composer]);
    panelEl.hidden = true;

    hostEl.appendChild(launcherEl);
    hostEl.appendChild(panelEl);
    document.body.appendChild(hostEl);

    botSvgEl = panelEl.querySelector(".bh-avatar svg");
    renderMessages();
  }

  function openPanel() {
    state.isOpen = true;
    panelEl.hidden = false;
    launcherEl.hidden = true;
    setTimeout(function () { panelEl.classList.add("is-open"); }, 10);
    if (inputEl) inputEl.focus();
  }
  function closePanel() {
    state.isOpen = false;
    panelEl.classList.remove("is-open");
    launcherEl.hidden = false;
    setTimeout(function () { panelEl.hidden = true; }, 280);
  }

  // ─── Route detection ──────────────────────────────────────────────────────
  function syncToRoute() {
    var key = lessonKeyFromUrl();
    if (!key) {
      // not a lesson page
      if (hostEl) hostEl.style.display = "none";
      return;
    }
    if (!hostEl) buildUI();
    hostEl.style.display = "";

    if (state.lessonKey !== key) {
      // Lesson change: reset
      state.lessonKey = key;
      state.lessonContext = null;
      state.messages = [];
      state.error = null;
      if (state.abort) state.abort.abort();
      setBotState("idle");
      renderMessages();
      var titleSub = panelEl && panelEl.querySelector("#bh-lesson-title");
      if (titleSub) titleSub.textContent = "Loading lesson...";

      fetchLessonContext(key).then(function (ctx) {
        if (state.lessonKey !== key) return; // route changed during fetch
        state.lessonContext = ctx;
        if (titleSub) titleSub.textContent = (ctx && ctx.lessonTitle) || "Lesson";
      });
    }
  }

  // Wrap pushState/replaceState to catch SPA navigation
  function patchHistory() {
    var orig = { push: history.pushState, replace: history.replaceState };
    history.pushState = function () {
      var r = orig.push.apply(this, arguments);
      window.dispatchEvent(new Event("bh-route"));
      return r;
    };
    history.replaceState = function () {
      var r = orig.replace.apply(this, arguments);
      window.dispatchEvent(new Event("bh-route"));
      return r;
    };
    window.addEventListener("popstate", function () { window.dispatchEvent(new Event("bh-route")); });
    window.addEventListener("bh-route", syncToRoute);
  }

  // ─── Styles ───────────────────────────────────────────────────────────────
  var SPARKLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg>';

  function injectStyles() {
    if (document.getElementById("bh-tutor-styles")) return;
    var css = `
#bh-tutor-host{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.bh-launcher{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:9999;display:flex;align-items:center;gap:8px;padding:14px 14px 14px 12px;border:1px solid #6b3410;border-right:0;border-radius:12px 0 0 12px;background:#7d3e15;color:#fff;cursor:pointer;font-weight:600;box-shadow:0 6px 24px rgba(107,52,16,.35);transition:padding .18s ease,background .18s ease}
.bh-launcher:hover{background:#8f4a1f;padding-right:18px}
.bh-launcher-icon{display:inline-flex}
.bh-launcher-label{font-size:13px;letter-spacing:.04em}
.bh-panel{position:fixed;top:0;right:0;bottom:0;width:min(420px,92vw);background:#fff;color:#1f2937;border-left:1px solid #e5e7eb;box-shadow:-20px 0 60px rgba(0,0,0,.18);z-index:9999;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.bh-panel.is-open{transform:translateX(0)}
.bh-panel-header{padding:14px 14px 10px 14px;border-bottom:1px solid #e5e7eb;display:flex;gap:12px;align-items:flex-start;background:#fef9f3}
.bh-avatar{width:72px;height:72px;flex:0 0 72px;margin:-4px 0 -8px 0}
.bh-avatar svg{width:100%;height:100%;display:block}
.bh-meta{flex:1;min-width:0}
.bh-meta-row{display:flex;align-items:center;gap:8px}
.bh-title{font-size:15px;font-weight:600;margin:2px 0 0 0;color:#111827}
.bh-state-chip{font-size:10px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;padding:2px 6px;border-radius:3px;background:rgba(148,163,184,.18);color:#475569}
.bh-state-thinking{background:rgba(217,119,6,.15);color:#a16207}
.bh-state-talking{background:rgba(5,150,105,.15);color:#047857}
.bh-state-happy{background:rgba(168,85,247,.15);color:#7e22ce}
.bh-sub{font-size:12px;color:#6b7280;margin:4px 0 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
.bh-close{background:transparent;border:0;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:24px;color:#6b7280;line-height:1}
.bh-close:hover{background:rgba(0,0,0,.05);color:#111}
.bh-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#fff}
.bh-intro-text{font-size:13.5px;color:#374151;margin:8px 0 12px 0;line-height:1.5}
.bh-chips{display:flex;flex-wrap:wrap;gap:6px}
.bh-chip{font-size:12px;padding:6px 11px;border-radius:999px;border:1px solid #d1d5db;background:#fff;color:#374151;cursor:pointer;transition:background .15s,border-color .15s}
.bh-chip:hover{background:#f3f4f6;border-color:#9ca3af}
.bh-msg{display:flex}
.bh-msg-user{justify-content:flex-end}
.bh-msg-assistant{justify-content:flex-start}
.bh-bubble{max-width:86%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}
.bh-msg-user .bh-bubble{background:#7d3e15;color:#fff;border-bottom-right-radius:4px}
.bh-msg-assistant .bh-bubble{background:#f3f4f6;color:#111827;border-bottom-left-radius:4px}
.bh-dots{display:inline-flex;gap:4px;color:#9ca3af}
.bh-dots span{width:6px;height:6px;border-radius:50%;background:currentColor;animation:bh-blink 1.2s ease-in-out infinite}
.bh-dots span:nth-child(2){animation-delay:.18s}
.bh-dots span:nth-child(3){animation-delay:.36s}
@keyframes bh-blink{0%,80%,100%{opacity:.3}40%{opacity:1}}
.bh-error{font-size:12px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:8px 10px;border-radius:6px}
.bh-composer{padding:10px 12px;border-top:1px solid #e5e7eb;background:#fff;display:flex;flex-direction:column;gap:6px}
.bh-input{resize:none;width:100%;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font:inherit;font-size:14px;color:#111827;background:#fff;outline:none;font-family:inherit}
.bh-input:focus{border-color:#7d3e15;box-shadow:0 0 0 3px rgba(125,62,21,.15)}
.bh-input:disabled{opacity:.6;cursor:not-allowed}
.bh-composer-actions{display:flex;justify-content:flex-end;gap:6px}
.bh-send,.bh-stop{font:inherit;font-size:13px;font-weight:600;padding:7px 14px;border-radius:7px;border:0;cursor:pointer}
.bh-send{background:#7d3e15;color:#fff}
.bh-send:hover{background:#8f4a1f}
.bh-send:disabled{opacity:.5;cursor:not-allowed}
.bh-stop{background:#fff;color:#374151;border:1px solid #d1d5db}
.bh-stop:hover{background:#f3f4f6}
@media (max-width:520px){
  .bh-panel{width:100vw}
  .bh-launcher-label{display:none}
}
@media (prefers-color-scheme:dark){
  .bh-panel{background:#111827;color:#e5e7eb;border-left-color:#1f2937}
  .bh-panel-header{background:#1c1917;border-bottom-color:#27272a}
  .bh-title{color:#f3f4f6}
  .bh-sub{color:#9ca3af}
  .bh-close{color:#9ca3af}
  .bh-close:hover{background:rgba(255,255,255,.08);color:#fff}
  .bh-messages{background:#111827}
  .bh-msg-assistant .bh-bubble{background:#1f2937;color:#e5e7eb}
  .bh-intro-text{color:#cbd5e1}
  .bh-chip{background:#1f2937;color:#cbd5e1;border-color:#374151}
  .bh-chip:hover{background:#27272a}
  .bh-composer{background:#0f172a;border-top-color:#1f2937}
  .bh-input{background:#0f172a;color:#e5e7eb;border-color:#1f2937}
  .bh-stop{background:#1f2937;color:#cbd5e1;border-color:#374151}
}
    `;
    var s = document.createElement("style");
    s.id = "bh-tutor-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    patchHistory();
    syncToRoute();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
