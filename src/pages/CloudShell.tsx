import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import App from "../App";
import LanguageSwitch from "../components/LanguageSwitch";
import { Ledger } from "../lib/db";
import {
  cloudClient,
  companyLedgerStorage,
  CompanyDocument,
  type Company,
} from "../lib/cloud";
import type { OperationsStorage } from "../lib/operations-store";
import { t, useLanguage } from "../lib/i18n";

export default function CloudShell() {
  useLanguage();
  const [session, setSession] = useState<Session | null>();
  const [company, setCompany] = useState<Company>();
  const [ledger, setLedger] = useState<Ledger>();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState("");
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [openingWorkspace, setOpeningWorkspace] = useState(false);
  const [operationsStorage, setOperationsStorage] =
    useState<OperationsStorage>();
  const opened = useRef<Ledger | undefined>(undefined);
  const client = cloudClient();
  useEffect(() => {
    let active = true;
    client.auth.getSession().then(({ data, error }) => {
      if (active) {
        if (error) setError(error.message);
        setSession(data.session);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, value) => {
      if (active) setSession(value);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  useEffect(() => {
    let active = true;
    setCompany(undefined);
    setLedger(undefined);
    setError("");
    if (!session?.user.id) return;
    setOpeningWorkspace(true);
    const previous = opened.current;
    opened.current = undefined;
    void (async () => {
      await previous?.release();
      const { data, error } = await client
        .from("accounting_companies")
        .select("id,name,trial_started_at,trial_ends_at")
        .maybeSingle();
      if (error) throw error;
      if (!active || !data) return;
      const selected = data as Company;
      const book = await Ledger.open(companyLedgerStorage(selected, client));
      if (!active) {
        await book.release();
        return;
      }
      opened.current = book;
      setOperationsStorage(
        new CompanyDocument(client, "accounting_operations", selected.id),
      );
      setCompany(selected);
      setLedger(book);
    })()
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setOpeningWorkspace(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id, client]);
  const signOut = async () => {
    setBusy(true);
    setError("");
    try {
      await opened.current?.release();
      opened.current = undefined;
      setLedger(undefined);
      setCompany(undefined);
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setSession(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (ledger && company)
    return (
      <App
        ledgerOverride={ledger}
        cloudCompany={company}
        operationsStorage={operationsStorage}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  return (
    <main className="auth-shell">
      <section className="panel padded auth-card">
        <div className="auth-brand">
          <img src="/logo.svg" width="40" alt="" />
          <h1>{t("AI Accounting")}</h1>
          <LanguageSwitch />
        </div>
        <h2>
          {t(
            session
              ? "Create your private company"
              : signup
                ? "Start a free 30-day learning trial"
                : "Sign in to your company",
          )}
        </h2>
        <p>
          {t(
            "Private company registration. No payment card and no automatic billing. Local hosting remains free to run.",
          )}
        </p>
        {session === undefined || openingWorkspace ? (
          <p role="status">{t("Loading…")}</p>
        ) : !session ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setNotice("");
              try {
                const result = signup
                  ? await client.auth.signUp({
                      email,
                      password,
                      options: { emailRedirectTo: location.origin },
                    })
                  : await client.auth.signInWithPassword({ email, password });
                if (result.error) throw result.error;
                setPassword("");
                if (signup && !result.data.session)
                  setNotice(
                    "Check your email to confirm registration, then return here and sign in.",
                  );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t("Email")}
              <input
                type="email"
                value={email}
                autoComplete="email"
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              {t("Password")}
              <input
                type="password"
                value={password}
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 12 : undefined}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {signup && (
              <p className="muted">
                {t(
                  "Use at least 12 characters. This is a learning preview, not certified production accounting software.",
                )}
              </p>
            )}
            <button disabled={busy}>
              {t(
                busy
                  ? "Working…"
                  : signup
                    ? "Register company owner"
                    : "Sign in",
              )}
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setSignup(!signup);
                setNotice("");
                setError("");
              }}
            >
              {t(signup ? "Already registered? Sign in" : "New here? Register")}
            </button>
          </form>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const { error } = await client
                  .from("accounting_companies")
                  .insert({ name: name.trim() });
                if (error) throw error;
                location.reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t("Business name")}
              <input
                value={name}
                maxLength={120}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button disabled={busy}>
              {t(busy ? "Working…" : "Create private workspace")}
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                void signOut();
              }}
              disabled={busy}
            >
              {t("Sign out")}
            </button>
          </form>
        )}
        {error && (
          <p className="alert error" role="alert">
            {t(error)}
          </p>
        )}
        {notice && (
          <p className="note" role="status">
            {t(notice)}
          </p>
        )}
      </section>
    </main>
  );
}
