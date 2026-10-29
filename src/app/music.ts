import { watch } from 'vue'
import { settings } from './settings'

/**
 * Música de la aplicación, generada con Web Audio (sin ficheros de audio). Tiene dos capas que se funden entre sí:
 * - «ambient»: pedal grave y acordes menores de teclado con notas largas. Es el fondo de toda la aplicación.
 * - «tension»: pulso grave, latido, arpegios y un tono que sube. Suena mientras corre el reloj del turno y
 *   se acelera y se abre a medida que se agota el tiempo (`setTension`, de 0 a 1).
 */
export type MusicMode = 'off' | 'ambient' | 'tension'

/** Acordes (notas MIDI) en bucle: La menor, Fa mayor 7, Si disminuido y Mi con novena menor, que no resuelve. */
const PROGRESSION = [
  [57, 60, 64],
  [53, 57, 60, 64],
  [59, 62, 65],
  [52, 56, 59, 62],
]
const DRONE = 33 // La1
const CHORD_SEC = 5.5
/** Bajo del pulso, en corcheas y dos compases: La frigio, con la segunda menor (Si bemol) que inquieta. */
const BASS = [33, 33, 45, 33, 34, 33, 45, 31, 33, 33, 45, 33, 34, 33, 36, 34]
/** Ganancia con el volumen al 100 %: el volumen de los ajustes (0 a 1) la escala. */
const MAX_GAIN = 0.12
/** Pulsos por minuto al empezar el turno y al quedarse sin tiempo. */
/** El fondo suena bien al 35 % y el tiempo de juego debe sonar como si estuviera al 50 %: misma curva cuadrática del volumen. */
const TENSION_BOOST = (0.5 / 0.35) ** 2
/** Volumen de los efectos respecto al de la música (la música va a 1). */
const SFX_GAIN = 6
const BPM_CALM = 92
const BPM_PANIC = 136

let ctx: AudioContext | null = null
let mode: MusicMode = 'off'
let tension = 0

interface Graph {
  c: AudioContext
  level: GainNode
  /** Entrada de los efectos de sonido (aplausos y reacción del público), con la misma reverberación. */
  sfx: GainNode
  /** Ruido blanco continuo para los efectos. */
  white: AudioBuffer
  ambient: GainNode
  tension: GainNode
  sweep: BiquadFilterNode
  tone: BiquadFilterNode
  riser: OscillatorNode
  riserGain: GainNode
  hats: AudioBuffer
}
let graph: Graph | null = null
let ambientTimer = 0
let tensionTimer = 0

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function getContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

/** Los navegadores solo dejan sonar tras un gesto del usuario: se prepara el audio en la primera interacción. */
function unlock() {
  const c = getContext()
  if (c && c.state === 'suspended') void c.resume()
}
if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, unlock, { passive: true })
}

/** Ganancia real según el volumen y el silencio elegidos; la curva cuadrática se acerca más a cómo oímos. */
function targetGain() {
  return settings.musicMuted ? 0 : settings.musicVolume ** 2 * MAX_GAIN
}
watch(
  () => [settings.musicVolume, settings.musicMuted],
  () => graph?.level.gain.setTargetAtTime(targetGain(), graph.c.currentTime, 0.05),
)

/** Ruido que decae: sirve de reverberación (respuesta al impulso) y, corto, de platillo. */
function noise(c: AudioContext, seconds: number, curve: number) {
  const length = Math.floor(c.sampleRate * seconds)
  const buffer = c.createBuffer(2, length, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** curve
  }
  return buffer
}

