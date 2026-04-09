// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(all(not(debug_assertions), target_os = "macos"))]
    {
        // Prevent debugger attachment on macOS
        extern "C" {
            fn ptrace(request: i32, pid: i32, addr: *mut i32, data: i32) -> i32;
        }
        unsafe { ptrace(31, 0, std::ptr::null_mut(), 0); }
    }

    #[cfg(all(not(debug_assertions), target_os = "windows"))]
    {
        // Detect debugger on Windows
        extern "system" {
            fn IsDebuggerPresent() -> i32;
        }
        if unsafe { IsDebuggerPresent() } != 0 {
            std::process::exit(1);
        }
    }

    cineflow_suite_lib::run()
}
