<script setup>
import { onMounted } from 'vue'
import './framework.css'
import './deck.css'
import { assemble } from './assemble.js'

const html = assemble(
  import.meta.glob('./slides/*.html', { eager: true, query: '?raw', import: 'default' }),
)

onMounted(() => import('./deck.js'))
</script>

<template>
  <div class="deck-shell">
    <div class="deck-stage" id="deck-stage" v-html="html" />
  </div>
  <nav class="deck-counter" role="navigation" aria-label="Deck navigation">
    <button type="button" id="deck-prev" aria-label="Previous slide">‹</button>
    <span class="deck-count"><span id="deck-cur">01</span> <span class="total">/ <span id="deck-total">01</span></span></span>
    <button type="button" id="deck-next" aria-label="Next slide">›</button>
  </nav>
  <div class="deck-hint">← / → · space</div>
</template>
