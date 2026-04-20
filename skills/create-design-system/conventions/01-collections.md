# 1. Five variable collections (the only collections you ever create)

| Collection   | Modes                                                  | Contents                                                                                                                                   |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Primitives` | Default                                                | Raw color ramps (50–950), `Space/*`, `Corner/*`, `elevation/*` floats, `typeface/display` + `typeface/body` STRING primitives              |
| `Theme`      | **Light**, **Dark**                                    | 54 semantic color aliases in 7 groups (`background/`, `border/`, `primary/`, `secondary/`, `tertiary/`, `error/`, `component/`)            |
| `Typography` | **85 · 100 · 110 · 120 · 130 · 150 · 175 · 200**       | 15 M3 slots (Display / Headline / Title / Body / Label × LG/MD/SM) × 4 properties — `font-family` aliases `typeface/*`; sizes scale per mode |
| `Layout`     | Default                                                | `space/*` + `radius/*` semantic aliases into Primitives                                                                                   |
| `Effects`    | **Light**, **Dark**                                    | `shadow/color` (opacity per mode) + `shadow/{tier}/blur` aliases into `elevation/*`                                                         |

**Never create** `Web`, `Android/M3`, or `iOS/HIG` alias collections — platform mapping lives on each variable's `codeSyntax`.
