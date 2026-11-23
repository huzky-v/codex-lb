# Tasks

## 1. Request normalization

- [x] 1.1 Add the GPT-6.2-or-later version check in `app/core/openai/requests.py`.
- [x] 1.2 Keep message-shaped `system`/`developer` items in `input` as
  `developer` messages for GPT-6.2 Responses requests, and move a non-empty
  top-level `instructions` value to a leading `developer` message.
- [x] 1.3 Keep the compact request normalizer and the Responses Lite carve-out
  unchanged.
- [x] 1.4 Apply the same mapping to chat completions and OpenAI-compatible
  `messages` Responses requests.

## 2. Affinity identity

- [x] 2.1 Read the leading instruction text from `input` when `instructions`
  is empty, so the thread-anchor domain keeps separating prompt variants.

## 3. Verification

- [x] 3.1 Unit tests: GPT-6.2 Responses, chat, and V1 messages shapes; GPT-6.1
  control; compact unchanged.
- [x] 3.2 Integration tests through `/backend-api/codex/responses` and
  `/v1/chat/completions` capturing the forwarded upstream payload.
- [x] 3.3 Run targeted pytest suites.
- [x] 3.4 Run strict OpenSpec validation.

## 4. Review fixes and simplification

- [x] 4.1 Centralize instruction shaping, including string input, and remove duplicated adapter transformations.
- [x] 4.2 Reconcile instruction placement after effective-model enforcement and source resolution.
- [x] 4.3 Recognize verified leading instruction messages in durable replay without relaxing ownership or positional checks.
- [x] 4.4 Add endpoint and bridge recovery regressions; run lint, types, tests, build and strict spec checks.
