use crate::db::{Database, VerificationJob, VerificationItem};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use walkdir::WalkDir;
use serde::{Serialize, Deserialize};
use tauri::{AppHandle, Emitter};
use std::fs;
use std::io::{Read, BufReader};
use blake3::Hasher;
use uuid::Uuid;
use chrono::Utc;
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::Mutex as StdMutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationProgress {
    pub job_id: String,
    pub phase: String, // "INDEXING", "HASHING", "COMPARING", "DONE"
    pub current_file: String,
    pub bytes_total: u64,
    pub bytes_processed: u64,
    pub files_total: u32,
    pub files_processed: u32,
    pub ok_count: u32,
    pub mismatch_count: u32,
    pub missing_count: u32,
}

pub struct FileEntry {
    pub rel_path: String,
    pub abs_path: PathBuf,
    pub size: u64,
    pub mtime: u64,
}

pub fn index_tree(root: &Path) -> Vec<FileEntry> {
    let mut entries = Vec::new();

    for entry in WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        
        // Skip junk
        let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if filename.starts_with(".") || filename == "Thumbs.db" {
            continue;
        }

        let rel_path = path.strip_prefix(root).unwrap().to_string_lossy().into_owned();
        let metadata = entry.metadata().unwrap();
        
        entries.push(FileEntry {
            rel_path,
            abs_path: path.to_path_buf(),
            size: metadata.len(),
            mtime: metadata.modified().unwrap_or(std::time::SystemTime::now())
                .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
        });
    }
    entries
}

pub fn hash_file(path: &Path) -> Result<String, std::io::Error> {
    let file = fs::File::open(path)?;
    let mut reader = BufReader::with_capacity(1024 * 1024 * 4, file); // 4MB buffer
    let mut hasher = Hasher::new();
    let mut buffer = [0; 1024 * 1024]; // 1MB chunks

    loop {
        let n = reader.read(&mut buffer)?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }

    Ok(hasher.finalize().to_hex().to_string())
}

