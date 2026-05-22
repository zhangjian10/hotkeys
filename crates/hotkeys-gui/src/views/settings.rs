//! 全局设置面板：window_keywords / auto_input_interval_secs / input_delay_millis。

use egui::{CollapsingHeader, DragValue, RichText, Ui};
use hotkeys_core::Config;

pub fn show(ui: &mut Ui, config: &mut Config) {
    CollapsingHeader::new(RichText::new("全局设置").heading())
        .default_open(true)
        .show(ui, |ui| {
            ui.add_space(4.0);

            // ----- 窗口关键词列表 -----
            ui.label("窗口关键词");
            ui.label(
                RichText::new("daemon 用这些关键词识别目标窗口；以 % 包裹则模糊匹配。")
                    .small()
                    .weak(),
            );
            ui.add_space(2.0);

            let mut delete_index: Option<usize> = None;
            let len = config.window_keywords.len();
            for (i, kw) in config.window_keywords.iter_mut().enumerate() {
                ui.horizontal(|ui| {
                    ui.add_sized([320.0, 0.0], egui::TextEdit::singleline(kw));
                    let can_remove = len > 1; // 至少保留一个
                    ui.add_enabled_ui(can_remove, |ui| {
                        if ui.button("✕").on_hover_text("删除此关键词").clicked() {
                            delete_index = Some(i);
                        }
                    });
                });
            }
            if let Some(i) = delete_index {
                config.window_keywords.remove(i);
            }
            if ui.button("+ 添加关键词").clicked() {
                config.window_keywords.push(String::new());
            }

            ui.add_space(8.0);

            // ----- 数值字段 -----
            egui::Grid::new("global_numeric_grid")
                .num_columns(2)
                .spacing([12.0, 6.0])
                .show(ui, |ui| {
                    ui.label("自动输入间隔（秒）");
                    ui.add(
                        DragValue::new(&mut config.auto_input_interval_secs)
                            .range(1..=u64::MAX)
                            .speed(1),
                    );
                    ui.end_row();

                    ui.label("输入延迟（毫秒）");
                    ui.add(
                        DragValue::new(&mut config.input_delay_millis)
                            .range(0..=u64::MAX)
                            .speed(1),
                    );
                    ui.end_row();
                });
        });
}
