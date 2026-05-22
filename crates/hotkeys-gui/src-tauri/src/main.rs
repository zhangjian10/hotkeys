// 隐藏 Windows 控制台（release 与 debug 都隐藏）。
// panic 信息会通过 Tauri 自身的日志机制输出。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hotkeys_gui_lib::run()
}
