import type { Team, Workspace, JournalRow } from "./types";
export const TEAMS: Team[] = ["TM", "TT", "TN"];
export const TEAM_LABELS: Record<Team, string> = {
  TM: "Manhã",
  TT: "Tarde",
  TN: "Noite",
};
export const MINIMUM = 4;
export const iso = (date = new Date()) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
export const parse = (date: string) => new Date(date + "T12:00:00");
export const fmt = (date: string) => parse(date).toLocaleDateString("pt-BR");
export const addDays = (date: string, days: number) => {
  const next = parse(date);
  next.setDate(next.getDate() + days);
  return iso(next);
};
export function restNumberForDate(date: string) {
  // The shared workbook's eight-day calendar begins on 2026-09-01.
  const sequence = [3, 3, 4, 4, 1, 1, 2, 2];
  const days = Math.round((+parse(date) - +parse("2026-09-01")) / 86400000);
  return sequence[((days % sequence.length) + sequence.length) % sequence.length];
}
export function assignRestNumber(
  app: Workspace,
  team: Team,
  name: string,
  number: number,
  today = iso(),
) {
  app.employeeRestNumbers ??= {};
  app.employeeRestNumbers[name] = number;
  for (const [date, shifts] of Object.entries(app.schedule)) {
    if (date < today) continue;
    const scheduled = shifts[team] || [];
    const onLeave = absFor(app, date).some((a) => samePerson(a.name, name));
    const recordedAbsent = app.journals[date]?.rows.some(
      (row) =>
        row.team === team &&
        samePerson(row.name, name) &&
        ["Férias", "Atestado", "Falta"].includes(row.status),
    );
    const shouldWork =
      restNumberForDate(date) !== number && !onLeave && !recordedAbsent;
    shifts[team] = shouldWork
      ? scheduled.some((n) => samePerson(n, name))
        ? scheduled
        : [...scheduled, name]
      : scheduled.filter((n) => !samePerson(n, name));
  }
}
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
// Preserve the existing imported schedule's first-name matching convention.
export const samePerson = (a: string, b: string) => {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .split(/\s+/)[0];
  return clean(a) === clean(b);
};
export function scheduleFor(
  app: Workspace,
  date: string,
): Partial<Record<Team, string[]>> {
  if (app.schedule[date]) return app.schedule[date];
  const keys = Object.keys(app.schedule).sort();
  const base =
    keys.filter((x) => x <= (app.sourceLastDate || "")).pop() || keys.at(-1);
  if (!base) return {};
  const delta = Math.round((+parse(date) - +parse(base)) / 86400000);
  return app.schedule[addDays(base, ((delta % 8) + 8) % 8)] || {};
}
export const absFor = (app: Workspace, date: string) =>
  app.absences.filter((a) => a.start <= date && a.end >= date);
