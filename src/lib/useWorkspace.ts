import { useCallback, useEffect, useRef, useState } from "react";
import {
  AuthError,
  ConflictError,
  loadWorkspace,
  LOCAL_KEY,
  saveWorkspace,
} from "./api";
import type {
  SyncState,
  Workspace,
  WorkspaceRecord,
  UpdateWorkspace,
} from "./types";
export function useWorkspace(enabled: boolean) {
  const [data, setData] = useState<Workspace | null>(null),
    [status, setStatus] = useState<SyncState>("loading"),
    [message, setMessage] = useState("Carregando seu espaço de trabalho…");
  const current = useRef<WorkspaceRecord | null>(null),
    dirty = useRef(false),
    conflict = useRef(false),
    generation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    pending = useRef<Promise<boolean> | null>(null),
    reading = useRef(false);
  const save = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    if (pending.current) {
      const ok = await pending.current;
      if (!ok) return false;
    }
    if (conflict.current) return false;
    if (!dirty.current || !current.current) return true;
    const perform = async () => {
      setStatus("saving");
      setMessage("Sincronizando alterações…");
      while (dirty.current && current.current) {
        const seq = generation.current,
          snapshot = structuredClone(current.current.state),
          revision = current.current.revision;
        try {
          const result = await saveWorkspace(snapshot, revision);
          current.current.revision = result.revision;
          dirty.current = seq !== generation.current;
        } catch (error) {
          conflict.current = error instanceof ConflictError;
          setStatus(conflict.current ? "conflict" : "error");
          setMessage(
            error instanceof Error ? error.message : "Não foi possível salvar.",
          );
          return false;
        }
      }
      setStatus("saved");
      setMessage("Tudo salvo na nuvem");
      return true;
    };
    pending.current = perform();
    const ok = await pending.current;
    pending.current = null;
    return ok;
  }, []);
  const reload = useCallback(async () => {
    if (pending.current) await pending.current;
    clearTimeout(timer.current);
    reading.current = true;
    setStatus("loading");
    setMessage("Carregando dados…");
    try {
      const record = await loadWorkspace();
      current.current = record;
      dirty.current = false;
      conflict.current = false;
      setData(record.state);
      setStatus("saved");
      setMessage("Tudo salvo na nuvem");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof AuthError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Falha ao carregar.",
      );
    } finally {
      reading.current = false;
    }
  }, []);
  const update: UpdateWorkspace = useCallback(
    (mutate) => {
      if (!current.current || conflict.current || reading.current) return;
      const next = structuredClone(current.current.state);
      mutate(next);
      current.current.state = next;
      generation.current++;
      dirty.current = true;
      setData(next);
      setStatus("saving");
      setMessage("Alterações pendentes de sincronização…");
      // Local recovery is supplementary. Cloud persistence must work when storage is full.
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      } catch {
        /* Cloud remains the source of truth. */
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void save();
      }, 700);
    },
    [save],
  );
  useEffect(() => {
    if (!enabled) {
      setData(null);
      current.current = null;
      return;
    }
    void reload();
    const interval = setInterval(async () => {
      if (
        document.hidden ||
        dirty.current ||
        pending.current ||
        conflict.current ||
        reading.current ||
        document.activeElement?.matches("input,textarea,select")
      )
        return;
      const seq = generation.current;
      try {
        const next = await loadWorkspace();
        if (
          !dirty.current &&
          seq === generation.current &&
          next.revision !== current.current?.revision
        ) {
          current.current = next;
          setData(next.state);
          setStatus("saved");
          setMessage("Atualizado com a nuvem");
        }
      } catch {
        /* Do not hide existing data for a transient read failure. */
      }
    }, 15000);
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => {
      clearInterval(interval);
      clearTimeout(timer.current);
      window.removeEventListener("beforeunload", guard);
    };
  }, [enabled, reload]);
  return {
    data,
    status,
    message,
    update,
    save,
    reload,
    hasPending: () => dirty.current,
  };
}
