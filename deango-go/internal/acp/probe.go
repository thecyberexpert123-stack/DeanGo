// probe.go — the full ACP probe used by the CLI and GUI:
// initialize → session/list (opt) → session/new → optional streamed prompt.
package acp

import (
	"encoding/json"
	"strings"
	"time"
)

// ProbeOptions controls Probe().
type ProbeOptions struct {
	Prompt           string
	ListSessions     bool
	PermissionPolicy string
	Timeout          time.Duration
}

// ProbeResult mirrors the Node probe result shape so the GUI is core-agnostic.
type ProbeResult struct {
	OK           bool              `json:"ok"`
	Error        string            `json:"error,omitempty"`
	Initialize   json.RawMessage   `json:"initialize,omitempty"`
	Capabilities map[string]any    `json:"capabilities,omitempty"`
	SessionID    string            `json:"sessionId,omitempty"`
	Sessions     any               `json:"sessions"`
	Models       json.RawMessage   `json:"models,omitempty"`
	Modes        json.RawMessage   `json:"modes,omitempty"`
	StreamedText string            `json:"streamedText"`
	StopReason   string            `json:"stopReason,omitempty"`
	PromptError  string            `json:"promptError,omitempty"`
	AgentLogTail []string          `json:"agentLogTail,omitempty"`
}

type updateParams struct {
	Update struct {
		SessionUpdate string `json:"sessionUpdate"`
		Content       struct {
			Text string `json:"text"`
		} `json:"content"`
	} `json:"update"`
}

// Probe runs the handshake + optional prompt against an agent command.
func Probe(agentCmd string, opts ProbeOptions) ProbeResult {
	if opts.Timeout <= 0 {
		opts.Timeout = 90 * time.Second
	}
	client, err := NewClient(agentCmd, opts.PermissionPolicy)
	if err != nil {
		return ProbeResult{OK: false, Error: err.Error()}
	}
	defer client.Close()

	res := ProbeResult{OK: true}

	// ---- initialize ------------------------------------------------------
	initRaw, err := client.Request("initialize", map[string]any{
		"protocolVersion": ProtocolVersion,
		"clientCapabilities": map[string]any{
			"fs":       map[string]any{"readTextFile": true, "writeTextFile": true},
			"terminal": false,
		},
		"clientInfo": map[string]any{"name": "deango-go-probe", "version": "0.1.0"},
	}, opts.Timeout)
	if err != nil {
		return ProbeResult{OK: false, Error: err.Error(), AgentLogTail: client.AgentLogTail(20)}
	}
	res.Initialize = initRaw

	// SessionCapabilities must match the wire field name exactly.
	type capsAlias struct {
		LoadSession         bool                     `json:"loadSession"`
		PromptCapabilities  map[string]any           `json:"promptCapabilities"`
		McpCapabilities     map[string]any           `json:"mcpCapabilities"`
		SessionCapabilities map[string]json.RawMessage `json:"sessionCapabilities"`
	}
	var initFull struct {
		AgentCapabilities capsAlias `json:"agentCapabilities"`
		AuthMethods       []struct {
			ID string `json:"id"`
		} `json:"authMethods"`
	}
	if json.Unmarshal(initRaw, &initFull) == nil {
		auth := []string{}
		for _, a := range initFull.AuthMethods {
			auth = append(auth, a.ID)
		}
		sc := initFull.AgentCapabilities.SessionCapabilities
		res.Capabilities = map[string]any{
			"loadSession":   initFull.AgentCapabilities.LoadSession,
			"sessionList":   hasKey(sc, "list"),
			"sessionResume": hasKey(sc, "resume"),
			"sessionFork":   hasKey(sc, "fork"),
			"mcp":           initFull.AgentCapabilities.McpCapabilities,
			"prompt":        initFull.AgentCapabilities.PromptCapabilities,
			"authMethods":   auth,
		}
	}
	_ = client.Notify("initialized", map[string]any{})

	// ---- session/list (optional) -----------------------------------------
	if opts.ListSessions {
		if raw, err := client.Request("session/list", map[string]any{}, opts.Timeout); err == nil {
			var listed struct {
				Sessions []map[string]any `json:"sessions"`
			}
			if json.Unmarshal(raw, &listed) == nil {
				res.Sessions = listed.Sessions
			}
		} else {
			res.Sessions = map[string]any{"error": err.Error()}
		}
	}

	// ---- session/new -------------------------------------------------------
	createdRaw, err := client.Request("session/new", map[string]any{"cwd": ".", "mcpServers": []any{}}, opts.Timeout)
	if err != nil {
		return ProbeResult{OK: false, Error: err.Error(), AgentLogTail: client.AgentLogTail(20)}
	}
	var created struct {
		SessionID string          `json:"sessionId"`
		Models    json.RawMessage `json:"models"`
		Modes     json.RawMessage `json:"modes"`
	}
	if json.Unmarshal(createdRaw, &created) == nil {
		res.SessionID = created.SessionID
		res.Models = created.Models
		res.Modes = created.Modes
	}

	// ---- session/prompt (optional, streamed) -------------------------------
	if opts.Prompt != "" && res.SessionID != "" {
		var sb strings.Builder
		client.OnNotification(func(method string, params json.RawMessage) {
			if method != "session/update" {
				return
			}
			var up updateParams
			if json.Unmarshal(params, &up) == nil && up.Update.SessionUpdate == "agent_message_chunk" {
				sb.WriteString(up.Update.Content.Text)
			}
		})
		promptRes, err := client.Request("session/prompt", map[string]any{
			"sessionId": res.SessionID,
			"prompt":    []map[string]any{{"type": "text", "text": opts.Prompt}},
		}, opts.Timeout)
		res.StreamedText = sb.String()
		if err != nil {
			res.PromptError = err.Error()
		} else {
			var pr struct {
				StopReason string `json:"stopReason"`
			}
			if json.Unmarshal(promptRes, &pr) == nil {
				res.StopReason = pr.StopReason
			}
		}
	}
	return res
}

func hasKey(m map[string]json.RawMessage, k string) bool {
	if m == nil {
		return false
	}
	_, ok := m[k]
	return ok
}
