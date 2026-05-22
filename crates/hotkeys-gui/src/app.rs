//! GUI 应用主结构与生命周期。

use std::path::PathBuf;
use std::time::{Duration, Instant};

use eframe::CreationContext;
use egui::{Color32, Context, FontFamily, FontId, RichText, ViewportCommand};
use hotkeys_core::{Config, ConfigError};

use crate::recorder::RecorderState;
use crate::views;

/// Toast 通知。
pub struct Toast {
    pub message: String,
    pub kind: ToastKind,
    pub expires_at: Instant,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ToastKind {
    Info,
    Success,
    Error,
}

impl ToastKind {
    fn color(self) -> Color32 {
        match self {
            ToastKind::Info => Color32::from_rgb(80, 130, 200),
            ToastKind::Success => Color32::from_rgb(80, 170, 90),
            ToastKind::Error => Color32::from_rgb(200, 80, 80),
        }
    }
}

/// 启动时配置加载错误（用于显示 modal）。
pub struct LoadError {
    pub message: String,
}

pub struct GuiApp {
    /// 当前正在编辑的配置（工作副本）。
    pub config: Config,
    /// 上次保存到磁盘的快照，用于 dirty 判断。
    pub saved_snapshot: Config,
    /// 配置文件路径。
    pub config_path: PathBuf,
    /// 录制状态机。
    pub recorder: Option<RecorderState>,
    /// 当前 Toast 通知。
    pub toast: Option<Toast>,
    /// 启动时配置加载错误（如果有）。
    pub load_error: Option<LoadError>,
    /// 关闭确认对话框是否显示。
    pub show_close_confirm: bool,
    /// 待删除的 hotkey index（弹出确认对话框时设置）。
    pub pending_delete: Option<usize>,
}

impl GuiApp {
    pub fn new(_cc: &CreationContext<'_>, config_path: PathBuf) -> Self {
        // 启动时加载或创建配置。失败时用 default 兜底并记录错误，让用户在 UI 上选择处理。
        let (config, load_error) = match Config::load_or_create(&config_path) {
            Ok(c) => (c, None),
            Err(e) => (
                Config::default(),
                Some(LoadError {
                    message: format!("{}", e),
                }),
            ),
        };

        Self {
            saved_snapshot: config.clone(),
            config,
            config_path,
            recorder: None,
            toast: None,
            load_error,
            show_close_confirm: false,
            pending_delete: None,
        }
    }

    /// 是否有未保存的修改。
    pub fn is_dirty(&self) -> bool {
        self.config != self.saved_snapshot
    }

    /// 保存配置到磁盘。
    pub fn save(&mut self) {
        match self.config.save(&self.config_path) {
            Ok(()) => {
                self.saved_snapshot = self.config.clone();
                self.show_toast("已保存", ToastKind::Success);
            }
            Err(e) => {
                self.show_toast(format!("保存失败: {}", display_err(&e)), ToastKind::Error);
            }
        }
    }

    /// 重置工作副本到上次保存的快照。
    pub fn reset(&mut self) {
        self.config = self.saved_snapshot.clone();
        self.recorder = None;
        self.show_toast("已重置", ToastKind::Info);
    }

