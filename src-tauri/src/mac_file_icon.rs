/*
 * (c) 2026 Alan Alves. All rights reserved.
 * CineFlow Suite — Professional Production to Post Hub
 * hello@expose-u.com | https://alan-design.com/
 */

//! Give a saved document (e.g. a `.wrap` shot list) the CineFlow app icon in
//! Finder, the same way image editors badge their own documents. This writes a
//! per-file custom icon via `-[NSWorkspace setIcon:forFile:options:]`; it does
//! not require the file type to be registered with Launch Services.

use cocoa::base::{id, nil};
use cocoa::foundation::NSString;
use objc::{class, msg_send, sel, sel_impl};

/// Stamp the running app's icon onto `file_path`. Best-effort: any AppKit
/// failure is returned as `Err` for the caller to log and ignore.
pub fn set_file_icon_to_app(file_path: &str) -> Result<(), String> {
    if file_path.is_empty() {
        return Err("empty file path".to_string());
    }
    unsafe {
        let pool: id = msg_send![class!(NSAutoreleasePool), new];

        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        if workspace == nil {
            let _: () = msg_send![pool, drain];
            return Err("no shared NSWorkspace".to_string());
        }

        // The app's own icon, taken from its bundle path.
        let bundle: id = msg_send![class!(NSBundle), mainBundle];
        let bundle_path: id = msg_send![bundle, bundlePath];
        let icon: id = msg_send![workspace, iconForFile: bundle_path];
        if icon == nil {
            let _: () = msg_send![pool, drain];
            return Err("could not load app icon".to_string());
        }

        let ns_file = NSString::alloc(nil).init_str(file_path);
        let ok: bool = msg_send![workspace, setIcon: icon forFile: ns_file options: 0u64];

        let _: () = msg_send![pool, drain];

        if ok {
            Ok(())
        } else {
            Err("setIcon:forFile: returned false".to_string())
        }
    }
}
