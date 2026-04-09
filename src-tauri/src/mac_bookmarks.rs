use objc::{msg_send, sel, sel_impl, class};
use cocoa::base::{id, nil};
use cocoa::foundation::{NSString, NSData, NSURL};

#[allow(dead_code)]
pub fn create_secure_bookmark(path: &str) -> Result<Vec<u8>, String> {
    unsafe {
        let ns_path = NSString::alloc(nil).init_str(path);
        let url = NSURL::fileURLWithPath_(nil, ns_path);
        
        let mut error: id = nil;
        // NSURLBookmarkCreationWithSecurityScope = 1 << 11
        let options = 1 << 11;
        
        let bookmark_data: id = msg_send![url, 
            bookmarkDataWithOptions:options 
            includingResourceValuesForKeys:nil 
            relativeToURL:nil 
            error:&mut error
        ];

        if bookmark_data == nil {
            return Err("Failed to create security-scoped bookmark".to_string());
        }

        let length: usize = msg_send![bookmark_data, length];
        let bytes: *const u8 = msg_send![bookmark_data, bytes];
        
        let mut result = Vec::with_capacity(length);
        std::ptr::copy_nonoverlapping(bytes, result.as_mut_ptr(), length);
        result.set_len(length);
        
        Ok(result)
    }
}

#[allow(dead_code)]
pub fn start_accessing_bookmark(bookmark_data: &[u8]) -> Result<(String, id), String> {
    unsafe {
        let ns_data = NSData::dataWithBytes_length_(nil, bookmark_data.as_ptr() as *const _, bookmark_data.len() as u64);
        
        let mut error: id = nil;
        let mut is_stale: bool = false;
        // NSURLBookmarkResolutionWithSecurityScope = 1 << 10
        let options = 1 << 10;
        
        let url: id = msg_send![class!(NSURL), 
            URLByResolvingBookmarkData:ns_data 
            options:options 
            relativeToURL:nil 
            bookmarkDataIsStale:&mut is_stale 
            error:&mut error
        ];

        if url == nil {
            return Err("Failed to resolve security-scoped bookmark".to_string());
        }

        let success: bool = msg_send![url, startAccessingSecurityScopedResource];
        if !success {
            return Err("Failed to start accessing security-scoped resource".to_string());
        }

        let path_str: id = msg_send![url, path];
        let path_rust = std::ffi::CStr::from_ptr(msg_send![path_str, UTF8String])
            .to_string_lossy()
            .into_owned();

        Ok((path_rust, url))
    }
}

#[allow(dead_code)]
pub fn stop_accessing_url(url: id) {
    unsafe {
        let _: () = msg_send![url, stopAccessingSecurityScopedResource];
    }
}
