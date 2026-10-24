import { useState, type FormEvent } from "react";
import {
  ArrowRightLeft,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import type { Team as TeamId, Workspace, UpdateWorkspace } from "../lib/types";
import {
  downloadFile,
  initials,
  iso,
  LEADERS,
  movePerson,
  removePerson,
  samePerson,
  TEAM_LABELS,
  TEAMS,
} from "../lib/domain";
import { Badge, Button, Empty, Field, Modal, Panel } from "../components/ui";
type Selected = { name: string; team: TeamId };
export function TeamPage({
  data,
  update,
  notify,
}: {
  data: Workspace;
  update: UpdateWorkspace;
  notify: (s: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Todas"),
    [modal, setModal] = useState<"add" | "edit" | "move" | "remove" | null>(
      null,
    ),
    [selected, setSelected] = useState<Selected | null>(null);
  const [name, setName] = useState(""),
    [registration, setRegistration] = useState(""),
    [personal, setPersonal] = useState(""),
    [team, setTeam] = useState<TeamId>("TM"),
    [error, setError] = useState("");
  const all = TEAMS.flatMap((team) =>
      data.teams[team].map((name) => ({ team, name })),
    ),
    rows = all.filter(
      (x) =>
        (filter === "Todas" || x.team === filter) &&
        [x.name, ...(data.employeeIds[x.name] || [])]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    );
  function open(type: typeof modal, person?: Selected) {
    setSelected(person || null);
    setName(person?.name || "");
    setTeam(person?.team || "TM");
    const ids = person ? data.employeeIds[person.name] : undefined;
    setRegistration(ids?.[0] || "");
    setPersonal(ids?.[1] || "");
    setError("");
    setModal(type);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      modal === "add" &&
      all.some(
        (x) => x.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
      )
    ) {
      setError("Este nome já está cadastrado.");
      return;
    }
    if (modal === "move" && selected?.team === team) {
      setError("Selecione um turno diferente.");
      return;
    }
    update((d) => {
      if (modal === "add") {
        d.teams[team].push(name.trim());
        d.employeeIds[name.trim()] = [registration.trim(), personal.trim()];
      }
      if (modal === "edit" && selected)
        d.employeeIds[selected.name] = [registration.trim(), personal.trim()];
      if (modal === "move" && selected)
        movePerson(d, selected.team, selected.name, team);
      if (modal === "remove" && selected)
        removePerson(d, selected.team, selected.name);
    });
    setModal(null);
    notify("Alteração preparada. Acompanhe a sincronização no topo.");
  }
  return (
    <>
      <div className="team-summary">
        {TEAMS.map((t) => (
          <button
            className={`team-summary-card ${filter === t ? "selected" : ""}`}
            key={t}
            onClick={() => setFilter(filter === t ? "Todas" : t)}
            aria-pressed={filter === t}
          >
            <span className="avatar">
              <UsersRound size={20} />
            </span>
            <span>
              <small>
                Equipe {t} · {TEAM_LABELS[t]}
              </small>
              <strong>
                {data.teams[t].length} <span>colaboradores</span>
              </strong>
            </span>
            <Badge tone="gray">{t}</Badge>
          </button>
        ))}
      </div>
      <Panel
        title="Pessoas que fazem acontecer"
        subtitle={`${all.length} colaboradores cadastrados nos três turnos`}
        action={
          <Button variant="primary" onClick={() => open("add")}>
            <Plus size={17} />
            Novo funcionário
          </Button>
        }
      >
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar funcionário"
              placeholder="Buscar por nome, registro ou número pessoal…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar equipe"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="Todas">Todas as equipes</option>
            {TEAMS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <Button
            onClick={() =>
              downloadFile(
                `backup-imiq-${iso()}.json`,
                JSON.stringify(data, null, 2),
              )
            }
          >
            <Download size={16} />
            Backup
          </Button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Equipe</th>
                <th>Registro</th>
                <th>Número pessoal</th>
                <th className="align-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ name, team }) => (
                <tr key={`${team}-${name}`}>
                  <td>
                    <div className="table-person">
                      <span className="avatar">{initials(name)}</span>
                      <div>
                        <strong>{name}</strong>
                        {LEADERS[team].some((n) => samePerson(n, name)) && (
                          <small>Líder de equipe</small>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge>
                      {team} · {TEAM_LABELS[team]}
                    </Badge>
                  </td>
                  <td className="mono">
                    {data.employeeIds[name]?.[0] || (
                      <span className="missing">Não informado</span>
                    )}
                  </td>
                  <td className="mono">
                    {data.employeeIds[name]?.[1] || (
                      <span className="missing">Não informado</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        onClick={() => open("edit", { name, team })}
                        aria-label={`Editar ${name}`}
                        title="Editar identificações"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => open("move", { name, team })}
                        aria-label={`Mover ${name}`}
                        title="Mudar turno"
                      >
                        <ArrowRightLeft size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => open("remove", { name, team })}
                        aria-label={`Remover ${name}`}
                        title="Remover funcionário"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty>Nenhuma pessoa encontrada. Tente outro nome ou equipe.</Empty>
        )}
        <div className="table-foot">
          <span>
            {rows.length} de {all.length} colaboradores
          </span>
          <span>Cadastros compartilhados entre os dispositivos</span>
        </div>
      </Panel>
      <div className="info-note">
        Mudanças de turno atualizam a escala e os diários a partir de hoje.
        Novos cadastros não são adicionados automaticamente à escala existente.
      </div>
      {modal && (
        <Modal
          title={
            modal === "add"
              ? "Novo funcionário"
              : modal === "edit"
                ? "Identificações do funcionário"
                : modal === "move"
                  ? "Transferir de turno"
                  : "Remover funcionário"
          }
          onClose={() => setModal(null)}
        >
          <form onSubmit={submit}>
            {modal === "remove" ? (
              <p>
                Remover <b>{selected?.name}</b> da equipe e dos registros
                futuros? O histórico anterior a hoje será mantido.
              </p>
            ) : (
              <>
                <Field label="Nome do funcionário">
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    readOnly={modal !== "add"}
                    autoFocus={modal === "add"}
                  />
                </Field>
                {(modal === "add" || modal === "edit") && (
                  <div className="form-grid">
                    <Field label="Registro">
                      <input
                        required
                        inputMode="numeric"
                        value={registration}
                        onChange={(e) => setRegistration(e.target.value)}
                      />
                    </Field>
                    <Field label="Número pessoal">
                      <input
                        required
                        inputMode="numeric"
                        value={personal}
                        onChange={(e) => setPersonal(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
                {(modal === "add" || modal === "move") && (
                  <Field label={modal === "move" ? "Novo turno" : "Equipe"}>
                    <select
                      value={team}
                      onChange={(e) => setTeam(e.target.value as TeamId)}
                    >
                      {TEAMS.map((t) => (
                        <option key={t} value={t}>
                          {t} — {TEAM_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant={modal === "remove" ? "danger" : "primary"}
              >
                {modal === "remove" ? "Confirmar remoção" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
