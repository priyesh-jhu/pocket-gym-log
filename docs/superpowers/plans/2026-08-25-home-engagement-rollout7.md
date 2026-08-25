# Home Engagement Rollout 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV export (one row per logged set) and a "Share" button on the Progress dashboard that exports a purpose-built stats card as a shareable image.

**Architecture:** A shared `downloadBlob`/`downloadText` helper (extracted from the existing ad hoc `downloadJSON` in `src/App.jsx`) backs both the new CSV export and the image-share fallback. CSV export is one new pure function. Image sharing wraps `html-to-image` (new dependency) and `navigator.share` behind one small function, isolating browser APIs from the new `ShareableStatsCard` component, which is a standalone card — not a reuse of the live dashboard UI — rendered permanently off-screen so it's always ready to snapshot with no mount-timing race.

**Tech Stack:** React 19, `html-to-image` (new dependency), Node's native test runner (`node --test src`).

**Spec:** `docs/superpowers/specs/2026-08-25-home-engagement-rollout7-design.md`

## Global Constraints

- Sharing a single past workout (e.g. from History) is out of scope — this rollout only shares the Progress dashboard's overall range stats.
- The shareable card is a standalone, purpose-built layout — never a snapshot of the live dashboard UI.
- `navigator.share` with files is tried first; a plain PNG download is the fallback when unsupported. A user-cancelled share (`AbortError`) is not an error.
- New pure-function tests follow this project's minimal-test convention (a handful of direct `node:test` cases, no exhaustive matrices). Browser-API-heavy code (DOM snapshotting, `navigator.share`) has no automated test — verified manually, consistent with how other browser-only UI in this project (e.g. `Toast`, session-row inputs) is verified.
- Run `npm test` and `npm run build` before every commit.

---

### Task 1: Shared download helper

**Files:**
- Create: `src/download.js`
- Modify: `src/App.jsx:80-88` (replace the local `downloadJSON` with a thin wrapper over the new helper)

**Interfaces:**
- Produces: `downloadBlob(blob, filename)` → `boolean` (true on success, false if the browser refuses); `downloadText(content, filename, mimeType)` → `boolean` (wraps `content` in a `Blob` and calls `downloadBlob`).

- [ ] **Step 1: Create `src/download.js`**

```js
// ─── DOWNLOAD ───────────────────────────────────────────────────────────────────
// One Blob-download implementation shared by every export path (JSON backup,
// CSV export, and the image-share fallback) instead of each reimplementing
// the same createObjectURL/click/revokeObjectURL dance.
export function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Downloads `content` (a string) as a file with the given MIME type. */
export function downloadText(content, filename, mimeType) {
  return downloadBlob(new Blob([content], { type: mimeType }), filename);
}
```

- [ ] **Step 2: Replace `downloadJSON` in `src/App.jsx`**

`src/App.jsx` currently has (lines 79-88):
```js
// ─── HELPERS ─────────────────────────────────────────────────────────────────
function downloadJSON(data, filename) {
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:"application/json"}));
    const a = Object.assign(document.createElement("a"), { href:url, download:filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch { return false; }
}
```
Replace it with:
```js
// ─── HELPERS ─────────────────────────────────────────────────────────────────
function downloadJSON(data, filename) {
  return downloadText(JSON.stringify(data, null, 2), filename, "application/json");
}
```
Add the import near `App.jsx`'s other local imports (check the existing import block at the top of the file for where sibling utility imports live, e.g. near `import { buildBackup, ... } from "./backup.js";`, and add a line in the same style):
```js
import { downloadText } from "./download.js";
```

