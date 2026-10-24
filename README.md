# Pasapalabra

Juego del rosco de Pasapalabra para navegador, pensado para jugar en familia en un mismo dispositivo. Sin backend: todo se ejecuta en el navegador y los datos se guardan en él.

## Características

- Rosco de 25 letras con palabras de cuatro perfiles más un fondo común. El perfil de cada jugador sale de su fecha de nacimiento, con la edad que tenga el día de la partida: niños (0–13), adolescentes (14–22), jóvenes (23–38) y adultos (39 en adelante). Cada jugador usa su propio perfil, así que pueden jugar a la vez un niño y un adulto. Los jugadores creados antes de pedir la fecha conservan su perfil hasta que se les indique.
- El perfil de jóvenes tiene 1000 palabras propias (40 por letra). Si en alguna letra tuviera menos de 5 propias, esa letra se completa con las de adultos.
- Cada rosco lleva siempre un 25 % de argot y cultura pop (6 de 25).
- Contador de uso por palabra: al terminar una partida se suma un uso a cada palabra que llegó a mostrarse (con el reloj en marcha). Al generar roscos se priorizan las menos usadas, de modo que el banco rota antes de repetir. El contador vive en el navegador (IndexedDB), no en los JSON del banco, así que cada navegador y cada dirección llevan su propia cuenta.
- De 1 a 4 jugadores por turnos, cada uno con su reloj. Acertar mantiene el turno; fallar o pasar lo cede.
- Pausa de preparación al empezar cada turno: el reloj no corre y no se ve la definición hasta pulsar Empezar.
- Foto del jugador dentro del aro durante su turno, o la cámara en directo (opcional).
- Jugadores, partidas y estadísticas guardados en el navegador (IndexedDB): partidas, victorias, precisión y acierto por letra.
- Deshacer el último veredicto.

## Modos de respuesta

- **Manual** (por defecto): se responde en voz alta y alguien valida.
- **Escribiendo**: el jugador teclea la palabra y el juego la comprueba, ignorando tildes y mayúsculas y tolerando erratas en palabras largas.

### Atajos de teclado (modo manual)

| Tecla | Acción |
|---|---|
| Mayús izquierda | Incorrecto |
| Mayús derecha | Correcto |
| Espacio | Pasapalabra |
| Intro (mantenida) | Ver la solución |
| Retroceso | Deshacer |

En la pausa de preparación, Intro o Espacio empiezan el turno.

## Desarrollo

Requiere Node.js.

```bash
npm install
npm run dev            # servidor de desarrollo en http://localhost:5173
npm test               # tests (Vitest)
npm run build          # genera dist/
npm run validate-bank  # valida el banco de palabras
```

## Publicar en GitHub Pages

Cada push a `main` ejecuta `.github/workflows/deploy.yml`, que pasa los tests, construye la web y la publica en `https://tamplix.github.io/pasapalabra/`.

Configuración única, en GitHub (*Settings* del repositorio): *Pages → Build and deployment → Source*: **GitHub Actions**.

El build usa `BASE_PATH=/pasapalabra/`; en local no hace falta, porque por defecto es `/`.

## Ejecutarlo en otro equipo

`npm run build` genera `dist/`, una web estática. No funciona abriendo `index.html` con doble clic: hay que servirla por HTTP (por ejemplo `npx serve dist`) o alojarla en un servicio de hosting estático. La cámara solo funciona con HTTPS o en `localhost`.

## Estructura

```
src/core/      motor del juego en TypeScript puro: generador de roscos, reductor de turnos, comprobación de respuestas
src/data/      banco de palabras (JSON por perfil) y validación
src/storage/   persistencia (IndexedDB), estadísticas
src/app/       estado de la aplicación y ajustes
src/views/     pantallas
src/components/ aro, avatar y medios del jugador
scripts/       migración y validación del banco de palabras
```

El motor es un reductor puro (`reduce(estado, acción)`) con acciones serializables y reloj basado en marcas de tiempo, de modo que se pueda reutilizar en un modo online.

## Banco de palabras

`src/data/words/{all,kids,teens,young,adults}.json`. Cada entrada tiene letra, posición (`starts_with` o `contains`), palabra, definición, perfil y si es argot/cultura pop. `npm run add-words -- <ruta.md> [--dry]` añade palabras nuevas desde una tabla markdown: asigna ids nuevos, omite (y lista) las que ya existen y valida el resultado; con `--dry` solo simula. `npm run validate-bank` comprueba el esquema, las posiciones de letra, los duplicados y la cobertura de las 25 letras por perfil.
