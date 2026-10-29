<script setup lang="ts">
/** Iconos de trazo para los botones de solo icono. Son decorativos: el botón que los contiene lleva el nombre accesible. */
defineProps<{ name: 'check' | 'x' | 'skip' | 'pause' | 'play' | 'undo' | 'volume' | 'mute' }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-if="name === 'check'" d="M5 12.5l4.5 4.5L19 7" />
    <path v-else-if="name === 'x'" d="M6 6l12 12M18 6L6 18" />
    <path v-else-if="name === 'skip'" d="M5 6l6.5 6L5 18M13 6l6.5 6-6.5 6" />
    <path v-else-if="name === 'pause'" d="M8.5 5.5v13M15.5 5.5v13" />
    <path v-else-if="name === 'play'" d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    <template v-else-if="name === 'volume'">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11" />
    </template>
    <template v-else-if="name === 'mute'">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </template>
    <template v-else-if="name === 'undo'">
      <path d="M9 5L4 10l5 5" />
      <path d="M4 10h9a6 6 0 010 12h-3" />
    </template>
  </svg>
</template>
