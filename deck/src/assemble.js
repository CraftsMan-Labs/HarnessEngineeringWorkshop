export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function slugToLabel(stem) {
  const parts = stem.split('-')
  if (parts.length < 2 || !/^\d+$/.test(parts[0])) {
    throw new Error(`slide filename must be NN-slug.html, got ${stem}`)
  }
  const words = parts.slice(1).filter(Boolean).map((word) =>
    /\d/.test(word) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1),
  )
  return `${parts[0]} ${words.join(' ')}`
}

export function prepareSlide(html, stem, index, total) {
  let out = html.replace(/\s*data-screen-label="[^"]*"/g, '')
  const open = out.match(/<section\s+class="([^"]*)"/i)
  if (!open) throw new Error(`${stem}: <section> must have a class attribute`)
  const classes = open[1].replace(/\bactive\b/g, ' ').replace(/\s+/g, ' ').trim()
  if (!classes.split(/\s+/).includes('slide')) {
    throw new Error(`${stem}: section class must include 'slide'`)
  }
  const active = index === 1 ? ' active' : ''
  out = out.replace(
    /<section\s+class="[^"]*"/i,
    `<section class="${classes}${active}" data-screen-label="${slugToLabel(stem)}"`,
  )
  const footers = out.match(/\{\{N\}\}\s*\/\s*\{\{TOTAL\}\}/g) || []
  if (footers.length !== 1) {
    throw new Error(`${stem}: footer must contain exactly one '{{N}} / {{TOTAL}}'`)
  }
  return out.replace(/\{\{N\}\}\s*\/\s*\{\{TOTAL\}\}/, `${pad2(index)} / ${pad2(total)}`)
}

export function assemble(modules) {
  const files = Object.keys(modules).sort()
  if (!files.length) throw new Error('no slide fragments')
  return files
    .map((path, i) => {
      const stem = path.split('/').pop().replace(/\.html$/, '')
      return prepareSlide(modules[path], stem, i + 1, files.length)
    })
    .join('\n')
}

export function selfCheck() {
  const html = '<section class="slide s-dark"><footer>{{N}} / {{TOTAL}}</footer></section>'
  const out = prepareSlide(html, '01-cover', 1, 12)
  if (!out.includes('data-screen-label="01 Cover"')) throw new Error('label')
  if (!out.includes('01 / 12')) throw new Error('footer')
  if (!/\bactive\b/.test(out)) throw new Error('active')
}
