# chat-completions-compat Delta

## MODIFIED Requirements

### Requirement: Map chat requests to Responses wire format

Chat mapping MUST hoist system/developer content into instructions, except for
GPT-6.2+ cached-prefix mapping and JSON object mode, which retain instruction
messages in input as specified below. Other messages MUST map to input. Tools
MUST use Responses schemas; tool choice, reasoning effort and response format
MUST map consistently. Unsupported behavior-changing fields MUST NOT be
silently ignored.

#### Scenario: GPT-6.2 and later system message normalization

- **WHEN** the client sends a `system` message followed by a `user` message
  for a GPT-6.2-or-later model
- **THEN** the mapped Responses payload carries the system content as a leading
  `developer` `input` message
- **AND** the mapped `instructions` value is empty
- **AND** any nonblank top-level instructions precede the original messages as a developer message

#### Scenario: A later GPT model uses the same chat mapping

- **WHEN** the client sends a `system` message for `gpt-6.3-sol`
- **THEN** the mapped Responses payload carries the system content as a leading
  `developer` `input` message
- **AND** the mapped `instructions` value is empty

#### Scenario: System message normalization

- **WHEN** the client sends a `system` message followed by a `user` message
- **AND** the request does not use `response_format.type = "json_object"`
- **AND** the model is not GPT-6.2 or later
- **THEN** the service maps the system content to `instructions` and the user
  message to `input`

#### Scenario: JSON object response format preserves instruction-role messages

- **WHEN** the client sends `response_format: {"type":"json_object"}` with a
  `system` or `developer` message that instructs JSON output
- **THEN** the mapped Responses payload keeps that message in `input` with its
  original role for models before GPT-6.2, or the `developer` role for GPT-6.2 and later
- **AND** the mapped `instructions` value does not contain that message content

#### Scenario: Tool choice values

- **WHEN** the client sets `tool_choice` to `none`, `auto`, or `required`
- **THEN** the service forwards the value consistently in the mapped Responses
  request
