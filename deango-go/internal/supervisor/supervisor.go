// Package supervisor — DeanGo's process babysitter for organism units.
// Units: $DEANGO_HOME/connection/units.json · run state: $DEANGO_HOME/run/<id>/.
package supervisor

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"deango/internal/model"
	"deango/internal/util"
)

func runDir(id string) string  { return filepath.Join(util.DeangoHome(), "run", id) }
func pidPath(id string) string { return filepath.Join(runDir(id), "unit.pid") }
func logPath(id string) string { return filepath.Join(runDir(id), "unit.log") }

func loadUnits() (model.UnitsFile, error) {
	var uf model.UnitsFile
	raw, err := os.ReadFile(filepath.Join(util.DeangoHome(), "connection", "units.json"))
	if err != nil {
		return model.UnitsFile{Units: []model.Unit{}}, nil // no connection built yet
	}
	if err := json.Unmarshal(raw, &uf); err != nil {
		return uf, err
	}
	return uf, nil
}

// StatusUnit checks the pid file and liveness of the recorded pid.
func StatusUnit(id string) model.UnitStatus {
	raw, err := os.ReadFile(pidPath(id))
	if err != nil {
		return model.UnitStatus{Running: false}
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	if err != nil || pid <= 0 {
		return model.UnitStatus{Running: false}
	}
	proc, err := os.FindProcess(pid)
	if err != nil {
		return model.UnitStatus{Running: false, StalePID: pid}
	}
	if !probeAlive(proc) { // platform-specific (proc_unix.go / proc_windows.go)
		return model.UnitStatus{Running: false, StalePID: pid}
	}
	return model.UnitStatus{Running: true, PID: pid}
}

// ListUnits returns all units with live status attached.
func ListUnits() ([]model.Unit, error) {
	uf, err := loadUnits()
	if err != nil {
		return nil, err
	}
	for i := range uf.Units {
		st := StatusUnit(uf.Units[i].ID)
		uf.Units[i].Status = &st
	}
	return uf.Units, nil
}

// StartUnit launches a unit detached, with stdout/stderr to its log.
func StartUnit(id string) map[string]any {
	uf, err := loadUnits()
	if err != nil {
		return util.ErrJSON(err)
	}
	var unit *model.Unit
	for i := range uf.Units {
		if uf.Units[i].ID == id {
			unit = &uf.Units[i]
			break
		}
	}
	if unit == nil {
		return util.ErrJSON(errors.New("unknown unit: " + id))
	}
	st := StatusUnit(id)
	if st.Running {
		return map[string]any{"ok": true, "already": true, "pid": st.PID}
	}
	if err := os.MkdirAll(runDir(id), 0o755); err != nil {
		return util.ErrJSON(err)
	}
	logf, err := os.OpenFile(logPath(id), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return util.ErrJSON(err)
	}
	cmd := exec.Command(unit.Cmd, unit.Args...)
	if unit.Cwd != "" {
		cmd.Dir = unit.Cwd
	} else {
		cmd.Dir = util.DeangoHome()
	}
	cmd.Env = os.Environ()
	for k, v := range unit.Env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}
	cmd.Stdout, cmd.Stderr = logf, logf
	setGroupAttrs(cmd) // platform-specific: own process group on unix
	if err := cmd.Start(); err != nil {
		_ = logf.Close()
		return util.ErrJSON(err)
	}
	_ = os.WriteFile(pidPath(id), []byte(strconv.Itoa(cmd.Process.Pid)), 0o644)
	go func() { _ = cmd.Wait(); _ = logf.Close() }()
	return map[string]any{"ok": true, "pid": cmd.Process.Pid, "log": logPath(id)}
}

// StopUnit SIGTERMs the process group, escalating to SIGKILL after 8s.
func StopUnit(id string) map[string]any {
	st := StatusUnit(id)
	_ = os.Remove(pidPath(id))
	if !st.Running {
		return map[string]any{"ok": true, "was": "stopped"}
	}
	signalUnit(st.PID, sigTerm) // graceful first (platform-specific)
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		s := StatusUnit(id)
		if !s.Running {
			return map[string]any{"ok": true}
		}
		time.Sleep(200 * time.Millisecond)
	}
	signalUnit(st.PID, sigKill)
	return map[string]any{"ok": true, "forced": true}
}

// TailLog returns the last n lines of the unit's log.
func TailLog(id string, n int) string {
	raw, err := os.ReadFile(logPath(id))
	if err != nil {
		return ""
	}
	lines := strings.Split(strings.TrimRight(string(raw), "\n"), "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "\n")
}
