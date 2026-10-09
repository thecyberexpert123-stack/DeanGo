//go:build windows

package supervisor

import (
	"os"
	"os/exec"
)

// Sentinel signals — values only used to choose the kill path on Windows.
type winSig int

const (
	sigTerm winSig = 1
	sigKill winSig = 9
)

func probeAlive(proc *os.Process) bool {
	// Windows has no signal-0 probe; FindProcess success is our best signal here
	// (the supervisor reconciles fully on unit exit via cmd.Wait in StartUnit).
	return proc != nil
}

func setGroupAttrs(cmd *exec.Cmd) {
	// no SysProcAttr group controls on Windows
}

func signalUnit(pid int, sig winSig) {
	if p, err := os.FindProcess(pid); err == nil {
		_ = p.Kill()
	}
}
