# responses-api-compat Delta

## MODIFIED Requirements

### Requirement: Non-message system and developer input items are preserved

Responses and compact normalization MUST preserve typed non-message
system/developer items unchanged, in order, through validation, serialization
and compact trimming. Only messages (type omitted or `message`) may be hoisted.
Directive-only requests MUST default missing instructions to `""`. Lite input
and instructions MUST remain unchanged. GPT-6.2 text-only instruction messages
MUST follow the cached-prefix requirement instead of hoisting.

#### Scenario: String input uses the cached instruction prefix

- **WHEN** a GPT-6.2 request sends string input and top-level instructions
- **THEN** the instructions precede the normalized user message as a developer message
- **AND** top-level instructions is empty

#### Scenario: Enforced model crosses the version boundary

- **WHEN** API-key enforcement changes the model across the GPT-6.2 boundary
- **THEN** instruction placement follows the enforced model rather than the requested model

#### Scenario: unknown non-message developer input item survives normalization

- **WHEN** a Responses or compact request `input` contains a typed, non-message
  item such as `{"type": "future_directive", "role": "developer", ...}`
  alongside developer instruction messages and user messages
- **AND** the model is not GPT-6.2 or later
- **THEN** the developer instruction messages are hoisted into `instructions`
- **AND** the `future_directive` item remains in `input` unchanged, in its
  original position
- **AND** the upstream-serialized payload retains the item unchanged

#### Scenario: preserved directive keeps reasoning and tool-call keys

- **WHEN** a Responses or compact request `input` contains a typed,
  non-message `system`/`developer` item carrying keys the interleaved
  reasoning sanitizer strips from message items (such as
  `reasoning_content`, `reasoning_details`, `tool_calls`, or `function_call`)
- **THEN** the item is retained byte-identical after validation
- **AND** the upstream-serialized payload retains the item byte-identical

#### Scenario: directive-only request without instructions still validates

- **WHEN** a Responses or compact request omits top-level `instructions` and
  its `input` contains only a typed, non-message `system`/`developer` item
  (such as `{"type": "future_directive", "role": "developer", ...}`) alongside
  user messages
- **THEN** the request validates with `instructions` defaulted to `""`
- **AND** the directive item remains in `input` unchanged, including in the
  upstream-serialized payload

#### Scenario: preserved directive survives compact input trimming

- **WHEN** a compact request is large enough to trigger upstream input
  trimming and its input middle contains a typed, non-message
  `system`/`developer` item such as
  `{"type": "future_directive", "role": "developer", ...}`
- **THEN** the trimmed upstream payload retains the item unchanged
- **AND** the item is not replaced by the trim marker

#### Scenario: typeless system messages keep hoisting behavior

- **WHEN** an OpenAI-compatible client sends `input` containing
  `{"role": "system", "content": "sys"}` without a `type` field
- **AND** the model is not GPT-6.2 or later
- **THEN** that item is hoisted into `instructions` as before

#### Scenario: GPT-6.2 and later keep the leading developer message in input

- **WHEN** a `gpt-6.2-sol` or later-model Responses request carries its system
  prompt as the first `input` item, a message-shaped `developer` item
- **THEN** the forwarded payload keeps that item in `input`
- **AND** the forwarded `instructions` field is empty

#### Scenario: A later GPT model uses the same cached input shape

- **WHEN** a `gpt-7-sol` Responses request carries a message-shaped `developer`
  input item
- **THEN** the forwarded payload keeps that item in `input`
- **AND** the forwarded `instructions` field is empty

#### Scenario: GPT-6.2 system message becomes a developer input message

- **WHEN** a `gpt-6.2-astra` Responses request carries a message-shaped
  `system` input item
- **THEN** the forwarded payload carries the same content as a `developer`
  input message in the same position
- **AND** the forwarded `instructions` field is empty

#### Scenario: GPT-6.2 top-level instructions move to input

- **WHEN** a GPT-6.2 Responses request carries a non-empty top-level
  `instructions` value
- **THEN** the forwarded payload carries that text as a leading `developer`
  input message
- **AND** the forwarded `instructions` field is empty

#### Scenario: GPT-6.1 keeps instruction hoisting

- **WHEN** a `gpt-6.1-sol` Responses request carries a message-shaped
  `developer` input item
- **THEN** that content is hoisted into `instructions` as before

#### Scenario: Compact requests keep instructions

- **WHEN** a GPT-6.2 compact request carries a message-shaped `developer`
  input item
- **THEN** that content is hoisted into `instructions` as before

## ADDED Requirements

### Requirement: Effective model selects cached instruction placement

For effective upstream GPT versions >= 6.2, Responses requests MUST retain
text-only system/developer messages as developer input messages in original
order and prepend nonblank top-level instructions as a developer message,
clearing instructions. This MUST apply to string input and chat adapters after
enforcement and source resolution. Older models and mixed-content instructions
MUST retain hoisting; compact and Lite MUST retain their existing rules.

#### Scenario: Equivalent input representations

- **WHEN** GPT-6.2 receives the same instructions with string or equivalent user-message array input
- **THEN** both forward the same developer instruction prefix

#### Scenario: Source model crosses the version boundary

- **WHEN** source resolution changes the effective model across GPT-6.2
- **THEN** instruction placement follows the upstream model

#### Scenario: Lite and mixed content retain existing rules

- **WHEN** input contains `additional_tools`
- **THEN** the input array and instructions remain unchanged
- **WHEN** non-Lite instruction messages contain non-text content
- **THEN** instruction text is hoisted and remaining content follows transport-safe normalization

### Requirement: Cached instruction prefixes preserve verified bridge recovery

Durable full-resend recovery MUST accept a contiguous leading prefix of inline,
account-neutral, text-only developer messages when the stored input fingerprint
matches. Prefix recognition MUST use original input positions before projection.
Response-owned messages, unknown fields, file references, and non-leading developer
messages MUST NOT gain replay eligibility through this rule. Existing prior-output
and pending-tool-call settlement proofs MUST still succeed before recovery.

#### Scenario: Full resend recovers after owner loss

- **WHEN** a GPT-6.2 full resend retains its verified instruction prefix, prior output and new user input
- **AND** the original account is unavailable
- **THEN** the bridge can recover on another eligible account with instructions retained
- **AND** it does not forward the original account's previous response ID

#### Scenario: Projection cannot create an instruction prefix

- **WHEN** a response-owned reasoning item precedes a developer message in the original input
- **THEN** projecting out that reasoning item MUST NOT classify the developer message as a leading instruction
