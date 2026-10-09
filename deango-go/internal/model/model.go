// Package model — shared report/plan shapes for the DeanGo Go core.
package model

import (
	"runtime"

	"deango/internal/util"
)

// Bin is one discovered executable.
type Bin struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type SystemReport struct {
	Platform   string `json:"platform"`
	Arch       string `json:"arch"`
	Home       string `json:"home"`
	DeangoHome string `json:"deangoHome"`
}

type NpmInfo struct {
	Bin        string `json:"bin,omitempty"`
	GlobalRoot string `json:"globalRoot,omitempty"`
}

type NodeReport struct {
	Installed bool    `json:"installed"`
	Bin       string  `json:"bin,omitempty"`
	Version   string  `json:"version,omitempty"`
	Npm       NpmInfo `json:"npm"`
}

type HermesReport struct {
	Installed   bool     `json:"installed"`
	Bins        []Bin    `json:"bins"`
	Version     string   `json:"version,omitempty"`
	Home        string   `json:"home,omitempty"`
	Checkout    string   `json:"checkout,omitempty"`
	ConfigFiles []string `json:"configFiles"`
	AcpHint     string   `json:"acpHint"`
	Pip         string   `json:"pip,omitempty"`
}

type OpenclawReport struct {
	Installed   bool     `json:"installed"`
	Bins        []Bin    `json:"bins"`
	Version     string   `json:"version,omitempty"`
	Home        string   `json:"home,omitempty"`
	NpmGlobal   string   `json:"npmGlobal,omitempty"`
	Checkout    string   `json:"checkout,omitempty"`
	ConfigFiles []string `json:"configFiles"`
}

// DetectionReport is the machine scan result (mirrors the Node engine).
type DetectionReport struct {
	ScannedAt string         `json:"scannedAt"`
	System    SystemReport   `json:"system"`
	Node      NodeReport     `json:"node"`
	Hermes    HermesReport   `json:"hermes"`
	Openclaw  OpenclawReport `json:"openclaw"`
	Complete  bool           `json:"complete"`
}

// PlanFile is one connection artifact DeanGo renders.
type PlanFile struct {
	Path    string `json:"path"`
	Kind    string `json:"kind"`
	Content string `json:"content"`
	Mode    uint32 `json:"mode,omitempty"`
}

// MergeTargets names the live config files DeanGo would merge into.
type MergeTargets struct {
	OpenclawConfig string `json:"openclawConfig,omitempty"`
	HermesConfig   string `json:"hermesConfig,omitempty"`
}

// ConnectionPlan is the full connection render (pre-write).
type ConnectionPlan struct {
	DeangoHome   string       `json:"deangoHome"`
	Files        []PlanFile   `json:"files"`
	MergeTargets MergeTargets `json:"mergeTargets"`
	Warnings     []string     `json:"warnings"`
}

// WrittenFile records one artifact written to disk.
type WrittenFile struct {
	Path  string `json:"path"`
	Bytes int    `json:"bytes"`
}

// MergeRecord documents one live-config merge (with backup).
type MergeRecord struct {
	Target   string `json:"target"`
	Backup   string `json:"backup,omitempty"`
	Strategy string `json:"strategy"`
}

// BuildResult is what `connect` returns.
type BuildResult struct {
	Plan    ConnectionPlan `json:"plan"`
	Written []WrittenFile  `json:"written"`
	Merges  []MergeRecord  `json:"merges"`
}

// Unit is one supervised organism process definition.
type Unit struct {
	ID          string            `json:"id"`
	Label       string            `json:"label"`
	Cmd         string            `json:"cmd"`
	Args        []string          `json:"args"`
	Cwd         string            `json:"cwd,omitempty"`
	Env         map[string]string `json:"env,omitempty"`
	Autostart   bool              `json:"autostart"`
	Note        string            `json:"note,omitempty"`
	HealthProbe *HealthProbe      `json:"healthProbe,omitempty"`
	Status      *UnitStatus       `json:"status,omitempty"`
}

type HealthProbe struct {
	Type string   `json:"type"`
	Args []string `json:"args"`
}

type UnitStatus struct {
	Running  bool `json:"running"`
	PID      int  `json:"pid,omitempty"`
	StalePID int  `json:"stalePid,omitempty"`
}

// UnitsFile is $DEANGO_HOME/connection/units.json.
type UnitsFile struct {
	Units []Unit `json:"units"`
}

// NewSystemReport fills the fixed machine facts.
func NewSystemReport() SystemReport {
	return SystemReport{
		Platform:   runtime.GOOS,
		Arch:       runtime.GOARCH,
		Home:       util.HomeDir(),
		DeangoHome: util.DeangoHome(),
	}
}
