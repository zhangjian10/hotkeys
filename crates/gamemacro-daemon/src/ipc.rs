//! 命名管道 IPC 服务：`\\.\pipe\gamemacro-daemon`
//!
//! 协议：每次连接 = 一行请求 + 一行响应，然后断开。
//! - `STATUS\n` -> JSON 一行：{"running":true,"active":<bool>,"profile":<string|null>,"profile_index":<int|null>,"pid":<u32>}
//! - `STOP\n`   -> `OK\n`，daemon 进程随后退出
//! - 其它      -> `ERR unknown\n`
//!
//! JSON 手拼（仅一处需要序列化，不引 serde_json）。
//! 同步、单实例、循环 reuse；GUI 是唯一客户端，足够。

use crate::state::AppState;
use crate::{log_error, log_info};

use std::ffi::OsStr;
use std::io::{Read, Write};
use std::os::windows::ffi::OsStrExt;
use std::ptr;

use winapi::shared::minwindef::DWORD;
use winapi::shared::winerror::ERROR_PIPE_CONNECTED;
use winapi::um::errhandlingapi::GetLastError;
use winapi::um::fileapi::{ReadFile, WriteFile};
use winapi::um::handleapi::{CloseHandle, INVALID_HANDLE_VALUE};
use winapi::um::namedpipeapi::{ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe};
use winapi::um::processthreadsapi::GetCurrentProcessId;
use winapi::um::winbase::{
    PIPE_ACCESS_DUPLEX, PIPE_READMODE_BYTE, PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT,
};

const PIPE_NAME: &str = r"\\.\pipe\gamemacro-daemon";
const BUF_SIZE: DWORD = 4096;

/// 在后台线程启动 IPC 服务。失败不影响 daemon 主流程，仅记日志。
pub fn spawn_server() {
    std::thread::Builder::new()
        .name("gamemacro-ipc".into())
        .spawn(serve_loop)
        .map_err(|e| log_error!("ipc: failed to spawn ipc thread: {}", e))
        .ok();
}

fn serve_loop() {
    log_info!("ipc: serving on {}", PIPE_NAME);
    let wide = to_wide(PIPE_NAME);
    loop {
        let handle = unsafe {
            CreateNamedPipeW(
                wide.as_ptr(),
                PIPE_ACCESS_DUPLEX,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                PIPE_UNLIMITED_INSTANCES,
                BUF_SIZE,
                BUF_SIZE,
                0,
                ptr::null_mut(),
            )
        };
        if handle == INVALID_HANDLE_VALUE {
            let err = unsafe { GetLastError() };
            log_error!("ipc: CreateNamedPipeW failed (err={})", err);
            std::thread::sleep(std::time::Duration::from_secs(1));
            continue;
        }

        // 等客户端连接（阻塞）。返回非零表示已连上；ERROR_PIPE_CONNECTED 表示对端
        // 在 ConnectNamedPipe 之前就连上了，等同成功。
        let ok = unsafe { ConnectNamedPipe(handle, ptr::null_mut()) };
        if ok == 0 {
            let err = unsafe { GetLastError() };
            if err != ERROR_PIPE_CONNECTED {
                log_error!("ipc: ConnectNamedPipe failed (err={})", err);
                unsafe {
                    CloseHandle(handle);
                }
                continue;
            }
        }

        // 处理一轮请求
        handle_one(handle);

        // 断开 + 关闭，下一轮 accept 会创建新实例
        unsafe {
            DisconnectNamedPipe(handle);
            CloseHandle(handle);
        }
    }
}

fn handle_one(handle: winapi::um::winnt::HANDLE) {
    let mut io = PipeIo { handle };
    let line = match read_line(&mut io) {
        Some(s) => s,
        None => return,
    };
    let cmd = line.trim();

    match cmd {
        "STATUS" => {
            let snap = AppState::snapshot();
            let pid = unsafe { GetCurrentProcessId() };
            let body = format!(
                "{{\"running\":true,\"active\":{},\"profile\":{},\"profile_index\":{},\"pid\":{}}}\n",
                bool_str(snap.active),
                json_opt_str(snap.profile_name.as_deref()),
                json_opt_usize(snap.profile_index),
                pid,
            );
            let _ = io.write_all(body.as_bytes());
        }
        "STOP" => {
            log_info!("ipc: stop requested via IPC");
            let _ = io.write_all(b"OK\n");
            // 给客户端一点时间读响应，再退出
            std::thread::sleep(std::time::Duration::from_millis(50));
            std::process::exit(0);
        }
        other => {
            log_info!("ipc: unknown command: {:?}", other);
            let _ = io.write_all(b"ERR unknown\n");
        }
    }
}

/* ============================================================================
 * 小工具
 * ========================================================================== */

struct PipeIo {
    handle: winapi::um::winnt::HANDLE,
}

impl Read for PipeIo {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let mut read: DWORD = 0;
        let ok = unsafe {
            ReadFile(
                self.handle,
                buf.as_mut_ptr() as *mut _,
                buf.len() as DWORD,
                &mut read,
                ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(std::io::Error::last_os_error());
        }
        Ok(read as usize)
    }
}

impl Write for PipeIo {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let mut written: DWORD = 0;
        let ok = unsafe {
            WriteFile(
                self.handle,
                buf.as_ptr() as *const _,
                buf.len() as DWORD,
                &mut written,
                ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(std::io::Error::last_os_error());
        }
        Ok(written as usize)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// 从管道读到第一个 `\n`（包含），返回 UTF-8 字符串（不含 `\n`）。
/// EOF / 错误返回 None。
fn read_line(io: &mut PipeIo) -> Option<String> {
    let mut acc = Vec::with_capacity(64);
    let mut buf = [0u8; 256];
    loop {
        match io.read(&mut buf) {
            Ok(0) => return None,
            Ok(n) => {
                acc.extend_from_slice(&buf[..n]);
                if let Some(pos) = acc.iter().position(|&b| b == b'\n') {
                    acc.truncate(pos);
                    // 兼容 CRLF
                    if acc.last() == Some(&b'\r') {
                        acc.pop();
                    }
                    return String::from_utf8(acc).ok();
                }
                if acc.len() > 4096 {
                    return None; // 防止恶意客户端撑爆
                }
            }
            Err(_) => return None,
        }
    }
}

fn to_wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

fn bool_str(b: bool) -> &'static str {
    if b { "true" } else { "false" }
}

fn json_opt_str(s: Option<&str>) -> String {
    match s {
        None => "null".into(),
        Some(v) => {
            let mut out = String::with_capacity(v.len() + 2);
            out.push('"');
            for ch in v.chars() {
                match ch {
                    '"' => out.push_str("\\\""),
                    '\\' => out.push_str("\\\\"),
                    '\n' => out.push_str("\\n"),
                    '\r' => out.push_str("\\r"),
                    '\t' => out.push_str("\\t"),
                    c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
                    c => out.push(c),
                }
            }
            out.push('"');
            out
        }
    }
}

fn json_opt_usize(v: Option<usize>) -> String {
    match v {
        None => "null".into(),
        Some(n) => n.to_string(),
    }
}
