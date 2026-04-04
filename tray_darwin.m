#import <Cocoa/Cocoa.h>

static NSStatusItem*       _statusItem = nil;
static NSPopover*          _popover    = nil;

static NSProgressIndicator* _cpuBar  = nil;
static NSProgressIndicator* _memBar  = nil;
static NSProgressIndicator* _diskBar = nil;
static NSProgressIndicator* _battBar = nil;
static NSTextField*          _cpuLabel  = nil;
static NSTextField*          _memLabel  = nil;
static NSTextField*          _diskLabel = nil;
static NSTextField*          _battLabel = nil;

// ─── TrayHandler ────────────────────────────────────────────────────────────

@interface TrayHandler : NSObject
- (void)togglePopover:(id)sender;
- (void)showWindow:(id)sender;
- (void)quitApp:(id)sender;
@end

@implementation TrayHandler

- (void)togglePopover:(id)sender {
    if (!_popover) return;
    if (_popover.isShown) {
        [_popover close];
    } else {
        [NSApp activateIgnoringOtherApps:YES];
        [_popover showRelativeToRect:_statusItem.button.bounds
                              ofView:_statusItem.button
                       preferredEdge:NSRectEdgeMinY];
    }
}

- (void)showWindow:(id)sender {
    [_popover close];
    [NSApp activateIgnoringOtherApps:YES];
    for (NSWindow* w in [NSApp windows]) {
        if (w.isMiniaturized) {
            [w deminiaturize:nil];
        } else {
            [w makeKeyAndOrderFront:nil];
        }
    }
}

- (void)quitApp:(id)sender {
    [NSApp terminate:nil];
}

@end

static TrayHandler* _handler = nil;

// ─── Helpers ─────────────────────────────────────────────────────────────────

static NSProgressIndicator* makeBar(NSRect frame, NSView* parent) {
    NSProgressIndicator* bar = [[NSProgressIndicator alloc] initWithFrame:frame];
    bar.style         = NSProgressIndicatorStyleBar;
    bar.indeterminate = NO;
    bar.minValue      = 0;
    bar.maxValue      = 100;
    bar.doubleValue   = 0;
    [parent addSubview:bar];
    return bar;
}

static NSTextField* makeLabel(NSString* text, NSRect frame, NSView* parent,
                               NSTextAlignment align, CGFloat size, BOOL bold) {
    NSTextField* f = [[NSTextField alloc] initWithFrame:frame];
    f.stringValue     = text;
    f.editable        = NO;
    f.bezeled         = NO;
    f.drawsBackground = NO;
    f.textColor       = [NSColor labelColor];
    f.alignment       = align;
    f.font = bold ? [NSFont boldSystemFontOfSize:size]
                  : [NSFont systemFontOfSize:size];
    [parent addSubview:f];
    return f;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

void MacMoleSetupTray(const unsigned char* icon1x, int len1x,
                      const unsigned char* icon2x, int len2x) {
    NSData* d1 = [NSData dataWithBytes:icon1x length:len1x];
    NSData* d2 = (len2x > 0) ? [NSData dataWithBytes:icon2x length:len2x] : nil;

    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        _handler = [[TrayHandler alloc] init];

        // ── Status bar icon ──────────────────────────────────────────────────
        NSStatusBar* bar = [NSStatusBar systemStatusBar];
        _statusItem = [bar statusItemWithLength:NSSquareStatusItemLength];

        NSImage* img = [[NSImage alloc] initWithData:d1];
        if (img) {
            [img setTemplate:YES];
            [img setSize:NSMakeSize(18, 18)];
            if (d2) {
                NSImageRep* rep2x = [[NSBitmapImageRep alloc] initWithData:d2];
                [img addRepresentation:rep2x];
            }
            _statusItem.button.image = img;
        }
        _statusItem.visible        = YES;
        _statusItem.button.toolTip = @"MacMole";
        _statusItem.button.action  = @selector(togglePopover:);
        _statusItem.button.target  = _handler;

        // ── Popover content view ─────────────────────────────────────────────
        const CGFloat W = 256, H = 222;
        NSView* content = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, W, H)];

        makeLabel(@"MacMole", NSMakeRect(0, H - 30, W, 20),
                  content, NSTextAlignmentCenter, 13, YES);
        makeLabel(@"System Monitor", NSMakeRect(0, H - 48, W, 16),
                  content, NSTextAlignmentCenter, 10, NO);

        const CGFloat startY = H - 72;
        const CGFloat rowH   = 20;

        NSString* titles[] = { @"CPU", @"Memory", @"Disk", @"Battery" };
        NSProgressIndicator** bars[] = { &_cpuBar, &_memBar, &_diskBar, &_battBar };
        NSTextField** labels[]       = { &_cpuLabel, &_memLabel, &_diskLabel, &_battLabel };

        for (int i = 0; i < 4; i++) {
            CGFloat y = startY - i * rowH;
            makeLabel(titles[i], NSMakeRect(12, y, 52, 16),
                      content, NSTextAlignmentLeft, 11, NO);
            *bars[i]   = makeBar(NSMakeRect(68, y + 1, 134, 14), content);
            *labels[i] = makeLabel(@"--", NSMakeRect(208, y, 36, 16),
                                   content, NSTextAlignmentRight, 11, NO);
        }

        NSBox* sep = [[NSBox alloc] initWithFrame:NSMakeRect(12, 52, W - 24, 1)];
        sep.boxType = NSBoxSeparator;
        [content addSubview:sep];

        NSButton* openBtn = [[NSButton alloc] initWithFrame:NSMakeRect(12, 14, 120, 28)];
        openBtn.title      = @"Open MacMole";
        openBtn.bezelStyle = NSBezelStyleRounded;
        openBtn.target     = _handler;
        openBtn.action     = @selector(showWindow:);
        [content addSubview:openBtn];

        NSButton* quitBtn = [[NSButton alloc] initWithFrame:NSMakeRect(W - 72, 14, 60, 28)];
        quitBtn.title      = @"Quit";
        quitBtn.bezelStyle = NSBezelStyleRounded;
        quitBtn.target     = _handler;
        quitBtn.action     = @selector(quitApp:);
        [content addSubview:quitBtn];

        NSViewController* vc = [[NSViewController alloc] init];
        vc.view = content;

        _popover = [[NSPopover alloc] init];
        _popover.contentViewController = vc;
        _popover.behavior              = NSPopoverBehaviorTransient;
        _popover.contentSize           = NSMakeSize(W, H);
    });
}

// ─── Live update (called from Go goroutine) ──────────────────────────────────

void MacMoleUpdateTrayMetrics(double cpu, double mem, double disk,
                               int battery, const char* battStatus) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!_cpuBar) return;

        _cpuBar.doubleValue    = cpu;
        _cpuLabel.stringValue  = [NSString stringWithFormat:@"%.0f%%", cpu];

        _memBar.doubleValue    = mem;
        _memLabel.stringValue  = [NSString stringWithFormat:@"%.0f%%", mem];

        _diskBar.doubleValue   = disk;
        _diskLabel.stringValue = [NSString stringWithFormat:@"%.0f%%", disk];

        if (battery >= 0) {
            _battBar.doubleValue   = (double)battery;
            _battLabel.stringValue = [NSString stringWithFormat:@"%d%%", battery];
        } else {
            _battBar.doubleValue   = 0;
            _battLabel.stringValue = @"N/A";
        }
    });
}
