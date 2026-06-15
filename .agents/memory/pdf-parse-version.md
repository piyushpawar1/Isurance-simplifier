---
name: pdf-parse version compatibility
description: pdf-parse v2 breaks the standard callable API — must use v1
---

## Rule

Always pin `pdf-parse` to v1 (`pdf-parse@1`). Do not upgrade to v2.

**Why:** pdf-parse v2 (`2.x`) changed from a simple exported function to a class-based `PDFParse` API with a completely different call signature. The v1 API (`pdfParse(buffer) => Promise<{ text, numpages }>`) is the expected interface and only works on v1.

**How to apply:** When adding pdf-parse to any package, use `pdf-parse@1` explicitly. Load it via `createRequire` from `"module"` to handle the CJS/ESM boundary in an ESM server bundle.
