use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerfEvent {
    pub id: String,
    pub name: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_ms: Option<u128>,
    pub status: String, // started|ok|error
    pub details: Option<String>,
}

#[derive(Clone, Default)]
pub struct PerfLog {
    inner: Arc<Mutex<Vec<PerfEvent>>>,
    max_events: usize,
}

impl PerfLog {
    pub fn new(max_events: usize) -> Self {
        Self {
            inner: Arc::new(Mutex::new(Vec::new())),
            max_events,
        }
    }

    pub fn start(&self, name: &str, details: Option<String>) -> String {
        let id = format!("perf_{}", uuid::Uuid::new_v4());
        let event = PerfEvent {
            id: id.clone(),
            name: name.to_string(),
            started_at: chrono::Utc::now().to_rfc3339(),
            ended_at: None,
            duration_ms: None,
            status: "started".to_string(),
            details,
        };
        let mut lock = self.inner.lock().expect("perflog lock poisoned");
        lock.push(event);
        Self::trim(&mut lock, self.max_events);
        id
    }

    pub fn end(&self, id: &str, status: &str, details: Option<String>) {
        let mut lock = self.inner.lock().expect("perflog lock poisoned");
        if let Some(event) = lock.iter_mut().find(|e| e.id == id) {
            let ended = chrono::Utc::now();
            event.ended_at = Some(ended.to_rfc3339());
            event.status = status.to_string();
            if details.is_some() {
                event.details = details;
            }
            if let Ok(started) = chrono::DateTime::parse_from_rfc3339(&event.started_at) {
                event.duration_ms = Some((ended - started.with_timezone(&chrono::Utc)).num_milliseconds().max(0) as u128);
            }
        }
        Self::trim(&mut lock, self.max_events);
    }

    pub fn list(&self) -> Vec<PerfEvent> {
        self.inner
            .lock()
            .map(|v| v.clone())
            .unwrap_or_default()
    }

    pub fn clear(&self) {
        if let Ok(mut lock) = self.inner.lock() {
            lock.clear();
        }
    }

    fn trim(events: &mut Vec<PerfEvent>, max_events: usize) {
        if events.len() > max_events {
            let drop_n = events.len() - max_events;
            events.drain(0..drop_n);
        }
    }
}