export function teamData(app: Workspace, team: Team, date: string) {
  const names = scheduleFor(app, date)[team] || [],
    absences = absFor(app, date),
    rows = app.journals[date]?.rows || [];
  const unavailable = (name: string) =>
    absences.some((a) => samePerson(a.name, name)) ||
    rows.some(
      (r) =>
        samePerson(r.name, name) &&
        r.team === team &&
        ["Férias", "Atestado", "Falta"].includes(r.status),
    );
  return {
    names,
    onLeave: names.filter(unavailable),
    available: names.filter((n) => !unavailable(n)),
  };
}
export function restForTeam(app: Workspace, team: Team, date: string) {
  const names = scheduleFor(app, date)[team] || [],
    absences = absFor(app, date),
    rows = app.journals[date]?.rows || [];
  return (app.teams[team] || []).filter(
    (n) =>
      !names.some((x) => samePerson(x, n)) &&
      !absences.some((a) => samePerson(a.name, n)) &&
      !rows.some(
        (r) =>
          r.team === team &&
          samePerson(r.name, n) &&
          ["Férias", "Atestado", "Falta"].includes(r.status),
      ),
  );
}
export function restForNumber(app: Workspace, team: Team, date: string) {
  const number = restNumberForDate(date);
  return restForTeam(app, team, date).filter(
    (name) => app.employeeRestNumbers?.[name] === number,
  );
}
export function actingLeader(
  app: Workspace,
  team: Team,
  date: string,
): string | null {
  const available = teamData(app, team, date).available;
  const leaders = app.teamLeaders?.[team] || [];
  if (team !== "TN")
    return leaders.find((n) => available.some((x) => samePerson(n, x))) || null;
  const titular = leaders[0];
  if (titular && available.some((n) => samePerson(n, titular)))
    return available.find((n) => samePerson(n, titular)) || null;
  const rotation = app.leaderRotation?.TN || [];
  if (!rotation.length) return null;
  let next = rotation[0];
  const forward = date >= "2026-09-01",
    start = forward ? "2026-09-01" : date,
    end = forward ? date : "2026-09-01";
  for (
    let day = start;
    forward ? day <= end : day < end;
    day = addDays(day, 1)
  ) {
    const people =
      day === date ? available : teamData(app, "TN", day).available;
    if (titular && people.some((n) => samePerson(n, titular))) continue;
    const candidates = rotation.filter((n) =>
      people.some((p) => samePerson(p, n)),
    );
    if (!candidates.length) continue;
    const pick = candidates.includes(next) ? next : candidates[0];
    if (forward && day === date) return pick;
    const index = rotation.findIndex((n) => samePerson(n, pick));
    next = rotation[(index + 1) % rotation.length];
  }
  return forward ? null : next;
}
export function isLeader(
  app: Workspace,
  team: Team,
  name: string,
  date: string,
) {
  if (team === "TN") {
    const leader = actingLeader(app, team, date);
    return !!leader && samePerson(leader, name);
  }
  return (
    (app.teamLeaders?.[team] || []).some((n) => samePerson(n, name)) &&
    app.teams[team].some((n) => samePerson(n, name))
  );
}
export function suggestionsFor(app: Workspace, date: string) {
  const work = Object.fromEntries(
    TEAMS.map((t) => [t, [...teamData(app, t, date).available]]),
  ) as Record<Team, string[]>;
  const moved = new Set<string>(),
    transfers: { name: string; from: Team; to: Team }[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const target = TEAMS.filter((t) => work[t].length < MINIMUM).sort(
      (a, b) => work[a].length - work[b].length,
    )[0];
    if (!target) break;
    let chosen: { donor: Team; name: string } | undefined;
    for (const donor of TEAMS.filter(
      (t) => t !== target && work[t].length > MINIMUM,
    ).sort((a, b) => work[b].length - work[a].length)) {
      const name = work[donor].find(
        (n) =>
          !isLeader(app, donor, n, date) &&
          !moved.has(n.toLowerCase()) &&
          !work[target].some((x) => samePerson(x, n)),
      );
      if (name) {
        chosen = { donor, name };
        break;
      }
    }
    if (!chosen) break;
    work[chosen.donor] = work[chosen.donor].filter(
      (n) => !samePerson(n, chosen!.name),
    );
    work[target].push(chosen.name);
    moved.add(chosen.name.toLowerCase());
    transfers.push({ name: chosen.name, from: chosen.donor, to: target });
  }
  return {
    transfers,
    gaps: TEAMS.reduce((n, t) => n + Math.max(0, MINIMUM - work[t].length), 0),
  };
}
export function autoRows(app: Workspace, date: string): JournalRow[] {
  return TEAMS.flatMap((team) =>
    (scheduleFor(app, date)[team] || []).map((name) => {
      const old = app.journals[date]?.rows.find(
        (r) => samePerson(r.name, name) && r.team === team,
      );
      const leave = absFor(app, date).find((a) => samePerson(a.name, name));
      return {
        team,
        name,
        status: leave
          ? leave.reason === "Atestado"
            ? "Atestado"
            : "Férias"
          : old?.status || "Presente",
        note: old?.note || "",
      };
    }),
  );
}
export function offData(app: Workspace, month: string, filter: string) {
  const [year, m] = month.split("-").map(Number),
    days = new Date(year, m, 0).getDate();
  if (!year || !m) return [];
  const dates = Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  return TEAMS.filter((t) => filter === "Todas" || t === filter)
    .flatMap((team) =>
      app.teams[team].map((name) => {
        const scheduled = dates.filter((d) =>
          (scheduleFor(app, d)[team] || []).some((n) => samePerson(n, name)),
        ).length;
        const matching = TEAMS.filter((t) =>
          app.teams[t].some((n) => samePerson(n, name)),
        ).length;
        const vacation =
          scheduled > 0 || matching === 1
            ? dates.filter((d) =>
                app.absences.some(
                  (a) => samePerson(a.name, name) && a.start <= d && a.end >= d,
                ),
              ).length
            : 0;
        return { name, team, scheduled, daysOff: days - scheduled, vacation };
      }),
    )
    .filter((x) => x.scheduled || x.vacation)
    .sort(
      (a, b) =>
        a.team.localeCompare(b.team) || a.name.localeCompare(b.name, "pt-BR"),
    );
}
export function movePerson(
  app: Workspace,
  from: Team,
  name: string,
  to: Team,
  today = iso(),
) {
  if (from === to) return;
  app.teams[from] = app.teams[from].filter((n) => n !== name);
  if (!app.teams[to].some((n) => samePerson(n, name))) app.teams[to].push(name);
  for (const [date, shifts] of Object.entries(app.schedule)) {
    if (date < today || !shifts[from]?.some((n) => samePerson(n, name)))
      continue;
    shifts[from] = shifts[from]!.filter((n) => !samePerson(n, name));
    shifts[to] ??= [];
    if (!shifts[to]!.some((n) => samePerson(n, name))) shifts[to]!.push(name);
  }
  for (const [date, journal] of Object.entries(app.journals))
    if (date >= today)
      journal.rows.forEach((r) => {
        if (r.team === from && samePerson(r.name, name)) r.team = to;
      });
}
export function removePerson(
  app: Workspace,
  team: Team,
  name: string,
  today = iso(),
) {
  app.teams[team] = app.teams[team].filter((n) => n !== name);
  delete app.employeeRestNumbers?.[name];
  for (const [date, shifts] of Object.entries(app.schedule))
    if (date >= today && shifts[team])
      shifts[team] = shifts[team]!.filter((n) => !samePerson(n, name));
  for (const [date, journal] of Object.entries(app.journals))
    if (date >= today)
      journal.rows = journal.rows.filter(
        (r) => !(r.team === team && samePerson(r.name, name)),
      );
  app.absences = app.absences.filter(
    (a) => !(samePerson(a.name, name) && a.end >= today),
  );
}
export function downloadFile(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(name: string, rows: unknown[][]) {
  const safe = (v: unknown) => {
    const text = String(v ?? "");
    return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  };
  downloadFile(
    name,
    "\ufeff" +
      rows
        .map((row) =>
          row.map((v) => '"' + safe(v).replaceAll('"', '""') + '"').join(";"),
        )
        .join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
