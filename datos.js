// =====================================================================
// DATOS DEL CAMPUS UCB LA PAZ — único archivo que hay que editar.
// Fuente de caminos y distancias: rutas medidas por el equipo en Footpath
// (sobre OpenStreetMap). Posición GPS anclada al centro del campus.
// =====================================================================

window.MAPA = { fondo: "openfreemap", estilo: "positron", carto_key: "" };

const ANCLA = { px: 390, py: 860, lat: -16.5227, lng: -68.1118 };
const M_POR_PX = 0.25;
function fp(x, y, plano) {
  const dx = (x - ANCLA.px) * M_POR_PX, dy = -(y - ANCLA.py) * M_POR_PX;
  return { lat: ANCLA.lat + dy / 111320, lng: ANCLA.lng + dx / (111320 * Math.cos(ANCLA.lat * Math.PI / 180)), plano };
}

// ---------------- Nodos (puntos del campus) ----------------
const NODOS = [
  { id: "entrada",       nombre: "Entrada principal",     tipo: "entrada", piso: 0, altura_m: 0,   ...fp(178, 1043, [175, 440]), sector: "entrada" },
  { id: "rampa-entrada", nombre: "Rampa de la entrada",   tipo: "punto",   piso: 0, altura_m: 1.5, ...fp(236, 1005, [200, 405]) },
  { id: "miamicito",     nombre: "Miamicito",             tipo: "servicio",piso: 0, altura_m: 1,   ...fp(302, 1051, [300, 400]), sector: "miamicito" },
  { id: "rampa-cafe",    nombre: "Rampa Cafetería",       tipo: "punto",   piso: 0, altura_m: 4,   ...fp(397, 929,  [330, 262]) },
  { id: "rampa-epc",     nombre: "Rampa EPC",             tipo: "punto",   piso: 0, altura_m: 4,   ...fp(391, 910,  [305, 280]) },
  { id: "rampa-fin-epc", nombre: "Rampa EPC (fin)",       tipo: "punto",   piso: 0, altura_m: 4,   ...fp(368, 916,  [285, 295]) },
  { id: "epc",           nombre: "Bloque EPC",            tipo: "bloque",  bloque: "EPC", piso: 0, altura_m: 4, ...fp(283, 903, [215, 300]), sector: "epc" },
  { id: "rampa-c-sup",   nombre: "Rampa C (arriba)",      tipo: "punto",   piso: 0, altura_m: 4,   ...fp(265, 905,  [185, 318]) },
  { id: "rampa-c-inf",   nombre: "Rampa C (abajo)",       tipo: "punto",   piso: 0, altura_m: 3.5, ...fp(248, 908,  [170, 330]) },
  { id: "rampa-fin-d",   nombre: "Rampa D (fin)",         tipo: "punto",   piso: 0, altura_m: 3,   ...fp(255, 888,  [145, 320]) },
  { id: "rampa-d",       nombre: "Rampa D",               tipo: "punto",   piso: 0, altura_m: 2.5, ...fp(206, 893,  [120, 335]) },
  { id: "j2",            nombre: "Corredor superior (oeste)", tipo: "punto", piso: 0, altura_m: 4.5, ...fp(225, 802, [110, 215]) },
  { id: "j1",            nombre: "Corredor superior (este)",  tipo: "punto", piso: 0, altura_m: 8,   ...fp(542, 760, [280, 140]) },
  { id: "jne",           nombre: "Esquina Bloque C",      tipo: "punto",   piso: 0, altura_m: 8.5, ...fp(560, 725,  [330, 120]) },
  { id: "jcol",          nombre: "Acceso al Coliseo",     tipo: "punto",   piso: 0, altura_m: 9.2, ...fp(522, 707,  [250, 110]) },
  { id: "coliseo",       nombre: "Coliseo (Bloque A)",    tipo: "sala",    bloque: "A", piso: 0, altura_m: 10, ...fp(515, 672, [170, 95]), sector: "coliseo" },
  { id: "rampa-agora",   nombre: "Rampa Ágora",           tipo: "punto",   piso: 0, altura_m: 8.5, ...fp(323, 716,  [200, 130]) },
  { id: "agora",         nombre: "Ágora",                 tipo: "sala",    piso: 0, altura_m: 7,   ...fp(496, 799,  [220, 160]), sector: "agora" },
  { id: "cruce",         nombre: "Cruce central",         tipo: "punto",   piso: 0, altura_m: 6,   ...fp(565, 842,  [330, 175]) },
  { id: "j4",            nombre: "Paseo central",         tipo: "punto",   piso: 0, altura_m: 4.5, ...fp(420, 885,  [300, 240]) },
  { id: "jl1",           nombre: "Paseo del jardín (este)", tipo: "punto", piso: 0, altura_m: 5,   ...fp(560, 900,  [420, 300]) },
  { id: "js",            nombre: "Sendero sur",           tipo: "punto",   piso: 0, altura_m: 4,   ...fp(577, 947,  [440, 320]) },
  { id: "F",             nombre: "Bloque F",              tipo: "bloque",  bloque: "F", piso: 0, altura_m: 6, ...fp(612, 880, [412, 128]), sector: "F" },
  { id: "bano-cafe",     nombre: "Baños Cafetería (por confirmar)", tipo: "bano", piso: 0, altura_m: 4,  accesible: true,  ...fp(420, 935, [352, 228]) },
  { id: "bano-coliseo",  nombre: "Baños Coliseo (por confirmar)",   tipo: "bano", piso: 0, altura_m: 10, accesible: false, ...fp(535, 690, [196, 118]) },
];

