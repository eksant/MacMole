//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#include <stdlib.h>

void MacMoleSetupTray(const unsigned char* icon1x, int len1x,
                      const unsigned char* icon2x, int len2x);
*/
import "C"
import (
	_ "embed"
	"unsafe"
)

//go:embed build/trayicon.png
var trayIcon1x []byte

//go:embed build/trayicon@2x.png
var trayIcon2x []byte

func initTray() {
	p1 := C.CBytes(trayIcon1x)
	p2 := C.CBytes(trayIcon2x)
	defer C.free(unsafe.Pointer(p1))
	defer C.free(unsafe.Pointer(p2))

	C.MacMoleSetupTray(
		(*C.uchar)(p1), C.int(len(trayIcon1x)),
		(*C.uchar)(p2), C.int(len(trayIcon2x)),
	)
}
