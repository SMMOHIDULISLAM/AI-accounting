"""Create a disposable synthetic Ledger Reborn backup for the import contract test."""
from pathlib import Path
import argparse
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "third_party" / "ledger-reborn"))
from ledger import Ledger

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", help="New .sqlite file; existing files are not overwritten")
args = parser.parse_args()
destination = Path(args.output).resolve()
if destination.exists():
    raise SystemExit("Choose a new output path; existing files are never overwritten")
destination.parent.mkdir(parents=True, exist_ok=True)
book = Ledger(":memory:")
try:
    customer = book.create_contact("SYNTHETIC customer", "customer")
    vendor = book.create_contact("SYNTHETIC supplier", "vendor")
    book.post_journal("2026-01-01", "SYNTHETIC owner contribution", [
        {"account": "1000", "debit_cents": 100000},
        {"account": "3000", "credit_cents": 100000},
    ])
    invoice = book.create_invoice("2026-01-02", customer["id"], [
        {"description": "SYNTHETIC service", "account": "4000", "amount_cents": 10000},
    ], due_date="2026-01-15")
    book.receive_payment("2026-01-10", invoice["id"], 4000)
    item = book.create_item("SYNTHETIC-SKU", "SYNTHETIC inventory")
    book.buy_inventory("2026-01-11", item["id"], "10", 700, contact_id=vendor["id"])
    book.sell_inventory("2026-01-12", item["id"], "2", 1200, customer["id"])
    book.backup(destination)
    print(json.dumps({"synthetic_only": True, "currency": "USD", "journals": len(book.list_data()["journals"]), "receivables": book.ar_aging("2026-01-31")["total_outstanding_cents"]}))
finally:
    book.close()
