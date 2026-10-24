import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoRows,
  movePerson,
  removePerson,
  restForTeam,
  teamData,
  suggestionsFor,
  offData,
  actingLeader,
  scheduleFor,
} from "../src/lib/domain";
import type { Workspace } from "../src/lib/types";
const fixture = (): Workspace => ({
  teams: {
    TM: ["Gleiton", "Ana", "Bruno", "Carla", "Davi", "Eva"],
    TT: ["Rithielle", "Felipe"],
    TN: ["Charles", "Rodiney", "Iorran", "Gabriel"],
  },
  schedule: {
    "2026-10-24": {
      TM: ["Gleiton", "Ana", "Bruno", "Carla", "Davi", "Eva"],
      TT: ["Rithielle", "Felipe"],
      TN: ["Charles", "Rodiney", "Iorran", "Gabriel"],
    },
  },
  journals: {},
  absences: [],
  employeeIds: {},
});
test("coverage excludes absence and journal nonattendance while rests remain separate", () => {
  const a = fixture();
  a.absences.push({
    name: "Ana",
    start: "2026-10-24",
    end: "2026-10-25",
    reason: "Férias",
  });
  a.journals["2026-10-24"] = {
    rows: [{ team: "TM", name: "Bruno", status: "Falta", note: "" }],
  };
  assert.deepEqual(teamData(a, "TM", "2026-10-24").available, [
    "Gleiton",
    "Carla",
    "Davi",
    "Eva",
  ]);
  assert.deepEqual(restForTeam(a, "TM", "2026-10-24"), []);
});
test("suggestions never transfer leaders and preserve the donor minimum", () => {
  const p = suggestionsFor(fixture(), "2026-10-24");
  assert.equal(p.transfers.length, 2);
  assert.equal(p.gaps, 0);
  assert.ok(
    p.transfers.every(
      (t) => t.name !== "Gleiton" && t.from === "TM" && t.to === "TT",
    ),
  );
});
test("moving a person preserves history and updates future schedule and journals", () => {
  const a = fixture();
  a.schedule["2026-10-23"] = { TM: ["Ana"] };
  a.journals["2026-10-24"] = {
    rows: [{ name: "Ana", team: "TM", status: "Presente", note: "" }],
  };
  movePerson(a, "TM", "Ana", "TT", "2026-10-24");
  assert.deepEqual(a.schedule["2026-10-23"].TM, ["Ana"]);
  assert.ok(!a.schedule["2026-10-24"].TM?.includes("Ana"));
  assert.ok(a.schedule["2026-10-24"].TT?.includes("Ana"));
  assert.equal(a.journals["2026-10-24"].rows[0].team, "TT");
});
test("removal preserves earlier records and removes future absences", () => {
  const a = fixture();
  a.schedule["2026-10-23"] = { TM: ["Ana"] };
  a.absences = [{ name: "Ana", start: "2026-10-25", end: "2026-10-26" }];
  removePerson(a, "TM", "Ana", "2026-10-24");
  assert.deepEqual(a.schedule["2026-10-23"].TM, ["Ana"]);
  assert.ok(!a.teams.TM.includes("Ana"));
  assert.equal(a.absences.length, 0);
});
test("diary prefill preserves comments and medical leave", () => {
  const a = fixture();
  a.absences = [
    { name: "Ana", start: "2026-10-24", end: "2026-10-24", reason: "Atestado" },
  ];
  a.journals["2026-10-24"] = {
    rows: [
      {
        name: "Ana",
        team: "TM",
        status: "Presente",
        note: "Observação anterior",
      },
    ],
  };
  const row = autoRows(a, "2026-10-24").find((r) => r.name === "Ana");
  assert.equal(row?.status, "Atestado");
  assert.equal(row?.note, "Observação anterior");
});
test("monthly days off keep absences in a separate count", () => {
  const a = fixture();
  a.absences = [{ name: "Ana", start: "2026-10-24", end: "2026-10-25" }];
  const row = offData(a, "2026-10", "TM").find((r) => r.name === "Ana")!;
  assert.equal(row.daysOff + row.scheduled, 31);
  assert.equal(row.vacation, 2);
});
test("night shift respects titular and alternating substitute rules", () => {
  const a = fixture();
  assert.equal(actingLeader(a, "TN", "2026-10-24"), "Charles");
  a.schedule = {
    "2026-09-01": { TN: ["Rodiney", "Iorran"] },
    "2026-09-02": { TN: ["Rodiney", "Iorran"] },
  };
  assert.equal(actingLeader(a, "TN", "2026-09-01"), "Rodiney");
  assert.equal(actingLeader(a, "TN", "2026-09-02"), "Iorran");
});
test("empty schedule has a safe empty state", () => {
  const a = fixture();
  a.schedule = {};
  assert.deepEqual(scheduleFor(a, "2026-10-24"), {});
  assert.equal(autoRows(a, "2026-10-24").length, 0);
});
