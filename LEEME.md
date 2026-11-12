# UCB Events · prototipo

Aplicación web (también instalable como app) con los eventos de la UCB y rutas dentro del campus.

## Abrir
- El fondo del mapa usa **OpenFreeMap** (datos de OpenStreetMap, gratis y sin clave). El servidor oficial de OpenStreetMap bloqueaba la app con "Access blocked / 403".
- Funciona con Live Server, con GitHub Pages o con doble clic, siempre que haya internet. Sin internet, la vista **Plano UCB** y las rutas siguen funcionando.

## Ubicación
- **Página web:** la persona elige "¿Dónde estás?" y "¿A dónde vas?" en las listas, tocando el mapa ("Estoy aquí" / "Voy aquí") o el plano. El GPS es opcional (botón).
- **App instalada:** usa el GPS automáticamente como punto de partida, sigue a la persona y recalcula la ruta cuando avanza más de 20 m. Si el GPS falla o la persona está fuera del campus, se elige a mano.

## Accesos de demostración
- Organizador: `organizador` / `ucb2026` (gestiona los eventos de "Mecacentro UCB"; los nuevos quedan pendientes)
- Administrador: `admin` / `ucb2026` (aprueba eventos y marca caminos fuera de servicio)
- Estudiante: menú ☰ → "Soy estudiante" (nombre y código)

## Estructura
| Archivo | Qué es |
|---|---|
| `index.html`, `styles.css` | Pantallas y diseño (basados en la versión del equipo) |
| `app.js` | Lógica: eventos, menú, mapa, rutas, horario, avisos, asistencia QR, administración |
| `datos.js` | **Campus:** puntos, caminos, baños y eventos de ejemplo. Es lo único que hay que editar |
| `ruteo.js` | Dijkstra (minimiza distancia), modo sin gradas, bajo techo, baño más cercano |
| `horario.js` | Lectura de horarios `.ics` (Google Calendar) y reconocimiento de aulas |
| `plano-campus.png` | Plano oficial (vista "Plano UCB") |
| `lib/`, `qrcode.js` | Leaflet y MapLibre (mapa) y generador de QR, incluidos en la carpeta |

## Datos del campus
- Puntos y distancias tomados de las rutas medidas en **Footpath** (sobre OpenStreetMap). Las rutas de la app coinciden con Footpath: Entrada→Coliseo 165 m, Entrada→Ágora 140 m, Entrada→Bloque D 104 m, Entrada→Bloque C 159 m, Entrada→Biblioteca 91 m, Bloque D→Coliseo 113 m, Ágora→F 36 m.
- Posición GPS anclada al centro del campus (-16.5227, -68.1118). Para afinarla, en `datos.js` cambiar `ANCLA` por la coordenada real de la Entrada (px 178, py 1043).
- **Por confirmar en el campus:** baños, gradas (por ahora solo dentro de los bloques), ascensores y pisos.