    pub fn show_toast(&mut self, message: impl Into<String>, kind: ToastKind) {
        self.toast = Some(Toast {
            message: message.into(),
            kind,
            expires_at: Instant::now() + Duration::from_secs(2),
        });
    }
}

fn display_err(e: &ConfigError) -> String {
    format!("{}", e)
}

impl eframe::App for GuiApp {
    fn update(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
        // ----- 关闭事件拦截 -----
        if ctx.input(|i| i.viewport().close_requested()) {
            if self.is_dirty() && !self.show_close_confirm {
                // 阻止本次关闭，弹确认框
                ctx.send_viewport_cmd(ViewportCommand::CancelClose);
                self.show_close_confirm = true;
            }
        }

        // ----- 全局快捷键 Ctrl+S -----
        let save_shortcut = egui::KeyboardShortcut::new(egui::Modifiers::CTRL, egui::Key::S);
        if ctx.input_mut(|i| i.consume_shortcut(&save_shortcut)) {
            self.save();
        }

        // ----- 录制状态机推进 -----
        if let Some(rec) = self.recorder.as_ref().cloned() {
            self.recorder = crate::recorder::tick(ctx, rec, &mut self.config, &mut |msg, kind| {
                self.toast = Some(Toast {
                    message: msg,
                    kind,
                    expires_at: Instant::now() + Duration::from_secs(2),
                });
            });
        }

        // ----- 标题（带 dirty 星号） -----
        let title = if self.is_dirty() {
            "Hotkeys 配置 *"
        } else {
            "Hotkeys 配置"
        };
        ctx.send_viewport_cmd(ViewportCommand::Title(title.into()));

        // ----- 启动错误 modal -----
        if self.load_error.is_some() {
            self.show_load_error_modal(ctx);
        }

        // ----- 关闭确认 modal -----
        if self.show_close_confirm {
            self.show_close_confirm_modal(ctx);
        }

        // ----- 删除确认 modal -----
        if self.pending_delete.is_some() {
            self.show_delete_confirm_modal(ctx);
        }

        // ----- 底部栏 -----
        egui::TopBottomPanel::bottom("bottom_bar")
            .resizable(false)
            .show(ctx, |ui| {
                ui.add_space(4.0);
                ui.horizontal(|ui| {
                    let path_text = self.config_path.display().to_string();
                    ui.label(
                        RichText::new(&path_text)
                            .small()
                            .color(Color32::from_gray(160)),
                    )
                    .on_hover_text(&path_text);

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let save_btn = egui::Button::new(RichText::new("保存 (Ctrl+S)").strong());
                        if ui.add(save_btn).clicked() {
                            self.save();
                        }
                        ui.add_enabled_ui(self.is_dirty(), |ui| {
                            if ui.button("重置").clicked() {
                                self.reset();
                            }
                        });
                    });
                });
                ui.add_space(2.0);
            });

        // ----- 主面板 -----
        egui::CentralPanel::default().show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                views::settings::show(ui, &mut self.config);
                ui.add_space(8.0);
                views::hotkeys::show(ui, self);
                ui.add_space(8.0);
            });
        });

        // ----- Toast 浮层 -----
        self.show_toast_overlay(ctx);
    }
}

