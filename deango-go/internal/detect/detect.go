// Package detect — find the limbs and the brain on this machine (Go core).
// Mirrors the Node engine's DetectionReport so the GUI/engine-adapter can
// swap cores without shape changes.
package detect

import (
	"path/filepath"
	"strings"
	"time"

	"deango/internal/model"
	"deango/internal/util"
)

var hermesDirCandidates = []string{
	".hermes", ".local/share/hermes", ".config/hermes",
	"src/hermes-agent", "code/hermes-agent", "hermes-agent", "opt/hermes-agent",
}

var openclawDirCandidates = []string{
	".openclaw", ".config/openclaw", ".local/share/openclaw",
	".local/state/openclaw", "src/openclaw", "code/openclaw", "openclaw",
}

func firstExisting(candidates []string) []string {
	found := []string{}
	for _, rel := range candidates {
		p := rel
		if !filepath.IsAbs(p) {
			p = filepath.Join(util.HomeDir(), rel)
		}
		if util.Exists(p) {
			found = append(found, p)
		}
	}
	return found
}

func findBins(names []string) []model.Bin {
	bins := []model.Bin{}
	for _, n := range names {
		if p := util.Which(n); p != "" {
			bins = append(bins, model.Bin{Name: n, Path: p})
		}
	}
	return bins
}

func probeVersion(bin string) string {
	if bin == "" {
		return ""
	}
	r := util.Run(bin, []string{"--version"}, 6*time.Second, "")
	if r.Code != 0 {
		return ""
	}
	out := strings.TrimSpace(r.Stdout + r.Stderr)
	if i := strings.Index(out, "\n"); i >= 0 {
		out = out[:i]
	}
	if len(out) > 200 {
		out = out[:200]
	}
	return strings.TrimPrefix(out, "v")
}

func detectNode() model.NodeReport {
	rep := model.NodeReport{}
	rep.Bin = util.Which("node")
	rep.Installed = rep.Bin != ""
	if rep.Installed {
		rep.Version = probeVersion(rep.Bin)
	}
	rep.Npm.Bin = util.Which("npm")
	if rep.Npm.Bin != "" {
		r := util.Run(rep.Npm.Bin, []string{"root", "-g"}, 8*time.Second, "")
		if r.Code == 0 {
			rep.Npm.GlobalRoot = strings.TrimSpace(r.Stdout)
		}
	}
	return rep
}

func detectHermes(node model.NodeReport) model.HermesReport {
	rep := model.HermesReport{ConfigFiles: []string{}}
	rep.Bins = findBins([]string{"hermes", "hermes-acp", "hermes-agent"})
	if len(rep.Bins) > 0 {
		rep.Version = probeVersion(rep.Bins[0].Path)
	}

	dirs := firstExisting(hermesDirCandidates)
	for _, d := range dirs {
		if util.IsDir(d) {
			if rep.Home == "" {
				rep.Home = d
			}
			marker := filepath.Join(d, "pyproject.toml")
			if util.IsFile(marker) && strings.Contains(util.HeadText(marker, 8), `name = "hermes-agent"`) {
				rep.Checkout = d
			}
		}
	}
	if rep.Checkout != "" && rep.Version == "" {
		rep.Version = "dev-checkout"
	}

	candidates := []string{}
	if rep.Home != "" {
		candidates = append(candidates,
			filepath.Join(rep.Home, "cli-config.yaml"),
			filepath.Join(rep.Home, "config.yaml"),
			filepath.Join(rep.Home, ".env"))
	} else {
		candidates = append(candidates, filepath.Join(util.HomeDir(), ".hermes", "cli-config.yaml"))
	}
	for _, c := range candidates {
		if util.IsFile(c) {
			rep.ConfigFiles = append(rep.ConfigFiles, c)
		}
	}

	rep.AcpHint = "install extra: pip install 'hermes-agent[acp]'"
	for _, b := range rep.Bins {
		if b.Name == "hermes-acp" {
			rep.AcpHint = "hermes-acp console script present"
		}
	}
	for _, p := range []string{"pip", "pip3", "uv"} {
		if w := util.Which(p); w != "" {
			rep.Pip = w
			break
		}
	}
	rep.Installed = len(rep.Bins) > 0 || rep.Checkout != ""
	return rep
}

func detectOpenclaw(node model.NodeReport) model.OpenclawReport {
	rep := model.OpenclawReport{ConfigFiles: []string{}}
	rep.Bins = findBins([]string{"openclaw"})
	if len(rep.Bins) > 0 {
		rep.Version = probeVersion(rep.Bins[0].Path)
	}

	dirs := firstExisting(openclawDirCandidates)
	for _, d := range dirs {
		if util.IsDir(d) {
			if rep.Home == "" {
				rep.Home = d
			}
			if util.IsFile(filepath.Join(d, "openclaw.mjs")) {
				rep.Checkout = d
			}
		}
	}
	if node.Npm.GlobalRoot != "" && util.IsDir(filepath.Join(node.Npm.GlobalRoot, "openclaw")) {
		rep.NpmGlobal = filepath.Join(node.Npm.GlobalRoot, "openclaw")
	}

	stem := rep.Home
	if stem == "" {
		stem = filepath.Join(util.HomeDir(), ".openclaw")
	}
	for _, n := range []string{"openclaw.json", "config.json", "openclaw.yaml", "config.yaml"} {
		if p := filepath.Join(stem, n); util.IsFile(p) {
			rep.ConfigFiles = append(rep.ConfigFiles, p)
		}
	}
	rep.Installed = len(rep.Bins) > 0 || rep.NpmGlobal != "" || rep.Checkout != ""
	return rep
}

// DetectAll performs the full machine scan. Read-only.
func DetectAll() model.DetectionReport {
	node := detectNode()
	hermes := detectHermes(node)
	openclaw := detectOpenclaw(node)
	return model.DetectionReport{
		ScannedAt: time.Now().UTC().Format(time.RFC3339),
		System:    model.NewSystemReport(),
		Node:      node,
		Hermes:    hermes,
		Openclaw:  openclaw,
		Complete:  hermes.Installed && openclaw.Installed,
	}
}
