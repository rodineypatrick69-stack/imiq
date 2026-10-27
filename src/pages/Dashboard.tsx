import {
  ArrowRight,
  ArrowUpRight,
  CalendarOff,
  Check,
  ClipboardList,
  Coffee,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunset,
  UsersRound,
  TriangleAlert,
} from "lucide-react";
import type { Page, Team, Workspace } from "../lib/types";
import {
  absFor,
  actingLeader,
  addDays,
  fmt,
  initials,
  isLeader,
  MINIMUM,
  parse,
  restForNumber,
  restNumberForDate,
  suggestionsFor,
  TEAM_LABELS,
  teamData,
  TEAMS,
} from "../lib/domain";
import { Badge, Button, Empty, Metric, Panel } from "../components/ui";
const shiftIcons = { TM: Sun, TT: Sunset, TN: Moon };
export function Dashboard({
  data,
  date,
  navigate,
  onDate,
}: {
  data: Workspace;
  date: string;
  navigate: (p: Page) => void;
  onDate: (d: string) => void;
}) {
  const teams = TEAMS.map((team) => ({ team, ...teamData(data, team, date) })),
    low = teams.filter((t) => t.available.length < MINIMUM),
    absences = absFor(data, date),
    rests = TEAMS.map((team) => ({
      team,
      people: restForNumber(data, team, date),
    }));
  const available = teams.reduce((n, t) => n + t.available.length, 0),
    restTotal = rests.reduce((n, t) => n + t.people.length, 0),
    journal = data.journals[date];
  const suggestion = suggestionsFor(data, date),
    lastJournal = Object.entries(data.journals).sort(([a], [b]) =>
      b.localeCompare(a),
    )[0];
  return (
    <>
      <section className="overview-hero">
        <div>
          <span className="overline">
            <span className="hero-dot" /> VISÃO GERAL DA OPERAÇÃO
          </span>
          <h2>
            Pessoas alinhadas.
            <br />
            <span>Operação em movimento.</span>
          </h2>
          <p>Um só lugar para acompanhar sua equipe e planejar o dia.</p>
          <Button onClick={() => navigate("diario")}>
            Abrir diário do dia
            <ArrowUpRight size={17} />
          </Button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                className={
                  i === 4
                    ? "art-orange"
                    : i === 0 || i === 8
                      ? "art-bright"
                      : ""
                }
              >
                {i === 4 ? (
                  <UsersRound size={32} />
                ) : i === 0 ? (
                  <Check size={25} />
                ) : i === 8 ? (
                  <ArrowUpRight size={26} />
                ) : null}
              </span>
            ))}
          </div>
          <span className="art-caption">CONECTAR. ORGANIZAR. EVOLUIR.</span>
        </div>
      </section>
      <div className="section-heading">
        <h2>Seu dia, em números</h2>
        <span>Referência: {fmt(date)}</span>
      </div>
      <div className="metrics">
        <Metric
          label="Pessoas disponíveis"
          value={String(available).padStart(2, "0")}
          detail="Nos três turnos do dia"
          icon={<UsersRound size={19} />}
        />
        <Metric
          label="Pessoas de folga"
          value={String(restTotal).padStart(2, "0")}
          detail="Fora da escala de hoje"
          icon={<Coffee size={19} />}
          tone="neutral"
        />
        <Metric
          label="Férias e ausências"
          value={String(absences.length).padStart(2, "0")}
          detail="Períodos ativos nesta data"
          icon={<CalendarOff size={19} />}
          tone="orange"
        />
        <Metric
          label="Diário operacional"
          value={journal ? "Registrado" : "Pendente"}
          detail={
            journal
              ? "Registro disponível para edição"
              : "Organize os registros do turno"
          }
          icon={<ClipboardList size={19} />}
          tone="neutral"
        />
      </div>
      <div className={`coverage-banner ${low.length ? "warning" : ""}`}>
        <div className="coverage-icon">
          {low.length ? <TriangleAlert size={20} /> : <ShieldCheck size={20} />}
        </div>
        <div>
          <strong>
            {low.length
              ? `Atenção à cobertura · ${low.map((t) => t.team).join(", ")}`
              : "Cobertura adequada nos três turnos"}
          </strong>
          <p>
            {low.length
              ? `${low.length} equipe(s) com menos de ${MINIMUM} pessoas disponíveis. Confira as sugestões abaixo.`
              : `Cada equipe tem pelo menos ${MINIMUM} pessoas disponíveis para a operação.`}
          </p>
        </div>
        <Badge tone={low.length ? "orange" : "purple"}>
          {low.length ? "Requer atenção" : "Tudo organizado"}
        </Badge>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <Panel
            title="Equipes do dia"
            subtitle="Disponibilidade e liderança por turno"
            action={
              <Button variant="ghost" onClick={() => navigate("equipe")}>
                Ver equipe
                <ArrowUpRight size={16} />
              </Button>
            }
          >
            <div className="shift-grid">
              {teams.map(({ team, names, available, onLeave }) => {
                const Icon = shiftIcons[team],
                  leader = actingLeader(data, team, date);
                return (
                  <div className="shift-card" key={team}>
                    <div className="shift-head">
                      <span className={`shift-icon shift-${team}`}>
                        <Icon size={19} />
                      </span>
                      <div>
                        <h3>{TEAM_LABELS[team]}</h3>
                        <small>Equipe {team}</small>
                      </div>
                      <Badge
                        tone={available.length < MINIMUM ? "orange" : "purple"}
                      >
                        {available.length} / {MINIMUM} mín.
                      </Badge>
                    </div>
                    <div className="shift-leader">
                      {leader ? (
                        <>
                          Líder: <b>{leader}</b>
                        </>
                      ) : (
                        "Sem líder disponível"
                      )}
                    </div>
                    <div className="shift-people">
                      {names.length ? (
                        names.map((name) => (
                          <div
                            key={name}
                            className={`person-row ${onLeave.includes(name) ? "unavailable" : ""}`}
                          >
                            <span className="person-dot" />
                            <span>{name}</span>
                            {isLeader(data, team, name, date) && (
                              <span className="leader-chip">L</span>
                            )}
                            {onLeave.includes(name) && <small>Ausente</small>}
                          </div>
                        ))
                      ) : (
                        <Empty>Nenhuma pessoa escalada.</Empty>
                      )}
                    </div>
                    <div className="shift-footer">
                      <span
                        className={`status-dot ${available.length < MINIMUM ? "orange" : ""}`}
                      />
                      {available.length < MINIMUM
                        ? "Cobertura abaixo do mínimo"
                        : "Cobertura adequada"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="suggestion">
              <Sparkles size={20} />
              <div>
                <h3>
                  {suggestion.transfers.length
                    ? "Sugestão de redistribuição"
                    : suggestion.gaps
                      ? "Planeje um reforço para o turno"
                      : "Equipes em equilíbrio"}
                </h3>
                {suggestion.transfers.map((x) => (
                  <p key={x.name}>
                    <b>{x.name}</b>: {x.from} <ArrowRight size={12} /> {x.to}
                  </p>
                ))}
                <p>
                  {suggestion.gaps
                    ? `Ainda faltam ${suggestion.gaps} pessoa(s) após os ajustes possíveis. Avalie reforço extra.`
                    : "As equipes podem manter o mínimo de pessoas disponíveis."}{" "}
                  {suggestion.transfers.length > 0 &&
                    "Proposta para sua revisão; nenhuma transferência foi aplicada."}
                </p>
              </div>
            </div>
          </Panel>
          <Panel
            title="Uma semana à frente"
            subtitle="Selecione um dia para consultar a cobertura"
          >
            <div className="week-strip">
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(date, i),
                  details = TEAMS.map((t) => teamData(data, t, day)),
                  low = details.some((t) => t.available.length < MINIMUM);
                return (
                  <button
                    key={day}
                    className={`week-day ${i === 0 ? "selected" : ""}`}
                    aria-label={`Ver ${fmt(day)}`}
                    aria-pressed={i === 0}
                    onClick={() => onDate(day)}
                  >
                    <span>
                      {parse(day)
                        .toLocaleDateString("pt-BR", { weekday: "short" })
                        .replace(".", "")}
                    </span>
                    <strong>{parse(day).getDate()}</strong>
                    <i className={low ? "orange" : ""} />
                    <small>
                      {details.reduce((n, t) => n + t.available.length, 0)}{" "}
                      pessoas
                    </small>
                  </button>
                );
              })}
            </div>
            <div className="legend">
              <span>
                <i />
                Cobertura adequada
              </span>
              <span>
                <i className="orange" />
                Precisa de atenção
              </span>
            </div>
          </Panel>
        </div>
        <div className="dashboard-aside">
          <Panel
            title="Fora da operação"
            subtitle="Ausências na data selecionada"
            action={<Badge tone="orange">{absences.length}</Badge>}
          >
            {absences.length ? (
              absences.map((a, i) => (
                <div className="detail-row" key={`${a.name}-${i}`}>
                  <div className="avatar orange-avatar">{initials(a.name)}</div>
                  <div>
                    <strong>{a.name}</strong>
                    <small>
                      {a.reason || "Férias"} · até {fmt(a.end)}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <Empty>Nenhuma ausência neste dia.</Empty>
            )}
            <Button
              className="panel-bottom-action"
              variant="ghost"
              onClick={() => navigate("ausencias")}
            >
              Gerenciar ausências
              <ArrowRight size={16} />
            </Button>
          </Panel>
          <Panel
            title={`Pausa programada · Folga nº ${restNumberForDate(date)}`}
            subtitle="Pessoas de folga por equipe"
            action={<Coffee size={20} className="muted-icon" />}
          >
            {rests.map(({ team, people }) => (
              <RestGroup
                key={team}
                team={team}
                people={people}
                restNumbers={data.employeeRestNumbers || {}}
              />
            ))}
            <div className="rest-total">
              <span>Total de folga</span>
              <strong>{restTotal} pessoas</strong>
            </div>
          </Panel>
          <Panel title="Último diário" subtitle="Continue de onde parou">
            {lastJournal ? (
              <>
                <div className="detail-row">
                  <div className="avatar">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <strong>{fmt(lastJournal[0])}</strong>
                    <small>
                      {lastJournal[1].supervisor || "Supervisor"} ·{" "}
                      {lastJournal[1].rows?.length || 0} registros
                    </small>
                  </div>
                </div>
                <Button
                  className="panel-bottom-action"
                  variant="ghost"
                  onClick={() => {
                    onDate(lastJournal[0]);
                    navigate("diario");
                  }}
                >
                  Consultar registro
                  <ArrowRight size={16} />
                </Button>
              </>
            ) : (
              <Empty>Seu primeiro diário aparecerá aqui.</Empty>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
function RestGroup({
  team,
  people,
  restNumbers,
}: {
  team: Team;
  people: string[];
  restNumbers: Record<string, number>;
}) {
  return (
    <div className="rest-group">
      <div>
        <span>Equipe {team}</span>
        <small>{people.length}</small>
      </div>
      {people.length ? (
        <p className="rest-people">
          {people.map((name) => (
            <span className="rest-person" key={name}>
              {name}
              <b>Folga nº {restNumbers[name] ?? "—"}</b>
            </span>
          ))}
        </p>
      ) : (
        <p className="muted">Nenhuma folga neste turno.</p>
      )}
    </div>
  );
}
