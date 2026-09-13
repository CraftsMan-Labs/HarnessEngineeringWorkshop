# Software Hacktory deck

Modular slide sources assemble into a single browser-ready [`index.html`](index.html).

## Layout

```
deck/
  build.py              # stdlib builder (no deps)
  index.html            # generated — open this in a browser
  assets/               # logos, images
  src/
    template.html       # document shell
    framework.css       # deck chrome (scale, nav, print)
    deck.css            # typography + slide variants
    deck.js             # keyboard / prev-next navigation
    slides/
      01-cover.html
      02-definition.html
      …
```

Each file under `src/slides/` is one `<section class="slide …">`. Filename order is slide order (`01-…`, `02-…`).

## Edit a slide

1. Open the fragment, e.g. `src/slides/03-why-first.html`.
2. Change the markup inside the section. Keep exactly one footer placeholder:

   ```html
   <footer class="foot"><span>Software Hacktory</span><span>{{N}} / {{TOTAL}}</span></footer>
   ```

3. Rebuild (or keep watch running), then refresh the browser.

Do **not** hand-edit `index.html` — it is overwritten by the builder.

## Add a slide

1. Copy an existing fragment that matches the layout you want (paper / dark / split).
2. Name it with the next zero-padded index and a kebab slug, e.g. `33-appendix.html`.
3. Rebuild. The builder derives `data-screen-label` (e.g. `33 Appendix`) and renumbers every footer `NN / TOTAL`.

## Reorder slides

Rename files so lexicographic order matches the new sequence (keep the `NN-slug` form). Rebuild — labels and `01 / 32`-style footers update automatically.

## Build commands

```bash
# one-shot regenerate
python3 deck/build.py

# rebuild whenever sources change (refresh the browser yourself)
python3 deck/build.py --watch

# fail if index.html does not match sources
python3 deck/build.py --check
```

Open `deck/index.html` directly (`file://`) or serve the `deck/` folder. No package install is required.
