<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Fondo de nebulosas: ruido fractal con distorsión de dominio, dibujado en un shader de WebGL.
 * - Se renderiza a media resolución (es un degradado suave) y a unos 30 fotogramas por segundo.
 * - Se detiene con la pestaña oculta y, con «reducir movimiento», pinta un único fotograma.
 * - Si WebGL no está disponible queda el degradado CSS de `.nebula-bg`.
 */
const canvas = ref<HTMLCanvasElement | null>(null)

const SCALE = 0.5
const FRAME_MS = 1000 / 30
/** Velocidad de la deriva: cuanto menor, más lenta. */
const SPEED = 0.02

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.02 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime;
  // Deriva: las formas grandes avanzan en una dirección además de transformarse.
  p += t * vec2(1.1, 0.45);
  vec2 q = vec2(fbm(p * 1.5 + t), fbm(p * 1.5 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p * 1.5 + 3.0 * q + vec2(1.7, 9.2) + 0.8 * t),
                fbm(p * 1.5 + 3.0 * q + vec2(8.3, 2.8) - 0.6 * t));
  float f = fbm(p * 1.4 + 3.0 * r);

  vec3 col = vec3(0.027, 0.082, 0.200);                                   // plató
  col = mix(col, vec3(0.085, 0.230, 0.510), smoothstep(0.25, 0.85, f));   // azul
  col = mix(col, vec3(0.350, 0.170, 0.580), smoothstep(0.30, 1.00, length(q)) * f * 0.9); // violeta
  col = mix(col, vec3(0.040, 0.400, 0.500), smoothstep(0.45, 1.00, r.x) * 0.36);          // turquesa
  col += vec3(1.0, 0.78, 0.18) * pow(f, 5.0) * 0.10;                      // vetas doradas
  vec2 uv = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - 0.55 * dot(uv, uv);                                        // viñeta
  gl_FragColor = vec4(col, 1.0);
}
`

let frame = 0
let cleanup = () => {}

onMounted(() => {
  const el = canvas.value
  const gl = el?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
  if (!el || !gl) return

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
  }
  const vs = compile(gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT)
  if (!vs || !fs) return
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
  gl.useProgram(program)

  // Un triángulo que cubre toda la pantalla.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
  const uRes = gl.getUniformLocation(program, 'uRes')
  const uTime = gl.getUniformLocation(program, 'uTime')

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  // Cada carga empieza en un punto distinto de la deriva.
  let time = Math.random() * 100
  let last = performance.now()

  function resize() {
    el!.width = Math.max(1, Math.ceil(el!.clientWidth * SCALE))
    el!.height = Math.max(1, Math.ceil(el!.clientHeight * SCALE))
    gl!.viewport(0, 0, el!.width, el!.height)
  }
  function draw() {
    gl!.uniform2f(uRes, el!.width, el!.height)
    gl!.uniform1f(uTime, time)
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
  }
  function tick(now: number) {
    frame = requestAnimationFrame(tick)
    if (now - last < FRAME_MS) return
    time += ((now - last) / 1000) * SPEED
    last = now
    draw()
  }
  function start() {
    cancelAnimationFrame(frame)
    resize()
    draw()
    if (motion.matches || document.hidden) return
    last = performance.now()
    frame = requestAnimationFrame(tick)
  }

  const observer = new ResizeObserver(start)
  observer.observe(el)
  document.addEventListener('visibilitychange', start)
  motion.addEventListener('change', start)
  start()

  cleanup = () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    document.removeEventListener('visibilitychange', start)
    motion.removeEventListener('change', start)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
})

onBeforeUnmount(() => cleanup())
</script>

<template>
  <div class="nebula-bg" aria-hidden="true">
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
.nebula-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 20% 15%, color-mix(in srgb, #4a2678 60%, transparent), transparent 55%),
    radial-gradient(ellipse at 80% 80%, color-mix(in srgb, var(--stage-2) 90%, transparent), transparent 60%),
    var(--stage);
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
