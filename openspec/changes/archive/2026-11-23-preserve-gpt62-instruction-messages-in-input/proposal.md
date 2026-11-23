# Preserve GPT-6.2 instruction messages in the cached input prefix

## Why

GPT-6.2 models (`gpt-6.2-sol`, `gpt-6.2-astra`) do not read or write the
top-level Responses `instructions` field in the prompt cache, so every step
re-bills that text as uncached input. A leading `developer` message in `input`
caches from the second step on. OpenCode v2.3.2 and current Codex CLI both send
the system prompt that way.

Codex-LB's request normalizer does the opposite: it hoists message-shaped
`system`/`developer` input items into `instructions`. For GPT-6.2 that converts
a cacheable request back into the one shape the model will not cache, undoing
the client-side fix for both `/v1/responses` and `/v1/chat/completions`.

## What Changes

- Add a GPT-6.2-or-later version check and, for those models, forward
  message-shaped `system`/`developer` input items as `developer` messages in
  `input` instead of hoisting them into `instructions`. The version gate applies
  to every later GPT release, so a new model does not need a code change.
- Move a non-empty top-level `instructions` value to a leading `developer`
  input message for those models and send `instructions` as the empty string.
- Apply the same rule when mapping chat messages and OpenAI-compatible
  `messages` requests onto a Responses payload.
- Keep compact requests and the Responses Lite shape on their existing rules:
  compact keeps `instructions`, and Lite remains byte-preserving.
- Leave every other model, routing, billing, and account behavior unchanged.
  Instruction text and order are preserved; only its wire location changes.

## Capabilities

### Modified Capabilities

- `responses-api-compat`: GPT-6.2 Responses and chat-derived requests keep
  instruction messages in the cached `input` prefix.
- `chat-completions-compat`: GPT-6.2 chat requests map system/developer
  messages to leading `developer` input messages instead of `instructions`.

## Versioning

OpenAI Codex removed the top-level field outright in PR #51156 and does not
gate the wire shape by model: `ResponsesApiRequest` has no `instructions` field,
and base instructions always travel as a leading `developer` input message.
Codex's only per-model wire capability is `use_responses_lite` for the tool
bundle, not the instruction location. Codex-LB keeps its existing pre-6.2
hoisting contract, so it gates the cached shape on a single numeric model
version (`>= 6.2`) instead of a model list; 6.3, 6.10, 7.x, and later releases
need no code change.

## Impact

The upstream request body changes only for GPT-6.2 and later: `instructions`
becomes empty and instruction text moves into `input` as developer messages.
No content is dropped or reordered. Routing, account selection, billing, and
the compact endpoint are unaffected.
