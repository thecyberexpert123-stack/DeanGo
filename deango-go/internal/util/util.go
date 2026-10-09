// Package util — shared primitives for the DeanGo Go core. Stdlib only.
package util

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"
)

// DeangoHome is the state root (override: DEANGO_HOME).
func DeangoHome() string {
	if h := os.Getenv("DEANGO_HOME"); h != "" {
		return h
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".deango")
}

func HomeDir() string {
	home, _ := os.UserHomeDir()
	return home
}

func Exists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

func IsDir(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}

func IsFile(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

// Which locates an executable on PATH (windows suffix aware).
func Which(cmd string) string {
	if lp, err := exec.LookPath(cmd); err == nil {
		return lp
	}
	return ""
}

// RunResult is the outcome of a timed subprocess run.
type RunResult struct {
	Code   int    `json:"code"`
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Ms     int64  `json:"ms"`
	Err    string `json:"error,omitempty"`
}

// Run executes a command with a timeout; never panics, always returns.
func Run(cmd string, args []string, timeout time.Duration, dir string) RunResult {
	started := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	c := exec.CommandContext(ctx, cmd, args...)
	if dir != "" {
		c.Dir = dir
	}
	var so, se bytes.Buffer
	c.Stdout, c.Stderr = &so, &se
	err := c.Run()
	res := RunResult{Stdout: so.String(), Stderr: se.String(), Ms: time.Since(started).Milliseconds()}
	if ctx.Err() == context.DeadlineExceeded {
		res.Code, res.Err = -2, "timeout"
		return res
	}
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			res.Code = ee.ExitCode()
		} else {
			res.Code, res.Err = -1, err.Error()
		}
	}
	return res
}

// DeepMerge merges b into a (b wins on conflicts; nested maps merged).
func DeepMerge(a, b map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range a {
		out[k] = v
	}
	for k, v := range b {
		if av, ok := out[k]; ok {
			am, aok := av.(map[string]any)
			bm, bok := v.(map[string]any)
			if aok && bok {
				out[k] = DeepMerge(am, bm)
				continue
			}
		}
		out[k] = v
	}
	return out
}

func ReadJSONFile(p string) (map[string]any, error) {
	raw, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return m, nil
}

func WriteJSONFile(p string, v any) error {
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, append(raw, '\n'), 0o644)
}

// UpsertManagedBlock replaces or appends a marked block in a text config.
func UpsertManagedBlock(text, marker, block string) string {
	begin := "# >>> deango:" + marker + " >>>"
	end := "# <<< deango:" + marker + " <<<"
	wrapped := begin + "\n" + strings.TrimRight(block, "\n") + "\n" + end
	re := regexp.MustCompile(`(?s)` + regexp.QuoteMeta(begin) + `.*?` + regexp.QuoteMeta(end))
	if re.MatchString(text) {
		return re.ReplaceAllString(text, wrapped)
	}
	return strings.TrimRight(text, "\n") + "\n\n" + wrapped + "\n"
}

// WalkEntry is one bounded-walk result.
type WalkEntry struct {
	Path string `json:"path"`
	Dir  bool   `json:"dir"`
	Size int64  `json:"size"`
}

// Walk returns up to maxEntries entries below root (skips node_modules/.git).
func Walk(root string, maxDepth, maxEntries int) []WalkEntry {
	out := []WalkEntry{}
	type item struct {
		p string
		d int
	}
	stack := []item{{p: root, d: 0}}
	for len(stack) > 0 && len(out) < maxEntries {
		it := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		ents, err := os.ReadDir(it.p)
		if err != nil {
			continue
		}
		for _, e := range ents {
			if len(out) >= maxEntries {
				break
			}
			if e.Name() == "node_modules" || e.Name() == ".git" {
				continue
			}
			full := filepath.Join(it.p, e.Name())
			rel, _ := filepath.Rel(root, full)
			var size int64
			if info, err := e.Info(); err == nil {
				size = info.Size()
			}
			isDir := e.IsDir()
			out = append(out, WalkEntry{Path: rel, Dir: isDir, Size: size})
			if isDir && it.d+1 < maxDepth {
				stack = append(stack, item{p: full, d: it.d + 1})
			}
		}
	}
	return out
}

// HeadText reads the first kb kilobytes of a file.
func HeadText(p string, kb int) string {
	raw, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	limit := kb * 1024
	if len(raw) > limit {
		raw = raw[:limit]
	}
	return string(raw)
}

// CountMatching counts files matching pred under root (bounded by cap).
func CountMatching(root string, pred func(string) bool, cap int) int {
	n := 0
	_ = filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil || n >= cap {
			return nil
		}
		if d.IsDir() && (d.Name() == "node_modules" || d.Name() == ".git") {
			return filepath.SkipDir
		}
		if !d.IsDir() && pred(p) {
			n++
		}
		return nil
	})
	return n
}

// PrintJSON writes v to stdout as indented JSON.
func PrintJSON(v any) {
	raw, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Printf(`{"ok":false,"error":%q}`, err.Error())
		return
	}
	fmt.Println(string(raw))
}

// ErrJSON builds a uniform failure object.
func ErrJSON(err error) map[string]any {
	return map[string]any{"ok": false, "error": err.Error()}
}

// SortedKeys returns the sorted keys of a map (stable output for GUIs).
func SortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func IsWindows() bool { return runtime.GOOS == "windows" }
