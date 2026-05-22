//! 热键列表面板：增删改 + 录制按钮 + 多行 input_string 编辑。

use egui::{CollapsingHeader, Color32, ComboBox, RichText, TextEdit, Ui};
use hotkeys_core::{ALL_MODIFIERS, ALL_TRIGGERS, HotkeyConfig};

use crate::app::GuiApp;
use crate::recorder::RecorderState;

pub fn show(ui: &mut Ui, app: &mut GuiApp) {
    let count = app.config.hotkeys.len();
    let header = RichText::new(format!("热键列表 ({})", count)).heading();
    CollapsingHeader::new(header).default_open(true).show(ui, |ui| {
        ui.add_space(4.0);

        // ----- 顶部：新增按钮 -----
        ui.horizontal(|ui| {
            if ui.button("+ 新增").clicked() {
                app.config.hotkeys.push(HotkeyConfig {
                    modifier_key: "Ctrl".to_string(),
                    trigger_key: "A".to_string(),
                    input_string: String::new(),
                    description: Some(String::new()),
                });
            }
        });
        ui.add_space(6.0);

        // ----- 每条热键卡片 -----
        let recording_index = app.recorder.as_ref().map(|r| r.target_index);
        let len = app.config.hotkeys.len();
        for i in 0..len {
            // 收集该行 UI 触发的动作，循环结束后再应用，避免与可变借用冲突。
            let mut action: Option<RowAction> = None;
            let is_recording = recording_index == Some(i);

            // 检测 modifier+trigger 冲突（同一组合在前面已存在）。
            let has_conflict = {
                let here = &app.config.hotkeys[i];
                app.config.hotkeys[..i].iter().any(|h| {
                    h.modifier_key == here.modifier_key && h.trigger_key == here.trigger_key
                })
            };

            egui::Frame::group(ui.style())
                .corner_radius(6.0)
                .inner_margin(egui::Margin::same(8))
                .show(ui, |ui| {
                    let hk = &mut app.config.hotkeys[i];

                    // 第一行：序号 / modifier / + / trigger / 录制 / 描述 / 删除
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(format!("#{}", i + 1)).weak());

                        // modifier 下拉
                        ComboBox::from_id_salt(("mod", i))
                            .selected_text(&hk.modifier_key)
                            .width(72.0)
                            .show_ui(ui, |ui| {
                                for &m in ALL_MODIFIERS {
                                    ui.selectable_value(&mut hk.modifier_key, m.to_string(), m);
                                }
                            });

                        ui.label("+");

                        // trigger 下拉
                        ComboBox::from_id_salt(("trig", i))
                            .selected_text(&hk.trigger_key)
                            .width(96.0)
                            .show_ui(ui, |ui| {
                                for &t in ALL_TRIGGERS {
                                    ui.selectable_value(&mut hk.trigger_key, t.to_string(), t);
                                }
                            });

                        // 录制按钮
                        let rec_label = if is_recording {
                            RichText::new("按下任意键... (Esc 取消)").color(Color32::LIGHT_RED)
                        } else {
                            RichText::new("🎙 录制")
                        };
                        if ui.button(rec_label).clicked() {
                            action = Some(if is_recording {
                                RowAction::CancelRecord
                            } else {
                                RowAction::StartRecord
                            });
                        }

                        ui.separator();
                        ui.label("描述:");
                        let mut desc = hk.description.clone().unwrap_or_default();
                        let desc_resp = ui.add_sized(
                            [ui.available_width() - 32.0, 0.0],
                            TextEdit::singleline(&mut desc).hint_text("可选"),
                        );
                        if desc_resp.changed() {
                            hk.description = if desc.is_empty() { None } else { Some(desc) };
                        }

                        if ui.button("✕").on_hover_text("删除").clicked() {
                            action = Some(RowAction::AskDelete);
                        }
                    });

                    // 第二行：input_string 多行编辑
                    ui.add_space(4.0);
                    ui.label("输入内容:");
                    ui.add(
                        TextEdit::multiline(&mut hk.input_string)
                            .desired_rows(3)
                            .desired_width(f32::INFINITY)
                            .font(egui::TextStyle::Monospace),
                    );
                    ui.label(
                        RichText::new("提示: 换行 = 游戏内回车 (Enter)").small().weak(),
                    );

                    // 冲突警告
                    if has_conflict {
                        ui.colored_label(
                            Color32::from_rgb(220, 180, 60),
                            "⚠ 与上方某条热键的修饰键+触发键完全相同，daemon 只会触发第一条",
                        );
                    }
                });
            ui.add_space(6.0);

            // 应用本行动作
            match action {
                Some(RowAction::StartRecord) => {
                    app.recorder = Some(RecorderState::new(i));
                }
                Some(RowAction::CancelRecord) => {
                    app.recorder = None;
                }
                Some(RowAction::AskDelete) => {
                    app.pending_delete = Some(i);
                }
                None => {}
            }
        }

        if len == 0 {
            ui.label(RichText::new("暂无热键，点击上方按钮添加。").weak());
        }
    });
}

enum RowAction {
    StartRecord,
    CancelRecord,
    AskDelete,
}
