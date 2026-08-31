// WS1 mechanical CSS split — copies selectors verbatim from components.css
// into the approved file structure. Range boundaries verified against the
// section banner map of components.css.
const fs = require("fs");
const src = fs
  .readFileSync("src/styles/components.css", "utf8")
  .split("\n");
const get = (a, b) => {
  let lines = src.slice(a - 1, b).join("\n");
  // Normalize partial media fragments: drop a leading @media header (the
  // wrapper re-adds it) and close any brace deficit left by cutting.
  lines = lines.replace(/^\s*@media[^{]*\{/, "");
  let opens = (lines.match(/\{/g) || []).length;
  let closes = (lines.match(/\}/g) || []).length;
  while (closes > opens) {
    const idx = lines.lastIndexOf("}");
    lines = lines.slice(0, idx) + lines.slice(idx + 1);
    closes--;
  }
  if (opens > closes) lines += "\n" + "}\n".repeat(opens - closes);
  // Drop a trailing banner comment that got cut mid-way.
  const openCmt = lines.lastIndexOf("/*");
  if (openCmt > -1 && !lines.slice(openCmt).includes("*/")) {
    lines = lines.slice(0, openCmt).trimEnd();
  }
  return lines.trim();
};

const FILES = {
  "src/styles/controls.css": { title: "Controls — buttons, badges, fields, shared control patterns" },
  "src/styles/overlays.css": { title: "Overlays — dialogs, search overlay, popovers, mention autocomplete" },
  "src/styles/layout.css": { title: "Layout — app shell, sidebar/rail, page scaffolds, stat strip" },
  "src/styles/ledger.css": { title: "Ledger — the ticket ledger signature, bulk selection, quick edit" },
  "src/styles/pages/auth.css": { title: "Auth pages (login / signup)" },
  "src/styles/pages/dashboard.css": { title: "Dashboard (workspace list)" },
  "src/styles/pages/workspace.css": { title: "Workspace workbench" },
  "src/styles/pages/labels.css": { title: "Labels management" },
  "src/styles/pages/my-issues.css": { title: "My Issues" },
  "src/styles/pages/issue.css": { title: "Issue detail" },
};

// entries: [file, start, end, media|null]
const SPLIT = [
  // controls
  ["src/styles/controls.css", 7, 426, null],        // buttons, avatar, badges, fields, alerts
  ["src/styles/controls.css", 555, 637, null],     // empty state, spinner & skeleton
  ["src/styles/controls.css", 1691, 1757, null],   // filter / issue toolbar
  ["src/styles/controls.css", 1969, 2082, null],   // issue form / label picker
  ["src/styles/controls.css", 2386, 2503, null],   // collapsible sections
  ["src/styles/controls.css", 2604, 2610, null],   // success notice
  ["src/styles/controls.css", 2819, 2825, "700px"],
  ["src/styles/controls.css", 2884, 2886, "375px"],
  ["src/styles/controls.css", 2903, 2905, "375px"],
  // overlays
  ["src/styles/overlays.css", 427, 554, null],     // dialog, shortcuts help
  ["src/styles/overlays.css", 3128, 3238, null],   // global search
  ["src/styles/overlays.css", 3367, 3430, null],   // mention autocomplete
  ["src/styles/overlays.css", 2827, 2833, "700px"],
  ["src/styles/overlays.css", 2866, 2870, "375px"],
  // layout
  ["src/styles/layout.css", 638, 1012, null],      // app shell
  ["src/styles/layout.css", 1013, 1062, null],     // page scaffolds
  ["src/styles/layout.css", 1579, 1690, null],     // stat strip
  ["src/styles/layout.css", 2631, 2693, "1024px"],
  ["src/styles/layout.css", 2705, 2709, "700px"],
  ["src/styles/layout.css", 2724, 2817, "700px"],
  ["src/styles/layout.css", 2852, 2854, "700px"],
  ["src/styles/layout.css", 2872, 2882, "375px"],
  // ledger
  ["src/styles/ledger.css", 1199, 1358, null],     // workspace selector ledger rows
  ["src/styles/ledger.css", 1758, 1968, null],     // bulk actions
  ["src/styles/ledger.css", 3239, 3366, null],     // quick edit
  ["src/styles/ledger.css", 2835, 2850, "700px"],
  ["src/styles/ledger.css", 2888, 2901, "375px"],
  // pages/auth
  ["src/styles/pages/auth.css", 1141, 1198, null],
  ["src/styles/pages/auth.css", 2862, 2864, "375px"],
  // pages/dashboard
  ["src/styles/pages/dashboard.css", 1063, 1112, null],
  // pages/workspace
  ["src/styles/pages/workspace.css", 1113, 1140, null],
  ["src/styles/pages/workspace.css", 1399, 1578, null],
  ["src/styles/pages/workspace.css", 2155, 2221, null],
  ["src/styles/pages/workspace.css", 2614, 2629, "900px"],
  // pages/labels
  ["src/styles/pages/labels.css", 2083, 2154, null],
  ["src/styles/pages/labels.css", 2222, 2298, null],
  // pages/my-issues
  ["src/styles/pages/my-issues.css", 1359, 1398, null],
  // pages/issue
  ["src/styles/pages/issue.css", 2299, 2385, null],
  ["src/styles/pages/issue.css", 2504, 2603, null],
  ["src/styles/pages/issue.css", 2694, 2703, "1024px"],
  ["src/styles/pages/issue.css", 2710, 2723, "700px"],
  ["src/styles/pages/issue.css", 2856, 2858, "700px"],
  ["src/styles/pages/issue.css", 2907, 3100, null],
  ["src/styles/pages/issue.css", 3431, 3448, null],
];

const out = {};
for (const [file, a, b, media] of SPLIT) {
  const chunk = get(a, b);
  out[file] = out[file] || [];
  out[file].push({ chunk, media });
}

for (const [file, parts] of Object.entries(out)) {
  const byMedia = new Map();
  for (const { chunk, media } of parts) {
    const key = media || "";
    if (!byMedia.has(key)) byMedia.set(key, []);
    byMedia.get(key).push(chunk);
  }
  let body = "";
  for (const [media, chunks] of byMedia) {
    const merged = chunks.join("\n\n");
    body += media ? `@media (max-width: ${media}) {\n${merged}\n}\n\n` : merged + "\n\n";
  }
  const header = `/* ============================================================================\n   ${FILES[file].title}\n   Consumes tokens from tokens.css. Split mechanically from components.css\n   (Workstream 1) — selectors copied verbatim, no visual change.\n   ========================================================================== */\n\n`;
  fs.mkdirSync(file.substring(0, file.lastIndexOf("/")), { recursive: true });
  fs.writeFileSync(file, header + body.trimEnd() + "\n");
}

// Global coarse-pointer 44px block → base.css (global accessibility primitive)
const coarse = get(3101, 3126);
fs.appendFileSync(
  "src/styles/base.css",
  `\n/* Touch targets: ensure 44px minimum on coarse pointers (global). */\n${coarse}\n`
);
console.log("split complete");
