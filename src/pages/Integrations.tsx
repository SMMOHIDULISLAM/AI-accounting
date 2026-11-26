import { useEffect, useState } from "react";
import {
  inspectExternalBook,
  mapExternalEntries,
  type ExternalBook,
} from "../lib/external-books";
import {
  ACCOUNTING_SKILLS,
  allocateMinorUnits,
  sourceAging,
  stockCost,
} from "../lib/accounting-skills";
import { formatMoney, parseMoney } from "../lib/accounting";
import { exportCSV } from "../lib/csv";
import { saveFile, today } from "../components/utils";
import type { Ledger } from "../lib/db";
import type { Snapshot } from "../lib/types";

type Props = {
  data: Snapshot;
  ledger: Ledger;
  run: (fn: () => Promise<unknown>, notice?: string) => Promise<boolean>;
};
const currencies = ["BDT", "USD", "GBP", "EUR", "CAD", "INR", "AUD"];
export default function Integrations(props: Props) {
  const [tab, setTab] = useState("Import books");
  return (
    <>
      <div className="tabs">
        {["Import books", "Accounting skills", "Source catalog"].map((name) => (
          <button
            key={name}
            className={tab === name ? "selected" : ""}
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === "Import books" ? (
        <BookImport {...props} />
      ) : tab === "Accounting skills" ? (
        <Skills {...props} />
      ) : (
        <Catalog />
      )}
    </>
  );
}

function BookImport({ data, ledger, run }: Props) {
  const [book, setBook] = useState<ExternalBook>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [bookId, setBookId] = useState("");
  const [currency, setCurrency] = useState("");
  const [positive, setPositive] = useState<"" | "debit" | "credit">("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [asOf, setAsOf] = useState(today());
  const [kind, setKind] = useState<"invoice" | "bill">("invoice");
  let mapped: ReturnType<typeof mapExternalEntries> = [],
    mappingError = "";
  if (book && book.format !== "openqbw")
    try {
      mapped = mapExternalEntries(book, mapping, data.accounts);
    } catch (e) {
      mappingError = (e as Error).message;
    }
  let aging: ReturnType<typeof sourceAging> | undefined,
    agingError = "";
  if (book?.documents.length)
    try {
      aging = sourceAging(book, kind, asOf);
    } catch (e) {
      agingError = (e as Error).message;
    }
  const used = new Set(
    book?.entries.flatMap((entry) => entry.lines.map((line) => line.accountId)),
  );
  return (
    <section className="panel padded integration-panel">
      <h2>Inspect another book before importing</h2>
      <p>
        Files are inspected locally in a separate in-memory SQLite database.
        Your live ledger is not replaced. Export a consistent source backup
        including committed WAL data first.
      </p>
      <p>
        Accepts Ledger Reborn backups, the accounting-sqlite manual Journals
        format, and OpenQBW SQLite exports. Raw QBW/QBB parsing requires the
        retained OpenQBW toolchain described in the repository.
      </p>
      <label>
        For signed accounting-sqlite journals: positive amounts mean
        <select
          value={positive}
          disabled={busy}
          onChange={(event) => {
            setPositive(event.target.value as typeof positive);
            setBook(undefined);
            setReviewed(false);
          }}
        >
          <option value="">Select before choosing that source format</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
      </label>
      <label>
        Choose a SQLite source (maximum 20 MB)
        <input
          type="file"
          accept=".sqlite,.sqlite3,.db"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setBusy(true);
            setError("");
            setNotice("");
            setBook(undefined);
            setMapping({});
            setReviewed(false);
            try {
              if (file.size > 20_000_000) throw Error("Source limit is 20 MB");
              const result = await inspectExternalBook(
                new Uint8Array(await file.arrayBuffer()),
                { sqlitePositive: positive || undefined },
              );
              setBook(result);
              setCurrency(result.currency || "");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && <p role="status">Inspecting source…</p>}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      {book && (
        <>
          <h3>
            {book.format} · {book.entries.length} journals ·{" "}
            {book.accounts.length} accounts
          </h3>
          {book.warnings.map((warning) => (
            <p className="note" key={warning}>
              {warning}
            </p>
          ))}
          {book.errors.map((message) => (
            <p role="alert" className="alert error" key={message}>
              {message}
            </p>
          ))}
          {book.format === "openqbw" ? (
            <>
              <h3>Recovered fields · inspection only</h3>
              <dl>
                {Object.entries(book.diagnostics).map(([key, value]) => (
                  <div className="statement-row" key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p>
                {book.rawLines.length} recovered line records. Showing the first
                20.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Parent ID</th>
                      <th>Raw numeric value</th>
                      <th>Undecoded reason</th>
                      <th>Raw date</th>
                      <th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.rawLines.slice(0, 20).map((line, i) => (
                      <tr key={i}>
                        <td>{line.qb_id_parent}</td>
                        <td>
                          {line.value === null ? "Undecoded" : line.value}
                        </td>
                        <td>{line.value_undecoded}</td>
                        <td>{line.txn_date_raw ?? "Unknown"}</td>
                        <td>{line.flags}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  saveFile(
                    "openqbw-inspection.csv",
                    exportCSV(
                      ["Parent", "Value", "Undecoded", "Date raw", "Flags"],
                      book.rawLines.map((line) => [
                        line.qb_id_parent ?? "",
                        line.value ?? "",
                        line.value_undecoded ?? "",
                        line.txn_date_raw ?? "",
                        line.flags ?? "",
                      ]),
                    ),
                  )
                }
              >
                Export inspected fields
              </button>
            </>
          ) : (
            <>
              <label>
                Stable source book ID
                <input
                  value={bookId}
                  maxLength={80}
                  placeholder="my-old-company"
                  onChange={(event) => {
                    setBookId(event.target.value);
                    setReviewed(false);
                  }}
                />
              </label>
              <small>
                Keep this same ID for later exports of this same book. Giving it
                a different ID can create duplicate drafts.
              </small>
              <label>
                Source currency
                <select
                  value={currency}
                  disabled={!!book.currency}
                  onChange={(event) => {
                    setCurrency(event.target.value);
                    setReviewed(false);
                  }}
                >
                  <option value="">Confirm the source currency</option>
                  {currencies.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
              {currency && currency !== data.settings.currency && (
                <p role="alert">
                  Source is {currency}; this ledger is {data.settings.currency}.
                  Import is blocked. No currency conversion is applied.
                </p>
              )}
              <h3>Map accounts by meaning</h3>
              <p>
                Create any missing account in Chart of accounts, then return and
                inspect the file again. No account mapping is selected
                automatically.
              </p>
              {book.accounts
                .filter((account) => used.has(account.id))
                .map((account) => (
                  <label key={account.id}>
                    {account.code} · {account.name} ·{" "}
                    {account.type || "source type unspecified"}
                    <select
                      aria-label={`Map ${account.name}`}
                      value={mapping[account.id] || ""}
                      onChange={(event) => {
                        setMapping((current) => ({
                          ...current,
                          [account.id]: event.target.value,
                        }));
                        setReviewed(false);
                      }}
                    >
                      <option value="">Choose the matching account</option>
                      {data.accounts
                        .filter(
                          (target) =>
                            !account.type || target.type === account.type,
                        )
                        .map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.code} · {target.name} · {target.type}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              {mappingError && <p role="status">{mappingError}</p>}
              <h3>Journal preview · first 10</h3>
              {mapped.slice(0, 10).map((entry) => (
                <article key={entry.sourceId} className="note">
                  <strong>
                    {entry.date} · {entry.description}
                  </strong>
                  {entry.lines.map((line, i) => (
                    <div className="statement-row" key={i}>
                      <span>
                        {
                          data.accounts.find(
                            (account) => account.id === line.accountId,
                          )?.name
                        }
                      </span>
                      <span>
                        Dr{" "}
                        {formatMoney(
                          line.debit,
                          currency || data.settings.currency,
                        )}{" "}
                        · Cr{" "}
                        {formatMoney(
                          line.credit,
                          currency || data.settings.currency,
                        )}
                      </span>
                    </div>
                  ))}
                </article>
              ))}
              <label className="integration-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                />{" "}
                I reviewed the source currency, account mappings, warnings and
                complete source records. Create drafts only.
              </label>
              <button
                disabled={
                  busy ||
                  !reviewed ||
                  !bookId ||
                  !currency ||
                  currency !== data.settings.currency ||
                  !!mappingError ||
                  !mapped.length ||
                  mapped.length > 500
                }
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    let result:
                      | { imported: number; skipped: number }
                      | undefined;
                    const ok = await run(async () => {
                      result = await ledger.importExternalDrafts(
                        book.format,
                        bookId,
                        currency,
                        mapped,
                      );
                    }, "External journals saved as drafts. Review before posting.");
                    if (ok && result) {
                      setNotice(
                        `${result.imported} drafts imported; ${result.skipped} existing source IDs skipped.`,
                      );
                      setReviewed(false);
                    }
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Import {mapped.length} reviewed drafts
              </button>
              {mapped.length > 500 && (
                <p role="alert">
                  Import supports at most 500 journals per batch. Export a
                  smaller source scope.
                </p>
              )}
            </>
          )}
          {!!book.documents.length && (
            <>
              <h3>Source receivables / payables aging · read only</h3>
              <p>
                This report reads the source documents and dated payments. It
                does not create editable invoices or bills in your AI Accounting
                ledger.
              </p>
              <div className="form-grid">
                <label>
                  As of
                  <input
                    type="date"
                    value={asOf}
                    onChange={(event) => setAsOf(event.target.value)}
                  />
                </label>
                <label>
                  Documents
                  <select
                    value={kind}
                    onChange={(event) =>
                      setKind(event.target.value as typeof kind)
                    }
                  >
                    <option value="invoice">Customer invoices</option>
                    <option value="bill">Supplier bills</option>
                  </select>
                </label>
              </div>
              {agingError && <p role="alert">{agingError}</p>}
              {aging && (
                <>
                  <div className="statement-row">
                    <strong>Outstanding</strong>
                    <strong>
                      {formatMoney(aging.total, book.currency || "USD")}
                    </strong>
                  </div>
                  {Object.entries(aging.buckets).map(([name, amount]) => (
                    <div className="statement-row" key={name}>
                      <span>{name} days</span>
                      <span>{formatMoney(amount, book.currency || "USD")}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Skills({ data, ledger, run }: Props) {
  const [skillId, setSkillId] = useState<string>(ACCOUNTING_SKILLS[0].id),
    [amount, setAmount] = useState("100.00"),
    [date, setDate] = useState(today()),
    [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState("10"),
    [stockValue, setStockValue] = useState("100.00"),
    [sold, setSold] = useState("3");
  const [payment, setPayment] = useState("100.01"),
    [weights, setWeights] = useState("1,1,1");
  const skill = ACCOUNTING_SKILLS.find((item) => item.id === skillId)!;
  let cents = 0,
    error = "",
    cost: ReturnType<typeof stockCost> | undefined,
    costError = "",
    shares: number[] = [],
    shareError = "";
  try {
    cents = parseMoney(amount);
    if (cents <= 0) throw Error("Enter a positive amount");
  } catch (e) {
    error = (e as Error).message;
  }
  try {
    cost = stockCost(quantity, parseMoney(stockValue), sold);
  } catch (e) {
    costError = (e as Error).message;
  }
  try {
    shares = allocateMinorUnits(
      parseMoney(payment),
      weights.split(",").map((value) => parseMoney(value.trim())),
    );
  } catch (e) {
    shareError = (e as Error).message;
  }
  const money = (value: number) => formatMoney(value, data.settings.currency);
  return (
    <div className="settings-layout">
      <section className="panel padded">
        <h2>Accounting patterns to review</h2>
        <p>
          Adapted guidance and exact allocation/costing policies from the
          MIT-licensed Ledger Reborn engine. Drafts use this ledger's currency
          and need review before posting.
        </p>
        <label>
          What happened?
          <select
            value={skillId}
            onChange={(event) => setSkillId(event.target.value)}
          >
            {ACCOUNTING_SKILLS.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <p>{skill.explanation}</p>
        <p className="note">{skill.checks}</p>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label>
            Amount
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
        </div>
        <p>
          Debit{" "}
          {data.accounts.find((account) => account.id === skill.debit)?.name} ·
          Credit{" "}
          {data.accounts.find((account) => account.id === skill.credit)?.name}
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          disabled={busy || !!error}
          onClick={async () => {
            setBusy(true);
            try {
              await run(
                () =>
                  ledger.saveDraft({
                    date,
                    description: skill.title,
                    lines: [
                      { accountId: skill.debit, debit: cents, credit: 0 },
                      { accountId: skill.credit, debit: 0, credit: cents },
                    ],
                  }),
                "Accounting-pattern draft saved for review.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Create reviewed-pattern draft
        </button>
      </section>
      <section className="panel padded">
        <h2>Exact accounting calculators</h2>
        <h3>Moving weighted-average stock cost</h3>
        <label>
          Quantity on hand
          <input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label>
          Total stock value
          <input
            value={stockValue}
            onChange={(event) => setStockValue(event.target.value)}
          />
        </label>
        <label>
          Quantity sold
          <input
            value={sold}
            onChange={(event) => setSold(event.target.value)}
          />
        </label>
        {costError ? (
          <p role="alert">{costError}</p>
        ) : (
          cost && (
            <p>
              Cost of goods sold: <strong>{money(cost.cost)}</strong>
              <br />
              Remaining value: {money(cost.remainingValue)} · Quantity:{" "}
              {cost.remainingQuantity}
            </p>
          )
        )}
        <p className="note">
          Calculator only. It does not maintain stock quantities or post
          cost-of-sales journals.
        </p>
        <h3>Allocate a payment without losing cents</h3>
        <label>
          Payment amount
          <input
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
          />
        </label>
        <label>
          Relative weights, separated by commas
          <input
            value={weights}
            onChange={(event) => setWeights(event.target.value)}
          />
        </label>
        {shareError ? (
          <p role="alert">{shareError}</p>
        ) : (
          <p>{shares.map(money).join(" + ")}</p>
        )}
        <p className="note">
          Preview only; this does not allocate payments to actual invoice
          records.
        </p>
      </section>
    </div>
  );
}

function Catalog() {
  const [catalog, setCatalog] = useState<{
    count: number;
    scope: string;
    repositories: {
      repository: string;
      url: string;
      license: string;
      status: string;
      language: string | null;
      description: string;
      codeCopied: boolean;
    }[];
  }>();
  const [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/accounting-repositories.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw Error("Source catalog could not be loaded");
        return response.json();
      })
      .then(setCatalog)
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    return () => controller.abort();
  }, []);
  const entries =
    catalog?.repositories.filter((entry) =>
      `${entry.repository} ${entry.license} ${entry.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) || [];
  return (
    <section className="panel padded">
      <h2>Accounting source catalog</h2>
      <p>
        {catalog
          ? `${catalog.count} unique repositories · checked 27 November 2026`
          : "Loading catalog…"}
      </p>
      <p>{catalog?.scope}</p>
      <label>
        Find a project or license
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Repository</th>
              <th>License signal</th>
              <th>Use in this app</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.repository}>
                <td>
                  <a href={entry.url} target="_blank" rel="noopener noreferrer">
                    {entry.repository}
                  </a>
                  <small>{entry.description}</small>
                </td>
                <td>
                  {entry.license}
                  <small>{entry.language}</small>
                </td>
                <td>
                  {entry.status}
                  <small>
                    {entry.codeCopied
                      ? "Pinned source and license retained"
                      : "Code not copied"}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        License metadata is a starting point. Custom and module-specific terms
        need review. Catalogued projects are not installed or merged into this
        runtime.
      </p>
    </section>
  );
}
