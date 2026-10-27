import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoRows,
  movePerson,
  removePerson,
  restForTeam,
  restForNumber,
  teamData,
  suggestionsFor,
  offData,
  actingLeader,
  scheduleFor,
  restNumberForDate,
  assignRestNumber,
} from "../src/lib/domain";
import type { Workspace } from "../src/lib/types";
const fixture = (): Workspace => ({
  teamLeaders: {
    TM: ["Alpha", "Bravo"],
    TT: ["Hotel", "India"],
    TN: ["Kilo"],
  },
  leaderRotation: { TN: ["Lima", "Mike"] },
  teams: {
    TM: ["Alpha", "Charlie", "Delta", "Echo", "Foxtrot", "Golf"],
    TT: ["Hotel", "India"],
    TN: ["Kilo", "Lima", "Mike", "November"],
  },
  schedule: {
    "2026-10-24": {
      TM: ["Alpha", "Charlie", "Delta", "Echo", "Foxtrot", "Golf"],
      TT: ["Hotel", "India"],
      TN: ["Kilo", "Lima", "Mike", "November"],
    },
  },
  journals: {},
  absences: [],
  employeeIds: {},
});
test("coverage excludes absence and journal nonattendance while rests remain separate", () => {
  const a = fixture();
  a.absences.push({
    name: "Charlie",
    start: "2026-10-24",
    end: "2026-10-25",
    reason: "Férias",
  });
  a.journals["2026-10-24"] = {
    rows: [{ team: "TM", name: "Delta", status: "Falta", note: "" }],
  };
  assert.deepEqual(teamData(a, "TM", "2026-10-24").available, [
    "Alpha",
    "Echo",
    "Foxtrot",
    "Golf",
  ]);
  assert.deepEqual(restForTeam(a, "TM", "2026-10-24"), []);
});
test("suggestions never transfer leaders and preserve the donor minimum", () => {
  const p = suggestionsFor(fixture(), "2026-10-24");
  assert.equal(p.transfers.length, 2);
  assert.equal(p.gaps, 0);
  assert.ok(
    p.transfers.every(
      (t) => t.name !== "Alpha" && t.from === "TM" && t.to === "TT",
    ),
  );
});
test("moving a person preserves history and updates future schedule and journals", () => {
  const a = fixture();
  a.schedule["2026-10-23"] = { TM: ["Charlie"] };
  a.journals["2026-10-24"] = {
    rows: [{ name: "Charlie", team: "TM", status: "Presente", note: "" }],
  };
  movePerson(a, "TM", "Charlie", "TT", "2026-10-24");
  assert.deepEqual(a.schedule["2026-10-23"].TM, ["Charlie"]);
  assert.ok(!a.schedule["2026-10-24"].TM?.includes("Charlie"));
  assert.ok(a.schedule["2026-10-24"].TT?.includes("Charlie"));
  assert.equal(a.journals["2026-10-24"].rows[0].team, "TT");
});
test("removal preserves earlier records and removes future absences", () => {
  const a = fixture();
  a.employeeRestNumbers = { "Charlie": 2 };
  a.schedule["2026-10-23"] = { TM: ["Charlie"] };
  a.absences = [{ name: "Charlie", start: "2026-10-25", end: "2026-10-26" }];
  removePerson(a, "TM", "Charlie", "2026-10-24");
  assert.deepEqual(a.schedule["2026-10-23"].TM, ["Charlie"]);
  assert.ok(!a.teams.TM.includes("Charlie"));
  assert.equal(a.absences.length, 0);
  assert.equal(a.employeeRestNumbers["Charlie"], undefined);
});
test("diary prefill preserves comments and medical leave", () => {
  const a = fixture();
  a.absences = [
    { name: "Charlie", start: "2026-10-24", end: "2026-10-24", reason: "Atestado" },
  ];
  a.journals["2026-10-24"] = {
    rows: [
      {
        name: "Charlie",
        team: "TM",
        status: "Presente",
        note: "Observação anterior",
      },
    ],
  };
  const row = autoRows(a, "2026-10-24").find((r) => r.name === "Charlie");
  assert.equal(row?.status, "Atestado");
  assert.equal(row?.note, "Observação anterior");
});
test("monthly days off keep absences in a separate count", () => {
  const a = fixture();
  a.absences = [{ name: "Charlie", start: "2026-10-24", end: "2026-10-25" }];
  const row = offData(a, "2026-10", "TM").find((r) => r.name === "Charlie")!;
  assert.equal(row.daysOff + row.scheduled, 31);
  assert.equal(row.vacation, 2);
});
test("night shift respects titular and alternating substitute rules", () => {
  const a = fixture();
  assert.equal(actingLeader(a, "TN", "2026-10-24"), "Kilo");
  a.schedule = {
    "2026-09-01": { TN: ["Lima", "Mike"] },
    "2026-09-02": { TN: ["Lima", "Mike"] },
  };
  assert.equal(actingLeader(a, "TN", "2026-09-01"), "Lima");
  assert.equal(actingLeader(a, "TN", "2026-09-02"), "Mike");
});
test("empty schedule has a safe empty state", () => {
  const a = fixture();
  a.schedule = {};
  assert.deepEqual(scheduleFor(a, "2026-10-24"), {});
  assert.equal(autoRows(a, "2026-10-24").length, 0);
});
test("workbook rest sequence repeats every eight days", () => {
  assert.equal(restNumberForDate("2026-09-01"), 3);
  assert.equal(restNumberForDate("2026-09-07"), 2);
  assert.equal(restNumberForDate("2026-11-05"), 3);
  assert.equal(restNumberForDate("2026-11-13"), 3);
});
test("dashboard pause list includes only the matching rest-number group", () => {
  const a = fixture();
  a.teams.TM = ["Alpha", "Charlie", "Delta", "Echo", "Foxtrot", "Golf"];
  a.employeeRestNumbers = { Alpha: 3, Charlie: 2 };
  a.schedule["2026-09-01"] = {
    TM: ["Delta", "Echo", "Foxtrot", "Golf"],
  };

  assert.deepEqual(restForNumber(a, "TM", "2026-09-01"), ["Alpha"]);
});
test("changing an employee's rest number changes only future rotation days", () => {
  const a = fixture();
  a.schedule["2026-10-20"] = { TM: ["Alpha"] };
  a.schedule["2026-10-24"] = { TM: ["Alpha"] };
  a.schedule["2026-10-25"] = { TM: ["Alpha"] };
  a.schedule["2026-10-26"] = { TM: ["Alpha"] };
  a.schedule["2026-10-27"] = { TM: [] };

  assignRestNumber(a, "TM", "Alpha", 2, "2026-10-24");

  assert.deepEqual(a.schedule["2026-10-20"].TM, ["Alpha"]);
  assert.ok(a.schedule["2026-10-24"].TM?.includes("Alpha"));
  assert.ok(!a.schedule["2026-10-25"].TM?.includes("Alpha"));
  assert.ok(!a.schedule["2026-10-26"].TM?.includes("Alpha"));
  assert.ok(a.schedule["2026-10-27"].TM?.includes("Alpha"));
});
