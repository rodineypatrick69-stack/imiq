import {
  ClipboardList,
  Download,
  RefreshCw,
  Save,
  ArrowUpRight,
} from "lucide-react";
import type { Workspace, UpdateWorkspace, Journal } from "../lib/types";
import { autoRows, downloadCsv, fmt } from "../lib/domain";
import { Badge, Button, Empty, Field, Panel } from "../components/ui";
export function Diary({
  data,
  date,
  update,
  onDate,
  save,
}: {
  data: Workspace;
  date: string;
  update: UpdateWorkspace;
  onDate: (d: string) => void;
  save: () => Promise<boolean>;
}) {
  const journal: Journal = data.journals[date] || {
    date,
    rows: autoRows(data, date),
    supervisor: "Paulo Junior",
    condition: "Operação normal",
    summary: "",
    handoff: "",
  };
  const change = (fn: (j: Journal) => void) =>
    update((d) => {
      d.journals[date] ??= structuredClone(journal);
      fn(d.journals[date]);
      d.journals[date].updated = new Date().toISOString();
    });
  const entries = Object.entries(data.journals).sort(([a], [b]) =>
    b.localeCompare(a),
  );
  function exportCsv() {
    downloadCsv(`diario-${date}.csv`, [
      ["Data", "Equipe", "Funcionário", "Situação", "Observação"],
      ...journal.rows.map((r) => [date, r.team, r.name, r.status, r.note]),
      [],
      ["Supervisor", journal.supervisor],
      ["Condição", journal.condition],
      ["Resumo", journal.summary],
      ["Pendências", journal.handoff],
    ]);
  }
  return (
    <>
      <Panel
        title="Diário operacional"
        subtitle={`Registros e passagem de turno · ${fmt(date)}`}
        action={
          <Button
            onClick={() =>
              change((j) => {
                j.rows = autoRows(data, date);
              })
            }
          >
            <RefreshCw size={16} />
            Preencher pela escala
          </Button>
        }
      >
        <div className="info-note compact">
          <ClipboardList size={18} />
          <span>
            Registre a presença e as ocorrências. As alterações são enviadas
            automaticamente para a nuvem.
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Equipe</th>
                <th>Funcionário</th>
                <th>Situação</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {journal.rows.map((r, i) => (
                <tr key={`${r.team}-${r.name}-${i}`}>
                  <td>
                    <Badge>{r.team}</Badge>
                  </td>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>
                    <select
                      aria-label={`Situação de ${r.name}`}
                      value={r.status}
                      onChange={(e) =>
                        change((j) => {
                          j.rows[i].status = e.target.value;
                        })
                      }
                    >
                      {[
                        "Presente",
                        "Férias",
                        "Atestado",
                        "Falta",
                        "Substituição",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Observação de ${r.name}`}
                      placeholder="Adicionar observação…"
                      value={r.note}
                      onChange={(e) =>
                        change((j) => {
                          j.rows[i].note = e.target.value;
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!journal.rows.length && (
          <Empty>Nenhuma pessoa escalada para esta data.</Empty>
        )}
        <div className="form-grid diary-fields">
          <Field label="Supervisor responsável">
            <input
              value={journal.supervisor || ""}
              onChange={(e) =>
                change((j) => {
                  j.supervisor = e.target.value;
                })
              }
            />
          </Field>
          <Field label="Condição do turno">
            <select
              value={journal.condition || "Operação normal"}
              onChange={(e) =>
                change((j) => {
                  j.condition = e.target.value;
                })
              }
            >
              {[
                "Operação normal",
                "Operação com restrição",
                "Ocorrência crítica",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Resumo e ocorrências" className="wide">
            <textarea
              rows={4}
              placeholder="O que aconteceu durante o turno?"
              value={journal.summary || ""}
              onChange={(e) =>
                change((j) => {
                  j.summary = e.target.value;
                })
              }
            />
          </Field>
          <Field label="Pendências para o próximo turno" className="wide">
            <textarea
              rows={3}
              placeholder="O que a próxima equipe precisa acompanhar?"
              value={journal.handoff || ""}
              onChange={(e) =>
                change((j) => {
                  j.handoff = e.target.value;
                })
              }
            />
          </Field>
        </div>
        <div className="form-footer">
          <span>A confirmação do salvamento aparece no topo do painel.</span>
          <div>
            <Button onClick={exportCsv}>
              <Download size={16} />
              Exportar CSV
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                change(() => {});
                void save();
              }}
            >
              <Save size={16} />
              Salvar diário
            </Button>
          </div>
        </div>
      </Panel>
      <Panel
        title="Histórico de diários"
        subtitle="Consulte os registros anteriores"
      >
        {entries.length ? (
          <div className="history-list">
            {entries.map(([day, j]) => (
              <button
                key={day}
                onClick={() => onDate(day)}
                className="history-row"
              >
                <div className="avatar">
                  <ClipboardList size={18} />
                </div>
                <span>
                  <strong>{fmt(day)}</strong>
                  <small>
                    {j.supervisor || "Supervisor"} · {j.rows.length} registros
                  </small>
                </span>
                <Badge tone="gray">{j.condition || "Operação normal"}</Badge>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <Empty>Seus diários salvos aparecerão aqui.</Empty>
        )}
      </Panel>
    </>
  );
}
