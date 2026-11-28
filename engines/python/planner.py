"""Read-only planning tool. JSON on stdin/stdout; no files, network, or execution tools."""
import json
import re
import sys

MAX_SAFE = 9007199254740991

def plan(payload):
    state = payload["state"]
    request = str(payload.get("request", "")).lower()
    if len(request) > 4000 or state.get("version") != 1:
        raise ValueError("Invalid planning request")
    events = state.get("events", [])
    result = {"basis": str(len(events)) + ":" + (events[-1]["id"] if events else "empty"), "actions": [], "questions": [], "mode": "review-only-rules"}
    if re.search(r"reorder|purchase|মজুত|ক্রয়|কেনা", request):
        for item in state.get("items", []):
            if item["kind"] == "service":
                continue
            on_hand = sum(x["quantity"] for x in state.get("stock", []) if x["itemId"] == item["id"] and x["location"] != "transit")
            if on_hand >= item["reorder"]:
                continue
            history = [p for p in state.get("purchases", []) if p["itemId"] == item["id"] and p["status"] == "received"]
            if not history:
                result["questions"].append("Choose a supplier and current price for: " + item["name"])
                continue
            previous = history[-1]
            quantity = item["reorder"] - on_hand
            total = (previous["total"] * quantity + previous["quantity"] // 2) // previous["quantity"]
            if not 0 < total <= MAX_SAFE:
                result["questions"].append("Confirm a valid purchase price for: " + item["name"])
                continue
            result["actions"].append({"title": "Draft replenishment purchase", "reason": "Uses the last received order's supplier and price as a proposal only. Verify both before approval. " + item["name"], "command": {"type": "purchase", "supplierId": previous["supplierId"], "itemId": item["id"], "quantity": quantity, "total": total}})
    elif re.search(r"payroll|salary|বেতন", request):
        result["questions"].append("Confirm employee, period, paid days, allowances and statutory deductions in HR & payroll. The agent will not invent payroll policy.")
    elif re.search(r"sale|dispatch|বিক্র|পাঠা", request):
        for row in state.get("sales", []):
            item = next((i for i in state["items"] if i["id"] == row["itemId"]), None)
            if row["status"] == "approved" and item and item["kind"] != "service":
                result["actions"].append({"title": "Review goods dispatch", "reason": "Check the delivery instruction and physical goods before moving them into transit.", "command": {"type": "dispatch-sale", "entityId": row["id"]}})
    else:
        result["questions"].append("Ask for replenishment, production readiness, dispatch review or payroll guidance.")
    if not result["actions"] and not result["questions"]:
        result["questions"].append("No matching action is currently required. Review your records before changing anything.")
    return result

if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(65537)
        if len(raw) > 65536:
            raise ValueError("Planning request exceeds 64 KB")
        result = plan(json.loads(raw.decode("utf-8")))
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        sys.stderr.write(str(error)[:500])
        sys.exit(1)
