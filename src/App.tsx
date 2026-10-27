import {
  Component,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CloudCheck,
  Coffee,
  Download,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  WifiOff,
  X,
} from "lucide-react";
import { Login } from "./components/Login";
import { Badge, Brand, Button, Modal } from "./components/ui";
import { logout, storedSession } from "./lib/api";
import { addDays, downloadFile, iso } from "./lib/domain";
import type { Page } from "./lib/types";
import { useWorkspace } from "./lib/useWorkspace";
import { Dashboard } from "./pages/Dashboard";
import { Diary } from "./pages/Diary";
import { TeamPage } from "./pages/Team";
import { Absences, DaysOff } from "./pages/Planning";
const navigation = [
  {
    id: "painel",
    label: "Painel diário",
    title: "Visão geral",
    sub: "Um olhar completo para as pessoas e a operação.",
    icon: LayoutDashboard,
  },
  {
    id: "diario",
    label: "Diário do dia",
    title: "Diário do dia",
    sub: "Cada informação faz a diferença na passagem de turno.",
    icon: ClipboardList,
  },
  {
    id: "equipe",
    label: "Equipe",
    title: "Sua equipe",
    sub: "Pessoas, identificações e turnos sempre organizados.",
    icon: UsersRound,
  },
  {
    id: "folgas",
    label: "Folgas",
    title: "Folgas e planejamento",
    sub: "Equilíbrio entre a rotina da equipe e a operação.",
    icon: Coffee,
  },
  {
    id: "ausencias",
    label: "Férias e ausências",
    title: "Férias e ausências",
    sub: "Antecipe os períodos e mantenha a cobertura em dia.",
    icon: CalendarOff,
  },
] as const;
export default function App() {
  const [authenticated, setAuthenticated] = useState(() => !!storedSession()),
    [page, setPage] = useState<Page>("painel"),
    [date, setDate] = useState(iso()),
    [mobileMenu, setMobileMenu] = useState(false),
    [help, setHelp] = useState(false),
    [toast, setToast] = useState(""),
    [signingOut, setSigningOut] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const cloud = useWorkspace(authenticated),
    active = navigation.find((n) => n.id === page)!;
  const navigate = (id: Page) => {
    setPage(id);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  useEffect(() => {
    document.title = authenticated
      ? `${active.title} · IMIQ`
      : "IMIQ — Controle pessoal";
  }, [active.title, authenticated]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      clearTimeout(toastTimer.current);
    };
  }, []);
  async function signOut() {
    setSigningOut(true);
    try {
      if (cloud.hasPending() && !(await cloud.save())) {
        notify(
          "Existem alterações não sincronizadas. Salve ou baixe um backup antes de sair.",
        );
        return;
      }
      await logout();
      setAuthenticated(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Falha ao sair.");
    } finally {
      setSigningOut(false);
    }
  }
  function reload() {
    if (
      !cloud.hasPending() ||
      confirm(
        "Carregar a nuvem substituirá as alterações ainda não sincronizadas desta tela. Baixe um backup antes, se precisar preservá-las. Continuar?",
      )
    )
      void cloud.reload();
  }
  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Fechar menu"
          >
            <X size={21} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-symbol">CP</span>
          <span>
            Controle de pessoal<small>Central da supervisão</small>
          </span>
          <ShieldCheck size={16} />
        </div>
        <span className="nav-caption">ESPAÇO DE TRABALHO</span>
        <nav aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {page === id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-support">
          <div className="support-icon">
            <ShieldCheck size={21} />
          </div>
          <strong>Seu time, conectado.</strong>
          <p>Informações compartilhadas para decisões mais claras.</p>
          <button onClick={() => setHelp(true)}>
            Como usar o IMIQ
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="version-label">v24</span>
          <span>Atualizado em 27/10/2026</span>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              className="mobile-toggle"
              aria-label="Abrir navegação"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={22} />
            </Button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{active.label}</strong>
          </div>
          <div className="topbar-right">
            <span
              className={`cloud-indicator ${cloud.status === "error" || cloud.status === "conflict" ? "has-error" : ""}`}
              role="status"
            >
              {cloud.status === "saving" || cloud.status === "loading" ? (
                <LoaderCircle size={16} className="spin" />
              ) : cloud.status === "saved" ? (
                <CloudCheck size={17} />
              ) : (
                <WifiOff size={17} />
              )}
              <span>
                {cloud.status === "saved"
                  ? "Sincronizado"
                  : cloud.status === "saving"
                    ? "Salvando…"
                    : cloud.status === "loading"
                      ? "Carregando…"
                      : "Atenção à sincronização"}
              </span>
            </span>
            <button
              className="help-button"
              aria-label="Ajuda"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={20} />
            </button>
            <span className="topbar-divider" />
            <div className="account-avatar" title="Acesso de supervisão">
              SP
            </div>
            <Button
              variant="ghost"
              className="logout-button"
              onClick={() => void signOut()}
              disabled={signingOut}
              aria-label="Sair do painel"
            >
              <LogOut size={17} />
              <span>Sair</span>
            </Button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">IMIQ / CONTROLE PESSOAL</div>
              <h1>{active.title}</h1>
              <p>{active.sub}</p>
            </div>
            <div className="heading-actions">
              <div className="date-control">
                <button
                  aria-label="Dia anterior"
                  onClick={() => setDate(addDays(date, -1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <CalendarDays size={16} />
                <input
                  type="date"
                  aria-label="Data de acompanhamento"
                  value={date}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                />
                <button
                  aria-label="Próximo dia"
                  onClick={() => setDate(addDays(date, 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <Button variant="primary" onClick={() => navigate("diario")}>
                <Plus size={17} />
                Diário do dia
              </Button>
            </div>
          </div>
          {(cloud.status === "error" || cloud.status === "conflict") && (
            <div className="sync-error" role="alert">
              <WifiOff size={21} />
              <div>
                <strong>Precisamos da sua atenção</strong>
                <p>{cloud.message}</p>
              </div>
              <div className="sync-actions">
                {cloud.data && (
                  <Button
                    onClick={() =>
                      downloadFile(
                        `backup-imiq-${iso()}.json`,
                        JSON.stringify(cloud.data, null, 2),
                      )
                    }
                  >
                    <Download size={16} />
                    Backup
                  </Button>
                )}
                <Button
                  onClick={
                    cloud.status === "conflict" || !cloud.data
                      ? reload
                      : () => {
                          void cloud.save();
                        }
                  }
                >
                  <RefreshCw size={16} />
                  {cloud.status === "conflict"
                    ? "Carregar nuvem"
                    : "Tentar novamente"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (
                      !cloud.hasPending() ||
                      confirm(
                        "Há alterações pendentes. Baixe um backup antes de entrar novamente. Continuar?",
                      )
                    )
                      setAuthenticated(false);
                  }}
                >
                  Entrar novamente
                </Button>
              </div>
            </div>
          )}
          {cloud.data ? (
            <fieldset
              className="workspace-content"
              disabled={
                cloud.status === "conflict" || cloud.status === "loading"
              }
            >
              {page === "painel" && (
                <Dashboard
                  data={cloud.data}
                  date={date}
                  navigate={navigate}
                  onDate={setDate}
                />
              )}{" "}
              {page === "diario" && (
                <Diary
                  data={cloud.data}
                  date={date}
                  update={cloud.update}
                  onDate={setDate}
                  save={cloud.save}
                />
              )}{" "}
              {page === "equipe" && (
                <TeamPage
                  data={cloud.data}
                  update={cloud.update}
                  notify={notify}
                />
              )}{" "}
              {page === "folgas" && <DaysOff data={cloud.data} date={date} />}{" "}
              {page === "ausencias" && (
                <Absences data={cloud.data} update={cloud.update} date={date} />
              )}
            </fieldset>
          ) : cloud.status === "loading" ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" size={28} />
              <h2>Preparando seu painel</h2>
              <p>Carregando as informações da equipe com segurança.</p>
              <div className="skeleton-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} />
                ))}
              </div>
            </div>
          ) : null}
          <footer className="app-footer">
            <span>
              <b>IMIQ.</b> Controle pessoal
            </span>
            <span>
              {cloud.message} <span className="footer-dot">·</span> Versão 24
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Fechar aviso" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <Modal title="Seu guia rápido do IMIQ" onClose={() => setHelp(false)}>
          <div className="help-list">
            {navigation.map((n) => (
              <div key={n.id}>
                <n.icon size={20} />
                <div>
                  <strong>{n.label}</strong>
                  <p>{n.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="info-note">
            Os registros são compartilhados entre os dispositivos. Aguarde a
            indicação “Sincronizado” antes de fechar. Se houver falha de
            conexão, use Backup para guardar uma cópia.
          </p>
          <div className="release-note">
            <Badge>Versão 24</Badge>
            <p>
              Cadastro de funcionários com número de folga editável, painel
              atualizado e navegação responsiva.
            </p>
          </div>
          <Button variant="primary" onClick={() => setHelp(false)}>
            Entendi
          </Button>
        </Modal>
      )}
    </div>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("IMIQ interface error", error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <Brand />
          <h1>Não foi possível abrir esta tela.</h1>
          <p>
            Recarregue para tentar novamente. Os dados já sincronizados
            permanecem na nuvem.
          </p>
          <Button variant="primary" onClick={() => location.reload()}>
            Recarregar painel
          </Button>
        </main>
      );
    return this.props.children;
  }
}
