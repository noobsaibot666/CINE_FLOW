mod audio;
mod clustering;
mod commands;
mod db;
mod export;
mod ffprobe;
mod folders;
mod jobs;
mod lut;
mod perf;
mod review_core;
mod scanner;
mod thumbnail;
mod tools;
mod verification;

use commands::AppState;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Determine cache directory
    let cache_dir = dirs_next::cache_dir()
        .map(|d| d.join("wrap-preview").to_string_lossy().to_string())
        .unwrap_or_else(|| "/tmp/wrap-preview".to_string());

    std::fs::create_dir_all(&cache_dir).expect("Failed to create cache directory");

    // Database path
    let db_path = format!("{}/wrap-preview.db", &cache_dir);
    let database = db::Database::new(&db_path).expect("Failed to initialize database");

    let app_state = Arc::new(AppState {
        db: database.clone(),
        cache_dir,
        job_manager: Arc::new(crate::jobs::JobManager::new(Some(database))),
        perf_log: crate::perf::PerfLog::new(500),
        review_core_base_dir: crate::review_core::storage::review_core_base_dir(),
        review_core_server_base_url: std::sync::Mutex::new(None),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state.clone())
        .setup(move |_| {
            let server_url = crate::review_core::server::start_review_core_server(
                app_state.db.clone(),
                app_state.review_core_base_dir.clone(),
            )?;
            if let Ok(mut lock) = app_state.review_core_server_base_url.lock() {
                *lock = Some(server_url);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_folder,
            commands::list_project_roots,
            commands::add_project_root,
            commands::remove_project_root,
            commands::update_project_root_label,
            commands::rescan_project,
            commands::get_clips,
            commands::extract_thumbnails,
            commands::get_project,
            commands::read_thumbnail,
            commands::read_audio_preview,
            commands::save_image_data_url,
            commands::load_brand_profile,
            commands::read_brand_logo,
            commands::save_brand_profile,
            commands::save_brand_logo,
            commands::start_verification,
            commands::get_job,
            commands::list_jobs,
            commands::cancel_job,
            commands::get_app_info,
            commands::export_feedback_bundle,
            commands::list_perf_events,
            commands::clear_perf_events,
            commands::export_perf_report,
            commands::get_verification_job,
            commands::get_verification_items,
            commands::list_verification_jobs_for_project,
            commands::list_verification_queue,
            commands::set_verification_queue_item,
            commands::remove_verification_queue_item,
            commands::clear_verification_queue,
            commands::start_verification_queue,
            commands::export_verification_report_markdown,
            commands::export_verification_report_pdf,
            commands::export_verification_queue_report_markdown,
            commands::export_verification_queue_report_pdf,
            commands::extract_audio_waveform,
            commands::update_clip_metadata,
            commands::export_to_fcpxml,
            commands::export_director_pack,
            commands::build_scene_blocks,
            commands::clear_scene_detection_cache,
            commands::get_scene_blocks,
            commands::rename_scene_block,
            commands::merge_scene_blocks,
            commands::split_scene_block,
            commands::set_project_lut,
            commands::remove_project_lut,
            commands::set_clip_lut_enabled,
            commands::generate_lut_thumbnails,
            commands::get_project_settings,
            commands::create_folder_zip,
            commands::create_folder_structure,
            commands::purge_cache,
            commands::review_core_ingest_files,
            commands::review_core_create_project,
            commands::review_core_list_projects,
            commands::review_core_touch_project,
            commands::review_core_list_assets,
            commands::review_core_list_assets_with_versions,
            commands::review_core_list_asset_versions,
            commands::review_core_list_thumbnails,
            commands::review_core_get_server_base_url,
            commands::review_core_check_duplicate_files,
            commands::review_core_add_comment,
            commands::review_core_list_comments,
            commands::review_core_update_comment,
            commands::review_core_delete_comment,
            commands::review_core_add_annotation,
            commands::review_core_list_annotations,
            commands::review_core_delete_annotation,
            commands::review_core_extract_frame,
            commands::review_core_list_frame_notes,
            commands::review_core_read_frame_note_image,
            commands::review_core_update_frame_note,
            commands::review_core_delete_frame_note,
            commands::review_core_get_approval,
            commands::review_core_set_approval,
            commands::review_core_create_share_link,
            commands::review_core_list_share_links,
            commands::review_core_revoke_share_link,
            commands::review_core_resolve_share_link,
            commands::review_core_verify_share_link_password,
            commands::review_core_share_unlock,
            commands::review_core_share_list_assets,
            commands::review_core_share_list_versions,
            commands::review_core_share_list_thumbnails,
            commands::review_core_share_list_comments,
            commands::review_core_share_add_comment,
            commands::review_core_share_set_display_name,
            commands::review_core_share_list_annotations,
            commands::review_core_share_export_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
