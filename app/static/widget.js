(function () {
    "use strict";

    // 1. Locate Script & Extract Configuration
    const currentScript =
        document.currentScript ||
        document.querySelector("script[data-api-key]");

    if (!currentScript) {
        console.error("[SupportAI] Could not find widget <script> tag with data-api-key.");
        return;
    }

    const apiKey = currentScript.getAttribute("data-api-key");
    const apiUrl =
        currentScript.getAttribute("data-api-url") ||
        window.location.origin;
    const welcomeOverride = currentScript.getAttribute("data-welcome-message");
    // "light" | "dark" | "auto" (default) — auto follows the host page.
    const themePreference = (currentScript.getAttribute("data-theme") || "auto").toLowerCase();
    const suggestedQuestions = (currentScript.getAttribute("data-suggested-questions") || "")
        .split("|")
        .map((q) => q.trim())
        .filter(Boolean);

    if (!apiKey) {
        console.error("[SupportAI] Missing required 'data-api-key' attribute.");
        return;
    }

    // 2. State
    let config = {
        widget_title: "Support Assistant",
        primary_color: "#2C5CFF",
        company_logo_url: null,
        organization_name: null,
        welcome_message: welcomeOverride || "Hi there! How can we help you today?",
    };
    let isOpen = false;
    let isStreaming = false;
    let hasInteracted = false;
    let unreadCount = 0;
    let isDark = false;
    const storageKey = "supportai_conv_" + apiKey.slice(-16);
    let conversationId = localStorage.getItem(storageKey) || null;
    let knownBackendMessageCount = 0;

    // 3. Color helpers
    function hexToRgb(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
        return m
            ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
            : { r: 44, g: 92, b: 255 };
    }
    function mixToward(hex, target, amount) {
        const { r, g, b } = hexToRgb(hex);
        const mix = (c) => Math.round(c + (target - c) * amount);
        return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
    }
    function rgba(hex, alpha) {
        const { r, g, b } = hexToRgb(hex);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    function luminance(r, g, b) {
        const lin = (c) => {
            c /= 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    // 4. Theme resolution — the host page is the source of truth. Class and
    // attribute conventions first (next-themes, Tailwind, most design systems),
    // then the page's actual painted background, then the OS preference. A
    // media query alone would miss a site whose own toggle says otherwise.
    function parseCssColor(value) {
        const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i.exec(value || "");
        if (!m) return null;
        const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
        if (alpha === 0) return null;
        return { r: +m[1], g: +m[2], b: +m[3] };
    }

    function detectHostIsDark() {
        if (themePreference === "dark") return true;
        if (themePreference === "light") return false;

        for (const el of [document.documentElement, document.body]) {
            if (!el) continue;
            const attr = (el.getAttribute("data-theme") || el.getAttribute("data-color-scheme") || "").toLowerCase();
            if (attr === "dark") return true;
            if (attr === "light") return false;
            if (el.classList.contains("dark")) return true;
            if (el.classList.contains("light")) return false;
        }

        for (const el of [document.body, document.documentElement]) {
            if (!el) continue;
            const bg = parseCssColor(getComputedStyle(el).backgroundColor);
            if (bg) return luminance(bg.r, bg.g, bg.b) < 0.35;
        }

        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    function applyTheme() {
        isDark = detectHostIsDark();
        root.classList.toggle("sai-dark", isDark);

        const accent = config.primary_color || "#2C5CFF";
        const { r, g, b } = hexToRgb(accent);
        const accentLum = luminance(r, g, b);

        root.style.setProperty("--sai-accent", accent);
        root.style.setProperty("--sai-accent-hover", mixToward(accent, isDark ? 255 : 0, 0.14));
        root.style.setProperty("--sai-accent-soft", mixToward(accent, isDark ? 20 : 255, isDark ? 0.82 : 0.9));
        root.style.setProperty("--sai-accent-ring", rgba(accent, isDark ? 0.32 : 0.16));
        root.style.setProperty("--sai-accent-shadow", rgba(accent, isDark ? 0.4 : 0.26));
        root.style.setProperty("--sai-on-accent", accentLum > 0.55 ? "#0b0b0e" : "#ffffff");
        // On dark surfaces a saturated brand colour is often too dim for small
        // text, so lift it for the label/icon accents specifically.
        root.style.setProperty(
            "--sai-accent-text",
            isDark && accentLum < 0.3 ? mixToward(accent, 255, 0.34) : accent,
        );
    }

    // 5. Styles
    const styles = `
    #supportai-widget-container {
      --sai-bg: #ffffff;
      --sai-surface: #ffffff;
      --sai-surface-2: #f6f6f8;
      --sai-line: #e5e5e8;
      --sai-fg: #111113;
      --sai-muted: #6b7076;
      --sai-subtle: #93959e;
      --sai-shadow: 0 16px 40px -12px rgba(9, 9, 11, 0.18), 0 2px 8px rgba(9, 9, 11, 0.06);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483000;
      color-scheme: light;
    }
    #supportai-widget-container.sai-dark {
      --sai-bg: #0b0b0e;
      --sai-surface: #131317;
      --sai-surface-2: #1b1b20;
      --sai-line: #27272e;
      --sai-fg: #f4f4f5;
      --sai-muted: #9a9ca3;
      --sai-subtle: #6f727a;
      --sai-shadow: 0 20px 48px -12px rgba(0, 0, 0, 0.7), 0 2px 10px rgba(0, 0, 0, 0.45);
      color-scheme: dark;
    }
    #supportai-widget-container * { box-sizing: border-box; }

    /* Launcher */
    #supportai-launcher {
      position: relative;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--sai-accent);
      box-shadow: 0 8px 24px -6px var(--sai-accent-shadow), 0 1px 3px rgba(0,0,0,0.12);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1), background 0.15s ease;
      outline: none;
      padding: 0;
    }
    #supportai-launcher:hover { transform: translateY(-1px); background: var(--sai-accent-hover); }
    #supportai-launcher:active { transform: scale(0.95); }
    #supportai-launcher:focus-visible { box-shadow: 0 0 0 3px var(--sai-accent-ring), 0 8px 24px -6px var(--sai-accent-shadow); }
    #supportai-launcher svg { width: 21px; height: 21px; stroke: var(--sai-on-accent); fill: none; }
    #sai-unread-badge {
      position: absolute;
      top: -1px; right: -1px;
      min-width: 18px; height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: #ef4444;
      color: #fff;
      font-size: 10.5px;
      font-weight: 600;
      line-height: 18px;
      text-align: center;
      box-shadow: 0 0 0 2px var(--sai-bg);
      display: none;
    }

    /* Window */
    #supportai-window {
      position: fixed;
      bottom: 88px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 128px);
      background: var(--sai-surface);
      border: 1px solid var(--sai-line);
      border-radius: 14px;
      box-shadow: var(--sai-shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px) scale(0.985);
      transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      color: var(--sai-fg);
    }
    #supportai-window.sai-open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    @media (max-width: 480px) {
      #supportai-window.sai-open {
        bottom: 0; right: 0; left: 0; top: 0;
        width: 100%; height: 100%; max-width: 100%; max-height: 100%;
        border-radius: 0; border: none;
      }
      #supportai-widget-container { bottom: 16px; right: 16px; }
    }

    /* Header — a hairline bar, not a coloured slab */
    #supportai-header {
      background: var(--sai-surface);
      border-bottom: 1px solid var(--sai-line);
      padding: 11px 10px 11px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-shrink: 0;
    }
    .sai-header-info { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .sai-avatar {
      width: 30px; height: 30px;
      border-radius: 8px;
      background: var(--sai-accent-soft);
      color: var(--sai-accent-text);
      display: flex; align-items: center; justify-content: center;
      font-weight: 600; font-size: 12.5px;
      overflow: hidden; flex-shrink: 0;
    }
    .sai-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .sai-header-text { min-width: 0; }
    .sai-header-text h3 {
      margin: 0;
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--sai-fg);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sai-status {
      font-size: 11.5px; color: var(--sai-muted);
      display: flex; align-items: center; gap: 5px; margin-top: 1px;
    }
    .sai-status-dot { width: 5px; height: 5px; background: #22c55e; border-radius: 50%; flex-shrink: 0; }
    .sai-icon-btn {
      background: none; border: none; color: var(--sai-muted); cursor: pointer;
      width: 28px; height: 28px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.12s ease, background 0.12s ease;
    }
    .sai-icon-btn:hover { color: var(--sai-fg); background: var(--sai-surface-2); }
    .sai-icon-btn:focus-visible { outline: 2px solid var(--sai-accent); outline-offset: -1px; }

    /* Messages */
    #supportai-messages {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      background: var(--sai-bg);
      position: relative;
      scroll-behavior: smooth;
    }
    .sai-msg-row { display: flex; max-width: 100%; margin-top: 8px; }
    .sai-msg-row:first-of-type { margin-top: 0; }
    .sai-msg-row.sai-row-user { justify-content: flex-end; }
    .sai-msg {
      max-width: 86%;
      padding: 9px 12px;
      font-size: 13.5px;
      line-height: 1.55;
      letter-spacing: -0.003em;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      border-radius: 13px;
      animation: sai-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes sai-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
    .sai-msg-assistant {
      background: var(--sai-surface-2);
      border: 1px solid var(--sai-line);
      color: var(--sai-fg);
      border-bottom-left-radius: 5px;
    }
    .sai-msg-user {
      background: var(--sai-accent);
      color: var(--sai-on-accent);
      border-bottom-right-radius: 5px;
    }
    .sai-msg p { margin: 0 0 7px; }
    .sai-msg p:last-child { margin-bottom: 0; }
    .sai-msg ul { margin: 5px 0 7px; padding-left: 17px; }
    .sai-msg ul:last-child { margin-bottom: 0; }
    .sai-msg li { margin: 3px 0; }
    .sai-msg strong { font-weight: 600; }
    .sai-msg code {
      background: var(--sai-bg);
      border: 1px solid var(--sai-line);
      padding: 0.5px 4px; border-radius: 4px; font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .sai-msg-user code { background: rgba(255,255,255,0.16); border-color: transparent; color: inherit; }
    .sai-msg a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }

    /* Cited sources */
    .sai-sources { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; max-width: 86%; }
    .sai-source-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10.5px; color: var(--sai-muted);
      background: var(--sai-surface); border: 1px solid var(--sai-line);
      border-radius: 6px; padding: 2.5px 7px 2.5px 5px; max-width: 100%;
    }
    .sai-source-chip svg { width: 10px; height: 10px; flex-shrink: 0; opacity: 0.7; }
    .sai-source-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Typing */
    .sai-typing { margin-top: 8px; }
    .sai-typing-indicator {
      display: inline-flex; align-items: center; gap: 4px; padding: 11px 13px;
      background: var(--sai-surface-2); border: 1px solid var(--sai-line);
      border-radius: 13px; border-bottom-left-radius: 5px;
    }
    .sai-typing-dot { width: 5px; height: 5px; background: var(--sai-subtle); border-radius: 50%; animation: sai-bounce 1.3s infinite ease-in-out both; }
    .sai-typing-dot:nth-child(1) { animation-delay: -0.3s; }
    .sai-typing-dot:nth-child(2) { animation-delay: -0.15s; }
    @keyframes sai-bounce { 0%, 80%, 100% { transform: scale(0.65); opacity: 0.45; } 40% { transform: scale(1); opacity: 1; } }

    /* Suggested questions — inline, so an empty thread doesn't read as a void */
    .sai-suggestions { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
    .sai-suggestions-label {
      font-size: 10.5px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.07em; color: var(--sai-subtle); margin-bottom: 1px;
    }
    .sai-suggestion-chip {
      text-align: left; background: var(--sai-surface); border: 1px solid var(--sai-line);
      color: var(--sai-fg); border-radius: 9px; padding: 8px 11px; font-size: 12.5px;
      line-height: 1.4; cursor: pointer; font-family: inherit; max-width: 100%;
      transition: border-color 0.12s ease, background 0.12s ease;
    }
    .sai-suggestion-chip:hover { background: var(--sai-accent-soft); border-color: var(--sai-accent); }
    .sai-suggestion-chip:focus-visible { outline: 2px solid var(--sai-accent); outline-offset: 1px; }

    /* Errors */
    .sai-error { margin-top: 8px; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; max-width: 86%; }
    .sai-retry-btn {
      background: var(--sai-surface); border: 1px solid var(--sai-line); color: var(--sai-fg);
      border-radius: 7px; padding: 5px 10px; font-size: 12px; font-weight: 500;
      cursor: pointer; font-family: inherit;
    }
    .sai-retry-btn:hover { background: var(--sai-surface-2); }

    /* Jump to latest */
    .sai-scroll-btn {
      position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
      background: var(--sai-surface); border: 1px solid var(--sai-line); color: var(--sai-fg);
      border-radius: 16px; padding: 5px 11px 5px 9px; font-size: 11.5px; font-weight: 500;
      display: none; align-items: center; gap: 4px; cursor: pointer; font-family: inherit;
      box-shadow: var(--sai-shadow); z-index: 5;
    }
    .sai-scroll-btn svg { width: 12px; height: 12px; }

    /* Composer */
    #supportai-input-area {
      padding: 10px 12px 8px;
      background: var(--sai-surface);
      border-top: 1px solid var(--sai-line);
      display: flex;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }
    #supportai-input {
      flex: 1;
      border: 1px solid var(--sai-line);
      background: var(--sai-bg);
      color: var(--sai-fg);
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 13.5px;
      font-family: inherit;
      outline: none;
      resize: none;
      max-height: 116px;
      min-height: 38px;
      line-height: 1.45;
      transition: border-color 0.12s ease, box-shadow 0.12s ease;
    }
    #supportai-input::placeholder { color: var(--sai-subtle); }
    #supportai-input:focus { border-color: var(--sai-accent); box-shadow: 0 0 0 3px var(--sai-accent-ring); }
    #supportai-send-btn {
      width: 38px; height: 38px; border-radius: 10px;
      background: var(--sai-accent); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--sai-on-accent); outline: none; flex-shrink: 0;
      transition: opacity 0.12s ease, background 0.12s ease, transform 0.1s ease;
    }
    #supportai-send-btn:hover:not(:disabled) { background: var(--sai-accent-hover); }
    #supportai-send-btn:active:not(:disabled) { transform: scale(0.94); }
    #supportai-send-btn:disabled { opacity: 0.35; cursor: default; }
    #supportai-send-btn:focus-visible { box-shadow: 0 0 0 3px var(--sai-accent-ring); }
    #supportai-send-btn svg { width: 16px; height: 16px; }
    .sai-footer-badge {
      font-size: 10px; text-align: center; color: var(--sai-subtle);
      padding: 0 4px 9px; background: var(--sai-surface); flex-shrink: 0;
      letter-spacing: 0.01em;
    }
    .sai-footer-badge strong { color: var(--sai-muted); font-weight: 600; }

    #supportai-messages::-webkit-scrollbar { width: 8px; }
    #supportai-messages::-webkit-scrollbar-thumb { background: var(--sai-line); border-radius: 4px; border: 2px solid var(--sai-bg); }
    #supportai-messages::-webkit-scrollbar-track { background: transparent; }
  `;

    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // 6. Inject DOM
    const container = document.createElement("div");
    container.id = "supportai-widget-container";
    container.innerHTML = `
    <div id="supportai-window" role="dialog" aria-label="Support chat" aria-modal="false">
      <div id="supportai-header">
        <div class="sai-header-info">
          <div class="sai-avatar" id="sai-avatar-box">AI</div>
          <div class="sai-header-text">
            <h3 id="sai-title">Support Assistant</h3>
            <div class="sai-status"><span class="sai-status-dot"></span> Online</div>
          </div>
        </div>
        <button id="supportai-close-btn" class="sai-icon-btn" aria-label="Close chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div id="supportai-messages" role="log" aria-live="polite" aria-relevant="additions">
        <button id="sai-scroll-btn" class="sai-scroll-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          New messages
        </button>
      </div>
      <form id="supportai-input-area">
        <textarea id="supportai-input" placeholder="Ask a question…" autocomplete="off" rows="1" aria-label="Message"></textarea>
        <button type="submit" id="supportai-send-btn" aria-label="Send message" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </form>
      <div class="sai-footer-badge">Powered by <strong>SupportAI</strong></div>
    </div>
    <button id="supportai-launcher" aria-label="Open support chat" aria-expanded="false">
      <span id="sai-unread-badge" aria-hidden="true">0</span>
      <svg id="sai-chat-icon" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
      <svg id="sai-close-icon" style="display:none;" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;
    document.body.appendChild(container);
    const root = container;

    // 7. DOM References
    const launcher = document.getElementById("supportai-launcher");
    const unreadBadge = document.getElementById("sai-unread-badge");
    const chatWindow = document.getElementById("supportai-window");
    const closeBtn = document.getElementById("supportai-close-btn");
    const messagesBox = document.getElementById("supportai-messages");
    const scrollBtn = document.getElementById("sai-scroll-btn");
    const form = document.getElementById("supportai-input-area");
    const input = document.getElementById("supportai-input");
    const sendBtn = document.getElementById("supportai-send-btn");
    const chatIcon = document.getElementById("sai-chat-icon");
    const closeIcon = document.getElementById("sai-close-icon");
    const avatarBox = document.getElementById("sai-avatar-box");
    const titleEl = document.getElementById("sai-title");

    applyTheme();

    // Follow the host page if it toggles theme after load.
    if (themePreference === "auto") {
        const observer = new MutationObserver(applyTheme);
        const opts = { attributes: true, attributeFilter: ["class", "data-theme", "data-color-scheme", "style"] };
        observer.observe(document.documentElement, opts);
        if (document.body) observer.observe(document.body, opts);
        if (window.matchMedia) {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            if (mq.addEventListener) mq.addEventListener("change", applyTheme);
        }
    }

    // 8. Rich text — escape first, then apply a small whitelist of markdown
    // patterns. Never interpolate raw model output into innerHTML unescaped.
    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
    function renderRichText(raw) {
        const escaped = escapeHtml(raw);
        const lines = escaped.split("\n");
        let html = "";
        let inList = false;
        let paragraph = [];

        const flushParagraph = () => {
            if (paragraph.length) {
                html += `<p>${paragraph.join("<br>")}</p>`;
                paragraph = [];
            }
        };
        const inline = (text) =>
            text
                .replace(/`([^`]+)`/g, "<code>$1</code>")
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        for (const line of lines) {
            const bullet = /^\s*[-*]\s+(.*)/.exec(line);
            if (bullet) {
                if (!inList) {
                    flushParagraph();
                    html += "<ul>";
                    inList = true;
                }
                html += `<li>${inline(bullet[1])}</li>`;
                continue;
            }
            if (inList) {
                html += "</ul>";
                inList = false;
            }
            if (line.trim() === "") {
                flushParagraph();
                continue;
            }
            paragraph.push(inline(line));
        }
        if (inList) html += "</ul>";
        flushParagraph();
        return html || escaped;
    }

    // 9. Helpers
    function setUnread(n) {
        unreadCount = Math.max(0, n);
        if (unreadCount > 0) {
            unreadBadge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
            unreadBadge.style.display = "block";
        } else {
            unreadBadge.style.display = "none";
        }
    }

    function toggleWidget() {
        isOpen = !isOpen;
        launcher.setAttribute("aria-expanded", String(isOpen));
        launcher.setAttribute("aria-label", isOpen ? "Close support chat" : "Open support chat");
        if (isOpen) {
            chatWindow.classList.add("sai-open");
            chatIcon.style.display = "none";
            closeIcon.style.display = "block";
            setUnread(0);
            input.focus();
            scrollToBottom(false);
        } else {
            chatWindow.classList.remove("sai-open");
            chatIcon.style.display = "block";
            closeIcon.style.display = "none";
        }
    }

    function isNearBottom() {
        return messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight < 80;
    }
    function scrollToBottom(smooth) {
        messagesBox.scrollTo({ top: messagesBox.scrollHeight, behavior: smooth === false ? "auto" : "smooth" });
        scrollBtn.style.display = "none";
    }
    messagesBox.addEventListener("scroll", () => {
        scrollBtn.style.display = isNearBottom() ? "none" : "flex";
    });
    scrollBtn.addEventListener("click", () => scrollToBottom(true));

    function appendMessage(role, text, opts) {
        opts = opts || {};
        const renderRole = (role || "").toLowerCase() === "user" ? "user" : "assistant";
        const wasNearBottom = isNearBottom();

        const row = document.createElement("div");
        row.className = `sai-msg-row sai-row-${renderRole}`;

        const bubble = document.createElement("div");
        bubble.className = `sai-msg sai-msg-${renderRole}`;
        bubble.innerHTML =
            renderRole === "assistant" ? renderRichText(text) : escapeHtml(text).replace(/\n/g, "<br>");
        row.appendChild(bubble);
        messagesBox.insertBefore(row, scrollBtn);

        if (opts.citations && opts.citations.length) renderCitations(opts.citations);
        if (wasNearBottom) scrollToBottom(false);
        return { row, bubble };
    }

    function renderCitations(citations) {
        const seen = new Map();
        for (const c of citations) {
            const name = c.filename || "source";
            seen.set(name, (seen.get(name) || 0) + 1);
        }
        const wrap = document.createElement("div");
        wrap.className = "sai-sources";
        for (const [name, count] of seen) {
            const chip = document.createElement("div");
            chip.className = "sai-source-chip";
            chip.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>' +
                `<span>${escapeHtml(name)}${count > 1 ? ` ·${count}` : ""}</span>`;
            wrap.appendChild(chip);
        }
        messagesBox.insertBefore(wrap, scrollBtn);
    }

    function showTyping() {
        const row = document.createElement("div");
        row.id = "sai-typing";
        row.className = "sai-typing";
        row.innerHTML =
            '<div class="sai-typing-indicator"><div class="sai-typing-dot"></div><div class="sai-typing-dot"></div><div class="sai-typing-dot"></div></div>';
        messagesBox.insertBefore(row, scrollBtn);
        if (isNearBottom()) scrollToBottom(false);
    }
    function hideTyping() {
        const el = document.getElementById("sai-typing");
        if (el) el.remove();
    }

    function hideSuggestions() {
        const el = document.getElementById("sai-suggestions");
        if (el) el.remove();
    }
    function renderSuggestions() {
        if (!suggestedQuestions.length || hasInteracted) return;
        hideSuggestions();
        const wrap = document.createElement("div");
        wrap.id = "sai-suggestions";
        wrap.className = "sai-suggestions";

        const label = document.createElement("div");
        label.className = "sai-suggestions-label";
        label.textContent = "Try asking";
        wrap.appendChild(label);

        for (const q of suggestedQuestions.slice(0, 4)) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "sai-suggestion-chip";
            chip.textContent = q;
            chip.addEventListener("click", () => sendMessage(q));
            wrap.appendChild(chip);
        }
        messagesBox.insertBefore(wrap, scrollBtn);
    }

    function autoResize() {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 116) + "px";
    }

    // 10. Load Organization Config
    async function loadConfig() {
        try {
            const res = await fetch(`${apiUrl}/api/v1/widget/config`, {
                headers: { "X-API-Key": apiKey },
            });
            if (!res.ok) return;
            const fetched = await res.json();
            config = Object.assign({}, config, fetched);
            if (welcomeOverride) config.welcome_message = welcomeOverride;

            applyTheme();
            if (config.widget_title) titleEl.textContent = config.widget_title;
            if (config.company_logo_url && (config.company_logo_url.startsWith("http") || config.company_logo_url.startsWith("data:image"))) {
                avatarBox.innerHTML = `<img src="${config.company_logo_url}" alt=""/>`;
            } else if (config.organization_name) {
                avatarBox.textContent = config.organization_name.charAt(0).toUpperCase();
            } else if (config.widget_title) {
                avatarBox.textContent = config.widget_title.charAt(0).toUpperCase();
            }

            if (messagesBox.querySelectorAll(".sai-msg-row").length === 0) {
                appendMessage("assistant", config.welcome_message || "Hi! How can we help?");
                renderSuggestions();
            }

            if (conversationId) await syncMessages();
        } catch (err) {
            console.warn("[SupportAI] Failed to load config:", err);
        }
    }

    // 11. Sync Messages for Polling & History
    async function syncMessages() {
        if (!conversationId || isStreaming) return;
        try {
            const res = await fetch(`${apiUrl}/api/v1/widget/conversations/${conversationId}/messages`, {
                headers: { "X-API-Key": apiKey },
            });
            if (!res.ok) {
                if (res.status === 404) {
                    conversationId = null;
                    localStorage.removeItem(storageKey);
                    knownBackendMessageCount = 0;
                }
                return;
            }
            const msgs = await res.json();

            if (msgs.length > knownBackendMessageCount) {
                const newCount = msgs.length - knownBackendMessageCount;
                hideSuggestions();
                messagesBox.querySelectorAll(".sai-msg-row, .sai-sources").forEach((el) => el.remove());
                appendMessage("assistant", config.welcome_message || "Hi! How can we help?");
                for (const msg of msgs) {
                    appendMessage(msg.role, msg.content, { citations: msg.citations });
                }
                if (!isOpen) setUnread(unreadCount + newCount);
                knownBackendMessageCount = msgs.length;
                hasInteracted = true;
            }
        } catch (err) {
            console.warn("[SupportAI] Error syncing messages:", err);
        }
    }

    // 12. Stream Message Submission
    async function sendMessage(question) {
        if (!question || isStreaming) return;
        hasInteracted = true;
        hideSuggestions();

        appendMessage("user", question);
        input.value = "";
        autoResize();
        isStreaming = true;
        sendBtn.disabled = true;
        showTyping();

        let assistantMsgEl = null;
        let fullText = "";

        const showError = (message) => {
            hideTyping();
            const wrap = document.createElement("div");
            wrap.className = "sai-error";
            const bubble = document.createElement("div");
            bubble.className = "sai-msg sai-msg-assistant";
            bubble.textContent = message;
            wrap.appendChild(bubble);
            const retry = document.createElement("button");
            retry.type = "button";
            retry.className = "sai-retry-btn";
            retry.textContent = "Try again";
            retry.addEventListener("click", () => {
                wrap.remove();
                sendMessage(question);
            });
            wrap.appendChild(retry);
            messagesBox.insertBefore(wrap, scrollBtn);
            if (isNearBottom()) scrollToBottom(false);
        };

        try {
            let response = await fetch(`${apiUrl}/api/v1/widget/chat/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
                body: JSON.stringify({ conversation_id: conversationId, question: question }),
            });

            // Auto-recovery: if the stored conversation is gone, start a fresh one.
            if (response.status === 404) {
                conversationId = null;
                localStorage.removeItem(storageKey);
                knownBackendMessageCount = 0;
                response = await fetch(`${apiUrl}/api/v1/widget/chat/stream`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
                    body: JSON.stringify({ conversation_id: null, question: question }),
                });
            }

            if (!response.ok) {
                let errorMsg = "Sorry, something went wrong. Please try again.";
                try {
                    const errData = await response.json();
                    if (errData && errData.detail) errorMsg = errData.detail;
                } catch (e) {}
                showError(errorMsg);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const dataStr = line.slice(6).trim();
                    if (dataStr === "[DONE]") break;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === "meta" && data.conversation_id) {
                            conversationId = data.conversation_id;
                            localStorage.setItem(storageKey, conversationId);
                        } else if (data.type === "token" && data.content) {
                            if (!assistantMsgEl) {
                                hideTyping();
                                assistantMsgEl = appendMessage("assistant", "");
                            }
                            fullText += data.content;
                            assistantMsgEl.bubble.innerHTML = renderRichText(fullText);
                            if (isNearBottom()) scrollToBottom(false);
                        } else if (data.type === "citations" && data.citations) {
                            if (assistantMsgEl) renderCitations(data.citations);
                        }
                    } catch (e) {
                        // Ignore non-JSON chunks
                    }
                }
            }
            knownBackendMessageCount += 2;
        } catch (error) {
            showError("Could not reach the server. Please check your connection.");
        } finally {
            hideTyping();
            isStreaming = false;
            sendBtn.disabled = input.value.trim().length === 0;
            input.focus();
        }
    }

    // 13. Event Listeners
    launcher.addEventListener("click", toggleWidget);
    closeBtn.addEventListener("click", toggleWidget);
    input.addEventListener("input", () => {
        autoResize();
        sendBtn.disabled = input.value.trim().length === 0 || isStreaming;
    });
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const text = input.value.trim();
            if (text) sendMessage(text);
        }
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen) toggleWidget();
    });
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) sendMessage(text);
    });

    // 14. Public API — lets the host page open the widget or ask a question on
    // the visitor's behalf. No-ops if another instance already registered it.
    if (!window.SupportAIWidget) {
        window.SupportAIWidget = {
            open: () => { if (!isOpen) toggleWidget(); },
            close: () => { if (isOpen) toggleWidget(); },
            toggle: toggleWidget,
            ask: (question) => {
                if (!isOpen) toggleWidget();
                sendMessage(question);
            },
        };
    }

    // 15. Initialize
    loadConfig();
    setInterval(syncMessages, 5000);
})();