- [ ] **Step 3: Verify**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0` (no test covers `downloadJSON`/`downloadBlob`/`downloadText` directly — they are browser-only, DOM-side-effecting functions with no automated coverage in this project's `node:test` setup, consistent with how this helper was already untested before this task).

Run: `npm run build`
Expected: build succeeds.

Manually confirm existing JSON export still works: `npm run dev`, tap the existing export icon in the top bar, confirm a `.json` file downloads exactly as before this change.

- [ ] **Step 4: Commit**

```bash
git add src/download.js src/App.jsx
git commit -m "Extract a shared Blob-download helper from the JSON export path"
```

---

### Task 2: CSV export

**Files:**
- Create: `src/csvExport.js`
- Create: `src/csvExport.test.js`
- Modify: `src/App.jsx` (add an "Export CSV" action next to the existing export/import icons)

**Interfaces:**
- Consumes: `downloadText(content, filename, mimeType)` from `src/download.js` (Task 1).
- Produces: `sessionsToCsv(sessions)` → CSV string, one header row plus one row per logged set (`date,day,exercise,weight,unit,reps,rpe`).

- [ ] **Step 1: Write the failing tests**

Create `src/csvExport.test.js`:
```js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sessionsToCsv } from "./csvExport.js";

describe("sessionsToCsv", () => {
  test("produces one row per set across sessions and exercises", () => {
    const sessions = [
      { date: "2026-08-18", day: "TUE", exercises: [{ name: "Bicep Curls", sets: [
        { weight: "25", reps: "12", unit: "lb", rpe: 8 },
        { weight: "25", reps: "11", unit: "lb", rpe: 9 },
      ] }] },
    ];
    const csv = sessionsToCsv(sessions);
    const lines = csv.split("\r\n");
    assert.equal(lines[0], "date,day,exercise,weight,unit,reps,rpe");
    assert.equal(lines.length, 3);
    assert.equal(lines[1], "2026-08-18,TUE,Bicep Curls,25,lb,12,8");
    assert.equal(lines[2], "2026-08-18,TUE,Bicep Curls,25,lb,11,9");
  });

  test("a set with no rpe renders a blank rpe column", () => {
    const sessions = [{ date: "2026-08-18", day: "TUE", exercises: [{ name: "Squat", sets: [{ weight: "100", reps: "5", unit: "lb" }] }] }];
    assert.equal(sessionsToCsv(sessions).split("\r\n")[1], "2026-08-18,TUE,Squat,100,lb,5,");
  });

  test("quotes a value containing a comma, doubling any internal quotes", () => {
    const sessions = [{ date: "2026-08-18", day: "TUE", exercises: [{ name: 'Row, "Bent-Over"', sets: [{ weight: "40", reps: "12", unit: "lb" }] }] }];
    assert.equal(sessionsToCsv(sessions).split("\r\n")[1], '2026-08-18,TUE,"Row, ""Bent-Over""",40,lb,12,');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A3 "sessionsToCsv"`
Expected: FAIL — `Cannot find module './csvExport.js'`.

- [ ] **Step 3: Implement `src/csvExport.js`**

```js
// ─── CSV EXPORT ─────────────────────────────────────────────────────────────────
// A flat, one-row-per-set view of the training log for spreadsheet analysis.
// Complements the JSON backup (src/backup.js), which is optimized for
// round-tripping through this app, not for opening in a spreadsheet.
const HEADER = ["date", "day", "exercise", "weight", "unit", "reps", "rpe"];

function csvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per logged set, sorted by date. rpe is blank for sets without one. */
export function sessionsToCsv(sessions) {
  const ordered = [...(Array.isArray(sessions) ? sessions : [])]
    .sort((a, b) => String(a?.date).localeCompare(String(b?.date)));
  const rows = [HEADER];
  for (const session of ordered) {
    for (const exercise of Array.isArray(session?.exercises) ? session.exercises : []) {
      for (const set of Array.isArray(exercise?.sets) ? exercise.sets : []) {
        rows.push([
          session.date ?? "",
          session.day ?? "",
          exercise.name ?? "",
          set.weight ?? "",
          set.unit ?? "",
          set.reps ?? "",
          set.rpe ?? "",
        ]);
      }
    }
  }
  return rows.map(row => row.map(csvField).join(",")).join("\r\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Wire the "Export CSV" action into the app bar**

In `src/App.jsx`, add the import:
```js
import { sessionsToCsv } from "./csvExport.js";
```
Add a new handler near the existing `exportData` function (`src/App.jsx:747-754`):
```js
  function exportCsv() {
    const ok = downloadText(sessionsToCsv(sessions), "workout-log-" + todayISO() + ".csv", "text/csv");
    setSaveStatus(ok ? "saved" : "error"); setStatusMsg(ok ? "CSV downloaded ✓" : "CSV export failed.");
    setTimeout(() => { setSaveStatus("idle"); setStatusMsg(null); }, 2000);
  }
```
Add a new button next to the existing export/import icons in the `AppBar`'s `actions` (`src/App.jsx:900-905`, right after the existing export `Button`):
```jsx
            <Button variant="text" onClick={exportData} aria-label="Export workout data">
              <Download size={16} />
            </Button>
            <Button variant="text" onClick={exportCsv} aria-label="Export workout data as CSV">
              <FileSpreadsheet size={16} />
            </Button>
            <Button variant="text" onClick={triggerImport} aria-label="Import workout data">
              <Upload size={16} />
            </Button>
```
`src/App.jsx:22` currently reads:
```js
import { BarChart3, Cloud, Download, Home, History, Scale, Settings, Upload, X } from "lucide-react";
```
Add `FileSpreadsheet` to that same import list (keep the rest alphabetized as-is, insert it after `Download`):
```js
import { BarChart3, Cloud, Download, FileSpreadsheet, Home, History, Scale, Settings, Upload, X } from "lucide-react";
```

- [ ] **Step 6: Verify manually**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, tap the new spreadsheet icon in the top bar, confirm a `.csv` file downloads, and open it to confirm the header row and one row per logged set with the right values.

- [ ] **Step 7: Commit**

```bash
git add src/csvExport.js src/csvExport.test.js src/App.jsx
git commit -m "Add CSV export of logged sets"
```

---

### Task 3: Image-share wrapper

**Files:**
- Modify: `package.json` (add `html-to-image` dependency)
- Create: `src/imageShare.js`

**Interfaces:**
- Consumes: `downloadBlob(blob, filename)` from `src/download.js` (Task 1).
- Produces: `shareElementAsImage(element, filename)` → `Promise<{ ok: boolean, method?: "share"|"download", cancelled?: boolean, error?: Error }>`.

- [ ] **Step 1: Add the dependency**

Run: `npm install html-to-image`

This adds an entry to `package.json`'s `dependencies` and updates `package-lock.json` — no manual edit needed, `npm install` does this.

- [ ] **Step 2: Implement `src/imageShare.js`**

```js
// ─── IMAGE SHARE ────────────────────────────────────────────────────────────────
// Isolates the two browser APIs this feature depends on (html-to-image's DOM
// snapshotting, and the Web Share API) behind one function, so the calling
// component only deals with a plain result object.
import { toBlob } from "html-to-image";
import { downloadBlob } from "./download.js";

/**
 * Renders `element` to a PNG and shares or downloads it.
 * Tries navigator.share with a file attachment first (opens the native share
 * sheet); falls back to a plain download when file sharing isn't supported.
 * A user cancelling the share sheet (AbortError) is reported as ok, not an
 * error — they made a choice, nothing went wrong.
 */
export async function shareElementAsImage(element, filename) {
  let blob;
  try {
    blob = await toBlob(element, { pixelRatio: 2 });
  } catch (error) {
    return { ok: false, error };
  }
  if (!blob) return { ok: false, error: new Error("Could not render the image.") };

  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return { ok: true, method: "share" };
    } catch (error) {
      if (error?.name === "AbortError") return { ok: true, method: "share", cancelled: true };
      return { ok: false, error };
    }
  }

  return downloadBlob(blob, filename)
    ? { ok: true, method: "download" }
    : { ok: false, error: new Error("Download failed.") };
}
```

- [ ] **Step 3: Verify**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0` (no automated test for this file — it depends entirely on browser APIs, `navigator.share`/`html-to-image`'s canvas rendering, neither available in this project's `node:test` runner; verified manually in Task 4 once there's a real element to point it at).

Run: `npm run build`
Expected: build succeeds (confirms the new dependency resolves correctly).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/imageShare.js
git commit -m "Add image-share wrapper around html-to-image and the Web Share API"
```

---

### Task 4: Shareable stats card and Progress dashboard wiring

**Files:**
- Create: `src/components/ShareableStatsCard.jsx`
- Create: `src/components/ShareableStatsCard.css`
- Modify: `src/components/index.js` (export the new component)
- Modify: `src/screens/ProgressScreen.jsx` (Share button, off-screen card, status message)
- Modify: `src/screens/ProgressScreen.css` (toolbar status text style)

**Interfaces:**
- Consumes: `dashboardRangeSummary`, `currentStreak`, `personalRecords`, `dominantUnit` from `src/stats.js` (existing exports); `shareElementAsImage` from `src/imageShare.js` (Task 3).
- Produces: `ShareableStatsCard({ sessions, rangeDays })`, a `forwardRef` component whose root DOM node is the ref target for `shareElementAsImage`.

- [ ] **Step 1: Create `ShareableStatsCard`**

`src/components/ShareableStatsCard.jsx`:
```jsx
import { forwardRef } from "react";
import { currentStreak, dashboardRangeSummary, dominantUnit, personalRecords } from "../stats.js";
import "./ShareableStatsCard.css";

function displayVolume(valueLb, unit) {
  const converted = unit === "kg" ? valueLb / 2.20462 : valueLb;
  return Math.round(converted).toLocaleString();
}

const ShareableStatsCard = forwardRef(function ShareableStatsCard({ sessions, rangeDays }, ref) {
  const unit = dominantUnit(sessions);
  const range = dashboardRangeSummary(sessions, rangeDays);
  const streak = currentStreak(sessions);
  const topPR = personalRecords(sessions, 20).find(record => record.date >= range.start && record.date <= range.end) || null;

  return (
    <div ref={ref} className="shareable-stats-card">
      <p className="shareable-stats-card__brand">Pocket Gym Log</p>
      <p className="shareable-stats-card__range">{range.start} – {range.end}</p>
      <div className="shareable-stats-card__stat">
        <strong>{displayVolume(range.volume, unit)}</strong>
        <span>{unit} total volume</span>
      </div>
      <div className="shareable-stats-card__stat">
        <strong>{range.sessions}</strong>
        <span>{range.sessions === 1 ? "session" : "sessions"}</span>
      </div>
      <div className="shareable-stats-card__stat">
        <strong>{streak.current}</strong>
        <span>{streak.current === 1 ? "day streak" : "day streak"}</span>
      </div>
      {topPR && (
        <div className="shareable-stats-card__stat">
          <strong>{topPR.weight}{topPR.unit}</strong>
          <span>{topPR.name} · new best</span>
        </div>
      )}
    </div>
  );
});

export default ShareableStatsCard;
```

- [ ] **Step 2: Add its CSS**

`src/components/ShareableStatsCard.css` — a fixed 1080×1920 layout (a common vertical share/story aspect ratio), styled with the app's existing design tokens:
```css
.shareable-stats-card {
  width: 1080px;
  height: 1920px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 64px;
  padding: 96px;
  background: var(--surface);
  color: var(--on-surface);
  font-family: var(--font-sans);
  box-sizing: border-box;
}
.shareable-stats-card__brand { margin: 0; font-size: 40px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--primary); }
.shareable-stats-card__range { margin: 0; font-size: 32px; color: var(--on-surface-variant); }
.shareable-stats-card__stat { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.shareable-stats-card__stat strong { font-size: 96px; font-weight: 800; line-height: 1; }
.shareable-stats-card__stat span { font-size: 32px; color: var(--on-surface-variant); }
```
(This card intentionally uses literal pixel values rather than the `--sp*` spacing scale/`--text-*` type scale — it's a fixed-size 1080×1920 export image, not a responsive in-app layout, so it isn't bound by the same token-only sizing convention as regular screens. It still uses the color tokens — `--surface`, `--on-surface`, `--on-surface-variant`, `--primary`, `--font-sans` — so it stays on-theme.)

- [ ] **Step 3: Export it from the component index**

In `src/components/index.js`, add:
```js
export { default as ShareableStatsCard } from "./ShareableStatsCard.jsx";
```

- [ ] **Step 4: Wire the Share button and off-screen card into Progress**

In `src/screens/ProgressScreen.jsx`, update imports:
```js
import { Button, Card, Chip, SegmentedButtons, Sheet, ShareableStatsCard } from "../components/index.js";
import { shareElementAsImage } from "../imageShare.js";
```
Update `ProgressToolbar` to accept and render the new button and status text:
```jsx
function ProgressToolbar({ settings, onChange, onCustomize, onShare, shareStatus }) {
  return <div className="progress-toolbar">
    <SegmentedButtons ariaLabel="Progress range" value={settings.rangeDays} onChange={rangeDays => onChange({ rangeDays })} options={[
      { value: 7, label: "7 days", ariaLabel: "Show last 7 days" },
      { value: 28, label: "28 days", ariaLabel: "Show last 28 days" },
      { value: 90, label: "90 days", ariaLabel: "Show last 90 days" },
    ]} />
    <Button variant="text" onClick={onCustomize}>Customize dashboard</Button>
    <Button variant="text" onClick={onShare}>Share</Button>
    {shareStatus && <span className="progress-toolbar__share-status" role="status">{shareStatus}</span>}
  </div>;
}
```
Inside the `ProgressScreen` function body, add a ref and a share handler (place near the other `useState`/`useRef` declarations already in this component):
```js
  const shareCardRef = useRef(null);
  const [shareStatus, setShareStatus] = useState("");

  async function handleShare() {
    setShareStatus("Preparing image…");
    const result = await shareElementAsImage(shareCardRef.current, `pocket-gym-log-${settings.rangeDays}d.png`);
    if (!result.ok) setShareStatus("Couldn't create the share image. Try again.");
    else if (result.method === "download") setShareStatus("Image downloaded ✓");
    else setShareStatus("");
    setTimeout(() => setShareStatus(""), 2500);
  }
```
Update the `<ProgressToolbar>` call site to pass the new props:
```jsx
    <ProgressToolbar settings={settings} onChange={saveChanges} onCustomize={event => { customizeReturnRef.current=event.currentTarget; setCustomizing(true); }} onShare={handleShare} shareStatus={shareStatus} />
```
Add the always-mounted, visually-hidden card directly after the toolbar (it needs no conditional rendering — being permanently off-screen means `shareCardRef.current` is always ready, avoiding any mount-timing race with `handleShare`):
```jsx
    <div className="progress-share-offscreen" aria-hidden="true">
      <ShareableStatsCard ref={shareCardRef} sessions={sessions} rangeDays={settings.rangeDays} />
    </div>
```

- [ ] **Step 5: Add the remaining supporting CSS**

In `src/screens/ProgressScreen.css`, add:
```css
.progress-toolbar__share-status { color: var(--on-surface-variant); font-size: var(--text-label-sm); }
.progress-share-offscreen { position: fixed; left: -9999px; top: 0; pointer-events: none; }
```

- [ ] **Step 6: Verify manually**

Run: `npm test && npm run build`
Expected: full suite passes, build succeeds.

Run `npm run dev` (or, ideally, test on a real mobile browser/PWA install for the native share-sheet path), open Progress, tap "Share", and confirm:
- On a browser/device supporting file sharing, the native share sheet opens with a PNG attached showing the current range's stats.
- On a browser without that support, a PNG downloads instead, and the status message reads "Image downloaded ✓".
- Switching the 7/28/90-day range before sharing changes the numbers on the shared card to match.
- Cancelling the native share sheet doesn't show an error message.
- On a profile with no PR in the selected range, the card shows 3 stat blocks (volume, sessions, streak) with no empty/placeholder 4th block.

- [ ] **Step 7: Commit**

```bash
git add src/components/ShareableStatsCard.jsx src/components/ShareableStatsCard.css src/components/index.js src/screens/ProgressScreen.jsx src/screens/ProgressScreen.css
git commit -m "Add shareable stats card and Share button to the Progress dashboard"
```

---

## Final Verification

After all four tasks:

- [ ] Run `npm test` — full suite passes.
- [ ] Run `npm run build` — succeeds with no errors.
- [ ] Run `npm run lint` — no new warnings/errors introduced by this rollout's files.
- [ ] Manually walk through, in one `npm run dev` session (and ideally once on a real phone/PWA for the native share sheet): CSV export downloads a correct file, and Progress's Share button produces a correct, on-brand image via both the share and download paths.
- [ ] Bump version (`npm version minor --no-git-tag-version` — new feature, not a bug fix), rebuild, commit, `firebase deploy --only hosting`, `git push` — per this project's established release process.
