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
