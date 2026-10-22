<script setup lang="ts">
import { ref } from 'vue'
import { login, loginConfigured } from '../app/auth'

const user = ref('')
const password = ref('')
const remember = ref(false)
const error = ref('')
const busy = ref(false)
let failures = 0

async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  // Cada fallo seguido retrasa el siguiente intento (hasta 4 s) para frenar la fuerza bruta desde esta pantalla.
  if (failures) await new Promise((r) => setTimeout(r, Math.min(4000, 500 * 2 ** (failures - 1))))
  const ok = await login(user.value, password.value, remember.value)
  if (!ok) {
    failures++
    error.value = 'Usuario o contraseña incorrectos.'
    password.value = ''
  }
  busy.value = false
}
</script>

<template>
  <main class="login">
    <h1>Pasapalabra</h1>

    <form v-if="loginConfigured" @submit.prevent="submit">
      <label>
        Usuario
        <input v-model="user" autocomplete="username" autocapitalize="off" spellcheck="false" required autofocus />
      </label>
      <label>
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <label class="check">
        <input v-model="remember" type="checkbox" />
        Recordarme en este equipo
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="primary" type="submit" :disabled="busy">{{ busy ? 'Comprobando…' : 'Entrar' }}</button>
    </form>

    <section v-else class="setup">
      <h2>El acceso aún no está configurado</h2>
      <p>Define tu usuario y contraseña ejecutando este comando en la carpeta del proyecto:</p>
      <pre>npm run set-login</pre>
      <p>Después recarga esta página. Si ya lo has hecho y sigues viendo este mensaje, reinicia el servidor de desarrollo.</p>
    </section>
  </main>
</template>

<style scoped>
.login {
  min-height: 100dvh;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 24px;
  padding: 24px 16px;
}
h1 { margin: 0; font-size: clamp(2.4rem, 8vw, 4rem); font-weight: 800; font-stretch: 75%; color: var(--gold); }
form, .setup {
  width: min(100%, 380px);
  display: grid;
  gap: 14px;
  padding: 22px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--stage-2) 70%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--chalk) 14%, transparent);
}
label { display: grid; gap: 6px; }
label.check { display: flex; align-items: center; gap: 10px; }
.error { margin: 0; color: var(--bad); font-weight: 600; }
.setup h2 { margin: 0; font-size: 1.2rem; }
.setup p { margin: 0; }
pre { margin: 0; padding: 12px 14px; border-radius: 10px; background: color-mix(in srgb, var(--stage) 60%, #000); overflow-x: auto; }
</style>
