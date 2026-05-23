use crate::log_error;
use enigo::{
    Direction::{self, Click},
    Enigo, Key, Keyboard, Settings,
};

pub struct InputManager {
    enigo: Enigo,
}

impl InputManager {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let enigo = Enigo::new(&Settings::default())?;
        Ok(Self { enigo })
    }

    pub fn input_text(&mut self, text: &str) {
        self.input_key('\n', Click);
        let _ = self.enigo.text(text);
        self.input_key('\n', Click);
    }
    fn input_key(&mut self, key: char, direction: Direction) {
        let result = self.enigo.key(Key::Unicode(key), direction);
        if let Err(e) = result {
            log_error!("Error sending key: {}", e);
        }
    }
}
