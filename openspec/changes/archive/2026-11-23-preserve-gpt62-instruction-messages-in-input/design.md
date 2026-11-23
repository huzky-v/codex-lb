# Design

## Context

See [proposal.md](proposal.md) for the cache motivation and [context.md](context.md)
for examples. Instruction normalization runs before routing, while enforced and
source-selected model identities can change afterward. Bridge recovery treats
developer messages as control state unless their original position is proven.

## Goals / Non-Goals

Centralize instruction placement in the existing Responses normalizer. Preserve
the independent compact and Lite contracts and existing replay ownership gates.
No schema, dependency, configuration, or dashboard change is needed.

## Decisions

- Chat adapters preserve instruction-role content during message conversion and
  delegate role rewriting and top-level insertion to Responses validation.
  Separate adapter-specific rewrites duplicated policy and obscured idempotence.
- Normalize string input before placing instructions. Reconcile placement when
  model policy crosses the version boundary, before routing/recovery consumes
  the request. Serialization-only rewriting would leave fingerprints and replay
  classification describing a different payload from the upstream wire.
- Record the validated original leading instruction count in the existing replay
  projection. Pass that evidence to both retained-output and exact tool-manifest
  checks. Recognizing a prefix after projection could turn a non-leading or
  response-owned control message into replayable instructions.

## Risks / Trade-offs

- Effective-model transitions may hoist then reinsert instruction text; existing
  older-model normalization remains the canonical representation in that case.
- Mixed instruction content retains the transport-safe hoist path. Compact and
  Lite are explicitly excluded from the cached-shape rewrite.
- Cache identities change when wire placement changes; recovery must still prove
  the stored fingerprint rather than guess continuity across deployment.

## Migration Plan

Deploy through the normal application build. No data migration is needed. Revert
the change to restore prior instruction placement; existing fingerprint checks
remain authoritative during deployment and rollback.
