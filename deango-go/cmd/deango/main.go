// DeanGo (Go core) — the organism's engine as one static binary.
// NOT an agent: the brain is Hermes, the limbs are OpenClaw; this core
// detects, inspects, connects, supervises, and probes them.
//
// All commands print JSON to stdout so shells and the Node UI can consume it.
//
//	deango detect | inspect | doctor
//	deango connect [--apply]
//	deango setup [--confirm] [step]
//	deango up|down|status|logs [unit]
//	deango probe [--cmd X] [--prompt "..."] [--list] [--allow-once] [--timeout 90s]
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"deango/internal/acp"
	"deango/internal/compat"
	"deango/internal/connect"
	"deango/internal/detect"
	"deango/internal/inspect"
	"deango/internal/setup"
	"deango/internal/supervisor"
	"deango/internal/util"
)

func exeName() string {
	if len(os.Args) > 0 {
		return filepath.Base(os.Args[0])
	}
	return "deango"
}

func flag(args []string, name string) bool {
	for _, a := range args {
		if a == name {
			return true
		}
	}
	return false
}

func opt(args []string, name, dflt string) string {
	for i, a := range args {
		if a == name && i+1 < len(args) {
			return args[i+1]
		}
	}
	return dflt
}

func positional(args []string, i int) string {
	n := 0
	for _, a := range args {
		if len(a) > 0 && a[0] != '-' {
			if n == i {
				return a
			}
			n++
		}
	}
	return ""
}

func fatal(err error) {
	util.PrintJSON(util.ErrJSON(err))
	os.Exit(1)
}

func main() {
	args := os.Args[1:]
	cmd := "doctor"
	if len(args) > 0 {
		cmd = args[0]
		args = args[1:]
	}

	switch cmd {
	case "detect":
		util.PrintJSON(detect.DetectAll())

	case "inspect":
		det := detect.DetectAll()
		util.PrintJSON(inspect.InspectAll(det))

	case "connect":
		det := detect.DetectAll()
		apply := flag(args, "--apply")
		res, err := connect.BuildConnection(det, apply)
		if err != nil {
			fatal(err)
		}
		util.PrintJSON(map[string]any{
			"written": res.Written, "merges": res.Merges,
			"warnings": res.Plan.Warnings, "deangoHome": res.Plan.DeangoHome,
		})

	case "connect-plan":
		util.PrintJSON(connect.PlanConnection(detect.DetectAll()))

	case "setup":
		det := detect.DetectAll()
		step := positional(args, 0)
		if step == "" {
			util.PrintJSON(setup.PlanSetup(det))
		} else {
			util.PrintJSON(setup.RunStep(det, step, flag(args, "--confirm")))
		}

	case "up":
		units, err := supervisor.ListUnits()
		if err != nil {
			fatal(err)
		}
		target := positional(args, 0)
		results := map[string]any{}
		for _, u := range units {
			if target != "" && u.ID != target {
				continue
			}
			if target == "" && (!u.Autostart || (u.Status != nil && u.Status.Running)) {
				continue
			}
			results[u.ID] = supervisor.StartUnit(u.ID)
		}
		util.PrintJSON(results)

	case "down":
		units, err := supervisor.ListUnits()
		if err != nil {
			fatal(err)
		}
		target := positional(args, 0)
		results := map[string]any{}
		for _, u := range units {
			if target != "" && u.ID != target {
				continue
			}
			results[u.ID] = supervisor.StopUnit(u.ID)
		}
		util.PrintJSON(results)

	case "status":
		units, err := supervisor.ListUnits()
		if err != nil {
			fatal(err)
		}
		util.PrintJSON(units)

	case "logs":
		id := positional(args, 0)
		if id == "" {
			id = "openclaw-gateway"
		}
		lines := 200
		if v := opt(args, "--lines", ""); v != "" {
			_, _ = fmt.Sscanf(v, "%d", &lines)
		}
		util.PrintJSON(map[string]any{"id": id, "log": supervisor.TailLog(id, lines)})

	case "compat":
		timeout, err := time.ParseDuration(opt(args, "--timeout", "60s"))
		if err != nil {
			timeout = 60 * time.Second
		}
		rep, err := compat.Check(flag(args, "--heal"), opt(args, "--cmd", ""), timeout)
		if err != nil {
			fatal(err)
		}
		util.PrintJSON(rep)

	case "probe":
		timeout, err := time.ParseDuration(opt(args, "--timeout", "90s"))
		if err != nil {
			timeout = 90 * time.Second
		}
		res := acp.Probe(opt(args, "--cmd", "hermes acp"), acp.ProbeOptions{
			Prompt:           opt(args, "--prompt", ""),
			ListSessions:     flag(args, "--list"),
			PermissionPolicy: map[bool]string{true: "allow-once", false: "deny"}[flag(args, "--allow-once")],
			Timeout:          timeout,
		})
		util.PrintJSON(res)

	case "doctor":
		det := detect.DetectAll()
		insp := inspect.InspectAll(det)
		plan := connect.PlanConnection(det)
		setupPlan := setup.PlanSetup(det)
		bridgeConfigured := false
		if oc, ok := insp["openclaw"].(map[string]any); ok {
			if gc, ok := oc["gatewayConfig"].(map[string]any); ok {
				bridgeConfigured, _ = gc["hermesAgentConfigured"].(bool)
			}
		}
		remaining := []string{}
		if steps, ok := setupPlan["steps"].([]setup.Step); ok {
			for _, s := range steps {
				remaining = append(remaining, s.Label)
			}
		}
		util.PrintJSON(map[string]any{
			"core":                    "go",
			"goos":                    runtime.GOOS,
			"organismReady":           det.Complete && len(plan.Warnings) == 0,
			"hermes":                  det.Hermes,
			"openclaw":                det.Openclaw,
			"bridgeAlreadyConfigured": bridgeConfigured,
			"connectionWarnings":      plan.Warnings,
			"setupStepsRemaining":     remaining,
		})

	case "version":
		util.PrintJSON(map[string]any{"deango": "0.1.0", "core": "go", "go": runtime.Version()})

	default:
		raw, _ := json.Marshal(map[string]any{
			"error": "unknown command: " + cmd,
			"usage": exeName() + " detect|inspect|doctor|connect [--apply]|setup [--confirm] [step]|up|down|status|logs [unit]|probe [--cmd X --prompt ...]|compat [--heal --cmd X --timeout D]",
		})
		fmt.Println(string(raw))
		os.Exit(1)
	}
}
