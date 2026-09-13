# Design — Harness Engineering Workshop

Locked system for the workshop deck. Open Design reads this first;
slides defer to it. Amend this file when the system changes — do not
restyle individual slides.

## System

- Genre · modern-minimal / techno-editorial
- Theme · custom (vibe: "black, white, instrument")
- Axes · white-paper / geometric-sans / ink-signal
- Output · 1920×1080 HTML deck → multi-page PDF (one slide per page)
- Authoring · Open Design `deck` framework; edit slide bodies only
- Brand · Agentics Foundation Event mark, top-right on every slide

## Tokens (canonical)

```css
:root {
  --color-paper:      #ffffff;
  --color-paper-2:    #f3f3f3;
  --color-ink:        #111111;
  --color-ink-2:      #5a5a5a;
  --color-rule:       #d0d0d0;
  --color-accent:     #111111;
  --color-accent-ink: #ffffff;
  --color-focus:      #111111;

  --color-cover:      #111111;
  --color-cover-ink:  #ffffff;
  --color-cover-2:    #9a9a9a;

  --font-display: "Outfit", "Schibsted Grotesk", sans-serif;
  --font-body:    "IBM Plex Sans", "Source Sans 3", sans-serif;
  --font-mono:    "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace;

  /* 8-pt rhythm. Type: 20 / 26 / 32 / 52 / 72 / 140. */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 180ms;  --dur-base: 280ms;  --dur-slow: 480ms;

  --radius-card: 0;   /* sharp — instrument, not app chrome */
  --radius-pill: 999px;
  --radius-input: 2px;
}
```

## Build (how we author)

This is a **reusable slide framework**, not a one-off Keynote file.

1. One HTML deck on the Open Design `deck` skeleton (1920×1080, keyboard
   nav, print stylesheet already produces a vertical PDF).
2. Theme lives in `:root` tokens above. Layouts are named `data-layout`
   types. Content is the only thing that changes per workshop module.
3. Preview/animate in the browser. Export PDF when the deck is settled.
   PDF captures the **end state** of each slide — motion is for live
   rehearsal and review, not for the printed page.
4. Adding a module = duplicate a layout `<section>`, swap copy and
   images. Do not invent new colors or type sizes.

## Slide types

Keep this set small so every new page is a copy, not a design job.

| Layout | Use |
|---|---|
| `cover` | Title, date, one-line promise. Dark canvas. |
| `agenda` | Numbered module list. Paper. |
| `section` | Module break: index + name + 8-word thesis. Dark. |
| `principle` | One claim, huge. One sentence why. Paper. |
| `split` | Framed visual 60 / text 40. Caption rail under the frame. |
| `gallery` | 2–4 framed images, each with a one-line caption. |
| `code` | Terminal or syntax block + the rule it proves. |
| `compare` | Pattern vs anti-pattern, two columns. |
| `exercise` | Lab prompt, timebox, success check. |
| `recap` | 3–5 takeaways. Then `thanks`. |

Teaching slides stay on paper. Atmosphere slides stay on cover-dark.
Never mix both on one page.

Default teaching density: one framed visual, one claim, at most three
supporting lines. If a fourth line is needed, split the slide.

## Visual rules

- One idea per teaching slide. If it needs a second idea, it is two slides.
- Images are content, not wallpaper. Default: framed screenshot or
  photo with a caption rail. Full-bleed only on `cover` and `section`.
- Diagrams prefer stroke + type (path-draw in preview). No decorative
  glow, scanlines, or purple gradients.
- Code and tool names use `--font-mono`. Headlines never do, except
  on `code` slides.

## Motion stance

- Live preview only: `blur-in` on covers, `rise-in` on titles,
  `fade-up` + `stagger-list` on body, `path-draw` on diagrams.
- One accent animation per slide. No glitch, neon-glow, or confetti.
- Reduced-motion / PDF · settled opacity, no looped effects.

## Voice

- Precise, slightly dry, engineer-to-engineer.
- Headlines are claims, not labels. "The harness is the product"
  not "Introduction to Harness Engineering."
- Microcopy names the next action: build, fork, run, measure.

## Anti-patterns

- No Inter, Space Grotesk, or generic purple-on-white AI decks.
- No per-slide color experiments. If a slide needs a new color, amend
  this file.
- Do not densify a `principle` into a wall of bullets.
- Do not put body paragraphs on dark covers.
- Do not ship a website runtime until we ask for it. PDF is the artifact.
