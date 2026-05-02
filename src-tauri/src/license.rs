use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use machine_uid;
use ed25519_dalek::{VerifyingKey, Signature, Verifier};
use base64::{Engine as _, engine::general_purpose};

#[cfg(feature = "direct-dist")]
fn get_server_url() -> String {
    // XOR obfuscated: "https://licensing.alan-design.com"
    let secret: [u8; 33] = [
        0x2a, 0x36, 0x36, 0x32, 0x31, 0x78, 0x6d, 0x6d, 0x2e, 0x2b, 0x21, 0x27, 0x2c, 0x31, 0x2b, 0x2c, 
        0x25, 0x6c, 0x23, 0x2e, 0x23, 0x2c, 0x6f, 0x26, 0x27, 0x31, 0x2b, 0x25, 0x2c, 0x6c, 0x21, 0x2d, 0x2f
    ];
    let key = 0x42;
    secret.iter().map(|&b| (b ^ key) as char).collect()
}

// This Public Key MUST match the Private Key on your TrueNAS server
#[cfg(feature = "direct-dist")]
const PUBLIC_KEY_B64: &str = "MCowBQYDK2VwAyEAS+kAH4Md2krdn1DeoveStSFn+hIQCvNE8pp5nK5vt9U=";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseStatus {
    pub active: bool,
    pub key: Option<String>,
    pub hwid: String,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivationToken {
    pub key: String,
    pub hwid: String,
    pub expires_at: i64,
    pub signature: String,
}

#[cfg(feature = "direct-dist")]
#[tauri::command]
pub fn get_hwid() -> String {
    machine_uid::get().unwrap_or_else(|_| "unknown_hwid".to_string())
}

#[cfg(feature = "direct-dist")]
fn get_license_path(app: &AppHandle) -> PathBuf {
    app.path().app_config_dir().unwrap().join("license.json")
}

#[cfg(feature = "direct-dist")]
pub fn check_license(app: &AppHandle) -> LicenseStatus {
    let hwid = get_hwid();
    let path = get_license_path(app);

    if !path.exists() {
        return LicenseStatus {
            active: false,
            key: None,
            hwid,
            message: Some("No license found".into()),
        };
    }

    match fs::read(&path) {
        Ok(obfuscated_content) => {
            let content: String = obfuscated_content.iter().map(|&b| (b ^ 0x55) as char).collect();
            match serde_json::from_str::<ActivationToken>(&content) {
                Ok(token) => {
                    // Verify HWID matches
                    if token.hwid != hwid {
                        return LicenseStatus { active: false, key: Some(token.key), hwid, message: Some("Hardware mismatch".into()) };
                    }

                    // Verify Expiration
                    let now = chrono::Utc::now().timestamp();
                    if token.expires_at < now {
                         return LicenseStatus { active: false, key: Some(token.key), hwid, message: Some("License expired".into()) };
                    }

                    // Verify Signature
                    if verify_signature(&token) {
                        LicenseStatus { active: true, key: Some(token.key), hwid, message: None }
                    } else {
                        LicenseStatus { active: false, key: Some(token.key), hwid, message: Some("Invalid signature".into()) }
                    }
                }
                Err(_) => LicenseStatus { active: false, key: None, hwid, message: Some("Corrupt license file".into()) },
            }
        }
        Err(_) => LicenseStatus { active: false, key: None, hwid, message: Some("Could not read license".into()) },
    }
}

#[cfg(feature = "direct-dist")]
fn verify_signature(token: &ActivationToken) -> bool {
    let public_key_bytes = match general_purpose::STANDARD.decode(PUBLIC_KEY_B64) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let verifying_key = match VerifyingKey::try_from(public_key_bytes.as_slice()) {
        Ok(k) => k,
        Err(_) => return false,
    };

    let signature_bytes = match general_purpose::STANDARD.decode(&token.signature) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let signature = match Signature::from_slice(signature_bytes.as_slice()) {
        Ok(s) => s,
        Err(_) => return false,
    };

    // The data that was signed on the server
    let signed_data = format!("{}:{}:{}", token.key, token.hwid, token.expires_at);
    
    verifying_key.verify(signed_data.as_bytes(), &signature).is_ok()
}

#[cfg(feature = "direct-dist")]
#[tauri::command]
pub async fn activate_license(app: AppHandle, key: String, email: String) -> Result<LicenseStatus, String> {
    let hwid = get_hwid();
    let client = reqwest::Client::new();
    
    let res = client.post(format!("{}/activate", get_server_url()))
        .json(&serde_json::json!({
            "key": key,
            "email": email,
            "hwid": hwid,
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if res.status().is_success() {
        let token: ActivationToken = res.json().await.map_err(|e| format!("Invalid response from server: {}", e))?;
        
        // Save token locally
        let path = get_license_path(&app);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        
        let content = serde_json::to_string(&token).map_err(|e| e.to_string())?;
        
        // Simple XOR obfuscation for local storage
        let obfuscated_content: Vec<u8> = content.as_bytes().iter().map(|&b| b ^ 0x55).collect();
        fs::write(path, obfuscated_content).map_err(|e| e.to_string())?;

        Ok(LicenseStatus {
            active: true,
            key: Some(token.key),
            hwid,
            message: None,
        })
    } else {
        let status_code = res.status();
        let body_text = res.text().await.unwrap_or_else(|_| "Could not read error response".to_string());
        
        // Try to parse as JSON first
        if let Ok(json_err) = serde_json::from_str::<serde_json::Value>(&body_text) {
            let msg = json_err["error"].as_str().unwrap_or("Activation failed").to_string();
            Err(msg)
        } else {
            // Fallback to text body or generic message
            if status_code.is_client_error() || status_code.is_server_error() {
                Err(format!("Server Error ({}): {}", status_code, body_text))
            } else {
                Err("Activation failed: Unknown server response".to_string())
            }
        }
    }
}

#[cfg(feature = "direct-dist")]
#[tauri::command]
pub fn get_license_status(app: AppHandle) -> LicenseStatus {
    check_license(&app)
}

#[cfg(not(feature = "direct-dist"))]
pub fn check_license(_app: &AppHandle) -> LicenseStatus {
    LicenseStatus {
        active: true,
        key: None,
        hwid: "".into(),
        message: None,
    }
}

#[cfg(not(feature = "direct-dist"))]
#[tauri::command]
pub fn get_license_status() -> LicenseStatus {
    LicenseStatus {
        active: true,
        key: None,
        hwid: "".into(),
        message: None,
    }
}

#[cfg(not(feature = "direct-dist"))]
#[tauri::command]
pub async fn activate_license(_key: String, _email: String) -> Result<LicenseStatus, String> {
    Err("Licensing not enabled in this build".into())
}
