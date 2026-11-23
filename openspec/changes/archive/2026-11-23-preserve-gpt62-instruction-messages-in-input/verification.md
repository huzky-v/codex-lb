# Verification

## Completeness and correctness

All 13 tasks are complete. Shared Responses normalization handles cached
instruction placement, string input and older-model/compact/Lite exceptions.
Chat and V1 conversion delegate placement to that normalizer. API-key policy and
Responses source selection reconcile placement on version-boundary transitions.
Bridge projection records original validated leading instructions and both
full-resend proofs consume that evidence.

## Evidence

- 813 tests passed across request mapping, replay safety, Responses/chat endpoint
  integration and the complete HTTP bridge integration suite.
- All 95 request-policy tests passed, including existing model alias and policy cases.
- Endpoint regressions cover string input and enforced models in both directions
  across Responses, backend Responses and chat completions.
- Bridge owner-loss regression covers GPT-6.2 and the existing older model.
- Replay tests cover multiple leading instructions, exact tool manifests,
  response-owned IDs, unknown fields, file references, malformed messages,
  non-leading messages and projection-collapsed positions.
- `make lint` passed, including architecture and migration topology checks.
- `uv run ty check` passed.
- Docker image `codex-lb:ci` built successfully, including frontend and Rust.
- A disposable container using that image passed an instruction-normalization
  smoke check and imported the replay-safety module successfully.
- Strict change validation passed; main-spec validation passed all 67 specs
  with existing long-requirement warnings.

## Coherence and limits

Instruction insertion and role rewriting have one implementation. No new
dependency or configuration setting was introduced. Existing replay settlement
and ownership checks remain in force. Tests stub upstream model execution;
actual upstream cache-hit rates are outside this local verification.
