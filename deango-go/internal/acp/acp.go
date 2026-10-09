// Package acp — DeanGo's ACP v1 stdio client (Go core).
// Speaks newline-delimited JSON-RPC to an agent process (default: hermes acp),
// answers client-direction requests with configurable policies, runs a full
// probe, and fails fast when the brain dies instead of hanging.
package acp

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// ProtocolVersion implements agent-client-protocol==0.9.x (ACP v1).
const ProtocolVersion = 1

type rpcMessage struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type pendingCall struct {
	res chan rpcMessage
}

// Client owns the child agent process and correlates requests.
type Client struct {
	proc             *exec.Cmd
	stdin            io.WriteCloser
	mu               sync.Mutex // serializes writes + id allocation
	nextID           int
	pendingMu        sync.Mutex
	pending          map[string]pendingCall
	notifyMu         sync.Mutex
	notifyHandlers   []func(method string, params json.RawMessage)
	permissionPolicy string
	dead             error
	agentLog         []string
	done             chan struct{}
}

// NewClient spawns the agent command and starts the read loop.
func NewClient(cmdline string, permissionPolicy string) (*Client, error) {
	parts := strings.Fields(cmdline)
	if len(parts) == 0 {
		return nil, errors.New("empty agent command")
	}
	if permissionPolicy == "" {
		permissionPolicy = "deny"
	}
	c := &Client{
		nextID:           1,
		pending:          map[string]pendingCall{},
		permissionPolicy: permissionPolicy,
		done:             make(chan struct{}),
	}
	proc := exec.Command(parts[0], parts[1:]...)
	stdout, err := proc.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := proc.StderrPipe()
	if err != nil {
		return nil, err
	}
	stdin, err := proc.StdinPipe()
	if err != nil {
		return nil, err
	}
	c.proc, c.stdin = proc, stdin
	if err := proc.Start(); err != nil {
		return nil, fmt.Errorf("spawn failed for %q: %w", cmdline, err)
	}
	go c.readStderr(stderr)
	go c.readLoop(stdout)
	return c, nil
}

func (c *Client) readStderr(r io.Reader) {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64<<10), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		c.mu.Lock()
		c.agentLog = append(c.agentLog, line)
		if len(c.agentLog) > 200 {
			c.agentLog = c.agentLog[len(c.agentLog)-200:]
		}
		c.mu.Unlock()
	}
}

func (c *Client) killPending(err error) {
	c.pendingMu.Lock()
	defer c.pendingMu.Unlock()
	if c.dead == nil {
		c.dead = err
	}
	for id, pc := range c.pending {
		pc.res <- rpcMessage{Error: &rpcError{Code: -32000, Message: err.Error()}}
		delete(c.pending, id)
	}
}

func (c *Client) readLoop(r io.Reader) {
	defer close(c.done)
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 256<<10), 32<<20) // ACP payloads can be large
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		var msg rpcMessage
		if json.Unmarshal([]byte(line), &msg) != nil {
			continue
		}
		switch {
		case msg.Method != "" && len(msg.ID) > 0:
			c.handleAgentRequest(msg)
		case msg.Method != "":
			c.notifyMu.Lock()
			handlers := append([]func(string, json.RawMessage){}, c.notifyHandlers...)
			c.notifyMu.Unlock()
			for _, h := range handlers {
				h(msg.Method, msg.Params) // synchronous: preserves stream chunk order
			}
		case len(msg.ID) > 0:
			key := string(msg.ID)
			c.pendingMu.Lock()
			pc, ok := c.pending[key]
			if ok {
				delete(c.pending, key)
			}
			c.pendingMu.Unlock()
			if ok {
				pc.res <- msg
			}
		}
	}
	err := "agent process exited"
	if c.proc.ProcessState != nil {
		err = fmt.Sprintf("agent process exited (%s)", c.proc.ProcessState.String())
	}
	c.mu.Lock()
	if n := len(c.agentLog); n > 0 {
		err = fmt.Sprintf("%s — last output: %.300s", err, c.agentLog[n-1])
	}
	c.mu.Unlock()
	c.killPending(errors.New(err))
}

