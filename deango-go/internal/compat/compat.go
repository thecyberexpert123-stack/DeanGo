// Package compat — the update watchdog (Go core): detect version/location
// drift after either component updates, probe the ACP spine, and optionally
// self-heal by re-rendering the connection (merges reapplied only if they
// were applied before).
package compat

import (
	"encoding/json"
	"path/filepath"
	"time"

	"deango/internal/acp"
	"deango/internal/connect"
	"deango/internal/detect"
	"deango/internal/model"
	"deango/internal/util"
)

type fieldDrift struct {
	Field string `json:"field"`
	Was   any    `json:"was"`
	Now   any    `json:"now"`
}

type Report struct {
	CheckedAt      string         `json:"checkedAt"`
	Versions       map[string]any `json:"versions"`
	Drift          []fieldDrift   `json:"drift"`
	DriftCount     int            `json:"driftCount"`
	Probe          map[string]any `json:"probe"`
	Healed         bool           `json:"healed"`
	HealActions    map[string]any `json:"healActions,omitempty"`
	ProbeAfterHeal map[string]any `json:"probeAfterHeal,omitempty"`
	Healthy        bool           `json:"healthy"`
}

func snapshot(det model.DetectionReport) map[string]any {
	bins := []string{}
	for _, b := range det.Hermes.Bins {
		bins = append(bins, b.Name+"="+b.Path)
	}
	var ocBin string
	if len(det.Openclaw.Bins) > 0 {
		ocBin = det.Openclaw.Bins[0].Path
	}
	return map[string]any{
		"hermes":            det.Hermes.Version,
		"openclaw":          det.Openclaw.Version,
		"hermesHome":        det.Hermes.Home,
		"hermesCheckout":    det.Hermes.Checkout,
		"hermesBins":        bins,
		"openclawHome":      det.Openclaw.Home,
		"openclawNpmGlobal": det.Openclaw.NpmGlobal,
		"openclawBin":       ocBin,
	}
}

func diffSnapshot(before, after map[string]any) []fieldDrift {
	drift := []fieldDrift{}
	if before == nil {
		return drift
	}
	for k, nowV := range after {
		wasV := before[k]
		if !equalJSON(wasV, nowV) {
			drift = append(drift, fieldDrift{Field: k, Was: wasV, Now: nowV})
		}
	}
	return drift
}

func equalJSON(a, b any) bool {
	// compare via re-marshal: honest for the flat scalar/slice shapes here
	ab, _ := json.Marshal(a)
	bb, _ := json.Marshal(b)
	return string(ab) == string(bb)
}

// brainCmd resolves the ACP brain command: caller-pinned value wins, else the
// hermes-acp unit from units.json, else the default. Re-derived after a heal,
// because the heal may have rewritten units.json with a corrected path.
func brainCmd(connDir, pinned string) string {
	if pinned != "" {
		return pinned
	}
	if units, err := util.ReadJSONFile(filepath.Join(connDir, "units.json")); err == nil {
		if us, ok := units["units"].([]any); ok {
			for _, u := range us {
				if um, ok := u.(map[string]any); ok && um["id"] == "hermes-acp" {
					if c, ok := um["cmd"].(string); ok && c != "" {
						return c
					}
				}
			}
		}
	}
	return "hermes acp"
}

// Check performs one watchdog pass. agentCmd "" → value from units.json,
// else default "hermes acp".
func Check(heal bool, agentCmd string, timeout time.Duration) (Report, error) {
	started := time.Now()
	det := detect.DetectAll()
	connDir := filepath.Join(util.DeangoHome(), "connection")

	manifest, _ := util.ReadJSONFile(filepath.Join(connDir, "manifest.json"))
	var before map[string]any
	applyAtConnect := false
	if manifest != nil {
		before, _ = manifest["versions"].(map[string]any)
		applyAtConnect, _ = manifest["apply"].(bool)
	}
	now := snapshot(det)
	drift := diffSnapshot(before, now)

	pinned := agentCmd
	agentCmd = brainCmd(connDir, pinned)
	if timeout <= 0 {
		timeout = 60 * time.Second
	}

	probe := acp.Probe(agentCmd, acp.ProbeOptions{Timeout: timeout})
	rep := Report{
		CheckedAt:  time.Now().UTC().Format(time.RFC3339),
		Versions:   map[string]any{"atConnect": before, "now": now},
		Drift:      drift,
		DriftCount: len(drift),
		Probe: map[string]any{
			"cmd": agentCmd, "ok": probe.OK, "ms": time.Since(started).Milliseconds(),
			"capabilities": probe.Capabilities, "error": probe.Error,
		},
	}
	rep.Healthy = probe.OK && len(drift) == 0

	if heal && (!probe.OK || len(drift) > 0) {
		res, err := connect.BuildConnection(det, applyAtConnect)
		if err != nil {
			rep.HealActions = map[string]any{"error": err.Error()}
		} else {
			rep.HealActions = map[string]any{"written": res.Written, "merges": res.Merges, "reappliedMerges": applyAtConnect}
		}
		agentCmd = brainCmd(connDir, pinned)
		re := acp.Probe(agentCmd, acp.ProbeOptions{Timeout: timeout})
		rep.Healed = true
		rep.ProbeAfterHeal = map[string]any{"cmd": agentCmd, "ok": re.OK, "error": re.Error}
		rep.Healthy = re.OK
	}

	if err := util.WriteJSONFile(filepath.Join(connDir, "health.json"), rep); err != nil {
		return rep, err
	}
	return rep, nil
}
