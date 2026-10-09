// Package inspect — deep-map the detected setups (files, locations,
// inventories, bridge configuration state). Read-only, bounded walks.
package inspect

import (
	"path/filepath"
	"strings"
	"time"

	"deango/internal/model"
	"deango/internal/util"
)

var configExt = map[string]bool{
	".json": true, ".yaml": true, ".yml": true, ".toml": true, ".env": true,
}

func summarizeTree(root string) map[string]any {
	if root == "" || !util.Exists(root) {
		return nil
	}
	entries := util.Walk(root, 3, 400)
	topDirs, cfg, stateLike := []string{}, []map[string]any{}, []map[string]any{}
	for _, e := range entries {
		if e.Dir {
			if !strings.Contains(e.Path, string(filepath.Separator)) {
				topDirs = append(topDirs, e.Path)
			}
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Path))
		rec := map[string]any{"path": e.Path, "size": e.Size}
		if configExt[ext] && len(cfg) < 60 {
			cfg = append(cfg, rec)
		}
		if strings.Contains(ext, "db") || strings.Contains(e.Path, "sessions") || strings.Contains(e.Path, "state") {
			if len(stateLike) < 60 {
				stateLike = append(stateLike, rec)
			}
		}
	}
	if len(topDirs) > 40 {
		topDirs = topDirs[:40]
	}
	return map[string]any{
		"root": root, "totalShown": len(entries), "truncated": len(entries) >= 400,
		"topDirs": topDirs, "configFiles": cfg, "stateLike": stateLike,
	}
}

func inspectHermes(det model.DetectionReport) map[string]any {
	h := det.Hermes
	if !h.Installed {
		return map[string]any{"present": false, "note": "hermes not detected"}
	}
	base := h.Checkout
	if base == "" {
		base = h.Home
	}
	out := map[string]any{"present": true, "base": summarizeTree(base)}
	if h.Checkout != "" {
		out["skills"] = map[string]any{
			"builtin":  util.CountMatching(filepath.Join(h.Checkout, "skills"), func(f string) bool { return strings.HasSuffix(f, "SKILL.md") }, 20000),
			"optional": util.CountMatching(filepath.Join(h.Checkout, "optional-skills"), func(f string) bool { return strings.HasSuffix(f, "SKILL.md") }, 20000),
		}
		out["agentModules"] = util.CountMatching(filepath.Join(h.Checkout, "agent"), func(f string) bool { return strings.HasSuffix(f, ".py") }, 20000)
		out["acpAdapterPresent"] = util.IsFile(filepath.Join(h.Checkout, "acp_adapter", "server.py"))
		out["stateModules"] = util.CountMatching(h.Checkout, func(f string) bool {
			return strings.Contains(filepath.Base(f), "hermes_state") && strings.HasSuffix(f, ".py")
		}, 20000)
	}
	if h.Home != "" && h.Home != h.Checkout {
		out["homeTree"] = summarizeTree(h.Home)
	}
	if len(h.ConfigFiles) > 0 {
		cfgs := map[string]any{}
		for _, f := range h.ConfigFiles {
			cfgs[f] = util.HeadText(f, 6)
		}
		out["config"] = cfgs
	}
	return out
}

func inspectOpenclaw(det model.DetectionReport) map[string]any {
	o := det.Openclaw
	if !o.Installed {
		return map[string]any{"present": false, "note": "openclaw not detected"}
	}
	base := o.Checkout
	if base == "" {
		base = o.NpmGlobal
	}
	if base == "" {
		base = o.Home
	}
	out := map[string]any{"present": true, "base": summarizeTree(base)}
	if o.Checkout != "" {
		out["extensions"] = util.CountMatching(filepath.Join(o.Checkout, "extensions"),
			func(f string) bool { return strings.HasSuffix(f, "openclaw.plugin.json") }, 20000)
		out["acpxPresent"] = util.IsFile(filepath.Join(o.Checkout, "extensions", "acpx", "openclaw.plugin.json"))
	}
	for _, cfg := range o.ConfigFiles {
		if strings.HasSuffix(cfg, ".json") {
			parsed, err := util.ReadJSONFile(cfg)
			content := util.HeadText(cfg, 64)
			if err == nil {
				_, hasPlugins := parsed["plugins"]
				out["gatewayConfig"] = map[string]any{
					"path": cfg, "hasPluginsKey": hasPlugins,
					"acpxConfigured":        strings.Contains(content, `"acpx"`),
					"hermesAgentConfigured": strings.Contains(content, `"hermes"`),
					"head":                  util.HeadText(cfg, 4),
				}
			}
			break
		}
		out["gatewayConfig"] = map[string]any{"path": cfg, "format": "yaml", "head": util.HeadText(cfg, 4)}
		break
	}
	return out
}

// InspectAll maps both setups in depth.
func InspectAll(det model.DetectionReport) map[string]any {
	return map[string]any{
		"scannedAt": time.Now().UTC().Format(time.RFC3339),
		"hermes":    inspectHermes(det),
		"openclaw":  inspectOpenclaw(det),
	}
}
