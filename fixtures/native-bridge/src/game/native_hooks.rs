#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct NativeMod {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) keys: Vec<[String; 3]>,
}

pub(crate) struct Game;

impl Game {
    pub(crate) fn native_mods(&mut self, mods: &mut Vec<NativeMod>) {
        let _ = mods;
    }
}