function buildGraph(c: AudioContext): Graph {
  // Salida común: un poco de reverberación para las dos capas, y el volumen del usuario al final.
  const level = c.createGain()
  level.gain.value = targetGain()
  level.connect(c.destination)
  const bus = c.createGain()
  const reverb = c.createConvolver()
  reverb.buffer = noise(c, 3.5, 2.5)
  const wet = c.createGain()
  wet.gain.value = 0.5
  const dry = c.createGain()
  dry.gain.value = 0.75
  bus.connect(dry).connect(level)
  bus.connect(reverb).connect(wet).connect(level)

  const sfx = c.createGain()
  sfx.gain.value = SFX_GAIN
  sfx.connect(bus)

  // Capa ambiental: un filtro que respira muy despacio da movimiento sin que se note un ritmo.
  const ambient = c.createGain()
  ambient.gain.value = 0
  ambient.connect(bus)
  const sweep = c.createBiquadFilter()
  sweep.type = 'lowpass'
  sweep.frequency.value = 1800
  sweep.connect(ambient)
  const lfo = c.createOscillator()
  const lfoDepth = c.createGain()
  lfo.frequency.value = 0.07
  lfoDepth.gain.value = 700
  lfo.connect(lfoDepth).connect(sweep.frequency)
  lfo.start()
  const drone = c.createOscillator()
  const droneGain = c.createGain()
  drone.type = 'sine'
  drone.frequency.value = hz(DRONE)
  droneGain.gain.value = 0.55
  drone.connect(droneGain).connect(sweep)
  drone.start()

  // Capa de tensión: su filtro se abre con la tensión y un tono sostenido sube de altura.
  const tensionLayer = c.createGain()
  tensionLayer.gain.value = 0
  tensionLayer.connect(bus)
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 900
  tone.connect(tensionLayer)
  const riser = c.createOscillator()
  const riserFilter = c.createBiquadFilter()
  const riserGain = c.createGain()
  riser.type = 'sawtooth'
  riser.frequency.value = 110
  riserFilter.type = 'lowpass'
  riserFilter.frequency.value = 1100
  riserGain.gain.value = 0
  riser.connect(riserFilter).connect(riserGain).connect(tensionLayer)
  riser.start()

  return { c, level, sfx, white: noise(c, 0.5, 0), ambient, tension: tensionLayer, sweep, tone, riser, riserGain, hats: noise(c, 0.06, 4) }
}

/** Una nota de teclado: dos osciladores ligeramente desafinados con ataque y cierre lentos. */
function playNote(g: Graph, midi: number, at: number, length: number, peak: number) {
  const c = g.c
  const env = c.createGain()
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(peak, at + 1.4)
  env.gain.setValueAtTime(peak, at + length - 2)
  env.gain.linearRampToValueAtTime(0, at + length)
  env.connect(g.sweep)
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1400
  tone.connect(env)
  for (const [type, detune] of [['triangle', -5], ['sawtooth', 6]] as const) {
    const osc = c.createOscillator()
    const level = c.createGain()
    level.gain.value = type === 'sawtooth' ? 0.35 : 1
    osc.type = type
    osc.frequency.value = hz(midi)
    osc.detune.value = detune
    osc.connect(level).connect(tone)
    osc.start(at)
    osc.stop(at + length + 0.05)
  }
}

/* ---------- capa ambiental ---------- */

function runAmbient(g: Graph) {
  let chord = 0
  let nextAt = g.c.currentTime + 0.1
  const schedule = () => {
    // Se programan los acordes con unos segundos de antelación para que nunca haya silencio.
    while (nextAt < g.c.currentTime + CHORD_SEC) {
      for (const [i, midi] of PROGRESSION[chord % PROGRESSION.length]!.entries()) {
        playNote(g, midi, nextAt + i * 0.35, CHORD_SEC + 2.5, 0.22)
      }
      nextAt += CHORD_SEC
      chord++
    }
    ambientTimer = window.setTimeout(schedule, 1000)
  }
  schedule()
}

/* ---------- capa de tensión ---------- */

/** Golpe corto y sordo con caída de tono: el latido. */
function kick(g: Graph, at: number, peak: number) {
  const osc = g.c.createOscillator()
  const env = g.c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(120, at)
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.14)
  env.gain.setValueAtTime(peak, at)
  env.gain.exponentialRampToValueAtTime(0.001, at + 0.28)
  osc.connect(env).connect(g.tension)
  osc.start(at)
  osc.stop(at + 0.3)
}

