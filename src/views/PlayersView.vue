<script setup lang="ts">
import { computed, ref } from 'vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import { deletePlayer, players, savePlayer } from '../app/store'
import { resizeToDataUrl } from '../app/image'
import { colorFromSeed, randomColor } from '../app/color'
import { isValidBirthDate, MIN_BIRTH_DATE, playerSummary, todayIso } from '../app/age'
import type { PlayerProfile } from '../storage/types'

const today = todayIso()
const newName = ref('')
const newBirth = ref('')
const error = ref('')

const newSummary = computed(() => (isValidBirthDate(newBirth.value) ? playerSummary({ birthDate: newBirth.value }) : ''))
const canAdd = computed(() => newName.value.trim() !== '' && isValidBirthDate(newBirth.value))

async function add() {
  const name = newName.value.trim()
  if (!name || !isValidBirthDate(newBirth.value)) return
  await savePlayer({ id: crypto.randomUUID(), name, birthDate: newBirth.value, color: randomColor(), createdAt: Date.now() })
  newName.value = ''
  newBirth.value = ''
}

/** Cambia la fecha de nacimiento; si no es válida, deja la anterior y avisa. */
async function changeBirth(p: PlayerProfile, e: Event) {
  const input = e.target as HTMLInputElement
  error.value = ''
  if (!isValidBirthDate(input.value)) {
    input.value = p.birthDate ?? ''
    error.value = 'La fecha de nacimiento no es válida: debe ser una fecha pasada, de 1900 en adelante.'
    return
  }
  await update(p, { birthDate: input.value })
}

async function update(p: PlayerProfile, patch: Partial<PlayerProfile>) {
  await savePlayer({ ...p, ...patch })
}

async function pickPhoto(p: PlayerProfile, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  try {
    await update(p, { avatar: await resizeToDataUrl(file, 1024) })
  } catch {
    error.value = 'No se pudo leer esa imagen. Prueba con un archivo JPG o PNG.'
  }
}

async function remove(p: PlayerProfile) {
  if (confirm(`¿Eliminar a ${p.name}? Sus partidas guardadas se conservan.`)) await deletePlayer(p.id)
}
</script>

<template>
  <div class="wrap">
    <h1>Jugadores</h1>

    <form class="new" @submit.prevent="add">
      <label>
        Nombre
        <input v-model="newName" placeholder="Nombre del jugador" required />
      </label>
      <label>
        Fecha de nacimiento
        <input v-model="newBirth" type="date" :min="MIN_BIRTH_DATE" :max="today" required />
      </label>
      <button class="primary" type="submit" :disabled="!canAdd">Añadir jugador</button>
      <p v-if="newSummary" class="hint">Palabras para: {{ newSummary }}</p>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <ul class="list">
      <li v-for="p in players" :key="p.id" class="card">
        <div class="top">
          <PlayerAvatar :name="p.name" :image="p.avatar" :color="p.color" :seed="p.id" :size="64" />
          <input :value="p.name" aria-label="Nombre" @change="update(p, { name: ($event.target as HTMLInputElement).value.trim() || p.name })" />
        </div>
        <label>
          Fecha de nacimiento
          <input type="date" :value="p.birthDate ?? ''" :min="MIN_BIRTH_DATE" :max="today" @change="changeBirth(p, $event)" />
        </label>
        <p class="hint" :class="{ warn: !p.birthDate }">
          {{ playerSummary(p) }}<template v-if="!p.birthDate">. Indica su fecha de nacimiento para ajustar las palabras.</template>
        </p>
        <div class="color-row">
          <label class="color">
            Color de fondo
            <input
              type="color"
              :value="p.color ?? colorFromSeed(p.id)"
              @change="update(p, { color: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <button class="link" type="button" @click="update(p, { color: randomColor() })">Al azar</button>
        </div>
        <div class="images">
          <label class="file">
            {{ p.avatar ? 'Cambiar foto' : 'Añadir foto' }}
            <input type="file" accept="image/*" @change="pickPhoto(p, $event)" />
          </label>
          <button v-if="p.avatar" class="link" @click="update(p, { avatar: undefined })">Quitar foto</button>
        </div>
        <button class="link danger" @click="remove(p)">Eliminar jugador</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.wrap { max-width: 900px; margin: 0 auto; display: grid; gap: 24px; }
h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); margin: 0; font-weight: 800; font-stretch: 80%; }
.new { display: flex; flex-wrap: wrap; gap: 14px; align-items: end; }
label { display: grid; gap: 6px; }
.list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--stage-2) 70%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--chalk) 14%, transparent);
}
.top { display: flex; align-items: center; gap: 12px; }
.top input { flex: 1; min-width: 0; font-weight: 700; }
.images { display: flex; gap: 10px; flex-wrap: wrap; }
.file {
  position: relative;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1.5px dashed var(--gold);
  cursor: pointer;
}
.file:focus-within { outline: 3px solid var(--gold); outline-offset: 2px; }
.file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.danger { color: var(--bad); }
.error { color: var(--bad); margin: 0; }
.color-row { display: flex; align-items: center; gap: 14px; }
.color { display: flex; align-items: center; gap: 10px; }
.color input[type='color'] { width: 56px; height: 38px; padding: 2px; border-radius: 10px; cursor: pointer; }
.hint { margin: 0; color: var(--muted); font-size: 0.95rem; }
.hint.warn { color: var(--gold); }
.new .hint { flex-basis: 100%; }
</style>
