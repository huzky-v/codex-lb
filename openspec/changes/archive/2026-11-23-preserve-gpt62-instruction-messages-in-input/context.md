# Review follow-up

Instruction wire placement belongs to the shared Responses normalizer. Chat and
V1 adapters only preserve message roles while converting chat content; the shared
normalizer rewrites roles and inserts top-level instructions once. Model policy
and source selection reconcile placement when the effective model changes.

For example, `instructions: "Be concise", input: "Hello"` becomes a developer
message followed by a user message on GPT-6.2. A key enforcing GPT-6.1 instead
keeps the instruction text at top level. Compact and Lite retain their own rules.

Bridge recovery fingerprints the full normalized input. Its projection records
the length of the original contiguous, validated instruction prefix, allowing
the existing settlement checks to ignore those instructions without deleting
them from replay. It must not infer a prefix after dropping reasoning items or
strip response-owned IDs before deciding eligibility.

Verification covers forwarded endpoint bodies, enforcement in both directions,
actual bridge owner loss, and rejection of owned/non-leading/malformed prefixes.
