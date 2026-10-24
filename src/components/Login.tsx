import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  UsersRound,
  CalendarDays,
  ClipboardCheck,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";
import { login } from "../lib/api";
import { Brand, Button, Field } from "./ui";
export function Login({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState(""),
    [pin, setPin] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(user, pin);
      setPin("");
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao entrar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="overline">
            <span className="orange-dot" /> GESTÃO QUE CONECTA PESSOAS
          </span>
          <h1>
            Seu time.
            <br />
            Sua operação.
            <br />
            <em>Sob controle.</em>
          </h1>
          <p>
            Mais clareza para organizar as equipes.
            <br />
            Mais tranquilidade para conduzir cada turno.
          </p>
          <div className="login-features">
            <span>
              <UsersRound />
              Equipes conectadas
            </span>
            <span>
              <CalendarDays />
              Escalas organizadas
            </span>
            <span>
              <ClipboardCheck />
              Registros em dia
            </span>
          </div>
        </div>
        <div className="login-story-bottom">
          <span>IMIQ / CENTRAL DE OPERAÇÕES</span>
          <span>01 — 03 TURNOS</span>
        </div>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </section>
      <section className="login-form-side">
        <div className="login-top">
          <span>Seu espaço de trabalho</span>
          <span className="version-label">v22</span>
        </div>
        <div className="login-form-wrap">
          <div className="login-icon">
            <LockKeyhole size={27} />
          </div>
          <span className="overline muted">BEM-VINDO AO IMIQ</span>
          <h2>Vamos começar?</h2>
          <p>Acesse seu painel e acompanhe o que importa.</p>
          <form onSubmit={submit}>
            <Field label="Usuário">
              <input
                autoComplete="username"
                name="username"
                placeholder="Seu usuário de acesso"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                required
                disabled={busy}
              />
            </Field>
            <Field label="PIN de acesso">
              <div className="password-wrap">
                <input
                  name="pin"
                  type={visible ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  minLength={4}
                  maxLength={4}
                  autoComplete="current-password"
                  placeholder="Seu PIN de 4 dígitos"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={visible ? "Ocultar PIN" : "Mostrar PIN"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </Field>
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  Entrando…
                </>
              ) : (
                <>
                  Acessar meu painel
                  <ArrowRight size={19} />
                </>
              )}
            </Button>
          </form>
          <div className="login-security">
            <ShieldCheck size={19} />
            <span>
              Acesso restrito à equipe autorizada.
              <br />
              Suas informações protegidas em cada acesso.
            </span>
          </div>
        </div>
        <footer className="login-footer">
          <span>IMIQ — Controle pessoal</span>
          <span>Versão 22 · 24 out 2026</span>
        </footer>
      </section>
    </main>
  );
}
