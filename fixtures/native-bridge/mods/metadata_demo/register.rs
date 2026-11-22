// Exact Rust adapter emitted by the metadata-only Fabric bridge.
fn register_fabric_metadata_mod(mods: &mut Vec<crate::game::native_hooks::NativeMod>) {
    mods.push(crate::game::native_hooks::NativeMod {
        id: "metadata_demo".to_owned(),
        title: "Metadata Demo 1.2.3".to_owned(),
        description: "A fixture for the metadata bridge".to_owned(),
        keys: Vec::new(),
    });
}