// ---------------- Caminos ----------------
// tipo: camino | rampa | escalera | ascensor   (metros: medición Footpath o estimación)
const ARISTAS = [
  { a: "entrada",       b: "rampa-entrada", tipo: "camino", metros: 17 },
  { a: "entrada",       b: "miamicito",     tipo: "camino", metros: 43 },
  { a: "entrada",       b: "B-P1",          tipo: "camino", metros: 91 },
  { a: "miamicito",     b: "B-P1",          tipo: "camino", metros: 60 },
  { a: "entrada",       b: "rampa-d",       tipo: "rampa",  metros: 83, nombre: "Rampas en zigzag (entrada – Bloque D)" },
  { a: "entrada",       b: "rampa-c-inf",   tipo: "escalera", metros: 38, nombre: "Gradas del atrio" },
  { a: "rampa-entrada", b: "rampa-cafe",    tipo: "rampa",  metros: 47, nombre: "Rampa entrada – Cafetería" },
  { a: "rampa-entrada", b: "epc",           tipo: "escalera", metros: 28, nombre: "Gradas centrales" },
  { a: "rampa-cafe",    b: "rampa-epc",     tipo: "camino", metros: 5 },
  { a: "rampa-epc",     b: "rampa-fin-epc", tipo: "rampa",  metros: 5,  nombre: "Rampa EPC" },
  { a: "rampa-fin-epc", b: "epc",           tipo: "rampa",  metros: 21, nombre: "Rampa central EPC" },
  { a: "epc",           b: "rampa-c-sup",   tipo: "camino", metros: 5 },
  { a: "rampa-c-sup",   b: "rampa-c-inf",   tipo: "rampa",  metros: 5,  nombre: "Rampa C" },
  { a: "rampa-c-inf",   b: "rampa-fin-d",   tipo: "camino", metros: 5 },
  { a: "rampa-fin-d",   b: "rampa-d",       tipo: "rampa",  metros: 10, nombre: "Rampa D" },
  { a: "rampa-d",       b: "D-P0",          tipo: "camino", metros: 21 },
  { a: "D-P0",          b: "j2",            tipo: "camino", metros: 9 },
  { a: "j2",            b: "j1",            tipo: "camino", metros: 75, nombre: "Corredor superior" },
  { a: "j1",            b: "jne",           tipo: "camino", metros: 10 },
  { a: "jne",           b: "C-P0",          tipo: "camino", metros: 17 },
  { a: "jne",           b: "jcol",          tipo: "camino", metros: 10 },
  { a: "jcol",          b: "coliseo",       tipo: "camino", metros: 9 },
  { a: "C-P0",          b: "coliseo",       tipo: "camino", metros: 17 },
  { a: "rampa-agora",   b: "C-P0",          tipo: "camino", metros: 42 },
  { a: "j1",            b: "cruce",         tipo: "camino", metros: 21 },
  { a: "cruce",         b: "agora",         tipo: "camino", metros: 20 },
  { a: "agora",         b: "C-P0",          tipo: "camino", metros: 19 },
  { a: "cruce",         b: "F",             tipo: "camino", metros: 16 },
  { a: "rampa-epc",     b: "j4",            tipo: "camino", metros: 9 },
  { a: "epc",           b: "j4",            tipo: "camino", metros: 35 },
  { a: "j4",            b: "cruce",         tipo: "camino", metros: 38 },
  { a: "rampa-cafe",    b: "jl1",           tipo: "camino", metros: 41 },
  { a: "jl1",           b: "F",             tipo: "camino", metros: 16 },
  { a: "jl1",           b: "B-P1",          tipo: "camino", metros: 26 },
  { a: "cruce",         b: "js",            tipo: "camino", metros: 26 },
  { a: "js",            b: "B-P1",          tipo: "camino", metros: 14 },
  { a: "rampa-cafe",    b: "bano-cafe",     tipo: "camino", metros: 8,  techado: true },
  { a: "coliseo",       b: "bano-coliseo",  tipo: "escalera", metros: 8, techado: true },
];

