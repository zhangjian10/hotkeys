//! 极简文件日志：%LOCALAPPDATA%\GameMacro\daemon.log
//!
//! 设计要点：
//! - 零外部依赖，仅 std
//! - OnceLock<Mutex<File>>：进程内全局单例，所有调用串行追加
//! - 1 MiB 大小阈值滚动一次到 daemon.log.1（旧 .1 被覆盖）
//! - debug build 同时镜像到 stdout/stderr，方便 cargo run 时看
//! - init 失败时不 panic：日志写入会变成 no-op，daemon 继续工作

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_LOG_BYTES: u64 = 1024 * 1024;

static LOG_FILE: OnceLock<Mutex<File>> = OnceLock::new();
static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

/// daemon 启动时调用一次。失败 = 静默降级为 no-op。
pub fn init() {
    let Some(path) = resolve_log_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    // 滚动检查：超过阈值就把当前日志改名为 .1（覆盖旧的 .1）
    if let Ok(meta) = std::fs::metadata(&path) {
        if meta.len() > MAX_LOG_BYTES {
            let rotated = path.with_extension("log.1");
            let _ = std::fs::remove_file(&rotated);
            let _ = std::fs::rename(&path, &rotated);
        }
    }
    if let Ok(file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = LOG_FILE.set(Mutex::new(file));
        let _ = LOG_PATH.set(path);
    }
}

/// 当前日志文件路径（init 成功后才有）。供后续 4-B 暴露给 GUI。
#[allow(dead_code)]
pub fn log_path() -> Option<&'static PathBuf> {
    LOG_PATH.get()
}

fn resolve_log_path() -> Option<PathBuf> {
    let base = std::env::var_os("LOCALAPPDATA")?;
    let mut p = PathBuf::from(base);
    p.push("GameMacro");
    p.push("daemon.log");
    Some(p)
}

/// 给宏调用：拼时间戳 + level + 消息后写文件，debug build 同时镜像到控制台。
pub fn write(level: &str, args: std::fmt::Arguments<'_>) {
    let ts = format_timestamp();
    let line = format!("{ts} [{level}] {args}\n");

    if let Some(lock) = LOG_FILE.get() {
        if let Ok(mut f) = lock.lock() {
            let _ = f.write_all(line.as_bytes());
            let _ = f.flush();
        }
    }

    // debug build：镜像到控制台，方便 `cargo run`。release 下 windows 子系统的 stdout
    // 指向 NUL，不会真正显示，无需额外处理。
    #[cfg(debug_assertions)]
    {
        if level == "ERROR" || level == "WARN" {
            eprint!("{line}");
        } else {
            print!("{line}");
        }
    }
}

fn format_timestamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (y, mo, d, h, mi, s) = breakdown_utc(secs);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

/// Unix epoch 秒 -> (year, month, day, hour, minute, second) UTC。
/// 不引 chrono；做朴素的逐年/逐月剥离。
fn breakdown_utc(mut secs: u64) -> (i32, u32, u32, u32, u32, u32) {
    let s = (secs % 60) as u32;
    secs /= 60;
    let mi = (secs % 60) as u32;
    secs /= 60;
    let h = (secs % 24) as u32;
    let mut days = (secs / 24) as i64;

    let mut y: i32 = 1970;
    loop {
        let yd = if is_leap(y) { 366 } else { 365 };
        if days >= yd {
            days -= yd;
            y += 1;
        } else {
            break;
        }
    }
    let months = [
        31,
        28 + if is_leap(y) { 1 } else { 0 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut mo: u32 = 1;
    for &md in &months {
        if days >= md {
            days -= md;
            mo += 1;
        } else {
            break;
        }
    }
    let d = (days as u32) + 1;
    (y, mo, d, h, mi, s)
}

fn is_leap(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

#[macro_export]
macro_rules! log_info {
    ($($t:tt)*) => { $crate::logging::write("INFO",  format_args!($($t)*)) };
}
#[macro_export]
macro_rules! log_warn {
    ($($t:tt)*) => { $crate::logging::write("WARN",  format_args!($($t)*)) };
}
#[macro_export]
macro_rules! log_error {
    ($($t:tt)*) => { $crate::logging::write("ERROR", format_args!($($t)*)) };
}
