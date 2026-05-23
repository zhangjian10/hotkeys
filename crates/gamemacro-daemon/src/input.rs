use crate::log_error;
use enigo::{Enigo, Keyboard, Settings};

pub struct InputManager {
    enigo: Enigo,
}

impl InputManager {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let enigo = Enigo::new(&Settings::default())?;
        Ok(Self { enigo })
    }

    /// 把用户配置的字符串原样模拟输入。**不再**自动追加首尾回车——
    /// 之前是为了适配某些游戏聊天框的"回车进入聊天 → 发送 → 回车关闭"流程，
    /// 但对绝大多数场景属于多余且违反直觉的行为。需要回车的用户在 input_string
    /// 里自行写 `\n` 即可（GUI Textarea 原生支持）。
    pub fn input_text(&mut self, text: &str) {
        if let Err(e) = self.enigo.text(text) {
            log_error!("Error sending text: {}", e);
        }
    }
}
