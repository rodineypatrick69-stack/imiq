import { useState, type FormEvent } from "react";
import {
  CalendarDays,
  Coffee,
  Download,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";
import type { Workspace, UpdateWorkspace } from "../lib/types";
import {
  downloadCsv,
  fmt,
  initials,
  offData,
  parse,
  TEAMS,
} from "../lib/domain";
import {
  Badge,
  Button,
  Empty,
  Field,
  Metric,
  Modal,
  Panel,
} from "../components/ui";
export function DaysOff({ data, date }: { data: Workspace; date: string }) {
  const [month, setMonth] = useState(date.slice(0, 7)),
    [team, setTeam] = useState("Todas");
  const rows = offData(data, month, team),
    average = rows.length
      ? (rows.reduce((n, x) => n + x.daysOff, 0) / rows.length)
          .toFixed(1)
          .replace(".", ",")
      : "0";
  return (
    <>
      <Panel
        title="Planejamento de folgas"
        subtitle="Consulte a distribuição mensal e organize a operação"
        action={
          <Button
            onClick={() =>
              downloadCsv(`folgas-${month}.csv`, [
                [
                  "Funcionário",
                  "Equipe",
                  "Dias escalados",
                  "Folgas programadas",
                  "Férias / ausências",
                ],
                ...rows.map((x) => [
                  x.name,
                  x.team,
                  x.scheduled,
                  x.daysOff,
                  x.vacation,
                ]),
              ])
            }
          >
            <Download size={16} />
            Exportar CSV
          </Button>
        }
      >
        <div className="planning-filters">
          <Field label="Mês de referência">
            <input
              type="month"
              required
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </Field>
          <Field label="Equipe">
            <select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="Todas">Todas as equipes</option>
              {TEAMS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>
      <div className="metrics three">
        <Metric
          label="Colaboradores no período"
          value={rows.length}
          detail="Com escala ou ausência no mês"
          icon={<UsersRound size={19} />}
        />
        <Metric
          label="Média de folgas"
          value={average}
          detail="Dias por colaborador"
          icon={<Coffee size={19} />}
          tone="orange"
        />
        <Metric
          label="Menor total de folgas"
          value={rows.length ? Math.min(...rows.map((x) => x.daysOff)) : 0}
          detail="Entre as pessoas do filtro"
          icon={<CalendarDays size={19} />}
          tone="neutral"
        />
      </div>
      <Panel
        title="Folgas por colaborador"
        subtitle="Escala e períodos de ausência considerados separadamente"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Equipe</th>
                <th>Dias escalados</th>
                <th>Folgas programadas</th>
                <th>Férias / ausências</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.team}-${r.name}`}>
                  <td>
                    <div className="table-person">
                      <span className="avatar">{initials(r.name)}</span>
                      <strong>{r.name}</strong>
                    </div>
                  </td>
                  <td>
                    <Badge>{r.team}</Badge>
                  </td>
                  <td>{r.scheduled} dias</td>
                  <td>
                    <strong>{r.daysOff} dias</strong>
                  </td>
                  <td>{r.vacation} dias</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty>Sem escala ou ausências para o filtro selecionado.</Empty>
        )}
        <div className="info-note compact">
          Folgas programadas são os dias sem escala. Ausências são exibidas em
          coluna própria e podem coincidir com esses dias.
        </div>
      </Panel>
    </>
  );
}
export function Absences({
  data,
  update,
  date,
}: {
  data: Workspace;
  update: UpdateWorkspace;
  date: string;
}) {
  const [adding, setAdding] = useState(false),
    [removing, setRemoving] = useState<number | null>(null),
    [error, setError] = useState("");
  const names = [...new Set(TEAMS.flatMap((t) => data.teams[t]))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const rows = data.absences
    .map((a, i) => ({ ...a, index: i }))
    .sort((a, b) => b.start.localeCompare(a.start));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      name = String(form.get("name")),
      start = String(form.get("start")),
      end = String(form.get("end")),
      reason = String(form.get("reason"));
    if (end < start) {
      setError("A data final deve ser igual ou posterior à inicial.");
      return;
    }
    update((d) => {
      d.absences.push({
        name,
        start,
        end,
        reason,
        note: String(form.get("note") || reason),
      });
    });
    setAdding(false);
  }
  return (
    <>
      <Panel
        title="Férias e ausências"
        subtitle="Planeje os períodos e antecipe o impacto na cobertura"
        action={
          <Button
            variant="primary"
            disabled={!names.length}
            onClick={() => {
              setError("");
              setAdding(true);
            }}
          >
            <Plus size={17} />
            Cadastrar período
          </Button>
        }
      >
        <div className="absence-summary">
          <CalendarDays size={20} />
          <span>
            <b>{rows.length}</b> períodos cadastrados
          </span>
          <span className="separator" />
          <span>
            <b>{rows.filter((a) => a.start <= date && a.end >= date).length}</b>{" "}
            ativos na data selecionada
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Motivo</th>
                <th>Período</th>
                <th>Duração</th>
                <th>Situação</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={`${a.index}-${a.name}`}>
                  <td>
                    <div className="table-person">
                      <span className="avatar">{initials(a.name)}</span>
                      <div>
                        <strong>{a.name}</strong>
                        {a.note && a.note !== a.reason && (
                          <small>{a.note}</small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tone="orange">{a.reason || "Férias"}</Badge>
                  </td>
                  <td>
                    {fmt(a.start)} <span className="muted">a</span> {fmt(a.end)}
                  </td>
                  <td>
                    {Math.round((+parse(a.end) - +parse(a.start)) / 86400000) +
                      1}{" "}
                    dias
                  </td>
                  <td>
                    <Badge
                      tone={
                        a.end < date
                          ? "gray"
                          : a.start > date
                            ? "purple"
                            : "orange"
                      }
                    >
                      {a.end < date
                        ? "Concluído"
                        : a.start > date
                          ? "Programado"
                          : "Em andamento"}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      aria-label={`Excluir ausência de ${a.name}`}
                      onClick={() => setRemoving(a.index)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty>
            Nenhuma ausência cadastrada. Adicione um período para começar.
          </Empty>
        )}
      </Panel>
      {adding && (
        <Modal
          title="Novo período de ausência"
          onClose={() => setAdding(false)}
        >
          <form onSubmit={submit}>
            <Field label="Funcionário">
              <select name="name" required>
                {names.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Início">
                <input type="date" name="start" required />
              </Field>
              <Field label="Fim">
                <input type="date" name="end" required />
              </Field>
            </div>
            <Field label="Motivo">
              <select name="reason">
                {["Férias", "Atestado", "Treinamento", "Licença", "Outro"].map(
                  (r) => (
                    <option key={r}>{r}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Observação (opcional)">
              <textarea
                name="note"
                rows={3}
                placeholder="Informações para o planejamento"
              />
            </Field>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit">
                Cadastrar período
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {removing !== null && (
        <Modal title="Excluir período" onClose={() => setRemoving(null)}>
          <p>
            Excluir o período de <b>{data.absences[removing].name}</b>? A
            disponibilidade da equipe será recalculada.
          </p>
          <div className="modal-actions">
            <Button onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                update((d) => {
                  d.absences.splice(removing, 1);
                });
                setRemoving(null);
              }}
            >
              Excluir período
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