// ---------------- Bloques con pisos ----------------
// Genera un nodo por piso, gradas entre pisos consecutivos y ascensor entre todos.
function bloqueConPisos(cfg) {
  const ids = [];
  cfg.pisos.forEach(p => {
    const id = cfg.prefijo + "-P" + p;
    ids.push({ id, p });
    NODOS.push(Object.assign({
      id, tipo: p === cfg.pisoAcceso ? "bloque" : "piso", bloque: cfg.bloque, piso: p,
      nombre: cfg.nombre + " · " + nombrePiso(p), altura_m: cfg.altura + (p - cfg.pisoAcceso) * 3.2,
      sector: cfg.sector, alias: p === cfg.pisoAcceso ? [cfg.nombre] : [],
    }, fp(cfg.x + (p - cfg.pisoAcceso) * 0.8, cfg.y - (p - cfg.pisoAcceso) * 0.8, cfg.plano)));
  });
  for (let i = 1; i < ids.length; i++)
    ARISTAS.push({ a: ids[i - 1].id, b: ids[i].id, tipo: "escalera", metros: 12, techado: true, nombre: "Gradas " + cfg.nombre + " " + nombrePiso(ids[i - 1].p) + "–" + nombrePiso(ids[i].p) });
  if (cfg.ascensor)
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
      ARISTAS.push({ a: ids[i].id, b: ids[j].id, tipo: "ascensor", metros: 0, techado: true, nombre: "Ascensor " + cfg.nombre });
}
function nombrePiso(p) { return p === 0 ? "Planta baja" : p < 0 ? "Subsuelo " + (-p) : "Piso " + p; }
bloqueConPisos({ prefijo: "D", bloque: "D", nombre: "Bloque D", pisos: [0, 1, 2, 3, 4, 5], pisoAcceso: 0, altura: 4, x: 190, y: 812, plano: [88, 235], ascensor: true, sector: "D" });
bloqueConPisos({ prefijo: "C", bloque: "C", nombre: "Bloque C", pisos: [-2, -1, 0, 1, 2, 3, 4], pisoAcceso: 0, altura: 8.5, x: 493, y: 716, plano: [388, 48], ascensor: true, sector: "C" });
// Biblioteca: ascensor POR CONFIRMAR (por ahora solo gradas)
bloqueConPisos({ prefijo: "B", bloque: "Biblioteca", nombre: "Biblioteca", pisos: [1, 2, 3, 4], pisoAcceso: 1, altura: 3, x: 541, y: 989, plano: [458, 262], ascensor: false, sector: "biblioteca" });

// ---------------- Aulas ----------------
const AULAS = [];
function aulas(bloque, piso, nombres, nodo, cap) { nombres.forEach(n => AULAS.push({ id: n.replace(/\s+/g, "").toUpperCase(), nombre: n, bloque, piso, nodo, capacidad: cap || 40 })); }
const rango = (pre, a, b) => Array.from({ length: b - a + 1 }, (_, i) => pre + String(a + i).padStart(pre.length === 1 && a >= 100 ? 3 : (String(a).length), "0"));
// Bloque C
aulas("C", -2, ["CS201", "CS202", "CS203", "CS204"], "C-P-2");
aulas("C", -1, ["CS101", "CS102", "CS103", "CS104"], "C-P-1");
aulas("C", 0,  ["C001", "C002", "C003", "C004", "C005"], "C-P0");
aulas("C", 1,  ["C101", "C102", "C103", "C104", "C105"], "C-P1");
aulas("C", 2,  ["C201", "C202", "C203", "C204"], "C-P2");
aulas("C", 3,  ["C301", "C302", "C303", "C304"], "C-P3");
aulas("C", 4,  ["C401", "C402", "C403", "C404"], "C-P4");
// Bloque D
aulas("D", 0, ["D1", "D2"], "D-P0");
aulas("D", 1, ["D3", "D4", "D5", "D6", "D7", "Laboratorio de Psicología"], "D-P1", 30);
aulas("D", 2, ["D8", "D9", "D10", "D11", "Auditorio 2"], "D-P2");
aulas("D", 3, ["D12", "D13", "D14", "D15", "D16", "Auditorio 3"], "D-P3");
aulas("D", 4, ["D17", "D18", "D19", "D20", "D21", "Auditorio 4"], "D-P4");
aulas("D", 5, ["D22", "D23", "D24", "Paraninfo"], "D-P5");
// Biblioteca
[1, 2, 3, 4].forEach(p => aulas("Biblioteca", p, ["Sala de estudio B" + p], "B-P" + p, 60));
// Otros bloques (aulas de ejemplo)
aulas("F", 0, ["F01", "F02", "F03", "F04"], "F");
aulas("EPC", 0, ["EPC1", "EPC2", "EPC3"], "epc", 35);
// Capacidades especiales
AULAS.forEach(a => { if (/Auditorio/.test(a.nombre)) a.capacidad = 120; if (a.nombre === "Paraninfo") a.capacidad = 250; });