impl GuiApp {
    fn show_load_error_modal(&mut self, ctx: &Context) {
        let msg = self
            .load_error
            .as_ref()
            .map(|e| e.message.clone())
            .unwrap_or_default();
        let mut clear = false;
        let mut overwrite = false;
        egui::Modal::new(egui::Id::new("load_error_modal")).show(ctx, |ui| {
            ui.set_max_width(420.0);
            ui.heading("加载配置失败");
            ui.add_space(6.0);
            ui.label("无法读取或解析现有的 hotkeys.toml：");
            ui.label(
                RichText::new(&msg)
                    .font(FontId::new(13.0, FontFamily::Monospace))
                    .color(Color32::LIGHT_RED),
            );
            ui.add_space(6.0);
            ui.label("当前已使用默认配置，不会覆盖你的文件，除非你点击下方按钮。");
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                if ui.button("继续编辑（不覆盖）").clicked() {
                    clear = true;
                }
                if ui
                    .button(RichText::new("覆盖为默认配置").color(Color32::LIGHT_RED))
                    .clicked()
                {
                    overwrite = true;
                }
            });
        });
        if overwrite {
            // 用 default 覆盖磁盘
            match self.config.save(&self.config_path) {
                Ok(()) => {
                    self.saved_snapshot = self.config.clone();
                    self.load_error = None;
                    self.show_toast("已覆盖为默认配置", ToastKind::Success);
                }
                Err(e) => {
                    self.show_toast(format!("覆盖失败: {}", display_err(&e)), ToastKind::Error);
                }
            }
        } else if clear {
            self.load_error = None;
        }
    }

    fn show_close_confirm_modal(&mut self, ctx: &Context) {
        let mut action: Option<CloseAction> = None;
        egui::Modal::new(egui::Id::new("close_confirm_modal")).show(ctx, |ui| {
            ui.set_max_width(360.0);
            ui.heading("有未保存的修改");
            ui.add_space(6.0);
            ui.label("是否在退出前保存当前修改？");
            ui.add_space(10.0);
            ui.horizontal(|ui| {
                if ui.button("保存并退出").clicked() {
                    action = Some(CloseAction::SaveAndExit);
                }
                if ui.button("放弃修改并退出").clicked() {
                    action = Some(CloseAction::DiscardAndExit);
                }
                if ui.button("取消").clicked() {
                    action = Some(CloseAction::Cancel);
                }
            });
        });
        match action {
            Some(CloseAction::SaveAndExit) => {
                self.save();
                if !self.is_dirty() {
                    self.show_close_confirm = false;
                    ctx.send_viewport_cmd(ViewportCommand::Close);
                }
            }
            Some(CloseAction::DiscardAndExit) => {
                self.saved_snapshot = self.config.clone(); // 防止再次拦截
                self.show_close_confirm = false;
                ctx.send_viewport_cmd(ViewportCommand::Close);
            }
            Some(CloseAction::Cancel) => {
                self.show_close_confirm = false;
            }
            None => {}
        }
    }

    fn show_delete_confirm_modal(&mut self, ctx: &Context) {
        let idx = match self.pending_delete {
            Some(i) => i,
            None => return,
        };
        let preview = self
            .config
            .hotkeys
            .get(idx)
            .map(|h| {
                let desc = h.description.as_deref().unwrap_or("");
                format!("{} + {}  {}", h.modifier_key, h.trigger_key, desc)
            })
            .unwrap_or_default();
        let mut confirm = false;
        let mut cancel = false;
        egui::Modal::new(egui::Id::new("delete_confirm_modal")).show(ctx, |ui| {
            ui.set_max_width(360.0);
            ui.heading("删除热键");
            ui.add_space(6.0);
            ui.label("确认删除以下热键？");
            ui.label(RichText::new(&preview).strong());
            ui.add_space(10.0);
            ui.horizontal(|ui| {
                if ui
                    .button(RichText::new("删除").color(Color32::LIGHT_RED))
                    .clicked()
                {
                    confirm = true;
                }
                if ui.button("取消").clicked() {
                    cancel = true;
                }
            });
        });
        if confirm {
            if idx < self.config.hotkeys.len() {
                self.config.hotkeys.remove(idx);
            }
            self.pending_delete = None;
        } else if cancel {
            self.pending_delete = None;
        }
    }

    fn show_toast_overlay(&mut self, ctx: &Context) {
        // 过期清理
        if let Some(t) = &self.toast
            && Instant::now() >= t.expires_at
        {
            self.toast = None;
        }
        let Some(toast) = &self.toast else { return };
        let color = toast.kind.color();
        let message = toast.message.clone();
        egui::Area::new(egui::Id::new("toast_overlay"))
            .anchor(egui::Align2::RIGHT_BOTTOM, egui::vec2(-16.0, -56.0))
            .order(egui::Order::Foreground)
            .show(ctx, |ui| {
                egui::Frame::popup(&ctx.style())
                    .fill(color)
                    .corner_radius(6.0)
                    .inner_margin(egui::Margin::symmetric(12, 8))
                    .show(ui, |ui| {
                        ui.label(RichText::new(&message).color(Color32::WHITE).strong());
                    });
            });
        // 让 toast 在过期前持续重绘，使其能自动消失。
        ctx.request_repaint_after(Duration::from_millis(100));
    }
}

enum CloseAction {
    SaveAndExit,
    DiscardAndExit,
    Cancel,
}
