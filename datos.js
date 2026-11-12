// =====================================================================
// DATOS DEL CAMPUS UCB LA PAZ  —  único archivo que hay que editar.
//
// Fuente: rutas medidas por el equipo en Footpath (sobre OpenStreetMap),
// captura general orientada al norte. Las distancias "metros" son las de
// Footpath; donde no hubo medición se estimaron con la escala de la captura.
// La posición GPS está anclada al centro del campus (-16.5227, -68.1118);
// para afinarla, reemplazar ANCLA con la coordenada real de un punto.
// =====================================================================

window.MAPA = { fondo: "openfreemap", estilo: "positron", carto_key: "" };

// Ancla: un píxel de la captura de Footpath (norte arriba) y su coordenada real.
const ANCLA = { px: 390, py: 860, lat: -16.5227, lng: -68.1118 };
const M_POR_PX = 0.25; // escala de la captura, calibrada con las distancias de Footpath

// fp(x, y): posición en la captura de Footpath → coordenadas reales
// plano: posición aproximada sobre plano-campus.png (vista "Plano UCB")
function fp(x, y, plano) {
  const dx = (x - ANCLA.px) * M_POR_PX, dy = -(y - ANCLA.py) * M_POR_PX;
  return {
    lat: ANCLA.lat + dy / 111320,
    lng: ANCLA.lng + dx / (111320 * Math.cos(ANCLA.lat * Math.PI / 180)),
    plano,
  };
}

