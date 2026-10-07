// Evita la finestra del terminale su Windows nelle build release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gieffe_it_lib::run()
}
