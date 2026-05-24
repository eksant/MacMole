//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#include <stdlib.h>

void MacMoleSetupTray(const unsigned char* icon1x, int len1x,
                      const unsigned char* icon2x, int len2x);

void MacMoleUpdateTrayMetrics(double cpu, double mem, double disk,
                               int battery, const char* battStatus);
*/
import "C"
import (
	_ "embed"
	"sync"
	"time"
	"unsafe"
)

//go:embed build/trayicon.png
var trayIcon1x []byte

//go:embed build/trayicon@2x.png
var trayIcon2x []byte

var (
	trayDone     = make(chan struct{})
	trayStopOnce sync.Once
)

func initTray() {
	p1 := C.CBytes(trayIcon1x)
	p2 := C.CBytes(trayIcon2x)
	defer C.free(unsafe.Pointer(p1))
	defer C.free(unsafe.Pointer(p2))

	C.MacMoleSetupTray(
		(*C.uchar)(p1), C.int(len(trayIcon1x)),
		(*C.uchar)(p2), C.int(len(trayIcon2x)),
	)

	// Start background goroutine to push live metrics into the popover.
	go func() {
		svc := NewMetricsService()
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		// Push an initial snapshot immediately (after a short delay so the
		// Objective-C popover view has been constructed on the main thread).
		time.Sleep(500 * time.Millisecond)
		pushTrayMetrics(svc)

		for {
			select {
			case <-ticker.C:
				pushTrayMetrics(svc)
			case <-trayDone:
				return
			}
		}
	}()
}

func pushTrayMetrics(svc *MetricsService) {
	m := svc.GetMetrics()

	status := C.CString(m.Battery.Status)
	defer C.free(unsafe.Pointer(status))

	C.MacMoleUpdateTrayMetrics(
		C.double(m.CPU.Usage),
		C.double(m.Memory.UsedPercent),
		C.double(m.Disk.UsedPercent),
		C.int(m.Battery.Percent),
		status,
	)
}

// StopTray signals the tray goroutine to exit cleanly. Safe to call multiple times.
func StopTray() {
	trayStopOnce.Do(func() { close(trayDone) })
}
