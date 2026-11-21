/* Theme toggle --------------------------------------------------------- */
(function () {
  const root = document.documentElement;
  const btn = document.querySelector("[data-theme-toggle]");
  let stored = null;
  try { stored = localStorage.getItem("theme"); } catch (e) {}
  if (stored) root.dataset.theme = stored;

  const isDark = () =>
    root.dataset.theme ? root.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  const label = () => btn.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
  label();

  btn.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    label();
    runScan(); // contrast changes with the theme, so check again
  });
})();

/* Live accessibility check ------------------------------------------- */
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function parseColor(str) {
  const m = str.match(/\d+(\.\d+)?/g);
  return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
}
function contrast(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function accessibleName(el) {
  const img = el.querySelector("img[alt]");
  return (el.getAttribute("aria-label") || el.textContent.trim() || (img && img.alt) || el.getAttribute("title") || "").trim();
}

function checks() {
  const bodyStyle = getComputedStyle(document.body);
  const ratio = contrast(parseColor(bodyStyle.color), parseColor(bodyStyle.backgroundColor));

  const imgs = [...document.images];
  const missingAlt = imgs.filter((i) => !i.hasAttribute("alt")).length;

  const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => +h.tagName[1]);
  const skipped = levels.some((l, i) => i > 0 && l - levels[i - 1] > 1);

  const controls = [...document.querySelectorAll("a[href], button")].filter((el) => el.getAttribute("aria-hidden") !== "true");
  const unnamed = controls.filter((el) => !accessibleName(el)).length;

  const lang = document.documentElement.getAttribute("lang");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return [
    { name: "Page language", ok: !!lang, val: lang || "missing" },
    { name: "Text contrast", ok: ratio >= 4.5, val: ratio.toFixed(1) + ":1" },
    { name: "Images with alt text", ok: missingAlt === 0, val: `${imgs.length - missingAlt}/${imgs.length}` },
    { name: "Heading order", ok: !skipped, val: skipped ? "skips a level" : "no skips" },
    { name: "Links and buttons named", ok: unnamed === 0, val: `${controls.length - unnamed}/${controls.length}` },
    { name: "Keyboard skip link", ok: !!document.querySelector(".skip"), val: "Tab to see it" },
    { name: "Motion preference", ok: true, val: reduced ? "reduced, respected" : "full motion" },
  ];
}

let scanTimer = [];
function runScan() {
  const log = document.querySelector("[data-scan-log]");
  const result = document.querySelector("[data-scan-result]");
  const again = document.querySelector("[data-scan-again]");
  if (!log) return;

  scanTimer.forEach(clearTimeout); scanTimer = [];
  log.innerHTML = ""; result.hidden = true; again.hidden = true;

  const rows = checks();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const step = reduced ? 0 : 380;

  rows.forEach((r, i) => {
    scanTimer.push(setTimeout(() => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="mark ${r.ok ? "" : "warn"}" aria-hidden="true">${r.ok ? "✓" : "!"}</span>
        <span>${r.name}</span><span class="val">${r.val}</span>`;
      li.setAttribute("aria-label", `${r.name}: ${r.ok ? "passed" : "needs work"}, ${r.val}`);
      log.appendChild(li);
    }, step * (i + 1)));
  });

  scanTimer.push(setTimeout(() => {
    const passed = rows.filter((r) => r.ok).length;
    document.querySelector("[data-scan-score]").textContent = `${passed}/${rows.length}`;
    document.querySelector("[data-scan-label]").textContent =
      passed === rows.length ? "checks passed, zero issues found" : "checks passed";
    result.hidden = false; again.hidden = false;
  }, step * (rows.length + 1)));
}

document.querySelector("[data-scan-again]").addEventListener("click", runScan);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(runScan); else runScan();

/* Header: menu, active section, progress ------------------------------ */
{
  const header = document.querySelector("[data-header]");
  const nav = document.querySelector("[data-nav]");
  const menu = document.querySelector("[data-menu]");
  const bar = document.querySelector("[data-progress]");

  const closeMenu = () => { nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-label", "Open menu"); };
  menu.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { closeMenu(); menu.focus(); } });

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    header.classList.toggle("scrolled", scrollY > 10);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const links = [...nav.querySelectorAll("ul a")];
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((l) => l.toggleAttribute("aria-current", l.getAttribute("href") === "#" + en.target.id));
      links.forEach((l) => { if (l.hasAttribute("aria-current")) l.setAttribute("aria-current", "true"); });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["work", "research", "about", "journey", "contact"].forEach((id) => { const el = document.getElementById(id); if (el) sectionObserver.observe(el); });

  const y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
}