// ---------------- Sectores e historia ----------------
// Reseñas provisionales: completar con la historia oficial de cada sector.
const SECTORES = {
  entrada:    { titulo: "Entrada principal y Atrio", texto: "Acceso principal del campus sobre la Avenida 14 de Septiembre, en Obrajes. Es el punto de encuentro de estudiantes y visitantes y el inicio de las rampas que conectan los distintos niveles del campus." },
  D:          { titulo: "Bloque D y Paraninfo", texto: "Edificio de seis niveles que reúne aulas, laboratorios y auditorios. En su quinto piso se encuentra el Paraninfo, escenario de actos académicos, defensas y ceremonias como la Meca Gala." },
  C:          { titulo: "Bloque C", texto: "Bloque de aulas con dos subsuelos y cuatro pisos, conectados por gradas y ascensor. Concentra buena parte de la actividad académica diaria." },
  coliseo:    { titulo: "Coliseo (Bloque A)", texto: "Espacio deportivo y de eventos masivos de la universidad. Acoge torneos, ferias y encuentros como la hackathon TECH MECH." },
  agora:      { titulo: "Ágora", texto: "Área de coworks y encuentro entre bloques, pensada para el trabajo en equipo y las actividades estudiantiles." },
  biblioteca: { titulo: "Biblioteca (Bloque I)", texto: "Centro de información y estudio de la sede, con salas de lectura distribuidas en cuatro pisos." },
  F:          { titulo: "Bloque F", texto: "Bloque de aulas ubicado junto a la Biblioteca y al cruce central del campus." },
  epc:        { titulo: "Bloque EPC", texto: "Sede de la Escuela de la Producción y la Competitividad, en el corazón del campus, junto a las rampas centrales." },
  miamicito:  { titulo: "Miamicito y jardín central", texto: "Área verde y de descanso junto a la entrada, uno de los puntos de reunión más conocidos de la comunidad universitaria." },
};
const HISTORIA_UCB = "La Universidad Católica Boliviana \"San Pablo\" inició clases el 14 de mayo de 1966 en La Paz, en el Instituto Superior de Economía de la Empresa, con siete profesores y 31 estudiantes, y fue erigida canónicamente el 16 de julio de 1966. Es la universidad privada más antigua de Bolivia. Su Sede La Paz funciona en Obrajes, sobre la Avenida 14 de Septiembre.";

// ---------------- Eventos de ejemplo ----------------
// lugar: id de aula (ej. "PARANINFO", "D14") o de un punto del campus (ej. "coliseo")
const EVENTOS = [
  { id: "techmech", nombre: "TECH MECH 2026 · Hackathon", categoria: "Académico", lugar: "coliseo",   inicio: "2026-11-12T08:00", fin: "2026-11-12T18:00", capacidad: 300, esperados: 250, actuales: 180, registro: "qr",    organizador: "Mecacentro UCB", descripcion: "Hackathon de tecnología y mecatrónica." },
  { id: "mecagala", nombre: "Meca Gala",                  categoria: "Cultural",  lugar: "PARANINFO", inicio: "2026-11-14T19:00", fin: "2026-11-14T23:00", capacidad: 250, esperados: 200, actuales: 0,   registro: "libre", organizador: "Mecacentro UCB", descripcion: "Noche de encuentro de la comunidad MECAFEST." },
  { id: "defensa",  nombre: "Defensa de grado · Mecatrónica", categoria: "Académico", lugar: "D14",  inicio: "2026-11-17T15:00", fin: "2026-11-17T17:00", capacidad: 40,  esperados: 30,  actuales: 0,   registro: "libre", organizador: "Carrera de Mecatrónica", descripcion: "Defensa pública de proyecto de grado." },
  { id: "feria",    nombre: "Feria de proyectos FDI",     categoria: "Académico", lugar: "agora",     inicio: "2026-11-25T10:00", fin: "2026-11-25T13:00", capacidad: 200, esperados: 150, actuales: 0,   registro: "qr",    organizador: "Facultad de Ingeniería", descripcion: "Exposición de proyectos estudiantiles." },
  { id: "futsal",   nombre: "Torneo interfacultades de futsal", categoria: "Deportivo", lugar: "coliseo", inicio: "2026-11-05T16:00", fin: "2026-11-05T19:00", capacidad: 400, esperados: 300, actuales: 0, registro: "libre", organizador: "Deportes UCB", descripcion: "Fase de grupos." },
];

window.DATOS = { nodos: NODOS, aristas: ARISTAS, eventos: EVENTOS, aulas: AULAS, sectores: SECTORES, historia: HISTORIA_UCB };
