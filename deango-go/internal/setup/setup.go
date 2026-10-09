// Package setup — installation planner for the two bodies.
// Default is dry-run; steps only execute with confirm=true.
package setup

import (
	"runtime"
	"strings"
	"time"

	"deango/internal/model"
	"deango/internal/util"
)

// Step is one candidate install action.
type Step struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Interactive bool   `json:"interactive"`
	Command     string `json:"command"`
}

type verifySpec struct {
	cmd  string
	args []string
}

type stepDef struct {
	label       string
	when        func(model.DetectionReport) bool
	interactive bool
	commands    map[string]string
	choose      func(model.DetectionReport) string
	verify      *verifySpec
}

var defs = map[string]stepDef{
	"install-hermes": {
		label: "Install Hermes Agent",
		when:  func(d model.DetectionReport) bool { return !d.Hermes.Installed },
		commands: map[string]string{
			"posix": "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash",
			"win32": "powershell -c \"iex (irm https://hermes-agent.nousresearch.com/install.ps1)\"",
		},
		verify: &verifySpec{cmd: "hermes", args: []string{"--version"}},
	},
	"install-openclaw": {
		label: "Install OpenClaw",
		when:  func(d model.DetectionReport) bool { return !d.Openclaw.Installed },
		commands: map[string]string{
			"posix": "curl -fsSL https://openclaw.ai/install.sh | bash",
			"npm":   "npm install -g openclaw@latest --allow-scripts=openclaw",
		},
		choose: func(d model.DetectionReport) string {
			if d.Node.Installed && d.Node.Npm.Bin != "" {
				return "npm"
			}
			return "posix"
		},
		verify: &verifySpec{cmd: "openclaw", args: []string{"--version"}},
	},
	"enable-hermes-acp": {
		label: "Ensure Hermes ACP extra (the brain's voice)",
		when: func(d model.DetectionReport) bool {
			if !d.Hermes.Installed {
				return false
			}
			for _, b := range d.Hermes.Bins {
				if b.Name == "hermes-acp" {
					return false
				}
			}
			return true
		},
		commands: map[string]string{"posix": "pip install 'agent-client-protocol==0.9.0'  # or: hermes pm repair acp"},
		verify:   &verifySpec{cmd: "hermes-acp", args: []string{"--version"}},
	},
	"auth-hermes": {
		label:       "Authenticate Hermes with a model provider (interactive)",
		when:        func(d model.DetectionReport) bool { return d.Hermes.Installed },
		interactive: true,
		commands:    map[string]string{"posix": "hermes auth login"},
	},
}

var defOrder = []string{"install-hermes", "install-openclaw", "enable-hermes-acp", "auth-hermes"}

// PlanSetup lists the actions needed for this machine.
func PlanSetup(det model.DetectionReport) map[string]any {
	steps := []Step{}
	for _, id := range defOrder {
		d := defs[id]
		if !d.when(det) {
			continue
		}
		key := "posix"
		if runtime.GOOS == "windows" {
			key = "win32"
		}
		if d.choose != nil {
			key = d.choose(det)
		}
		cmds := d.commands[key]
		if cmds == "" {
			cmds = d.commands["posix"]
		}
		steps = append(steps, Step{ID: id, Label: d.label, Interactive: d.interactive, Command: cmds})
	}
	return map[string]any{
		"platform": runtime.GOOS,
		"ready":    len(steps) == 0,
		"steps":    steps,
	}
}

// RunStep executes one planned step; requires confirm=true.
func RunStep(det model.DetectionReport, stepID string, confirm bool) map[string]any {
	def, ok := defs[stepID]
	if !ok {
		return map[string]any{"ok": false, "error": "unknown step: " + stepID}
	}
	key := "posix"
	if runtime.GOOS == "windows" {
		key = "win32"
	}
	if def.choose != nil {
		key = def.choose(det)
	}
	command := def.commands[key]
	if command == "" {
		command = def.commands["posix"]
	}
	if !confirm {
		return map[string]any{"ok": false, "dryRun": true, "command": command, "note": "pass confirm to execute"}
	}
	if def.interactive {
		return map[string]any{"ok": false, "interactive": true, "note": "run this yourself in a terminal", "command": command}
	}
	shell, args := "bash", []string{"-c", command}
	if runtime.GOOS == "windows" {
		shell, args = "powershell", []string{"-c", command}
	}
	r := util.Run(shell, args, 20*time.Minute, "")
	out := map[string]any{"ok": r.Code == 0, "exit": r.Code, "tail": tail(r.Stdout+r.Stderr, 2000)}
	if def.verify != nil {
		v := util.Run(def.verify.cmd, def.verify.args, 10*time.Second, "")
		out["verified"] = map[string]any{"ok": v.Code == 0, "out": tail(strings.TrimSpace(v.Stdout+v.Stderr), 200)}
	}
	return out
}

func tail(s string, n int) string {
	if len(s) > n {
		return s[len(s)-n:]
	}
	return s
}
