# Zero-budget architecture source notes

Checked 20 November 2026.

Ollama's official API introduction documents local inference at `http://localhost:11434/api/chat` with a downloaded model and no authorization header. Direct hosted inference requires an API key. We will not use paid hosted APIs or automatically switch to cloud models. Source: https://docs.ollama.com/api/introduction and https://docs.ollama.com/api/authentication

The FAQ says local prompts and responses are not sent to Ollama, models can load in CPU RAM or GPU VRAM, and Ollama binds to 127.0.0.1:11434 by default. Model size and context consume local memory; local software does not mean electricity, hardware or initial internet downloads have no cost. Cloud features can be disabled; the README should link to the official local-only instructions. Source: https://docs.ollama.com/faq

sql.js provides SQLite compiled for JavaScript/WebAssembly. Its Database export operation returns SQLite database bytes. It is in-memory during use, so the application must persist exported database bytes to IndexedDB after successful transactions. Source: https://sql.js.org/documentation/ and https://sql.js.org/documentation/Database.html

Recommended MVP: a React/TypeScript web UI, a real sql.js SQLite ledger persisted as bytes in IndexedDB, and backup/restore of .sqlite files. The server is not the authoritative ledger store. For open-ended local AI, run the app on the user's computer with a same-origin backend that forwards explicitly requested assistant conversations to the loopback Ollama service. An online Manus preview cannot reach the user's localhost:11434; it will provide a clearly labelled rules-based guided mode, not fabricated AI answers. No provider key or subscription is required for this local option. Do not describe model competency as CPA/ACCA/CA certification or guaranteed worldwide compliance.