func (c *Client) write(msg any) error {
	raw, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.dead != nil {
		return c.dead
	}
	_, err = c.stdin.Write(append(raw, '\n'))
	return err
}

// Request performs one client→agent RPC with timeout. Fails fast if the
// agent died.
func (c *Client) Request(method string, params any, timeout time.Duration) (json.RawMessage, error) {
	if c.dead != nil {
		return nil, c.dead
	}
	c.mu.Lock()
	id := c.nextID
	c.nextID++
	c.mu.Unlock()
	key := fmt.Sprintf("%d", id)

	pc := pendingCall{res: make(chan rpcMessage, 1)}
	c.pendingMu.Lock()
	c.pending[key] = pc
	c.pendingMu.Unlock()

	err := c.write(map[string]any{"jsonrpc": "2.0", "id": id, "method": method, "params": params})
	if err != nil {
		c.pendingMu.Lock()
		delete(c.pending, key)
		c.pendingMu.Unlock()
		return nil, err
	}

	select {
	case msg := <-pc.res:
		if msg.Error != nil {
			return nil, fmt.Errorf("%s: RPC %d: %s", method, msg.Error.Code, msg.Error.Message)
		}
		return msg.Result, nil
	case <-time.After(timeout):
		c.pendingMu.Lock()
		delete(c.pending, key)
		c.pendingMu.Unlock()
		return nil, fmt.Errorf("%s: timeout", method)
	}
}

// Notify sends a client→agent notification (no id).
func (c *Client) Notify(method string, params any) error {
	return c.write(map[string]any{"jsonrpc": "2.0", "method": method, "params": params})
}

// OnNotification registers a handler for agent→client notifications.
func (c *Client) OnNotification(h func(method string, params json.RawMessage)) {
	c.notifyMu.Lock()
	c.notifyHandlers = append(c.notifyHandlers, h)
	c.notifyMu.Unlock()
}

func (c *Client) respond(id json.RawMessage, result any, rpcErr *rpcError) {
	rawID := json.RawMessage(id)
	msg := map[string]any{"jsonrpc": "2.0", "id": rawID}
	if rpcErr != nil {
		msg["error"] = rpcErr
	} else {
		msg["result"] = result
	}
	_ = c.write(msg)
}

func (c *Client) handleAgentRequest(msg rpcMessage) {
	if msg.Method == "session/request_permission" {
		if c.permissionPolicy == "allow-once" {
			c.respond(msg.ID, map[string]any{
				"outcome": map[string]any{"outcome": "selected", "optionId": firstOptionID(msg.Params)},
			}, nil)
		} else {
			c.respond(msg.ID, map[string]any{"outcome": map[string]any{"outcome": "cancelled"}}, nil)
		}
		return
	}
	c.respond(msg.ID, nil, &rpcError{Code: -32601, Message: "not implemented by DeanGo probe: " + msg.Method})
}

func firstOptionID(params json.RawMessage) string {
	var p struct {
		Options []struct {
			ID string `json:"id"`
		} `json:"options"`
	}
	if json.Unmarshal(params, &p) == nil && len(p.Options) > 0 && p.Options[0].ID != "" {
		return p.Options[0].ID
	}
	return "allow-once"
}

// AgentLogTail returns recent agent stderr lines.
func (c *Client) AgentLogTail(n int) []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.agentLog) > n {
		return append([]string{}, c.agentLog[len(c.agentLog)-n:]...)
	}
	return append([]string{}, c.agentLog...)
}

// Close terminates the agent politely, then forcibly.
func (c *Client) Close() {
	_ = c.stdin.Close()
	if c.proc.Process != nil {
		_ = c.proc.Process.Kill()
	}
	select {
	case <-c.done:
	case <-time.After(3 * time.Second):
	}
}
