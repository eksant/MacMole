package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func buildMenu(app *App) *menu.Menu {
	appMenu := menu.NewMenu()
	moleMenu := appMenu.AddSubmenu("Mac Mole")
	moleMenu.AddText("Show Window", keys.CmdOrCtrl("1"), func(_ *menu.CallbackData) {
		wruntime.WindowShow(app.ctx)
		wruntime.WindowSetAlwaysOnTop(app.ctx, true)
		wruntime.WindowSetAlwaysOnTop(app.ctx, false)
	})
	moleMenu.AddSeparator()
	moleMenu.AddText("Quit Mac Mole", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		wruntime.Quit(app.ctx)
	})
	return appMenu
}

func main() {
	commands := NewCommandService()
	metrics := NewMetricsService()
	settings := NewSettingsService()

	app := &App{commands: commands}

	err := wails.Run(&options.App{
		Menu:             buildMenu(app),
		Title:            "Mac Mole",
		Width:            1200,
		Height:           760,
		MinWidth:         900,
		MinHeight:        600,
		BackgroundColour: &options.RGBA{R: 15, G: 15, B: 20, A: 1},
		HideWindowOnClose: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
			metrics,
			commands,
			settings,
		},
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarHiddenInset(),
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			Appearance:           mac.NSAppearanceNameDarkAqua,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
