# F-drive portable edition — revised scope

Requested on 20 November 2026 while the first web build was in progress.

## Requirements carried forward

The offline edition must keep its application files, ledger, attachments, runtime and local AI models on a removable drive such as F:. It should move between compatible PCs, need no separate Node/Ollama installation on the destination PC, and run only after the user explicitly instructs it to run. There must be no USB autorun, silent installation, system startup task or administrator-only setup. The long-term product should have offline/online and PC/mobile editions, with controlled transfer and integration capabilities.

## Current foundation is not a portable release

The current web foundation has browser-local SQLite in IndexedDB. Browser storage is tied to browser/profile/origin and does not travel with an F-drive disk. Its source instructions also require Node and an optional installed Ollama model. Therefore the existing build must not be described as satisfying no-install F-drive portability. The cloud sandbox paths are not the user's C:, D:, E: or F: drives; no local PC drive has been accessed or modified.

## Recommended first portable package

Target Windows 10/11 x64 first, subject to user confirmation. Store everything application-controlled beneath `F:\AI-accounting\` when that is the chosen disk. Resolve locations relative to the launcher instead of hardcoding the drive letter, because another PC may assign the same removable disk G: or H:. A portable `Run AI Accounting` launcher should start the bundled runtime and local-only server when clicked, open the browser UI, and stop the application services on exit. No automatic execution merely from connecting the disk.

Replace authoritative IndexedDB storage in the portable edition with an actual SQLite file in the package's `data` folder. Add attachment storage, backup/restore, clean shutdown, single-process lock and safe drive-removal checks. Ship a pinned runtime and an appropriate Windows local-model runner, plus a separately verified model package if its license permits redistribution. Do not make AI download, install dependencies, or modify the operating system on its own. The deterministic launcher can detect compatible architecture, free memory, models and writable storage, then explain missing requirements before running.

“No installation” means the destination does not need to install the app's own dependencies. It cannot guarantee that Windows will never write its own logs, caches, antivirus data, temporary files or browser profile files to C:. Guarantee application-managed data locations, not every operating-system write. If browser data must also remain on the disk, evaluate a bundled portable browser with its profile and cache explicitly redirected to the package, and explain its size and security-update needs. Some PCs block USB executables or local servers by policy; the app must report that and must not bypass security controls.

Offline model selection depends on PC hardware. A model that runs on one computer may be unusable on another with less RAM. Manual entry and guided rules must work without a model, but model-based open-ended AI cannot be guaranteed on every PC. An initial bundled model download requires internet somewhere; the offline package can then travel without another download if compatible.

## Online and mobile editions

The online web app is a separate deployment, not automatically a portable executable. Preserve the same accounting core, but design authenticated per-user access and durable online storage before cloud synchronization of sensitive records. Use explicit export/import first; no automatic upload of the drive's ledger. Later synchronization needs conflict handling, version tracking, consent, backups and encryption decisions.

A Windows executable cannot run unchanged on phones, macOS or Linux. Deliver mobile access through the responsive web app first; true offline mobile support needs a separately designed PWA/native storage and model strategy. USB-drive browser file access and local AI support vary by mobile platform. Do not claim universal no-install offline support.

## Next decision

Confirm Windows 10/11 x64 as the first portable target and approve the revised storage/packaging work. Keep the currently working web foundation as a checkpoint and private source repository. Portable binaries, bundled local model, online publication and cross-device synchronization are not completed by this checkpoint. The app remains a draft-management bookkeeping tool, not a complete Xero/QuickBooks substitute or global compliance engine.