window.DATOS = {
  // tipo: entrada | punto | bloque | aula | sala | servicio | bano
  nodos: [
    { id: "entrada",      nombre: "Entrada principal (Av. 14 de Septiembre)", tipo: "entrada", piso: 0, altura_m: 0,  ...fp(178, 1043, [175, 440]), alias: ["Entrada", "Atrio", "Ingreso"] },
    { id: "rampa-entrada",nombre: "Rampa de la entrada",           tipo: "punto",   piso: 0, altura_m: 1.5,  ...fp(236, 1005, [200, 405]) },
    { id: "maiamicito",   nombre: "Maiamicito",                    tipo: "servicio",piso: 0, altura_m: 1,  ...fp(302, 1051, [300, 400]), alias: ["Maiamicito"] },
    { id: "rampa-cafe",   nombre: "Rampa Cafetería",               tipo: "punto",   piso: 0, altura_m: 4,  ...fp(397, 929,  [330, 262]), alias: ["Cafetería", "Cafe"] },
    { id: "rampa-epc",    nombre: "Rampa EPC",                     tipo: "punto",   piso: 0, altura_m: 4,  ...fp(391, 910,  [300, 285]) },
    { id: "rampa-fin-epc",nombre: "Rampa EPC (fin)",               tipo: "punto",   piso: 0, altura_m: 4,  ...fp(368, 916,  [280, 300]) },
    { id: "epc",          nombre: "Bloque C · EPC (Escuela de la Producción)", tipo: "bloque", bloque: "EPC", piso: 0, altura_m: 4, ...fp(283, 903, [215, 300]), alias: ["EPC", "Escuela de la Producción"] },
    { id: "rampa-c-sup",  nombre: "Rampa C (arriba)",              tipo: "punto",   piso: 0, altura_m: 4,  ...fp(265, 905,  [180, 318]) },
    { id: "rampa-c-inf",  nombre: "Rampa C (abajo)",               tipo: "punto",   piso: 0, altura_m: 3.5,  ...fp(248, 908,  [165, 330]) },
    { id: "rampa-fin-d",  nombre: "Rampa D (fin)",                 tipo: "punto",   piso: 0, altura_m: 3,  ...fp(255, 888,  [140, 320]) },
    { id: "rampa-d",      nombre: "Rampa D",                       tipo: "punto",   piso: 0, altura_m: 2.5,  ...fp(206, 893,  [115, 330]) },
    { id: "D-P0",         nombre: "Bloque D (planta baja)",        tipo: "bloque",  bloque: "D", piso: 0, altura_m: 4,  ...fp(190, 812, [88, 235]),  alias: ["Bloque D"] },
    { id: "D-P5",         nombre: "Paraninfo (Bloque D, piso 5)",  tipo: "sala",    bloque: "D", piso: 5, altura_m: 19, ...fp(196, 828, [92, 231]),  alias: ["Paraninfo"] },
    { id: "rampa-agora",  nombre: "Rampa Ágora",                   tipo: "punto",   piso: 0, altura_m: 6,  ...fp(323, 716,  [175, 175]) },
    { id: "cruce",        nombre: "Cruce central (Ágora – F)",     tipo: "punto",   piso: 0, altura_m: 6,  ...fp(565, 842,  [330, 175]) },
    { id: "agora",        nombre: "Ágora",                         tipo: "punto",   piso: 0, altura_m: 7,  ...fp(496, 799,  [220, 160]), alias: ["Ágora", "Agora"] },
    { id: "F",            nombre: "Bloque F",                      tipo: "bloque",  bloque: "F", piso: 0, altura_m: 6,  ...fp(612, 880, [412, 128]), alias: ["Bloque F"] },
    { id: "biblioteca",   nombre: "Biblioteca (Bloque I)",         tipo: "servicio",bloque: "I", piso: 0, altura_m: 3,  ...fp(541, 989, [458, 262]), alias: ["Biblioteca", "Bloque I"] },
    { id: "C-P0",         nombre: "Bloque C (planta baja)",        tipo: "bloque",  bloque: "C", piso: 0, altura_m: 8.5,  ...fp(493, 716, [388, 48]),  alias: ["Bloque C"] },
    { id: "C-P2",         nombre: "Aula C-201 (Bloque C, piso 2)", tipo: "aula",    bloque: "C", piso: 2, altura_m: 14.5, ...fp(504, 721, [392, 52]),  alias: ["C-201", "C201"] },
    { id: "coliseo",      nombre: "Coliseo (Bloque A)",            tipo: "sala",    bloque: "A", piso: 0, altura_m: 10, ...fp(515, 672, [170, 95]),  alias: ["Coliseo", "Bloque A"] },
    // Baños: UBICACIÓN POR CONFIRMAR en el campus
    { id: "bano-cafe",    nombre: "Baños Cafetería (por confirmar)", tipo: "bano", piso: 0, altura_m: 4,  accesible: true,  ...fp(420, 935, [352, 228]) },
    { id: "bano-coliseo", nombre: "Baños Coliseo (por confirmar)",   tipo: "bano", piso: 0, altura_m: 10, accesible: false, ...fp(535, 690, [196, 118]) },
  ],

  // Caminos (doble sentido). metros = medición de Footpath (o estimación, marcada "est.")
  aristas: [
    { a: "entrada",       b: "rampa-entrada", tipo: "camino", metros: 17 },                       // est.
    { a: "rampa-entrada", b: "rampa-cafe",    tipo: "rampa",  metros: 47, nombre: "Rampa entrada – Cafetería" },
    { a: "rampa-cafe",    b: "rampa-epc",     tipo: "camino", metros: 5 },                        // est.
    { a: "rampa-epc",     b: "rampa-fin-epc", tipo: "rampa",  metros: 5,  nombre: "Rampa EPC" },
    { a: "rampa-fin-epc", b: "epc",           tipo: "camino", metros: 21 },
    { a: "epc",           b: "rampa-c-sup",   tipo: "camino", metros: 5 },
    { a: "rampa-c-sup",   b: "rampa-c-inf",   tipo: "rampa",  metros: 5,  nombre: "Rampa C" },
    { a: "rampa-c-inf",   b: "rampa-fin-d",   tipo: "camino", metros: 5 },                        // est.
    { a: "rampa-fin-d",   b: "rampa-d",       tipo: "rampa",  metros: 10, nombre: "Rampa D" },
    { a: "rampa-d",       b: "D-P0",          tipo: "camino", metros: 21 },                       // est.
    { a: "entrada",       b: "rampa-d",       tipo: "rampa",  metros: 83, nombre: "Rampas en zigzag (entrada – Bloque D)" }, // Footpath Entrada→D 104 m
    { a: "D-P0",          b: "D-P5",          tipo: "ascensor", metros: 0, techado: true, nombre: "Ascensor Bloque D" },
    { a: "D-P0",          b: "D-P5",          tipo: "escalera", metros: 30, techado: true },
    { a: "D-P0",          b: "C-P0",          tipo: "camino", metros: 96, nombre: "Corredor superior (D – C)" }, // Footpath D→Coliseo 113 m
    { a: "D-P0",          b: "rampa-agora",   tipo: "camino", metros: 33 },                       // est.
    { a: "rampa-agora",   b: "agora",         tipo: "rampa",  metros: 48, nombre: "Rampa Ágora" }, // est.
    { a: "rampa-cafe",    b: "cruce",         tipo: "camino", metros: 56 },                       // Footpath Entrada→Ágora 140 m
    { a: "epc",           b: "cruce",         tipo: "camino", metros: 72 },                       // est.
    { a: "cruce",         b: "agora",         tipo: "camino", metros: 20 },
    { a: "cruce",         b: "F",             tipo: "camino", metros: 16 },                       // Footpath Ágora→F 36 m
    { a: "cruce",         b: "C-P0",          tipo: "camino", metros: 39 },                       // Footpath Entrada→C 159 m
    { a: "cruce",         b: "coliseo",       tipo: "camino", metros: 45 },                       // Footpath Entrada→Coliseo 165 m
    { a: "agora",         b: "C-P0",          tipo: "camino", metros: 19 },
    { a: "C-P0",          b: "coliseo",       tipo: "camino", metros: 17 },
    { a: "C-P0",          b: "C-P2",          tipo: "ascensor", metros: 0, techado: true, nombre: "Ascensor Bloque C" },
    { a: "C-P0",          b: "C-P2",          tipo: "escalera", metros: 14, techado: true },
    { a: "F",             b: "biblioteca",    tipo: "camino", metros: 42 },
    { a: "biblioteca",    b: "maiamicito",    tipo: "camino", metros: 60 },
    { a: "entrada",       b: "maiamicito",    tipo: "camino", metros: 43 },
    { a: "entrada",       b: "biblioteca",    tipo: "camino", metros: 91 },
    { a: "rampa-cafe",    b: "bano-cafe",     tipo: "camino", metros: 8,  techado: true },
    { a: "coliseo",       b: "bano-coliseo",  tipo: "escalera", metros: 8, techado: true, nota: "por confirmar" },
  ],

  eventos: [
    { id: "techmech", nombre: "TECH MECH 2026 · Hackathon", categoria: "Académico", lugar: "coliseo", inicio: "2026-11-12T08:00", fin: "2026-11-12T18:00", capacidad: 300, aforo_pct: 65, organizador: "Mecacentro UCB", descripcion: "Hackathon de tecnología y mecatrónica." },
    { id: "mecagala", nombre: "Meca Gala",                  categoria: "Cultural",  lugar: "D-P5",    inicio: "2026-11-14T19:00", fin: "2026-11-14T23:00", capacidad: 250, aforo_pct: null, organizador: "Mecacentro UCB", descripcion: "Noche de encuentro de la comunidad MECAFEST." },
    { id: "defensa",  nombre: "Defensa de grado · Mecatrónica", categoria: "Académico", lugar: "C-P2", inicio: "2026-11-17T15:00", fin: "2026-11-17T17:00", capacidad: 40, aforo_pct: 20, organizador: "Carrera de Mecatrónica", descripcion: "Defensa pública de proyecto de grado." },
    { id: "feria",    nombre: "Feria de proyectos FDI",     categoria: "Académico", lugar: "agora",   inicio: "2026-11-25T10:00", fin: "2026-11-25T13:00", capacidad: 200, aforo_pct: null, organizador: "Facultad de Ingeniería", descripcion: "Exposición de proyectos estudiantiles." },
    { id: "futsal",   nombre: "Torneo interfacultades de futsal", categoria: "Deportivo", lugar: "coliseo", inicio: "2026-11-05T16:00", fin: "2026-11-05T19:00", capacidad: 400, aforo_pct: null, organizador: "Deportes UCB", descripcion: "Fase de grupos." },
  ],
};
