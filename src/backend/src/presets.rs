//! 打印尺寸预设表。毫米对照依据 doc/spec/print-sizes.md；
//! 店铺要求不符时只改本表，不用动算法代码。

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PrintPreset {
    pub id: &'static str,
    pub name: &'static str,
    pub width_mm: f64,
    pub height_mm: f64,
}

pub const PRESETS: &[PrintPreset] = &[
    PrintPreset {
        id: "5in",
        name: "5 寸",
        width_mm: 89.0,
        height_mm: 127.0,
    },
    PrintPreset {
        id: "7in",
        name: "7 寸",
        width_mm: 127.0,
        height_mm: 178.0,
    },
    PrintPreset {
        id: "10in",
        name: "10 寸",
        width_mm: 203.0,
        height_mm: 254.0,
    },
    PrintPreset {
        id: "15in",
        name: "15 寸",
        width_mm: 254.0,
        height_mm: 381.0,
    },
    PrintPreset {
        id: "20in",
        name: "20 寸",
        width_mm: 406.0,
        height_mm: 508.0,
    },
    PrintPreset {
        id: "21in",
        name: "21 寸",
        width_mm: 400.0,
        height_mm: 533.0,
    },
    PrintPreset {
        id: "27in",
        name: "27 寸",
        width_mm: 514.0,
        height_mm: 686.0,
    },
    PrintPreset {
        id: "32in",
        name: "32 寸",
        width_mm: 610.0,
        height_mm: 813.0,
    },
    PrintPreset {
        id: "a4",
        name: "A4",
        width_mm: 210.0,
        height_mm: 297.0,
    },
];

pub fn find_preset(id: &str) -> Option<&'static PrintPreset> {
    PRESETS.iter().find(|p| p.id == id)
}

/// 横竖互换。
pub fn swapped(preset: &PrintPreset) -> PrintPreset {
    PrintPreset {
        id: preset.id,
        name: preset.name,
        width_mm: preset.height_mm,
        height_mm: preset.width_mm,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::units::mm_to_px;

    #[test]
    fn preset_ids_unique() {
        for (i, a) in PRESETS.iter().enumerate() {
            for b in &PRESETS[i + 1..] {
                assert_ne!(a.id, b.id);
            }
        }
    }

    #[test]
    fn five_inch_at_300dpi() {
        let p = find_preset("5in").unwrap();
        assert_eq!(
            (mm_to_px(p.width_mm, 300), mm_to_px(p.height_mm, 300)),
            (1051, 1500)
        );
    }

    #[test]
    fn swap_exchanges_dimensions() {
        let p = find_preset("a4").unwrap();
        let s = swapped(p);
        assert_eq!((s.width_mm, s.height_mm), (297.0, 210.0));
    }
}
