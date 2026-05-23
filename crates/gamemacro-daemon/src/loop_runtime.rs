//! Per-hotkey 循环输入运行时。
//!
//! 职责：
//! - 运行一个 tokio multi-thread runtime；每条 `repeat=true` 的热键被按下时起一个 task
//! - task 按 `effective_interval_secs` 周期 tick，把要输入的文本通过 std::mpsc 投递给 input worker
//! - 唯一的 input worker 是普通 std::thread，持有 Enigo（输入 API 需要串行化执行）
//! - 启动循环返回一个稳定的 `LoopHandle`；用 handle 单独取消，或一次性 `cancel_all`
//! - 单次输入（repeat=false）：调用 `submit_once()` 直接发一条到 worker，不起 task

use crate::input::InputManager;
use std::sync::mpsc as std_mpsc;
use std::thread;
use std::time::Duration;
use tokio::runtime::Runtime;
use tokio_util::sync::CancellationToken;

/// 一条要发送给 input worker 的命令。
#[derive(Debug)]
struct InputJob {
    text: String,
    /// 输入完一次后再睡的延迟（毫秒），用于压制游戏丢字。
    post_delay_ms: u64,
}

/// 启动一条循环后返回的稳定句柄。可用于后续单独取消。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LoopHandle(u64);

pub struct LoopRuntime {
    rt: Runtime,
    /// 通向 input worker 的发送端（无界 std::mpsc）。
    /// 循环 task 的 tick 速率受 interval 控制，不会暴涨；用无界通道避免 task 因背压被阻塞。
    job_tx: std_mpsc::Sender<InputJob>,
    /// 每条进行中的循环对应一个 CancellationToken。整体 cancel 用 `cancel_all`。
    /// HashMap 而不是 Vec：handle 不复用，移除任意条不会让别的 handle 失效。
    loops: std::collections::HashMap<LoopHandle, CancellationToken>,
    next_handle: u64,
}

impl LoopRuntime {
    /// 创建运行时：spawn input worker thread（持有 Enigo），创建 tokio runtime。
    /// 不 spawn 任何循环 task —— 由 `start_loop` 按需启动。
    pub fn new() -> std::io::Result<Self> {
        let (job_tx, job_rx) = std_mpsc::channel::<InputJob>();

        // 输入 worker：单线程持有 Enigo，串行处理 InputJob
        thread::Builder::new()
            .name("gamemacro-input-worker".into())
            .spawn(move || {
                input_worker_loop(job_rx);
            })?;

        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_time()
            .thread_name("gamemacro-loop")
            .build()?;

        Ok(Self {
            rt,
            job_tx,
            loops: std::collections::HashMap::new(),
            next_handle: 0,
        })
    }

    /// 启动一条循环。第一次 tick 立即 fire（用户按下立即有反馈），之后每 `interval_secs` 秒一次。
    pub fn start_loop(
        &mut self,
        input_string: String,
        interval_secs: u64,
        delay_ms: u64,
    ) -> LoopHandle {
        let handle = LoopHandle(self.next_handle);
        self.next_handle += 1;

        let token = CancellationToken::new();
        let token_for_task = token.clone();
        let tx = self.job_tx.clone();
        let interval = Duration::from_secs(interval_secs.max(1));

        self.rt.spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            // tokio::time::interval 默认 first tick 立即 ready —— 等同"按下立刻输入一次"
            loop {
                tokio::select! {
                    _ = token_for_task.cancelled() => break,
                    _ = ticker.tick() => {
                        let job = InputJob {
                            text: input_string.clone(),
                            post_delay_ms: delay_ms,
                        };
                        // 发送失败说明 input worker 已退出：直接结束 task
                        if tx.send(job).is_err() {
                            break;
                        }
                    }
                }
            }
        });

        self.loops.insert(handle, token);
        handle
    }

    /// 停止一条循环（如果该 handle 仍有效）。
    pub fn stop_loop(&mut self, handle: LoopHandle) {
        if let Some(tok) = self.loops.remove(&handle) {
            tok.cancel();
        }
    }

    /// 一次性提交一条输入（用于 repeat=false 的热键）。
    pub fn submit_once(&self, text: String, delay_ms: u64) {
        let _ = self.job_tx.send(InputJob {
            text,
            post_delay_ms: delay_ms,
        });
    }

    /// 取消所有循环（窗口失活 / 配置 reload 时调用）。
    pub fn cancel_all_loops(&mut self) {
        for (_, tok) in self.loops.drain() {
            tok.cancel();
        }
    }
}

fn input_worker_loop(rx: std_mpsc::Receiver<InputJob>) {
    let mut input = match InputManager::new() {
        Ok(i) => i,
        Err(e) => {
            eprintln!("input worker: failed to init Enigo: {}", e);
            return;
        }
    };
    while let Ok(job) = rx.recv() {
        input.input_text(&job.text);
        if job.post_delay_ms > 0 {
            thread::sleep(Duration::from_millis(job.post_delay_ms));
        }
    }
}
