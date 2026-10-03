/* =========================================================================
   ITM 特別教育 学習アプリ — メインロジック
   UI はベトナム語（デフォルト）、日本語切替対応
   漢字にはルビ（ふりがな）を表示する
   ========================================================================= */
(function () {
  "use strict";

  // ---------- データ参照 ----------
  const CATS = window.DATA_CATEGORIES;
  const CHS  = window.DATA_CHAPTERS;
  const FCS  = window.DATA_FLASHCARDS;
  const DRS  = window.DATA_DRILLS;
  const I    = window.I18N;

  // ---------- 状態 ----------
  const store = {
    lang: "vi",          // "vi" | "jp"
    view: "ebook",       // "ebook" | "flash" | "drill"
    // ebook
    query: "",
    activeCat: "all",
    activeChapter: null,
    searchOpen: false,
    tocCollapsed: false,
    // flash
    flashDir: "jp",      // "jp" | "vn"
    flashCat: "all",
    flashChapter: "all",
    flashDeck: [],
    flashIndex: 0,
    flipped: false,
    // drill
    drillCat: "all",
    drillChapter: "all",
    drillDeck: [],
    drillIndex: 0,
    drillAnswered: false,
    drillSelected: -1,
    drillCorrectCount: 0,
    drillWrongCount: 0,
  };

  const KEY = "itm_special_v2";
  let progress = { known: {}, correct: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) progress = JSON.parse(raw);
  } catch (e) { progress = { known: {}, correct: {} }; }

  function saveProgress() {
    try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {}
  }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---------- i18n ----------
  function t(key) { return (I[store.lang] && I[store.lang][key]) || key; }

  function updateUI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      if (I[store.lang] && I[store.lang][k]) el.textContent = I[store.lang][k];
    });
    $("#appTitle").textContent = t("appTitle");
    $("#appSubtitle").textContent = t("appSubtitle");
    $("#langLabel").textContent = t("langToggle");
  }

  // ---------- ユーティリティ ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 「漢字{かな}」→ <ruby>漢字<rt>かな</rt></ruby>
  function ruby(s) {
    if (s == null) return "";
    const t = esc(String(s));
    return t.replace(
      /([^\s\u0000-\u007F]+)\{([ぁ-んァ-ヶｰー\u3000-\u303F]{1,20})\}/g,
      "<ruby>$1<rt>$2</rt></ruby>"
    );
  }

  function catById(id) { return CATS.find((x) => x.id === id); }
  function catLabel(id) {
    const c = catById(id);
    if (!c) return id;
    return store.lang === "jp" ? (c.label || id) : (c.labelVN || c.label || id);
  }
  function catIcon(id) {
    const c = catById(id);
    return c ? c.icon : "";
  }

  // ---------- レンダリング ----------
  function render() {
    switch (store.view) {
      case "ebook": renderEbook(); break;
      case "flash": renderFlash(); break;
      case "drill": renderDrill(); break;
    }
    renderProgress();
  }

  function renderProgress() {
    const totalFC = FCS.filter(fc => fc.jp && fc.vn).length;
    const totalDR = DRS.filter(dr => dr.question && dr.options && dr.options.length >= 2).length;
    const total = totalFC + totalDR;
    const done = Object.keys(progress.known).length + Object.keys(progress.correct).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("#progressFill").style.width = pct + "%";
    $("#progressLabel").textContent = t("progressLabel") + " " + pct + "%（" + done + "/" + total + "）";
  }

  // ===================== 電子ブック =====================
  function chapterMatches(q, cat, ch) {
    if (cat !== "all" && ch.category !== cat) return false;
    if (!q) return true;
    const hay = [ch.title, ch.subtitle, ch.num + "", catLabel(ch.category)];
    ch.sections.forEach((s) => {
      hay.push(s.heading, s.headingVN);
      s.blocks.forEach((b) => {
        if (b.text) hay.push(b.text);
        if (b.textVN) hay.push(b.textVN);
        if (b.items) b.items.forEach((it) => {
          if (it.jp) hay.push(it.jp);
          if (it.vn) hay.push(it.vn);
        });
      });
    });
    return hay.join(" ").toLowerCase().includes(q.toLowerCase());
  }

  function renderEbook() {
    const q = store.query.trim();
    const cat = store.activeCat;

    // ソート: numの昇順
    const sortedCHS = [...CHS].sort((a, b) => a.num - b.num);
    const chapters = sortedCHS.filter((ch) => chapterMatches(q, cat, ch));

    // 目次
    let tocHTML = '<div class="toc-inner">';
    tocHTML += '<button class="toc-mobile-toggle" id="tocMobileToggle">' + t("tocTitle") + ' ▼</button>';
    tocHTML += '<div class="toc-head">' +
      '<span class="toc-title">' + t("tocTitle") + '</span>' +
      '<button class="toc-search-toggle" id="tocSearchToggle" title="' + t("searchBtn") + '">' +
      (store.searchOpen ? "✕" : "🔍") + "</button></div>";
    tocHTML += '<input class="toc-search" id="tocSearch"' +
      (store.searchOpen ? "" : " style='display:none'") +
      ' type="search" placeholder="' + esc(t("tocSearch")) + '" value="' + esc(store.query) + '" />';

    // カテゴリフィルタ
    tocHTML += '<div class="toc-cat-filter">';
    tocHTML += '<button class="toc-cat-btn' + (cat === "all" ? " active" : "") +
      '" data-cat="all">' + t("catAll") + '</button>';
    CATS.forEach((c) => {
      tocHTML += '<button class="toc-cat-btn' + (cat === c.id ? " active" : "") +
        '" data-cat="' + c.id + '">' + c.icon + " " +
        (store.lang === "jp" ? ruby(c.label) : esc(c.labelVN)) + '</button>';
    });
    tocHTML += '</div>';

    if (chapters.length === 0) {
      tocHTML += '<div class="toc-empty">' + t("tocEmpty") + '</div>';
    } else {
      chapters.forEach((ch) => {
        const active = store.activeChapter === ch.id ? " active" : "";
        tocHTML += '<button class="toc-item' + active + '" data-jump="' + ch.id + '">' +
          '<span class="num">' + ch.num + '.</span>' +
          '<span class="cat-icon">' + catIcon(ch.category) + '</span>' +
          ruby(ch.title) + "</button>";
      });
    }
    tocHTML += "</div>";

    // 本文
    let body = "";
    if (chapters.length === 0) {
      body = '<div class="card" style="padding:24px">' + t("noResults") + '</div>';
    } else {
      chapters.forEach((ch) => { body += chapterHTML(ch); });
    }

    $("#main").innerHTML =
      '<div class="ebook-layout"><aside class="toc' +
      (store.tocCollapsed ? " collapsed" : "") + '">' + tocHTML + '</aside>' +
      '<div class="toc-body">' + body + '</div></div>';

    // イベント
    const toggle = $("#tocSearchToggle");
    if (toggle) toggle.addEventListener("click", () => {
      store.searchOpen = !store.searchOpen;
      if (!store.searchOpen) store.query = "";
      renderEbook();
      if (store.searchOpen) { const s = $("#tocSearch"); if (s) s.focus(); }
    });

    const input = $("#tocSearch");
    if (input) input.addEventListener("input", () => {
      store.query = input.value;
      store.activeChapter = null;
      renderEbook();
      const s = $("#tocSearch");
      if (s) s.focus();
    });

    const mobileToggle = $("#tocMobileToggle");
    if (mobileToggle) mobileToggle.addEventListener("click", () => {
      store.tocCollapsed = !store.tocCollapsed;
      renderEbook();
    });

    $$(".toc-item").forEach((b) => {
      b.addEventListener("click", () => {
        store.activeChapter = b.getAttribute("data-jump");
        renderEbook();
        const el = document.getElementById("ch-" + store.activeChapter);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          // 開く
          const hdr = el.querySelector(".chapter-header");
          const cnt = el.querySelector(".chapter-content");
          if (hdr && cnt && !cnt.classList.contains("open")) {
            hdr.classList.add("open");
            cnt.classList.add("open");
            const tgl = el.querySelector(".chapter-toggle");
            if (tgl) tgl.classList.add("open");
          }
        }
      });
    });

    $$(".toc-cat-btn").forEach((b) => {
      b.addEventListener("click", () => {
        store.activeCat = b.getAttribute("data-cat");
        store.activeChapter = null;
        renderEbook();
      });
    });

    // チャプター開閉
    $$(".chapter-header").forEach((h) => {
      h.addEventListener("click", () => {
        h.classList.toggle("open");
        const cnt = h.nextElementSibling;
        if (cnt) cnt.classList.toggle("open");
        const tgl = h.querySelector(".chapter-toggle");
        if (tgl) tgl.classList.toggle("open");
      });
    });
  }

  function chapterHTML(ch) {
    const isOpen = store.activeChapter === ch.id;
    let html = '<div class="chapter-card" id="ch-' + ch.id + '">';
    html += '<div class="chapter-header' + (isOpen ? " open" : "") + '">';
    html += '<span class="chapter-num">' + ch.num + '</span>';
    html += '<div class="chapter-title-wrap">';
    html += '<p class="chapter-title">' + catIcon(ch.category) + " " + ruby(ch.title) + '</p>';
    if (ch.subtitle) html += '<p class="chapter-subtitle">' + esc(ch.subtitle) + '</p>';
    html += '</div>';
    html += '<span class="chapter-toggle' + (isOpen ? " open" : "") + '">▼</span>';
    html += '</div>';

    html += '<div class="chapter-content' + (isOpen ? " open" : "") + '">';
    ch.sections.forEach((sec) => {
      if (sec.heading && sec.heading !== "Slide 1") {
        html += '<div class="section-head">';
        html += '<h2>' + ruby(sec.heading) + '</h2>';
        if (sec.headingVN) html += '<span class="vn">' + esc(sec.headingVN) + '</span>';
        html += '</div>';
      }
      sec.blocks.forEach((b) => { html += blockHTML(b); });
    });
    html += '</div></div>';
    return html;
  }

  function blockHTML(b) {
    switch (b.type) {
      case "p": {
        let h = '<div class="block block-p">';
        if (b.text) h += '<div class="jp-text">' + ruby(b.text) + '</div>';
        if (b.textVN && b.textVN !== b.text) h += '<div class="vn-text">' + esc(b.textVN) + '</div>';
        return h + '</div>';
      }
      case "list": {
        let h = '<ul class="block block-list">';
        (b.items || []).forEach((it) => {
          h += '<li>';
          if (it.jp) h += '<div class="jp-text">' + ruby(it.jp) + '</div>';
          if (it.vn) h += '<div class="vn-text">' + esc(it.vn) + '</div>';
          h += '</li>';
        });
        return h + '</ul>';
      }
      case "vocab": {
        let h = '<div class="block block-vocab">';
        (b.items || []).forEach((it) => {
          h += '<div class="vocab-item">';
          h += '<div class="vocab-jp">' + ruby(it.jp || "") + '</div>';
          if (it.romaji) h += '<div class="vocab-romaji">' + esc(it.romaji) + '</div>';
          if (it.vn) h += '<div class="vocab-vn">' + esc(it.vn) + '</div>';
          h += '</div>';
        });
        return h + '</div>';
      }
      case "quote": {
        let h = '<div class="block block-quote">';
        if (b.text) h += '<div class="jp-text">' + ruby(b.text) + '</div>';
        if (b.textVN) h += '<div class="vn-text">' + esc(b.textVN) + '</div>';
        return h + '</div>';
      }
      case "note": {
        let h = '<div class="block block-note">';
        h += '<div class="note-label">📝 ' + t("ebookNotes") + '</div>';
        if (b.text) h += '<div class="jp-text">' + ruby(b.text).replace(/\n/g, "<br>") + '</div>';
        if (b.textVN) h += '<div class="vn-text">' + esc(b.textVN).replace(/\n/g, "<br>") + '</div>';
        return h + '</div>';
      }
      case "table": {
        if (!b.rows || b.rows.length === 0) return "";
        let h = '<table class="block block-table">';
        b.rows.forEach((row, i) => {
          h += '<tr>';
          row.forEach((cell) => {
            h += (i === 0 ? '<th>' : '<td>') + ruby(cell) + (i === 0 ? '</th>' : '</td>');
          });
          h += '</tr>';
        });
        return h + '</table>';
      }
      default: return '';
    }
  }

  // ===================== フラッシュカード =====================
  function filterFlashcards() {
    let deck = FCS.filter(fc => fc.jp && fc.vn && fc.jp.trim() && fc.vn.trim());
    // ゴミデータ除去
    deck = deck.filter(fc => {
      const jp = fc.jp.trim();
      return jp !== "ITM外語センター" &&
             jp !== "Trung tâm ngoại ngữ tiếng Nhật ITM" &&
             jp.length > 1;
    });
    if (store.flashCat !== "all") deck = deck.filter(fc => fc.category === store.flashCat);
    if (store.flashChapter !== "all") deck = deck.filter(fc => fc.chapter === store.flashChapter);
    // 既知を除外
    deck = deck.filter(fc => !progress.known[fc.id]);
    return deck;
  }

  function renderFlash() {
    if (store.flashDeck.length === 0) {
      store.flashDeck = filterFlashcards();
      store.flashIndex = 0;
      store.flipped = false;
    }

    let html = '<h2>' + t("flashTitle") + '</h2>';

    // コントロール
    html += '<div class="flash-controls">';
    html += '<label>' + t("flashDir") + ': </label>';
    html += '<select id="flashDirSel">';
    html += '<option value="jp"' + (store.flashDir === "jp" ? " selected" : "") + '>' + t("flashDirJP") + '</option>';
    html += '<option value="vn"' + (store.flashDir === "vn" ? " selected" : "") + '>' + t("flashDirVN") + '</option>';
    html += '</select>';
    html += '<label>' + t("flashCat") + ': </label>';
    html += '<select id="flashCatSel">';
    html += '<option value="all">' + t("flashCatAll") + '</option>';
    CATS.forEach(c => {
      html += '<option value="' + c.id + '"' + (store.flashCat === c.id ? " selected" : "") + '>' +
        c.icon + " " + (store.lang === "jp" ? c.label.replace(/\{[^}]+\}/g, "") : c.labelVN) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    const deck = store.flashDeck;
    if (deck.length === 0) {
      html += '<div class="flash-complete">' + t("flashComplete") +
        '<br><button class="drill-btn" id="flashResetBtn">' + t("flashReset") + '</button></div>';
      $("#main").innerHTML = html;
      const rb = $("#flashResetBtn");
      if (rb) rb.addEventListener("click", () => { progress.known = {}; saveProgress(); store.flashDeck = []; render(); });
      bindFlashControls();
      return;
    }

    const card = deck[store.flashIndex % deck.length];
    const front = store.flashDir === "jp" ? card.jp : card.vn;
    const back = store.flashDir === "jp" ? card.vn : card.jp;
    const romaji = card.romaji || "";

    html += '<div class="flash-card-wrap"><div class="flash-card" id="flashCard">';
    html += '<div class="flash-card-inner' + (store.flipped ? " flipped" : "") + '">';
    html += '<div class="flash-front"><div class="flash-main-text">' + ruby(front) + '</div>';
    if (store.flashDir === "jp" && romaji) html += '<div class="flash-romaji">' + esc(romaji) + '</div>';
    html += '<div class="flash-sub-text" style="margin-top:12px;font-size:13px;color:var(--muted)">' + t("flashFlip") + ' 👆</div>';
    html += '</div>';
    html += '<div class="flash-back"><div class="flash-main-text">' + ruby(back) + '</div>';
    if (store.flashDir === "vn" && romaji) html += '<div class="flash-romaji">' + esc(romaji) + '</div>';
    html += '</div>';
    html += '</div></div></div>';

    html += '<div class="flash-actions">';
    if (store.flipped) {
      html += '<button class="flash-btn flash-btn-again" id="flashAgain">' + t("flashAgain") + '</button>';
      html += '<button class="flash-btn flash-btn-known" id="flashKnown">' + t("flashKnown") + '</button>';
    } else {
      html += '<button class="flash-btn flash-btn-flip" id="flashFlip">' + t("flashFlip") + '</button>';
    }
    html += '</div>';

    html += '<div class="flash-progress">' + t("flashProgress") + ' ' +
      (store.flashIndex + 1) + ' / ' + deck.length + '</div>';

    $("#main").innerHTML = html;

    // イベント
    const fc = $("#flashCard");
    if (fc) fc.addEventListener("click", () => { store.flipped = !store.flipped; render(); });
    const fb = $("#flashFlip");
    if (fb) fb.addEventListener("click", () => { store.flipped = true; render(); });
    const fk = $("#flashKnown");
    if (fk) fk.addEventListener("click", () => {
      progress.known[card.id] = true; saveProgress();
      store.flashDeck = filterFlashcards();
      store.flashIndex = store.flashIndex >= store.flashDeck.length ? 0 : store.flashIndex;
      store.flipped = false; render();
    });
    const fa = $("#flashAgain");
    if (fa) fa.addEventListener("click", () => {
      store.flashIndex = (store.flashIndex + 1) % deck.length;
      store.flipped = false; render();
    });
    bindFlashControls();
  }

  function bindFlashControls() {
    const ds = $("#flashDirSel");
    if (ds) ds.addEventListener("change", () => { store.flashDir = ds.value; store.flipped = false; render(); });
    const cs = $("#flashCatSel");
    if (cs) cs.addEventListener("change", () => {
      store.flashCat = cs.value; store.flashDeck = []; store.flashIndex = 0; store.flipped = false; render();
    });
  }

  // ===================== ドリル =====================
  function filterDrills() {
    let deck = DRS.filter(dr =>
      dr.question && dr.question.trim() &&
      dr.options && dr.options.length >= 2 &&
      dr.question.length > 2 &&
      dr.question !== "ITM外語センター"
    );
    if (store.drillCat !== "all") deck = deck.filter(dr => dr.category === store.drillCat);
    if (store.drillChapter !== "all") deck = deck.filter(dr => dr.chapter === store.drillChapter);
    return deck;
  }

  function renderDrill() {
    if (store.drillDeck.length === 0) {
      store.drillDeck = filterDrills();
      store.drillIndex = 0;
      store.drillAnswered = false;
      store.drillSelected = -1;
      store.drillCorrectCount = 0;
      store.drillWrongCount = 0;
    }

    let html = '<h2>' + t("drillTitle") + '</h2>';

    // コントロール
    html += '<div class="drill-controls">';
    html += '<label>' + t("drillCat") + ': </label>';
    html += '<select id="drillCatSel">';
    html += '<option value="all">' + t("drillCatAll") + '</option>';
    CATS.forEach(c => {
      html += '<option value="' + c.id + '"' + (store.drillCat === c.id ? " selected" : "") + '>' +
        c.icon + " " + (store.lang === "jp" ? c.label.replace(/\{[^}]+\}/g, "") : c.labelVN) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    const deck = store.drillDeck;
    if (deck.length === 0) {
      html += '<div class="drill-complete">' + t("drillEmpty") + '</div>';
      $("#main").innerHTML = html;
      bindDrillControls();
      return;
    }

    // スコア
    if (store.drillIndex > 0 || store.drillAnswered) {
      html += '<div class="drill-score-bar">' + t("drillScore") + ': ';
      html += '<span class="score-correct">✓ ' + store.drillCorrectCount + '</span>';
      html += '<span class="score-wrong">✗ ' + store.drillWrongCount + '</span>';
      html += ' (' + (store.drillIndex + (store.drillAnswered ? 1 : 0)) + '/' + deck.length + ')';
      html += '</div>';
    }

    if (store.drillIndex >= deck.length) {
      html += '<div class="drill-complete">' + t("drillComplete") +
        '<br><br>' + t("drillScore") + ': <span class="score-correct">' + store.drillCorrectCount + '</span> / ' + deck.length +
        '<br><button class="drill-btn" id="drillRestart">' + t("drillRestart") + '</button></div>';
      $("#main").innerHTML = html;
      const rb = $("#drillRestart");
      if (rb) rb.addEventListener("click", () => { store.drillDeck = []; render(); });
      bindDrillControls();
      return;
    }

    const q = deck[store.drillIndex];
    html += '<div class="drill-card">';
    html += '<div class="drill-question">' + ruby(q.question) + '</div>';
    if (q.questionVN) html += '<div class="drill-question-vn">' + esc(q.questionVN) + '</div>';

    html += '<div class="drill-options">';
    const letters = "ABCDEFGH";
    q.options.forEach((opt, i) => {
      let cls = "drill-option";
      if (store.drillAnswered) {
        if (i === q.answer) cls += " correct";
        else if (i === store.drillSelected) cls += " wrong";
      } else if (i === store.drillSelected) {
        cls += " selected";
      }
      html += '<div class="' + cls + '" data-idx="' + i + '">';
      html += '<span class="drill-option-marker">' + letters[i] + '</span>';
      html += '<span>' + ruby(opt) + '</span>';
      html += '</div>';
    });
    html += '</div>';

    if (store.drillAnswered) {
      const isCorrect = store.drillSelected === q.answer;
      html += '<div class="drill-feedback ' + (isCorrect ? "correct" : "wrong") + '">';
      html += isCorrect ? t("drillCorrect") : (t("drillWrong") + ruby(q.options[q.answer]));
      html += '</div>';
      html += '<button class="drill-btn" id="drillNext">' + t("drillNext") + '</button>';
    } else if (store.drillSelected >= 0) {
      html += '<button class="drill-btn" id="drillCheck">' + t("drillCheck") + '</button>';
    }

    html += '</div>';
    $("#main").innerHTML = html;

    // イベント
    if (!store.drillAnswered) {
      $$(".drill-option").forEach(el => {
        el.addEventListener("click", () => {
          store.drillSelected = parseInt(el.getAttribute("data-idx"));
          render();
        });
      });
    }
    const chk = $("#drillCheck");
    if (chk) chk.addEventListener("click", () => {
      store.drillAnswered = true;
      const q = deck[store.drillIndex];
      if (store.drillSelected === q.answer) {
        store.drillCorrectCount++;
        progress.correct[q.id] = true; saveProgress();
      } else {
        store.drillWrongCount++;
      }
      render();
    });
    const nxt = $("#drillNext");
    if (nxt) nxt.addEventListener("click", () => {
      store.drillIndex++;
      store.drillAnswered = false;
      store.drillSelected = -1;
      render();
    });
    bindDrillControls();
  }

  function bindDrillControls() {
    const cs = $("#drillCatSel");
    if (cs) cs.addEventListener("change", () => {
      store.drillCat = cs.value; store.drillDeck = []; render();
    });
  }

  // ===================== 初期化 =====================
  function init() {
    // タブ
    $$(".tab").forEach(b => {
      b.addEventListener("click", () => {
        $$(".tab").forEach(t => t.classList.remove("active"));
        b.classList.add("active");
        store.view = b.getAttribute("data-view");
        // リセット
        if (store.view === "flash") { store.flashDeck = []; store.flashIndex = 0; store.flipped = false; }
        if (store.view === "drill") { store.drillDeck = []; }
        render();
      });
    });

    // 言語切替
    $("#langToggle").addEventListener("click", () => {
      store.lang = store.lang === "vi" ? "jp" : "vi";
      updateUI18n();
      render();
    });

    updateUI18n();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
