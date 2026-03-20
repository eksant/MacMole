package main

import (
	"context"
)

// App struct holds shared application context.
type App struct {
	ctx      context.Context
	commands *CommandService
}

// NewApp creates the root app struct.
func NewApp() *App {
	return &App{}
}

// startup is called by Wails when the app starts.
// The context is wired into services that need it for event emission.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.commands.setContext(ctx)
	initTray()
}
