#import <Cocoa/Cocoa.h>

static NSStatusItem* _statusItem = nil;

@interface TrayHandler : NSObject
- (void)showWindow:(id)sender;
- (void)quitApp:(id)sender;
@end

@implementation TrayHandler

- (void)showWindow:(id)sender {
    [NSApp activateIgnoringOtherApps:YES];
    for (NSWindow* w in [NSApp windows]) {
        if (!w.isMiniaturized) {
            [w makeKeyAndOrderFront:nil];
        } else {
            [w deminiaturize:nil];
        }
    }
}

- (void)quitApp:(id)sender {
    [NSApp terminate:nil];
}

@end

static TrayHandler* _handler = nil;

void MacMoleSetupTray(const unsigned char* icon1x, int len1x,
                      const unsigned char* icon2x, int len2x) {
    // Copy bytes into NSData BEFORE dispatch_async so Go can free the pointers.
    NSData* d1 = [NSData dataWithBytes:icon1x length:len1x];
    NSData* d2 = (len2x > 0) ? [NSData dataWithBytes:icon2x length:len2x] : nil;

    dispatch_async(dispatch_get_main_queue(), ^{
        _handler = [[TrayHandler alloc] init];

        NSStatusBar* bar = [NSStatusBar systemStatusBar];
        _statusItem = [bar statusItemWithLength:NSSquareStatusItemLength];

        // Build NSImage from copied bytes
        NSImage* img = [[NSImage alloc] initWithData:d1];
        [img setTemplate:YES];  // auto-invert for dark/light mode
        [img setSize:NSMakeSize(18, 18)];

        // Add @2x representation
        if (d2 != nil) {
            NSImageRep* rep2x = [[NSBitmapImageRep alloc] initWithData:d2];
            [img addRepresentation:rep2x];
        }

        _statusItem.button.image = img;
        _statusItem.button.toolTip = @"MacMole";

        // Build dropdown menu
        NSMenu* menu = [[NSMenu alloc] initWithTitle:@"MacMole"];
        [menu setAutoenablesItems:NO];

        NSMenuItem* title = [[NSMenuItem alloc]
            initWithTitle:@"MacMole — Mac Cleaner"
                   action:nil
            keyEquivalent:@""];
        title.enabled = NO;
        [menu addItem:title];

        [menu addItem:[NSMenuItem separatorItem]];

        NSMenuItem* showItem = [[NSMenuItem alloc]
            initWithTitle:@"Show Window"
                   action:@selector(showWindow:)
            keyEquivalent:@""];
        showItem.target = _handler;
        showItem.enabled = YES;
        [menu addItem:showItem];

        [menu addItem:[NSMenuItem separatorItem]];

        NSMenuItem* quitItem = [[NSMenuItem alloc]
            initWithTitle:@"Quit MacMole"
                   action:@selector(quitApp:)
            keyEquivalent:@"q"];
        quitItem.target = _handler;
        quitItem.enabled = YES;
        [menu addItem:quitItem];

        _statusItem.menu = menu;
    });
}