pub async fn start_verification(
    app: AppHandle,
    db: Arc<Database>,
    source_root: String,
    dest_root: String,
    mode: String,
) -> Result<String, String> {
    let job_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let mut job = VerificationJob {
        id: job_id.clone(),
        created_at: now,
        source_root: source_root.clone(),
        dest_root: dest_root.clone(),
        mode: mode.clone(),
        status: "RUNNING".to_string(),
        total_files: 0,
        total_bytes: 0,
        verified_ok_count: 0,
        missing_count: 0,
        size_mismatch_count: 0,
        hash_mismatch_count: 0,
        unreadable_count: 0,
        extra_in_dest_count: 0,
    };

    db.insert_verification_job(&job).map_err(|e| e.to_string())?;

    let source_path = PathBuf::from(&source_root);
    let dest_path = PathBuf::from(&dest_root);

    // Run in background
    let job_id_for_task = job_id.clone();
    tokio::spawn(async move {
        // Phase 1: Indexing
        app.emit("verification-progress", VerificationProgress {
            job_id: job_id_for_task.clone(),
            phase: "INDEXING".to_string(),
            current_file: "".to_string(),
            bytes_total: 0,
            bytes_processed: 0,
            files_total: 0,
            files_processed: 0,
            ok_count: 0,
            mismatch_count: 0,
            missing_count: 0,
        }).unwrap();

        let source_entries = index_tree(&source_path);
        let dest_entries = index_tree(&dest_path);

        job.total_files = source_entries.len() as u32;
        job.total_bytes = source_entries.iter().map(|e| e.size).sum();
        
        db.update_verification_job_counts(&job).unwrap();

        let dest_map: HashMap<String, FileEntry> = dest_entries
            .into_iter()
            .map(|e| (e.rel_path.clone(), e))
            .collect();
        
        let dest_map_shared = Arc::new(StdMutex::new(dest_map));
        let results_shared = Arc::new(StdMutex::new(Vec::new()));
        let job_shared = Arc::new(StdMutex::new(job.clone()));
        let bytes_processed = Arc::new(std::sync::atomic::AtomicU64::new(0));

        // Use a custom thread pool to limit concurrency (2-4 threads as requested)
        let pool = rayon::ThreadPoolBuilder::new().num_threads(4).build().unwrap();

        pool.install(|| {
            source_entries.par_iter().enumerate().for_each(|(idx, src)| {
                let mut item = VerificationItem {
                    job_id: job_id_for_task.clone(),
                    rel_path: src.rel_path.clone(),
                    source_size: src.size,
                    dest_size: None,
                    source_mtime: src.mtime,
                    dest_mtime: None,
                    source_hash: None,
                    dest_hash: None,
                    status: "OK".to_string(),
                    error_message: None,
                };

                let mut dest_entry = None;

                // Lock the dest_map to pull out the matching file
                {
                    let mut dm = dest_map_shared.lock().unwrap();
                    if let Some(dst) = dm.remove(&src.rel_path) {
                        dest_entry = Some(dst);
                    }
                }

                if let Some(dst) = dest_entry {
                    item.dest_size = Some(dst.size);
                    item.dest_mtime = Some(dst.mtime);

                    if src.size != dst.size {
                        item.status = "SIZE_MISMATCH".to_string();
                        let mut j = job_shared.lock().unwrap();
                        j.size_mismatch_count += 1;
                    } else if mode == "SOLID" {
                        let src_hash = hash_file(&src.abs_path);
                        let dst_hash = hash_file(&dst.abs_path);

                        match (src_hash, dst_hash) {
                            (Ok(sh), Ok(dh)) => {
                                item.source_hash = Some(sh.clone());
                                item.dest_hash = Some(dh.clone());
                                if sh != dh {
                                    item.status = "HASH_MISMATCH".to_string();
                                    let mut j = job_shared.lock().unwrap();
                                    j.hash_mismatch_count += 1;
                                } else {
                                    let mut j = job_shared.lock().unwrap();
                                    j.verified_ok_count += 1;
                                }
                            }
                            (e1, e2) => {
                                item.status = if e1.is_err() { "UNREADABLE_SOURCE" } else { "UNREADABLE_DEST" }.to_string();
                                item.error_message = Some(format!("S:{:?} D:{:?}", e1.err(), e2.err()));
                                let mut j = job_shared.lock().unwrap();
                                j.unreadable_count += 1;
                            }
                        }
                    } else {
                        let mut j = job_shared.lock().unwrap();
                        j.verified_ok_count += 1;
                    }
                } else {
                    item.status = "MISSING".to_string();
                    let mut j = job_shared.lock().unwrap();
                    j.missing_count += 1;
                }

                let current_bytes = bytes_processed.fetch_add(src.size, std::sync::atomic::Ordering::SeqCst) + src.size;
                
                // Emit progress (throttled by index for performance)
                if idx % 10 == 0 || idx == source_entries.len() - 1 {
                    let j = job_shared.lock().unwrap();
                    let _ = app.emit("verification-progress", VerificationProgress {
                        job_id: job_id_for_task.clone(),
                        phase: "HASHING".to_string(),
                        current_file: src.rel_path.clone(),
                        bytes_total: j.total_bytes,
                        bytes_processed: current_bytes,
                        files_total: j.total_files,
                        files_processed: idx as u32 + 1,
                        ok_count: j.verified_ok_count,
                        mismatch_count: j.size_mismatch_count + j.hash_mismatch_count,
                        missing_count: j.missing_count,
                    });
                }

                // Push to shared results
                {
                    let mut res = results_shared.lock().unwrap();
                    res.push(item);
                    
                    // Periodically flush to DB
                    if res.len() >= 100 {
                        db.insert_verification_items(&res).unwrap();
                        res.clear();
                        let j = job_shared.lock().unwrap();
                        db.update_verification_job_counts(&j).unwrap();
                    }
                }
            });
        });

        // Final flush
        let final_results = {
            let mut res = results_shared.lock().unwrap();
            let items = res.clone();
            res.clear();
            items
        };
        if !final_results.is_empty() {
            db.insert_verification_items(&final_results).unwrap();
        }

        let mut final_job = {
            let j = job_shared.lock().unwrap();
            j.clone()
        };

        // Handle Extra files (remaining in dest_map_shared)
        {
            let dm = dest_map_shared.lock().unwrap();
            if !dm.is_empty() {
                let mut extras = Vec::new();
                for (rel_path, dst) in dm.iter() {
                    extras.push(VerificationItem {
                        job_id: job_id_for_task.clone(),
                        rel_path: rel_path.clone(),
                        source_size: 0,
                        dest_size: Some(dst.size),
                        source_mtime: 0,
                        dest_mtime: Some(dst.mtime),
                        source_hash: None,
                        dest_hash: None,
                        status: "EXTRA_IN_DEST".to_string(),
                        error_message: None,
                    });
                    final_job.extra_in_dest_count += 1;
                }
                db.insert_verification_items(&extras).unwrap();
            }
        }

        final_job.status = "DONE".to_string();
        db.update_verification_job_counts(&final_job).unwrap();
        db.update_verification_job_status(&job_id_for_task, "DONE").unwrap();

        let _ = app.emit("verification-progress", VerificationProgress {
            job_id: job_id_for_task.clone(),
            phase: "DONE".to_string(),
            current_file: "Complete".to_string(),
            bytes_total: final_job.total_bytes,
            bytes_processed: final_job.total_bytes,
            files_total: final_job.total_files,
            files_processed: final_job.total_files,
            ok_count: final_job.verified_ok_count,
            mismatch_count: final_job.size_mismatch_count + final_job.hash_mismatch_count,
            missing_count: final_job.missing_count,
        });
    });

    Ok(job_id)
}
