# Controller Route Boundary

Routes own Express Router construction and cross-cutting auth/cache/protect middleware; controllers receive an injected router only where legacy handler registration remains.

## What Happened
The document slice was fully moved to thin controller handlers, a document service, and a document repository. The class, quiz, study, and assignment slices moved shared Router and middleware wiring into route modules while preserving their existing handler registration and DI signatures.

## Takeaway
When completing the remaining migration, move each controller's query/use-case helpers into a service/repository pair before converting handler registration to pure `{ req, res }` functions. Keep the existing route factory options and transaction executor arguments unchanged.

## History
- 2026-10-22 (website-ho-tro-hoc-tap-ai/refactor): initial
