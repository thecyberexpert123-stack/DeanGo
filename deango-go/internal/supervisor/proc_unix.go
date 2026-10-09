//go:build !windows

package supervisor

import (
	"os"
	"os/exec"
	"syscall"
)

const (
	sigTerm = syscall.SIGTERM
	sigKill = syscall.SIGKILL
)

func probeAlive(proc *os.Process) bool {
	return proc.Signal(syscall.Signal(0)) == nil
}

func setGroupAttrs(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func signalUnit(pid int, sig syscall.Signal) {
	if pgid, err := syscall.Getpgid(pid); err == nil {
		_ = syscall.Kill(-pgid, sig)
		return
	}
	if p, err := os.FindProcess(pid); err == nil {
		_ = p.Signal(sig)
	}
}
