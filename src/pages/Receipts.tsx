import { useEffect, useState } from "react";
import type { Ledger } from "../lib/db";
import type { Snapshot } from "../lib/types";
import { receiptCandidates } from "../lib/receipt-text";
import { minorUnitsText } from "../lib/money";
import { parseMoney } from "../lib/accounting";
import { today } from "../components/utils";

export default function Receipts({
  data,
  ledger,
  run,
}: {
  data: Snapshot;
  ledger: Ledger;
  run: (fn: () => Promise<unknown>, notice?: string) => Promise<boolean>;
}) {
  const [file, setFile] = useState<File>(),
    [available, setAvailable] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [text, setText] = useState(""),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(today()),
    [description, setDescription] = useState(""),
    [currency, setCurrency] = useState("");
  const [debit, setDebit] = useState(""),
    [credit, setCredit] = useState(""),
    [reviewed, setReviewed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/receipts/status", { signal: controller.signal })
      .then((response) =>
        response.ok ? response.json() : { available: false },
      )
      .then((status) => setAvailable(status.available))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const candidates = receiptCandidates(text);
  let amountError = "",
    cents = 0;
  try {
    if (amount) {
      cents = parseMoney(amount);
      if (cents <= 0) throw Error("Amount must be positive");
    }
  } catch (e) {
    amountError = (e as Error).message;
  }
  return (
    <div className="settings-layout">
      <section className="panel padded">
        <h2>Read a cash memo locally</h2>
        <p>
          English OCR uses Tesseract on this computer. The image is sent only to
          your local app server and is not saved by this endpoint. Check every
          extracted field against the memo.
        </p>
        <p role="status">
          {available
            ? "Local English OCR is ready."
            : "Local OCR is unavailable. Start in local mode with Tesseract, or paste the memo text below."}
        </p>
        <label>
          Receipt image · PNG/JPEG, up to 8 MB
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              setText("");
              setAmount("");
              setCurrency("");
              setDate(today());
              setDescription("");
              setDebit("");
              setCredit("");
              setReviewed(false);
              setError("");
            }}
          />
        </label>
        <button
          disabled={!file || !available || busy}
          onClick={async () => {
            if (!file) return;
            setBusy(true);
            setError("");
            setReviewed(false);
            try {
              if (file.size > 8_000_000) throw Error("Image limit is 8 MB");
              const response = await fetch("/api/receipts/ocr", {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
              });
              const result = await response.json();
              if (!response.ok) throw Error(result.error || "OCR failed");
              setText(result.text);
              const resultCandidates = receiptCandidates(result.text);
              if (resultCandidates.totals.length === 1) {
                setAmount(minorUnitsText(resultCandidates.totals[0].amount));
                setCurrency(resultCandidates.totals[0].currency || "");
              }
              if (resultCandidates.dates.length === 1)
                setDate(resultCandidates.dates[0]);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Reading locally…" : "Read receipt"}
        </button>
        <label>
          Memo text / OCR output
          <textarea
            rows={12}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setReviewed(false);
            }}
          />
        </label>
        {candidates.totals.length > 1 && (
          <p className="note">
            Multiple totals were found. Select the correct amount from the
            original document yourself.
          </p>
        )}
        <p className="note">
          OCR is not an accounting decision. Bengali handwriting, tax splits,
          supplier matching and duplicate receipt detection are not verified by
          this feature. Images received through WhatsApp still require a
          media-download integration.
        </p>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="panel padded">
        <h2>Review the accounting effect</h2>
        <p>
          Choose the actual debit and credit accounts. A sale, a purchase and
          settling an existing invoice have different effects. This creates a
          draft only.
        </p>
        <label>
          What happened?
          <input
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setReviewed(false);
            }}
            placeholder="Describe the transaction"
          />
        </label>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setReviewed(false);
              }}
            />
          </label>
          <label>
            Amount
            <input
              value={amount}
              inputMode="decimal"
              onChange={(event) => {
                setAmount(event.target.value);
                setReviewed(false);
              }}
            />
          </label>
        </div>
        <label>
          Confirm memo currency
          <select
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
              setReviewed(false);
            }}
          >
            <option value="">Choose from the original memo</option>
            {["BDT", "USD", "GBP", "EUR", "CAD", "INR", "AUD"].map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        {currency && currency !== data.settings.currency && (
          <p role="alert">
            This memo is {currency}; the ledger is {data.settings.currency}. No
            conversion is applied.
          </p>
        )}
        {[
          { label: "Debit account", value: debit, change: setDebit },
          { label: "Credit account", value: credit, change: setCredit },
        ].map((field) => (
          <label key={field.label}>
            {field.label}
            <select
              value={field.value}
              onChange={(event) => {
                field.change(event.target.value);
                setReviewed(false);
              }}
            >
              <option value="">Choose an account</option>
              {data.accounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.code} · {account.name} · {account.type}
                </option>
              ))}
            </select>
          </label>
        ))}
        {amountError && <p role="alert">{amountError}</p>}
        <label className="integration-check">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(event) => setReviewed(event.target.checked)}
          />{" "}
          I checked the original memo, amount, currency, date, duplicates and
          both account effects.
        </label>
        <button
          disabled={
            busy ||
            !reviewed ||
            !description.trim() ||
            !amount ||
            !!amountError ||
            !debit ||
            !credit ||
            debit === credit ||
            currency !== data.settings.currency
          }
          onClick={async () => {
            setBusy(true);
            try {
              const ok = await run(
                () =>
                  ledger.saveDraft({
                    date,
                    description,
                    reference: file?.name,
                    lines: [
                      { accountId: debit, debit: cents, credit: 0 },
                      { accountId: credit, debit: 0, credit: cents },
                    ],
                  }),
                "Memo draft saved. Review before posting.",
              );
              if (ok) setReviewed(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save memo draft
        </button>
      </section>
    </div>
  );
}
