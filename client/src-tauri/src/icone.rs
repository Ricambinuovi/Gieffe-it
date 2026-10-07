//! Icone del tray disegnate dal codice (nessun file da distribuire):
//! un foglietto giallo; con un pallino rosso quando ci sono messaggi in sospeso;
//! grigio quando il server non è raggiungibile.

use tauri::image::Image;

const DIM: u32 = 64;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Aspetto {
    Normale,
    InSospeso,
    NonConnesso,
}

type Colore = [u8; 4];

struct Tela {
    px: Vec<u8>,
}

impl Tela {
    fn nuova() -> Self {
        Tela { px: vec![0; (DIM * DIM * 4) as usize] }
    }

    fn mescola(&mut self, x: i32, y: i32, c: Colore, copertura: f32) {
        if x < 0 || y < 0 || x >= DIM as i32 || y >= DIM as i32 {
            return;
        }
        let i = ((y as u32 * DIM + x as u32) * 4) as usize;
        let a = (c[3] as f32 / 255.0) * copertura.clamp(0.0, 1.0);
        let a0 = self.px[i + 3] as f32 / 255.0;
        let out = a + a0 * (1.0 - a);
        if out <= 0.0 {
            return;
        }
        for k in 0..3 {
            let v = (c[k] as f32 * a + self.px[i + k] as f32 * a0 * (1.0 - a)) / out;
            self.px[i + k] = v.round() as u8;
        }
        self.px[i + 3] = (out * 255.0).round() as u8;
    }

    /// Riempie i pixel per cui `dentro` restituisce la copertura (0..1), con 3x3 campioni.
    fn riempi(&mut self, c: Colore, dentro: impl Fn(f32, f32) -> bool) {
        for y in 0..DIM as i32 {
            for x in 0..DIM as i32 {
                let mut n = 0;
                for sy in 0..3 {
                    for sx in 0..3 {
                        let fx = x as f32 + (sx as f32 + 0.5) / 3.0;
                        let fy = y as f32 + (sy as f32 + 0.5) / 3.0;
                        if dentro(fx, fy) {
                            n += 1;
                        }
                    }
                }
                if n > 0 {
                    self.mescola(x, y, c, n as f32 / 9.0);
                }
            }
        }
    }
}

pub fn icona(aspetto: Aspetto) -> Image<'static> {
    let (corpo, piega, riga): (Colore, Colore, Colore) = match aspetto {
        Aspetto::NonConnesso => ([170, 170, 170, 255], [135, 135, 135, 255], [90, 90, 90, 255]),
        _ => ([255, 218, 56, 255], [214, 170, 20, 255], [80, 62, 10, 255]),
    };

    let mut t = Tela::nuova();
    let (a, b, p) = (6.0_f32, 58.0_f32, 18.0_f32); // bordi del foglietto e lato della piega

    // foglietto con l'angolo in basso a destra piegato
    t.riempi(corpo, |x, y| x >= a && x <= b && y >= a && y <= b && (x - a) + (y - a) <= 2.0 * (b - a) - p);
    // piega: triangolo con l'angolo retto in (b-p, b-p) e l'ipotenusa sul taglio
    t.riempi(piega, |x, y| {
        let (u, v) = (x - (b - p), y - (b - p));
        u >= 0.0 && v >= 0.0 && u + v <= p
    });
    // righe di testo
    for (i, larghezza) in [38.0_f32, 32.0, 36.0].iter().enumerate() {
        let y0 = 17.0 + i as f32 * 10.0;
        t.riempi(riga, |x, y| x >= 13.0 && x <= 13.0 + larghezza && y >= y0 && y <= y0 + 4.0);
    }

    if aspetto == Aspetto::InSospeso {
        let (cx, cy, r) = (47.0_f32, 17.0_f32, 14.0_f32);
        t.riempi([255, 255, 255, 255], |x, y| (x - cx).powi(2) + (y - cy).powi(2) <= r * r);
        t.riempi([226, 31, 38, 255], |x, y| (x - cx).powi(2) + (y - cy).powi(2) <= (r - 3.0).powi(2));
    }

    Image::new_owned(t.px, DIM, DIM)
}
