//! hotkeys-gui 入口。
//!
//! 加载 `hotkeys.toml`（位于 exe 同目录），启动 eframe 主窗口。
#![windows_subsystem = "windows"] // Release 时不弹控制台

use std::path::PathBuf;

mod app;
mod recorder;
mod views;

use app::GuiApp;

fn config_path() -> PathBuf {
    // 优先取 exe 同目录下的 hotkeys.toml；如果失败回退到当前工作目录。
    if let Ok(exe) = std::env::current_exe()
        && let Some(parent) = exe.parent()
    {
        return parent.join("hotkeys.toml");
    }
    PathBuf::from("hotkeys.toml")
}

fn main() -> eframe::Result<()> {
    let path = config_path();

    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([720.0, 560.0])
            .with_min_inner_size([520.0, 360.0])
            .with_title("Hotkeys 配置"),
        ..Default::default()
    };

    eframe::run_native(
        "Hotkeys 配置",
        options,
        Box::new(move |cc| Ok(Box::new(GuiApp::new(cc, path)))),
    )
}
