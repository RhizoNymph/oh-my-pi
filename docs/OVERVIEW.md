# Overview

```yaml
Overview:
  description: >
    Oh My Pi is a Bun/TypeScript coding-agent workspace. The coding-agent CLI
    coordinates model sessions, tools, persistence, and a differential terminal UI;
    supporting packages provide provider clients, model metadata, runtime state,
    native acceleration, observability, and shared utilities.
  subsystems:
    - packages/coding-agent: CLI, interactive modes, session orchestration, tools, configuration
    - packages/tui: terminal capabilities, component tree, input dispatch, differential renderer
    - packages/agent: provider-independent agent loop and tool-call state
    - packages/ai: multi-provider streaming model client
    - packages/catalog: generated model catalog, provider descriptors, model classification
    - packages/natives and crates/pi-natives: native text, search, media, and process operations
    - packages/stats: local observability dashboard
    - packages/utils: shared logging, streams, environment, and process helpers
  data_flow: >
    CLI input enters coding-agent modes, which update AgentSession state and invoke the
    agent runtime. The runtime streams provider events through packages/ai; coding-agent
    maps those events into transcript/tool components. packages/tui composes the component
    tree into terminal rows, applies overlays and cursor placement, and emits terminal
    control sequences through ProcessTerminal. Session persistence records semantic events
    independently of terminal rendering.

Features Index:
  tui_runtime:
    description: Component rendering, input dispatch, overlays, cursor placement, and terminal lifecycle
    entry_points: [packages/tui/src/tui.ts, packages/tui/src/terminal.ts]
    depends_on: [terminal_capabilities]
    doc: docs/tui-runtime-internals.md
  native_scrollback_renderer:
    description: Append-only normal-screen transcript rendering and committed-row invariants
    entry_points: [packages/tui/src/tui.ts, packages/coding-agent/src/modes/components/transcript-container.ts]
    depends_on: [tui_runtime, terminal_capabilities]
    doc: docs/tui-core-renderer.md
  app_viewport_renderer:
    description: Experimental application-owned transcript viewport with pinned interactive chrome
    entry_points: [packages/tui/src/tui.ts, packages/coding-agent/src/modes/components/transcript-container.ts]
    depends_on: [tui_runtime, terminal_capabilities]
    doc: docs/features/app-viewport-renderer.md
  terminal_capabilities:
    description: Terminal, multiplexer, synchronized-output, keyboard, mouse, and image capability policy
    entry_points: [packages/tui/src/terminal-capabilities.ts, packages/tui/src/terminal.ts]
    depends_on: []
    doc: docs/tui-core-renderer.md
  sessions:
    description: Agent-session lifecycle, persistence, resume, and branching
    entry_points: [packages/coding-agent/src/session/agent-session.ts]
    depends_on: [agent_runtime]
    doc: docs/session.md
  agent_runtime:
    description: Provider-independent model loop and tool execution state
    entry_points: [packages/agent/src]
    depends_on: [provider_streaming]
    doc: docs/provider-streaming-internals.md
  provider_streaming:
    description: Multi-provider request and streaming event normalization
    entry_points: [packages/ai/src]
    depends_on: [model_catalog]
    doc: docs/providers.md
  model_catalog:
    description: Generated model metadata, provider descriptors, and identity classification
    entry_points: [packages/catalog/src]
    depends_on: []
    doc: docs/models.md
  tools:
    description: Built-in coding-agent tools and their runtime contracts
    entry_points: [packages/coding-agent/src/tools]
    depends_on: [agent_runtime, native_operations]
    doc: docs/custom-tools.md
  native_operations:
    description: Native text/search/media/process bindings and Rust implementations
    entry_points: [packages/natives/src, crates/pi-natives/src]
    depends_on: []
    doc: docs/natives-architecture.md
```