/** Nota corta y seca: el bajo del pulso y las notas del arpegio. */
function pluck(g: Graph, midi: number, at: number, length: number, peak: number, type: OscillatorType, out: AudioNode) {
  const osc = g.c.createOscillator()
  const env = g.c.createGain()
  osc.type = type
  osc.frequency.value = hz(midi)
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(peak, at + 0.012)
  env.gain.exponentialRampToValueAtTime(0.001, at + length)
  osc.connect(env).connect(out)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

/** Chasquido de ruido agudo, como el segundero de un reloj. */
function tick(g: Graph, at: number, peak: number) {
  const src = g.c.createBufferSource()
  const hp = g.c.createBiquadFilter()
  const env = g.c.createGain()
  src.buffer = g.hats
  hp.type = 'highpass'
  hp.frequency.value = 6500
  env.gain.value = peak
  src.connect(hp).connect(env).connect(g.tension)
  src.start(at)
}

/**
 * Una corchea de la capa de tensión. Con poca tensión solo hay bajo y latido; después entra el arpegio
 * y, al final, el segundero en cada pulso.
 */
function playStep(g: Graph, step: number, at: number, len: number, t: number) {
  const bassFilter = g.tone
  pluck(g, BASS[step % BASS.length]!, at, len * 0.95, step % 4 === 0 ? 0.5 : 0.36, 'sawtooth', bassFilter)
  if (step % 4 === 0 || (t > 0.6 && step % 16 === 10)) kick(g, at, 0.55 + 0.4 * t)
  if (t > 0.3) {
    const chord = PROGRESSION[Math.floor(step / 16) % PROGRESSION.length]!
    const midi = chord[step % chord.length]! + (step % 2 ? 24 : 12)
    pluck(g, midi, at, len * 1.6, 0.05 + 0.16 * t, 'triangle', bassFilter)
  }
  if ((t > 0.55 && step % 2 === 1) || t > 0.85) tick(g, at, 0.05 + 0.1 * t)
}

function runTension(g: Graph) {
  let step = 0
  let nextAt = g.c.currentTime + 0.05
  const schedule = () => {
    // El pulso se programa de poco en poco para que el cambio de tempo y de tensión se note enseguida.
    while (nextAt < g.c.currentTime + 0.25) {
      const len = 60 / (BPM_CALM + (BPM_PANIC - BPM_CALM) * tension) / 2
      playStep(g, step, nextAt, len, tension)
      nextAt += len
      step++
    }
    tensionTimer = window.setTimeout(schedule, 50)
  }
  schedule()
}

/* ---------- control ---------- */

function applyTension(g: Graph) {
  const t = g.c.currentTime
  g.tone.frequency.setTargetAtTime(700 + 4300 * tension, t, 0.3)
  g.riserGain.gain.setTargetAtTime(mode === 'tension' ? 0.03 + 0.1 * tension * tension : 0, t, 0.4)
}

function ensureGraph(): Graph | null {
  const c = getContext()
  if (!c) return null
  return (graph ??= buildGraph(c))
}

/** Pasa a otra capa con un fundido cruzado; los temporizadores de la capa que se apaga se paran al terminar. */
function apply() {
  const g = ensureGraph()
  if (!g) return
  const c = g.c
  const now = c.currentTime
  g.ambient.gain.setTargetAtTime(mode === 'ambient' ? 1 : 0, now, mode === 'ambient' ? 0.6 : 0.4)
  g.tension.gain.setTargetAtTime(mode === 'tension' ? 0.9 * TENSION_BOOST : 0, now, mode === 'tension' ? 0.25 : 0.5)
  applyTension(g)

  if (mode === 'ambient' && !ambientTimer) runAmbient(g)
  if (mode === 'tension' && !tensionTimer) runTension(g)
  const wanted = mode
  window.setTimeout(() => {
    if (mode === wanted) {
      if (wanted !== 'ambient') { window.clearTimeout(ambientTimer); ambientTimer = 0 }
      if (wanted !== 'tension') { window.clearTimeout(tensionTimer); tensionTimer = 0 }
    }
  }, 2500)
}

/** Cambia la capa que suena. Con `off` se apagan las dos con un cierre suave. */
export function setMusicMode(next: MusicMode) {
  if (next === mode) return
  mode = next
  if (next === 'off' && !graph) return
  apply()
}

/** Tensión de 0 (empieza el turno) a 1 (se acaba el tiempo): sube el tempo, abre el sonido y añade capas. */
export function setTension(value: number) {
  tension = clamp01(value)
  if (graph) applyTension(graph)
}

/* ---------- efectos de sonido ---------- */

export type Sfx = 'applause' | 'groan'

/**
 * Aplauso de sala: muchas palmadas sueltas de ruido (cada una con su resonancia de mano y su golpe agudo, a una distancia
 * y un lado distintos) sobre un murmullo continuo de ruido filtrado. Crece rápido, se mantiene un momento y se apaga.
 */
function applause(g: Graph, at: number) {
  const c = g.c
  const length = 2
  // Murmullo de fondo: la suma de las palmadas lejanas.
  const bed = c.createBufferSource()
  const bedBand = c.createBiquadFilter()
  const bedEnv = c.createGain()
  bed.buffer = g.white
  bed.loop = true
  bedBand.type = 'bandpass'
  bedBand.frequency.value = 2600
  bedBand.Q.value = 0.45
  bedEnv.gain.setValueAtTime(0, at)
  bedEnv.gain.linearRampToValueAtTime(0.16, at + 0.35)
  bedEnv.gain.setValueAtTime(0.16, at + 0.9)
  bedEnv.gain.linearRampToValueAtTime(0, at + length)
  bed.connect(bedBand).connect(bedEnv).connect(g.sfx)
  bed.start(at)
  bed.stop(at + length + 0.05)

  // Palmadas sueltas: más densas al principio y a mitad del aplauso, y escasas al final.
  const shape = (x: number) => Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 0.8 * (1 - x * 0.35)
  let placed = 0
  while (placed < 190) {
    const x = Math.random()
    if (Math.random() > shape(x)) continue
    placed++
    const when = at + x * (length - 0.15)
    const near = Math.random() ** 2
    const peak = 0.12 + 0.7 * near
    const pan = c.createStereoPanner()
    pan.pan.value = Math.random() * 2 - 1
    pan.connect(g.sfx)
    for (const [freq, q, level, decay] of [
      [800 + Math.random() * 1400, 1.6, 1, 0.03 + Math.random() * 0.035],
      [3200 + Math.random() * 2400, 1.1, 0.45, 0.012 + Math.random() * 0.015],
    ] as const) {
      const src = c.createBufferSource()
      const band = c.createBiquadFilter()
      const env = c.createGain()
      src.buffer = g.white
      band.type = 'bandpass'
      band.frequency.value = freq
      band.Q.value = q
      env.gain.setValueAtTime(peak * level, when)
      env.gain.exponentialRampToValueAtTime(0.001, when + decay)
      src.connect(band).connect(env).connect(pan)
      src.start(when, Math.random() * 0.3)
      src.stop(when + decay + 0.02)
    }
  }
}

/** «Ooohh» de público: varias voces graves y desafinadas con vocal «o» que bajan de tono y se desvanecen. */
function groan(g: Graph, at: number) {
  const c = g.c
  const length = 1.5
  for (let i = 0; i < 7; i++) {
    const start = at + Math.random() * 0.12
    const f0 = 150 + Math.random() * 130
    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(f0, start)
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.7, start + length)
    env.gain.setValueAtTime(0, start)
    env.gain.linearRampToValueAtTime(0.1, start + 0.28)
    env.gain.exponentialRampToValueAtTime(0.001, start + length)
    // Los formantes de la «o»: dos resonancias, una en torno a 500 Hz y otra a 850 Hz.
    for (const [freq, gain] of [[500, 1], [850, 0.45]] as const) {
      const formant = c.createBiquadFilter()
      const level = c.createGain()
      formant.type = 'bandpass'
      formant.frequency.value = freq
      formant.Q.value = 5
      level.gain.value = gain
      osc.connect(formant).connect(level).connect(env)
    }
    env.connect(g.sfx)
    osc.start(start)
    osc.stop(start + length + 0.05)
  }
}

/** Reproduce un efecto, que sigue el volumen y el silencio de la música. No suena si los efectos están desactivados. */
export function playSfx(kind: Sfx) {
  if (!settings.effects) return
  const g = ensureGraph()
  if (!g) return
  if (g.c.state === 'suspended') void g.c.resume()
  const at = g.c.currentTime + 0.02
  if (kind === 'applause') applause(g, at)
  else groan(g, at)
}
