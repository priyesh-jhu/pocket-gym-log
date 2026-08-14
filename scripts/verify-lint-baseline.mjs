import { ESLint } from "eslint";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const appPath = resolve(root, "src/App.jsx");
const source = await readFile(appPath, "utf8");
const lines = source.split("\n");
const start = lines.findIndex(line => line.includes("// Bootstrap")) + 1;
const endOffset = lines.slice(start).findIndex(line => line.includes("observeAuth("));
const end = endOffset < 0 ? -1 : start + endOffset + 1;

if (start < 1 || end < start) {
  console.error("lint-baseline: could not locate the App guest-bootstrap region");
  process.exitCode = 1;
} else {
  const eslint = new ESLint({ cwd: root });
  const results = await eslint.lintFiles(["."]);
  const findings = results.flatMap(result => result.messages.map(message => ({
    file: relative(root, result.filePath),
    line: message.line,
    ruleId: message.ruleId,
    severity: message.severity,
    message: message.message,
  })));
  const allowed = findings.filter(item => item.file === "src/App.jsx" && item.ruleId === "react-hooks/set-state-in-effect" && item.line >= start && item.line <= end);
  const unexpected = findings.filter(item => !allowed.includes(item));
  const valid = unexpected.length === 0 && allowed.length <= 1;

  for (const item of allowed) console.log(`lint-baseline allowed: ${item.file}:${item.line} ${item.ruleId}`);
  for (const item of unexpected) console.error(`lint-baseline unexpected: ${item.file}:${item.line} ${item.ruleId || "unknown"} ${item.message}`);
  if (allowed.length > 1) console.error(`lint-baseline unexpected: ${allowed.length} matching baseline findings (maximum 1)`);
  if (valid) console.log(`lint-baseline passed: ${findings.length} finding${findings.length === 1 ? "" : "s"}`);
  else process.exitCode = 1;
}
