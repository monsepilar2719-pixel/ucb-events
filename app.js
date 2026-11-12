// =====================================================================
// UCB EVENTS · lógica de la aplicación (prototipo sin servidor)
// Roles: visitante, organizador, administrador.
// =====================================================================
(function () {
  "use strict";
  const D = window.DATOS;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const nodo = id => D.nodos.find(n => n.id === id);
  const aula = id => D.aulas.find(a => a.id === id);

  // ---------- Configuración de la demo ----------
  const CUENTAS = { // SOLO DEMOSTRACIÓN: en producción, login institucional y permisos en el servidor
    organizador: { clave: "ucb2026", rol: "organizador", nombre: "Mecacentro UCB" },
    admin:       { clave: "ucb2026", rol: "admin",       nombre: "Administración UCB" },
  };
  const ESPERA_AVISO_MS = 60e3, VENTANA_QR_MS = 30e3;

  // ---------- Almacenamiento ----------
  const P = "ucbev3_";
  const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(P + k)); return v == null ? def : v; } catch (e) { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} };

  // ---------- Íconos (SVG simples) ----------
  const ICO = {
    camino: '<path d="M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-3 4h3l2 5 3 1-.6 1.9L13.5 15 13 13l-1 4 3 3v2h-2v-1.2l-3-2.8L9 22H7l2.2-9.4L8 13v3H6v-4.5L10 8Z"/>',
    rampa: '<path d="M3 20h18v-2.5L3 9v11Zm2-3.5v-4.1l9 4.1H5Z"/>',
    gradas: '<path d="M3 21v-4h4v-4h4V9h4V5h6v2h-4v4h-4v4h-4v4H5v2H3Z"/>',
    ascensor: '<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm4 4-3 3h6L9 7Zm6 10 3-3h-6l3 3Z"/>',
    meta: '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/>',
    gps: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 3h-2.1A7 7 0 0 0 13 5.1V3h-2v2.1A7 7 0 0 0 5.1 11H3v2h2.1a7 7 0 0 0 5.9 5.9V21h2v-2.1a7 7 0 0 0 5.9-5.9H21v-2Z"/>',
  };
  const svg = (k, cls) => '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICO[k] || ICO.camino) + "</svg>";

  // ---------- Sesión ----------
  let sesion = leer("sesion", { rol: "visitante" });
  const esGestor = () => sesion.rol === "organizador" || sesion.rol === "admin";
  const puedeGestionar = ev => sesion.rol === "admin" || (sesion.rol === "organizador" && ev.organizador === sesion.nombre);
  const ROL_TXT = { visitante: "Acceso público", organizador: "Organizador", admin: "Administrador" };

  // ---------- Lugares (aulas y puntos del campus) ----------
  function lugarInfo(id) {
    const a = aula(id);
    if (a) {
      const n = nodo(a.nodo);
      const bloque = a.bloque === "Biblioteca" ? "Biblioteca" : "Bloque " + a.bloque;
      return { id, nodo: a.nodo, nombre: a.nombre, direccion: bloque + " · " + nombrePiso(a.piso) + " · " + a.nombre, aula: a, n };
    }
    const n = nodo(id);
    return n ? { id, nodo: id, nombre: n.nombre, direccion: n.nombre, n } : { id, nodo: "entrada", nombre: id, direccion: id };
  }
  function nombrePiso(p) { return p === 0 ? "Planta baja" : p < 0 ? "Subsuelo " + (-p) : "Piso " + p; }
  const ESPACIOS = ["coliseo", "agora", "miamicito", "entrada", "epc", "F"];

  function opcionesLugar(incluirEventos) {
    let h = "";
    if (incluirEventos) {
      const act = eventosVisibles().filter(e => estadoFecha(e) !== "past");
      if (act.length) h += '<optgroup label="Eventos">' + act.map(e => '<option value="ev:' + e.id + '">' + esc(e.nombre) + "</option>").join("") + "</optgroup>";
    }
    h += '<optgroup label="Espacios del campus">' + ESPACIOS.map(id => '<option value="' + id + '">' + esc(nodo(id).nombre) + "</option>").join("") + "</optgroup>";
    const grupos = {};
    D.aulas.forEach(a => { const g = a.bloque === "Biblioteca" ? "Biblioteca" : "Bloque " + a.bloque; (grupos[g] = grupos[g] || []).push(a); });
    Object.keys(grupos).forEach(g => {
      h += '<optgroup label="' + g + '">' + grupos[g].map(a => '<option value="' + a.id + '">' + esc(a.nombre + " · " + nombrePiso(a.piso)) + "</option>").join("") + "</optgroup>";
    });
    return h;
  }

  // ---------- Eventos ----------
  function eventosGuardados() {
    let evs = leer("eventos", null);
    if (!evs) { evs = D.eventos.map(e => Object.assign({ estado: "aprobado", secreto: nuevoSecreto() }, e)); guardar("eventos", evs); }
    return evs;
  }
  const guardarEventos = evs => guardar("eventos", evs);
  const asistentes = id => leer("asistencias", {})[id] || [];
  function guardarAsistentes(id, l) { const a = leer("asistencias", {}); a[id] = l; guardar("asistencias", a); }
  function eventos() {
    return eventosGuardados().map(e => {
      const ev = Object.assign({}, e);
      ev.actual = ev.registro === "qr" ? asistentes(ev.id).length + (ev.actuales || 0) : (ev.actuales || 0);
      ev.lugarInfo = lugarInfo(ev.lugar);
      return ev;
    });
  }
  const eventosVisibles = () => eventos().filter(e => e.estado === "aprobado" || puedeGestionar(e));
  const evento = id => eventos().find(e => e.id === id);
  function estadoFecha(ev) {
    const ahora = new Date(), ini = new Date(ev.inicio), fin = new Date(ev.fin || ev.inicio);
    if (fin < ahora) return "past";
    if (ini <= ahora) return "live";
    if (ini.toDateString() === ahora.toDateString()) return "today";
    return "upcoming";
  }
  const ETQ = { past: "Finalizado", live: "En curso", today: "Hoy", upcoming: "Próximo" };
  const fmtFecha = iso => new Date(iso).toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short" });
  const fmtHora = t => new Date(t).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });

  // =====================================================================
  // NAVEGACIÓN
  // =====================================================================
  const SECCIONES = [
    { id: "events", t: "Eventos", roles: ["visitante", "organizador", "admin"] },
    { id: "map", t: "Mapa y rutas", roles: ["visitante", "organizador", "admin"] },
    { id: "aulas", t: "Aulas", roles: ["visitante", "organizador", "admin"] },
    { id: "campus", t: "Campus e historia", roles: ["visitante", "organizador", "admin"] },
    { id: "organizer", t: "Mis eventos", roles: ["organizador", "admin"] },
    { id: "admin", t: "Administración", roles: ["admin"] },
  ];
  let seccionActual = "events";
  function pintarNavegacion() {
    const vis = SECCIONES.filter(s => s.roles.includes(sesion.rol));
    $("#tabs").innerHTML = vis.map(s => '<button class="tab' + (s.id === seccionActual ? " active" : "") + '" data-tab="' + s.id + '" type="button">' + s.t + "</button>").join("");
    $("#menu-secciones").innerHTML = vis.map(s => '<button class="menu-item' + (s.id === seccionActual ? " activo" : "") + '" data-ir="' + s.id + '" type="button">' + s.t + "</button>").join("");
    $$("[data-tab]").forEach(b => b.onclick = () => irA(b.dataset.tab));
    $$("[data-ir]").forEach(b => b.onclick = () => irA(b.dataset.ir));
  }
  function irA(id) {
    const s = SECCIONES.find(x => x.id === id);
    if (!s || !s.roles.includes(sesion.rol)) id = "events";
    seccionActual = id;
    SECCIONES.forEach(x => $("#" + x.id).classList.toggle("hidden", x.id !== id));
    pintarNavegacion(); cerrarMenu();
    if (id === "map") setTimeout(() => { mapa.invalidateSize(); if (ultimosLimites) mapa.fitBounds(ultimosLimites); }, 80);
    if (id === "aulas") pintarAulas();
  }
  function abrirMenu() { $("#menu").classList.add("abierto"); $("#velo").classList.remove("hidden"); $("#menu").setAttribute("aria-hidden", "false"); }
  function cerrarMenu() { $("#menu").classList.remove("abierto"); $("#velo").classList.add("hidden"); $("#menu").setAttribute("aria-hidden", "true"); }
  $("#btn-menu").onclick = abrirMenu; $("#chip-sesion").onclick = abrirMenu; $("#btn-cerrar-menu").onclick = cerrarMenu; $("#velo").onclick = cerrarMenu;
  document.addEventListener("keydown", e => { if (e.key === "Escape") { cerrarMenu(); cerrarModal(); } });

  function pintarSesion() {
    $("#chip-sesion").textContent = sesion.rol === "visitante" ? "Visitante" : sesion.nombre;
    $("#menu-nombre").textContent = sesion.rol === "visitante" ? "Visitante" : sesion.nombre;
    $("#menu-rol").textContent = ROL_TXT[sesion.rol];
    $("#menu-sesion").innerHTML = sesion.rol === "visitante"
      ? '<button class="secondary" data-s="login" type="button">Acceso para organizadores y administración</button>'
      : '<button class="danger" data-s="salir" type="button">Cerrar sesión</button>';
    $$("#menu-sesion [data-s]").forEach(b => b.onclick = () => b.dataset.s === "login" ? (cerrarMenu(), login()) : cerrarSesion());
    $("#org-nombre").textContent = esGestor() ? sesion.nombre : "";
  }
  function login() {
    abrirModal('<h3>Acceso restringido</h3><p class="muted">Solo para organizadores autorizados y administración.</p>' +
      '<form id="lf" class="left"><label>Usuario<input name="u" required autocomplete="username" placeholder="organizador o admin"></label>' +
      '<label>Contraseña<input name="p" type="password" required autocomplete="current-password"></label>' +
      '<p id="lf-err" class="error"></p><button class="primary full" type="submit">Ingresar</button></form>' +
      '<p class="demo-credentials">Demostración: <b>organizador</b> / <b>ucb2026</b> · <b>admin</b> / <b>ucb2026</b></p>');
    $("#lf").onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target), c = CUENTAS[f.get("u").trim().toLowerCase()];
      if (c && f.get("p") === c.clave) { sesion = { rol: c.rol, nombre: c.nombre }; guardar("sesion", sesion); cerrarModal(); refrescarTodo(); irA(c.rol === "admin" ? "admin" : "organizer"); toast("Sesión iniciada: " + c.nombre); }
      else $("#lf-err").textContent = "Usuario o contraseña incorrectos.";
    };
  }
  function cerrarSesion() { sesion = { rol: "visitante" }; guardar("sesion", sesion); cerrarMenu(); refrescarTodo(); irA("events"); toast("Sesión cerrada."); }

  // =====================================================================
  // MAPA
  // =====================================================================
  const centro = [D.nodos.reduce((s, n) => s + n.lat, 0) / D.nodos.length, D.nodos.reduce((s, n) => s + n.lng, 0) / D.nodos.length];
  const mapa = L.map("mapa", { zoomControl: true }).setView(centro, 18);
  const CFG = window.MAPA || {};
  function sinFondo(msg) { $("#mapa").classList.add("sin-fondo"); if (msg) toast(msg); }
  if ((CFG.fondo || "openfreemap") === "openfreemap" && L.maplibreGL) {
    try {
      const capa = L.maplibreGL({ style: "https://tiles.openfreemap.org/styles/" + (CFG.estilo || "positron"),
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(mapa);
      let av = false; capa.getMaplibreMap().on("error", () => { if (!av) { av = true; sinFondo(); } });
    } catch (e) { sinFondo("Este dispositivo no puede dibujar el mapa base. Usa «Plano UCB»."); }
  } else if (CFG.fondo === "osm") {
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, maxNativeZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(mapa);
  } else sinFondo();

  const ESTILO = { camino: { color: "#8e9aa6", weight: 4 }, rampa: { color: "#1f9d7a", weight: 5 }, escalera: { color: "#c8452c", weight: 4, dashArray: "4 6" }, ascensor: { color: "#6f4cc3", weight: 5 } };
  const grupoArista = ar => ar.nombre || (nodo(ar.a).nombre + " – " + nodo(ar.b).nombre);
  function cerradas() { const g = new Set(leer("cerrados", [])); return new Set(D.aristas.map((ar, i) => g.has(grupoArista(ar)) ? i : -1).filter(i => i >= 0)); }
  const opcionesRuta = () => ({ cerradas: cerradas() });
  const capaCaminos = L.layerGroup().addTo(mapa);
  function dibujarCaminos() {
    capaCaminos.clearLayers(); const c = cerradas();
    D.aristas.forEach((ar, i) => {
      const a = nodo(ar.a), b = nodo(ar.b);
      if (!a || !b || Ruteo.haversine(a, b) < 1.5) return;
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], c.has(i) ? { color: "#000", weight: 3, dashArray: "2 8", opacity: .6 } : ESTILO[ar.tipo] || ESTILO.camino)
        .bindTooltip((c.has(i) ? "Fuera de servicio · " : "") + { camino: "Camino", rampa: "Rampa", escalera: "Gradas", ascensor: "Ascensor" }[ar.tipo] + " · " + ar.metros + " m").addTo(capaCaminos);
    });
  }
  // Puntos visibles (planta baja / acceso de cada bloque)
  D.nodos.filter(n => n.tipo !== "piso").forEach(n => {
    const punto = n.tipo === "punto";
    const html = n.tipo === "bano" ? '<div class="pin pin-bano">WC</div>' : '<div class="pin pin-' + n.tipo + '"></div>';
    const tam = n.tipo === "bano" ? 24 : punto ? 10 : 15;
    const m = L.marker([n.lat, n.lng], { icon: L.divIcon({ className: "", html, iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] }) }).addTo(mapa);
    if (!punto) m.bindTooltip(n.nombre.replace(" · Planta baja", "").replace(" · Piso 1", ""), { direction: "top", offset: [0, -6] });
    m.on("click", () => popupLugar(n));
  });
  // Ascensores junto a la entrada de los bloques C y D
  (D.ascensores || []).forEach(x => L.marker([x.lat, x.lng], { icon: L.divIcon({ className: "", html: '<div class="pin-asc" title="' + esc(x.nombre) + '">' + svg("ascensor") + "</div>", iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 500 }).addTo(mapa).bindTooltip(x.nombre));
  function popupLugar(n) {
    const s = n.sector && D.sectores[n.sector];
    L.popup({ maxWidth: 280 }).setLatLng([n.lat, n.lng]).setContent("<b>" + esc(n.nombre) + "</b>" + (s ? '<p class="pop-hist">' + esc(s.texto) + "</p>" : "") +
      '<div class="pop-acc"><button class="secondary" data-desde="' + n.id + '">Estoy aquí</button><button class="primary" data-hasta="' + n.id + '">Ir aquí</button></div>').openOn(mapa);
  }
  mapa.on("click", e => {
    if (e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest(".leaflet-marker-icon")) return;
    const { nodo: n } = Ruteo.nodoMasCercano(D, e.latlng.lat, e.latlng.lng);
    L.popup().setLatLng(e.latlng).setContent("Punto más cercano: <b>" + esc(n.nombre) + '</b><div class="pop-acc"><button class="secondary" data-desde="' + n.id + '">Estoy aquí</button><button class="primary" data-hasta="' + n.id + '">Ir aquí</button></div>').openOn(mapa);
  });
  mapa.on("popupopen", e => {
    e.popup.getElement().querySelectorAll("button").forEach(btn => btn.onclick = () => {
      if (btn.dataset.desde) ponerOrigen(btn.dataset.desde);
      if (btn.dataset.hasta) $("#to").value = btn.dataset.hasta;
      if (btn.dataset.ev) $("#to").value = "ev:" + btn.dataset.ev;
      mapa.closePopup(); calcular();
    });
  });

  // ---- Eventos en el mapa: aparecen mientras están activos y desaparecen solos al terminar ----
  const capaEventos = L.layerGroup().addTo(mapa);
  function pintarEventosMapa() {
    capaEventos.clearLayers();
    const porNodo = {};
    eventos().filter(e => e.estado === "aprobado" && estadoFecha(e) !== "past").forEach(e => { (porNodo[e.lugarInfo.nodo] = porNodo[e.lugarInfo.nodo] || []).push(e); });
    Object.keys(porNodo).forEach(nid => {
      const n = nodo(nid), lista = porNodo[nid], vivo = lista.some(e => estadoFecha(e) === "live");
      const etiqueta = lista.length === 1 ? lista[0].nombre : lista.length + " eventos";
      const icon = L.divIcon({ className: "", html: '<div class="ev-pin' + (vivo ? " vivo" : "") + '"><span>' + esc(etiqueta.length > 22 ? etiqueta.slice(0, 21) + "…" : etiqueta) + "</span></div>", iconSize: [0, 0], iconAnchor: [0, 0] });
      L.marker([n.lat, n.lng], { icon, zIndexOffset: 1000 }).addTo(capaEventos).on("click", () => {
        L.popup({ maxWidth: 300 }).setLatLng([n.lat, n.lng]).setContent(lista.map(e =>
          '<div class="pop-ev"><span class="estado ' + estadoFecha(e) + '">' + ETQ[estadoFecha(e)] + "</span><b>" + esc(e.nombre) + "</b><br><small>" + fmtFecha(e.inicio) + " · " + fmtHora(e.inicio) + "–" + fmtHora(e.fin) + "<br>" + esc(e.lugarInfo.direccion) + '</small><div class="pop-acc"><button class="primary" data-ev="' + e.id + '">Cómo llegar</button></div></div>').join("")).openOn(mapa);
      });
    });
    pintarPlano(ultimaRuta);
  }

  // ---- Plano UCB ----
  function pintarPlano(ruta) {
    const o = origen(), hasta = destino();
    const evNodos = new Set(eventos().filter(e => e.estado === "aprobado" && estadoFecha(e) !== "past").map(e => e.lugarInfo.nodo));
    $("#plano-pins").innerHTML = D.nodos.filter(n => n.plano && n.tipo !== "punto" && n.tipo !== "piso").map(n =>
      '<button type="button" class="ppin' + (n.tipo === "bano" ? " bano" : "") + (n.id === o.id || (hasta && n.id === hasta.nodo) ? " sel" : "") + (evNodos.has(n.id) ? " conev" : "") +
      '" style="left:' + (n.plano[0] / 643 * 100) + "%;top:" + (n.plano[1] / 490 * 100) + '%" data-n="' + n.id + '" title="' + esc(n.nombre) + '">' + esc(etiquetaCorta(n)) + "</button>").join("");
    $$("#plano-pins .ppin").forEach(b => b.onclick = () => infoSector(b.dataset.n));
    let s = "";
    if (ruta && ruta.ok) {
      const pts = ruta.nodos.filter(n => n.plano).map(n => n.plano.join(",")).join(" ");
      s = '<polyline points="' + pts + '" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><polyline points="' + pts + '" fill="none" stroke="#2f6fe0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    $("#plano-svg").innerHTML = s;
  }
  const etiquetaCorta = n => n.tipo === "bano" ? "WC" : n.id === "entrada" ? "Entrada" : n.id === "coliseo" ? "Coliseo" : n.id === "agora" ? "Ágora" : n.id === "miamicito" ? "Miamicito" : n.bloque === "Biblioteca" ? "Biblioteca" : n.bloque ? n.bloque : n.nombre;
  let ultimaRuta = null;
  $$(".seg-btn").forEach(b => b.onclick = () => {
    $$(".seg-btn").forEach(x => x.classList.toggle("active", x === b));
    const plano = b.dataset.vista === "plano";
    $("#plano").classList.toggle("hidden", !plano); $("#mapa").classList.toggle("hidden", plano);
    if (!plano) setTimeout(() => { mapa.invalidateSize(); if (ultimosLimites) mapa.fitBounds(ultimosLimites); }, 50);
    pintarPlano(ultimaRuta);
  });

  // =====================================================================
  // ORIGEN (web: manual; app instalada: GPS) y DESTINO
  // =====================================================================
  const MODO_APP = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const GPS_ID = "__gps";
  let posGPS = null, marcadorGPS = null, circuloGPS = null, vigilando = null, ultimaPosRuta = null;
  function opcionesOrigen() {
    $("#from").innerHTML = (posGPS ? '<option value="' + GPS_ID + '">Mi ubicación (GPS)</option>' : "") +
      '<optgroup label="Espacios y bloques">' + D.nodos.filter(n => (n.tipo !== "punto" && n.tipo !== "piso") ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .map(n => '<option value="' + n.id + '">' + esc(n.nombre.replace(" · Planta baja", "").replace(" · Piso 1", "")) + "</option>").join("") + "</optgroup>";
  }
  function ponerOrigen(id) {
    const n = nodo(id);
    if (n && n.bloque === "D") { $("#from").value = "D-P0"; $("#from-piso").value = String(n.piso); }
    else if (n && n.tipo === "piso") { const base = D.nodos.find(x => x.bloque === n.bloque && x.tipo === "bloque"); $("#from").value = base ? base.id : "entrada"; }
    else $("#from").value = id;
    $("#from-piso-wrap").classList.toggle("hidden", $("#from").value !== "D-P0");
  }
  function origen() {
    const v = $("#from").value;
    if (v === GPS_ID && posGPS) return { id: posGPS.nodo, gps: posGPS };
    if (v === "D-P0") return { id: "D-P" + $("#from-piso").value, gps: null };
    return { id: v && nodo(v) ? v : "entrada", gps: null };
  }
  function destino() {
    const v = $("#to").value;
    if (v && v.startsWith("ev:")) { const e = evento(v.slice(3)); if (e) return Object.assign({ evento: e }, e.lugarInfo); }
    return v ? lugarInfo(v) : null;
  }
  $("#from").onchange = () => { $("#from-piso-wrap").classList.toggle("hidden", $("#from").value !== "D-P0"); pintarPlano(ultimaRuta); };
  $("#from-piso").onchange = () => calcular();

  // ---------- Simulador de piso por barómetro (MOCKUP) ----------
  // En una app nativa se leería el barómetro del celular. Aquí se simula la lectura.
  // A ~3.600 m de altitud la presión baja unos 0,25 hPa por cada piso (3,2 m).
  $("#btn-barometro").onclick = () => {
    const P0 = 652.40, HPA_PISO = 0.25;
    let altura = (+$("#from-piso").value || 0) * 3.2, objetivo = altura, t = 0;
    abrirModal('<h3>Detectar mi piso · Bloque D</h3><p class="muted">Simulación del barómetro del celular (prototipo). En la app nativa la lectura es real y se calibra al escanear el QR de la planta baja.</p>' +
      '<div class="baro"><div class="baro-edificio" id="b-edif">' + [5, 4, 3, 2, 1, 0].map(p => '<div class="b-piso" data-bp="' + p + '"><span>' + (p ? "Piso " + p : "PB") + "</span></div>").join("") + '<i id="b-yo"></i></div>' +
      '<div class="baro-datos"><div class="baro-dial"><svg viewBox="0 0 120 70"><path d="M10 65a50 50 0 0 1 100 0" fill="none" stroke="#e1e7f0" stroke-width="10" stroke-linecap="round"/><path id="b-arco" d="M10 65a50 50 0 0 1 100 0" fill="none" stroke="#ffc502" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/></svg><b id="b-hpa">—</b><small>hPa</small></div>' +
      '<dl><dt>Calibración</dt><dd>' + P0.toFixed(2) + ' hPa (planta baja)</dd><dt>Altura relativa</dt><dd id="b-alt">—</dd><dt>Piso estimado</dt><dd id="b-piso" class="b-grande">—</dd></dl></div></div>' +
      '<div class="fila"><button class="secondary" id="b-bajar" type="button">Bajar un piso</button><button class="secondary" id="b-subir" type="button">Subir un piso</button></div>' +
      '<button class="primary full" id="b-usar" type="button">Usar este piso como punto de partida</button>');
    const pintar = () => {
      t += 1; altura += (objetivo - altura) * 0.12;
      const ruido = Math.sin(t / 3) * 0.012 + (Math.random() - .5) * 0.01, hpa = P0 - altura / 3.2 * HPA_PISO + ruido;
      const piso = Math.max(0, Math.min(5, Math.round((P0 - hpa) / HPA_PISO)));
      if (!$("#b-hpa")) return;
      $("#b-hpa").textContent = hpa.toFixed(2); $("#b-alt").textContent = "+" + altura.toFixed(1) + " m";
      $("#b-piso").textContent = piso ? "Piso " + piso : "Planta baja"; $("#b-piso").dataset.p = piso;
      $("#b-arco").setAttribute("stroke-dasharray", Math.min(100, altura / 16 * 100) + " 100");
      $("#b-yo").style.bottom = (altura / 3.2 / 6 * 100 + 100 / 12) + "%";
      $$(".b-piso").forEach(x => x.classList.toggle("activo", +x.dataset.bp === piso));
    };
    $("#b-subir").onclick = () => { objetivo = Math.min(16, Math.round(objetivo / 3.2 + 1) * 3.2); };
    $("#b-bajar").onclick = () => { objetivo = Math.max(0, Math.round(objetivo / 3.2 - 1) * 3.2); };
    $("#b-usar").onclick = () => { const p = $("#b-piso").dataset.p || "0"; $("#from").value = "D-P0"; $("#from-piso").value = p; $("#from-piso-wrap").classList.remove("hidden"); cerrarModal(); toast("Punto de partida: Bloque D · " + nombrePiso(+p) + " (detectado por barómetro, simulación)."); calcular(); };
    timerModal = setInterval(pintar, 120); pintar();
  };

  function actualizarGPS(pos, primero) {
    const lat = pos.coords.latitude, lng = pos.coords.longitude, acc = pos.coords.accuracy || 30;
    const { nodo: n, distancia } = Ruteo.nodoMasCercano(D, lat, lng);
    if (distancia > 400) { if (primero) toast("Tu GPS indica que estás fuera del campus. Elige tu punto de partida en la lista."); return false; }
    posGPS = { lat, lng, acc, nodo: n.id, dist: distancia };
    if (!marcadorGPS) {
      circuloGPS = L.circle([lat, lng], { radius: acc, color: "#2f6fe0", weight: 1, fillOpacity: .12 }).addTo(mapa);
      marcadorGPS = L.circleMarker([lat, lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#2f6fe0", fillOpacity: 1 }).addTo(mapa).bindTooltip("Estás aquí");
    } else { marcadorGPS.setLatLng([lat, lng]); circuloGPS.setLatLng([lat, lng]).setRadius(acc); }
    const sel = $("#from").value; opcionesOrigen(); $("#from").value = primero ? GPS_ID : sel;
    $("#from-piso-wrap").classList.toggle("hidden", $("#from").value !== "D-P0");
    if ($("#from").value === GPS_ID && ultimaRuta && ultimaRuta.ok && (!ultimaPosRuta || Ruteo.haversine(ultimaPosRuta, posGPS) > 20)) calcular();
    return true;
  }
  function pedirGPS(continuo) {
    if (!navigator.geolocation) { toast("Este dispositivo no tiene ubicación. Elige tu punto de partida."); return; }
    let primero = true;
    const ok = pos => { const v = actualizarGPS(pos, primero); if (primero && v) { toast("Usando tu ubicación GPS como punto de partida."); if (!continuo) calcular(); } primero = false; };
    const err = () => toast("No se pudo obtener tu ubicación. Elige tu punto de partida en la lista.");
    const opt = { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 };
    if (continuo) { if (vigilando === null) vigilando = navigator.geolocation.watchPosition(ok, err, opt); } else navigator.geolocation.getCurrentPosition(ok, err, opt);
  }
  $("#btn-gps").onclick = () => pedirGPS(MODO_APP);
  function conTramoGPS(r, o) {
    if (!r.ok || !o.gps || o.gps.dist < 8) return r;
    const d = Math.round(o.gps.dist);
    return Object.assign({}, r, { metros: r.metros + d, segundos: r.segundos + Math.round(d / 1.2), minutos: Math.max(1, Math.round((r.segundos + d / 1.2) / 60)),
      pasos: [{ icono: "gps", texto: "Desde tu ubicación, camina " + d + " m hasta " + nodo(o.id).nombre }].concat(r.pasos), inicioGPS: [o.gps.lat, o.gps.lng] });
  }

  // =====================================================================
  // RUTAS
  // =====================================================================
  const modo = () => document.querySelector('input[name="modo"]:checked').value;
  const setModo = m => { const r = document.querySelector('input[name="modo"][value="' + m + '"]'); if (r) r.checked = true; };
  const modoPreferido = () => leer("siempre_accesible", false) ? "accesible" : "corta";
  function rutaA(lugarNodo, m, o) { o = o || origen(); return conTramoGPS(Ruteo.ruta(D, o.id, lugarNodo, m, opcionesRuta()), o); }

  let capaRuta = null, ultimosLimites = null;
  function dibujarRuta(r) {
    ultimaRuta = r;
    if (capaRuta) { mapa.removeLayer(capaRuta); capaRuta = null; }
    pintarPlano(r);
    if (!r || !r.ok) return;
    const coords = (r.inicioGPS ? [r.inicioGPS] : []).concat(r.nodos.map(n => [n.lat, n.lng]));
    capaRuta = L.layerGroup([
      L.polyline(coords, { color: "#fff", weight: 11, opacity: .95 }), L.polyline(coords, { color: "#2f6fe0", weight: 6 }),
      L.circleMarker(coords[0], { radius: 8, color: "#fff", weight: 3, fillColor: "#2f6fe0", fillOpacity: 1 }),
      L.circleMarker(coords[coords.length - 1], { radius: 9, color: "#fff", weight: 3, fillColor: "#e8890c", fillOpacity: 1 }),
    ]).addTo(mapa);
    ultimosLimites = L.latLngBounds(coords).pad(0.4);
    if (!$("#mapa").classList.contains("hidden") && $("#mapa").offsetWidth) mapa.fitBounds(ultimosLimites);
  }
  function htmlPasos(r, dest) {
    const final = dest && dest.aula ? "Llegaste. " + dest.aula.nombre + " está en " + nombrePiso(dest.aula.piso).toLowerCase() + " del " + (dest.aula.bloque === "Biblioteca" ? "edificio de la Biblioteca" : "Bloque " + dest.aula.bloque) + "." : "Llegaste a " + (dest ? dest.nombre : r.destino.nombre) + ".";
    return "<ol class='pasos'>" + r.pasos.map(p => "<li>" + svg(p.icono) + "<span>" + esc(p.texto) + "</span></li>").join("") + "<li>" + svg("meta") + "<span>" + esc(final) + "</span></li></ol>";
  }
  function calcular() {
    const dest = destino(); if (!dest) return;
    const o = origen(), m = modo();
    if (o.gps) ultimaPosRuta = { lat: o.gps.lat, lng: o.gps.lng };
    actualizarURL();
    const r = rutaA(dest.nodo, m, o);
    const out = $("#route-result");
    dibujarRuta(r);
    const titulo = dest.evento ? '<div class="res-ev">' + esc(dest.evento.nombre) + "<small>" + esc(dest.direccion) + " · " + fmtHora(dest.evento.inicio) + "–" + fmtHora(dest.evento.fin) + "</small></div>" : '<div class="res-ev">' + esc(dest.direccion) + "</div>";
    if (!r.ok) {
      let extra = "";
      if (m === "accesible" && !r.mismoLugar) { const alt = rutaA(dest.nodo, "corta", o); extra = alt.ok ? "<br>Existe una ruta con gradas de " + alt.metros + " m. Coordine asistencia con el organizador o la administración." : ""; }
      out.innerHTML = titulo + '<div class="aviso ' + (r.mismoLugar ? "info" : "error") + '">' + esc(r.motivo) + extra + "</div>";
      return;
    }
    let comp = "";
    if (m === "corta" && r.usaEscaleras) {
      const acc = rutaA(dest.nodo, "accesible", o);
      comp = acc.ok ? '<div class="aviso info">Esta ruta incluye gradas. Con rampas: ' + acc.metros + " m (+" + Math.max(0, acc.metros - r.metros) + ' m). <button class="link" id="ver-acc" type="button">Ver ruta con rampas</button></div>'
                    : '<div class="aviso error">Este destino no tiene ruta sin gradas disponible.</div>';
    } else if (m === "accesible") comp = '<div class="aviso ok">Ruta sin gradas' + (r.usaAscensor ? ", con ascensor" : "") + ".</div>";
    else comp = '<div class="aviso ok">Ruta sin gradas.</div>';
    out.innerHTML = titulo + '<div class="resumen">' + r.metros + ' m <span>· ' + r.minutos + " min a pie</span></div>" + comp + htmlPasos(r, dest);
    const b = $("#ver-acc"); if (b) b.onclick = () => { setModo("accesible"); calcular(); };
  }
  function irEvento(id, m) { opcionesDestino(); $("#to").value = "ev:" + id; setModo(m || modoPreferido()); irA("map"); calcular(); }
  function irLugar(id, m) { opcionesDestino(); $("#to").value = id; setModo(m || modoPreferido()); irA("map"); calcular(); }
  function opcionesDestino() { const v = $("#to").value; $("#to").innerHTML = opcionesLugar(true); if (v && [...$("#to").options].some(o => o.value === v)) $("#to").value = v; }
  $("#route-btn").onclick = calcular;
  $("#to").onchange = calcular;
  $$('input[name="modo"]').forEach(r => r.onchange = calcular);
  $("#btn-bano").onclick = () => {
    const m = modo(), acc = m === "accesible", o = origen();
    const r = conTramoGPS(Ruteo.rutaAlMasCercano(D, o.id, n => n.tipo === "bano" && (!acc || n.accesible), m, opcionesRuta()), o);
    dibujarRuta(r);
    $("#route-result").innerHTML = r.ok ? '<div class="res-ev">Baño más cercano' + (acc ? " accesible" : "") + "<small>" + esc(r.destino.nombre) + '</small></div><div class="resumen">' + r.metros + " m <span>· " + r.minutos + " min</span></div>" + htmlPasos(r, null) : '<div class="aviso error">' + esc(r.motivo) + "</div>";
  };
  const urlBase = () => location.href.split("?")[0].split("#")[0];
  function actualizarURL() { try { const v = $("#to").value; const p = new URLSearchParams(); if (v.startsWith("ev:")) p.set("evento", v.slice(3)); else p.set("hasta", v); if (modo() !== "corta") p.set("modo", modo()); history.replaceState(null, "", urlBase() + "?" + p); } catch (e) {} }
  $("#btn-compartir").onclick = () => { const url = location.href; if (navigator.share) navigator.share({ title: "UCB Events", text: "Ruta en el campus UCB:", url }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent("Ruta en el campus UCB: " + url), "_blank"); };

  // =====================================================================
  // EVENTOS (vista pública)
  // =====================================================================
  function linkCalendar(e) {
    const f = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "T" + pad(d.getHours()) + pad(d.getMinutes()) + "00";
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.nombre) + "&dates=" + f(new Date(e.inicio)) + "/" + f(new Date(e.fin)) +
      "&ctz=America/La_Paz&location=" + encodeURIComponent(e.lugarInfo.direccion + ", UCB La Paz") + "&details=" + encodeURIComponent("Cómo llegar: " + urlBase() + "?evento=" + e.id);
  }
  const yaAsistio = id => { const p = leer("perfil", null); return !!p && asistentes(id).some(x => (x.codigo || x.nombre).toLowerCase() === (p.codigo || p.nombre).toLowerCase()); };
  function render() {
    const q = $("#search").value.toLowerCase().trim(), cat = $("#category").value, fil = $("#date-filter").value, seg = leer("seguidos", []);
    const lista = eventosVisibles().filter(ev => {
      const t = (ev.nombre + " " + ev.lugarInfo.direccion + " " + (ev.descripcion || "") + " " + ev.organizador).toLowerCase(), st = estadoFecha(ev);
      return (!q || t.includes(q)) && (!cat || ev.categoria === cat) && (fil === "all" || (fil === "past" ? st === "past" : st !== "past"));
    }).sort((a, b) => { const ap = estadoFecha(a) === "past", bp = estadoFecha(b) === "past"; if (ap !== bp) return ap ? 1 : -1; return ap ? b.inicio.localeCompare(a.inicio) : a.inicio.localeCompare(b.inicio); });
    $("#event-count").textContent = lista.length + " evento(s)";
    const m = modoPreferido();
    $("#event-list").innerHTML = lista.map(ev => {
      const st = estadoFecha(ev), past = st === "past", pct = ev.capacidad ? Math.min(100, Math.round(ev.actual / ev.capacidad * 100)) : 0;
      const r = past ? null : rutaA(ev.lugarInfo.nodo, m);
      const rAcc = past ? null : rutaA(ev.lugarInfo.nodo, "accesible");
      const ruta = past ? "" : '<div class="ev-ruta">' + svg("camino") + "<span>" + (r && r.ok ? "<b>" + r.metros + " m</b> desde " + esc(origenTexto()) + " · " + r.minutos + " min" : "Sin ruta disponible") + "</span>" +
        (rAcc && rAcc.ok ? '<span class="tag-ok">Accesible con rampas</span>' : '<span class="tag-acc">Sin acceso sin gradas</span>') + "</div>";
      return '<article class="event-card ' + (past ? "past-event" : "") + '">' +
        '<div class="event-top"><span class="category-tag">' + esc(ev.categoria) + '</span><span class="estado ' + st + '">' + ETQ[st] + "</span></div>" +
        "<h3>" + esc(ev.nombre) + "</h3>" + (ev.estado === "pendiente" ? '<span class="tag-pend">Reserva pendiente de aprobación</span>' : "") +
        '<dl class="ev-datos"><dt>Fecha</dt><dd>' + fmtFecha(ev.inicio) + " · " + fmtHora(ev.inicio) + "–" + fmtHora(ev.fin) + "</dd><dt>Lugar</dt><dd>" + esc(ev.lugarInfo.direccion) + "</dd><dt>Organiza</dt><dd>" + esc(ev.organizador) + "</dd></dl>" +
        (ev.descripcion ? '<p class="ev-desc">' + esc(ev.descripcion) + "</p>" : "") + ruta +
        '<div class="occupancy"><span style="width:' + pct + '%"></span></div><div class="occupancy-label"><span>Asistentes: ' + ev.actual + " · esperados " + (ev.esperados || "—") + " · capacidad " + ev.capacidad + "</span><b>" + pct + "%</b></div>" +
        '<div class="card-actions">' + (past ? '<button class="secondary" disabled type="button">Evento finalizado</button>' :
          '<button class="primary" data-irev="' + ev.id + '" type="button">Cómo llegar</button><a class="secondary" target="_blank" rel="noopener" href="' + linkCalendar(ev) + '">Agregar al calendario</a>' +
          '<button class="secondary" data-seguir="' + ev.id + '" type="button">' + (seg.includes(ev.id) ? "Recibiendo avisos" : "Recibir avisos") + "</button>" +
          (ev.registro === "qr" && ev.estado === "aprobado" ? (yaAsistio(ev.id) ? '<span class="tag-ok">Asistencia registrada</span>' : '<button class="secondary" data-marcar="' + ev.id + '" type="button">Registrar asistencia</button>') : "") +
          (puedeGestionar(ev) ? '<button class="secondary" data-gest="' + ev.id + '" type="button">Gestionar</button>' : "")) + "</div></article>";
    }).join("") || '<p class="muted">No se encontraron eventos.</p>';
    $$("[data-irev]").forEach(b => b.onclick = () => irEvento(b.dataset.irev));
    $$("[data-seguir]").forEach(b => b.onclick = () => { const s = new Set(leer("seguidos", [])); s.has(b.dataset.seguir) ? s.delete(b.dataset.seguir) : s.add(b.dataset.seguir); guardar("seguidos", [...s]); if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); render(); });
    $$("[data-marcar]").forEach(b => b.onclick = () => pedirCodigo(b.dataset.marcar));
    $$("#event-list [data-gest]").forEach(b => b.onclick = () => gestionar(b.dataset.gest, "aforo"));
  }
  const origenTexto = () => { const o = origen(); return o.gps ? "tu ubicación" : nodo(o.id).nombre; };
  $("#search").oninput = render; $("#category").onchange = render; $("#date-filter").onchange = render;

  // =====================================================================
  // AULAS: disponibilidad
  // =====================================================================
  const FRANJAS = [["07:00", "08:30"], ["08:45", "10:15"], ["10:30", "12:00"], ["12:15", "13:45"], ["14:00", "15:30"], ["15:45", "17:15"], ["17:30", "19:00"], ["19:15", "20:45"]];
  const MATERIAS = ["Cálculo I", "Cálculo II", "Física I", "Programación", "Estadística", "Ética", "Contabilidad", "Psicología General", "Derecho Civil", "Microeconomía", "Álgebra Lineal", "Comunicación", "Teología", "Electrónica", "Química General", "Marketing"];
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const aMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  function horarioAula(a, dia) {
    const cl = FRANJAS.map(([i, f], k) => {
      const h = hash(a.id + ":" + dia + ":" + k) % 100, lim = /Auditorio|Paraninfo|Sala de estudio/.test(a.nombre) ? 18 : dia === 6 ? 25 : 58;
      return h < lim ? { i, f, tipo: "clase", titulo: /Sala de estudio/.test(a.nombre) ? "Grupo de estudio reservado" : MATERIAS[hash(a.id + dia + k) % MATERIAS.length] } : null;
    }).filter(Boolean);
    const evs = eventos().filter(e => e.lugar === a.id && e.estado === "aprobado" && new Date(e.inicio).getDay() === dia && estadoFecha(e) !== "past")
      .map(e => ({ i: e.inicio.slice(11, 16), f: e.fin.slice(11, 16), tipo: "evento", titulo: e.nombre }));
    return cl.concat(evs).sort((x, y) => aMin(x.i) - aMin(y.i));
  }
  function estadoAula(a, dia, hora) {
    const h = horarioAula(a, dia), t = aMin(hora);
    const actual = h.find(x => aMin(x.i) <= t && t < aMin(x.f));
    if (actual) return { libre: false, texto: (actual.tipo === "evento" ? "Evento: " : "") + actual.titulo, hasta: actual.f };
    const sig = h.find(x => aMin(x.i) > t);
    return { libre: true, texto: sig ? "Libre hasta las " + sig.i : "Libre el resto del día", hasta: sig ? sig.i : null };
  }
  function prepararFiltrosAulas() {
    const bloques = [...new Set(D.aulas.map(a => a.bloque))];
    $("#au-bloque").innerHTML = '<option value="">Todos los bloques</option>' + bloques.map(b => '<option value="' + b + '">' + (b === "Biblioteca" ? "Biblioteca" : "Bloque " + b) + "</option>").join("");
    const d = new Date(); $("#au-dia").value = String(d.getDay() === 0 ? 1 : d.getDay()); $("#au-hora").value = pad(d.getHours()) + ":" + pad(d.getMinutes());
    $("#au-bloque").onchange = () => { pisosAulas(); pintarAulas(); };
    ["#au-piso", "#au-dia", "#au-hora", "#au-estado"].forEach(s => $(s).onchange = pintarAulas);
    pisosAulas();
  }
  function pisosAulas() {
    const b = $("#au-bloque").value, pisos = [...new Set(D.aulas.filter(a => !b || a.bloque === b).map(a => a.piso))].sort((x, y) => x - y);
    $("#au-piso").innerHTML = '<option value="">Todos los pisos</option>' + pisos.map(p => '<option value="' + p + '">' + nombrePiso(p) + "</option>").join("");
  }
  function pintarAulas() {
    const b = $("#au-bloque").value, p = $("#au-piso").value, dia = +$("#au-dia").value, hora = $("#au-hora").value || "10:00", solo = $("#au-estado").value === "libre";
    const lista = D.aulas.filter(a => (!b || a.bloque === b) && (p === "" || a.piso === +p)).map(a => ({ a, e: estadoAula(a, dia, hora) })).filter(x => !solo || x.e.libre);
    $("#aulas-resumen").textContent = lista.filter(x => x.e.libre).length + " libres de " + lista.length;
    $("#aulas-lista").innerHTML = lista.map(({ a, e }) => '<button class="aula-card ' + (e.libre ? "libre" : "ocupada") + '" data-aula="' + a.id + '" type="button">' +
      "<span class='aula-nom'>" + esc(a.nombre) + "</span><span class='aula-ub'>" + (a.bloque === "Biblioteca" ? "Biblioteca" : "Bloque " + a.bloque) + " · " + nombrePiso(a.piso) + " · " + a.capacidad + " pers.</span>" +
      "<span class='aula-est'>" + (e.libre ? "Libre" : "Ocupada") + "</span><span class='aula-txt'>" + esc(e.texto) + (e.libre ? "" : " · hasta " + e.hasta) + "</span></button>").join("") || '<p class="muted">Sin aulas para este filtro.</p>';
    $$("[data-aula]").forEach(x => x.onclick = () => detalleAula(x.dataset.aula, dia));
  }
  function detalleAula(id, dia) {
    const a = aula(id), h = horarioAula(a, dia), dias = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    abrirModal("<h3>" + esc(a.nombre) + '</h3><p class="muted">' + esc(lugarInfo(id).direccion) + " · capacidad " + a.capacidad + "</p>" +
      '<h4 class="left">' + dias[dia] + '</h4><ul class="franjas">' + FRANJAS.map(([i, f]) => { const o = h.find(x => x.i === i); return '<li class="' + (o ? o.tipo : "libre") + '"><b>' + i + "–" + f + "</b><span>" + esc(o ? o.titulo : "Libre") + "</span></li>"; }).join("") +
      h.filter(x => x.tipo === "evento" && !FRANJAS.some(f => f[0] === x.i)).map(x => '<li class="evento"><b>' + x.i + "–" + x.f + "</b><span>" + esc(x.titulo) + "</span></li>").join("") +
      '</ul><button class="primary full" id="ir-aula" type="button">Cómo llegar a ' + esc(a.nombre) + "</button>");
    $("#ir-aula").onclick = () => { cerrarModal(); irLugar(id); };
  }

  // =====================================================================
  // CAMPUS E HISTORIA
  // =====================================================================
  function pintarCampus() {
    $("#historia-ucb").textContent = D.historia;
    $("#sectores").innerHTML = Object.keys(D.sectores).map(k => {
      const s = D.sectores[k], n = D.nodos.find(x => x.sector === k && x.tipo !== "piso");
      return '<article class="sector"><h3>' + esc(s.titulo) + "</h3><p>" + esc(s.texto) + "</p>" + (n ? '<button class="secondary" data-sec="' + n.id + '" type="button">Ver en el mapa</button>' : "") + "</article>";
    }).join("");
    $$("[data-sec]").forEach(b => b.onclick = () => { irA("map"); const n = nodo(b.dataset.sec); mapa.setView([n.lat, n.lng], 19); popupLugar(n); });
  }
  function infoSector(id) {
    const n = nodo(id), s = n.sector && D.sectores[n.sector];
    abrirModal("<h3>" + esc(s ? s.titulo : n.nombre) + '</h3><p class="left">' + esc(s ? s.texto : "") + '</p><button class="primary full" id="ir-sec" type="button">Cómo llegar</button>');
    $("#ir-sec").onclick = () => { cerrarModal(); irLugar(id); };
  }

  // =====================================================================
  // ORGANIZADORES: crear / editar y gestionar
  // =====================================================================
  function prepararForm() {
    $("#ev-lugar").innerHTML = '<option value="">Seleccionar lugar</option>' + opcionesLugar(false);
    $("#ev-lugar").onchange = rutaPrevia;
    const admin = sesion.rol === "admin";
    $("#save-event-btn").textContent = admin ? "Publicar evento" : "Enviar solicitud";
    $("#form-nota").textContent = admin ? "Como administrador, el evento se publica de inmediato." : "Los eventos de organizadores se envían como solicitud de reserva y se publican cuando la administración los aprueba.";
  }
  function rutaPrevia() {
    const v = $("#ev-lugar").value; if (!v) { $("#ruta-previa").innerHTML = ""; return; }
    const li = lugarInfo(v), r = Ruteo.ruta(D, "entrada", li.nodo, "corta", opcionesRuta()), a = Ruteo.ruta(D, "entrada", li.nodo, "accesible", opcionesRuta());
    $("#ruta-previa").innerHTML = "<b>Ruta generada automáticamente</b> desde la entrada principal hasta " + esc(li.direccion) + ": " + (r.ok ? r.metros + " m" : "sin ruta") + " · con rampas: " + (a.ok ? a.metros + " m" : "no disponible");
  }
  function resetForm() { const f = $("#event-form"); f.reset(); f.elements.id.value = ""; $("#form-title").textContent = sesion.rol === "admin" ? "Crear evento" : "Solicitar un evento"; $("#cancel-edit-btn").classList.add("hidden"); $("#ruta-previa").innerHTML = ""; prepararForm(); }
  $("#cancel-edit-btn").onclick = resetForm;
  function editar(id) {
    const ev = eventosGuardados().find(e => e.id === id); if (!ev) return;
    const f = $("#event-form").elements;
    f.id.value = ev.id; f.name.value = ev.nombre; f.category.value = ev.categoria; f.place.value = ev.lugar; f.date.value = ev.inicio.slice(0, 10); f.time.value = ev.inicio.slice(11, 16); f.end.value = ev.fin.slice(11, 16);
    f.capacity.value = ev.capacidad; f.expected.value = ev.esperados || ""; f.description.value = ev.descripcion || ""; f.registro.value = ev.registro || "libre";
    $("#form-title").textContent = "Editar evento"; $("#save-event-btn").textContent = "Guardar cambios"; $("#cancel-edit-btn").classList.remove("hidden"); rutaPrevia();
    irA("organizer"); $("#event-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#event-form").onsubmit = e => {
    e.preventDefault(); if (!esGestor()) return;
    const f = new FormData(e.target), cap = +f.get("capacity"), esp = +f.get("expected");
    const inicio = f.get("date") + "T" + f.get("time"), fin = f.get("date") + "T" + f.get("end");
    if (fin <= inicio) { $("#form-message").textContent = "La hora de fin debe ser posterior al inicio."; return; }
    const datos = { nombre: f.get("name").trim(), categoria: f.get("category"), lugar: f.get("place"), inicio, fin, capacidad: cap, esperados: esp, descripcion: f.get("description").trim(), registro: f.get("registro") };
    const evs = eventosGuardados(), id = f.get("id");
    let msg;
    if (id) { Object.assign(evs.find(x => x.id === id), datos); msg = "Cambios guardados."; }
    else {
      evs.push(Object.assign({ id: "ev" + Date.now(), organizador: sesion.nombre, estado: sesion.rol === "admin" ? "aprobado" : "pendiente", actuales: 0, secreto: nuevoSecreto() }, datos));
      msg = sesion.rol === "admin" ? "Evento publicado. Ya aparece en el mapa." : "Solicitud enviada. Se publicará cuando la administración apruebe la reserva.";
    }
    guardarEventos(evs); resetForm(); $("#form-message").textContent = msg; refrescarTodo();
  };
  function renderManageList() {
    const box = $("#manage-event-list");
    if (!esGestor()) { box.innerHTML = ""; return; }
    const mios = eventos().filter(e => sesion.rol === "admin" ? e.organizador === sesion.nombre : e.organizador === sesion.nombre).sort((a, b) => b.inicio.localeCompare(a.inicio));
    box.innerHTML = mios.map(ev => filaEvento(ev, '<button class="primary" data-gest="' + ev.id + '" type="button">Gestionar</button><button class="secondary" data-edit="' + ev.id + '" type="button">Editar</button>')).join("") || '<p class="muted">Todavía no tienes eventos.</p>';
    box.querySelectorAll("[data-gest]").forEach(b => b.onclick = () => gestionar(b.dataset.gest, "aforo"));
    box.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editar(b.dataset.edit));
  }
  const filaEvento = (ev, acciones) => '<div class="manage-row"><div class="manage-info"><b>' + esc(ev.nombre) + "</b><span>" + fmtFecha(ev.inicio) + " " + fmtHora(ev.inicio) + "–" + fmtHora(ev.fin) + " · " + esc(ev.lugarInfo.direccion) + " · " + esc(ev.organizador) +
    " · " + (ev.estado === "pendiente" ? "Pendiente" : ETQ[estadoFecha(ev)]) + " · " + (ev.registro === "qr" ? "Registro QR" : "Sin registro") + '</span></div><div class="manage-actions">' + acciones + "</div></div>";

  // ---------- Modal Gestionar ----------
  let timerModal = null;
  function abrirModal(html) { clearInterval(timerModal); timerModal = null; $("#modal-cuerpo").innerHTML = html; $("#modal").classList.remove("hidden"); }
  function cerrarModal() { $("#modal").classList.add("hidden"); clearInterval(timerModal); timerModal = null; }
  $("#modal-cerrar").onclick = cerrarModal;
  $("#modal").onclick = e => { if (e.target.id === "modal") cerrarModal(); };
  function actualizarEvento(id, cambios) { const evs = eventosGuardados(); Object.assign(evs.find(x => x.id === id), cambios); guardarEventos(evs); }

  function gestionar(id, pest) {
    const ev = evento(id); if (!ev || !puedeGestionar(ev)) return;
    const tabs = '<div class="gest-tabs">' + [["aforo", "Aforo"], ["aviso", "Notificar"], ["asistencia", "Asistencia"]].map(([k, t]) => '<button class="secondary' + (k === pest ? " active" : "") + '" data-gt="' + k + '" type="button">' + t + "</button>").join("") + "</div>";
    let c = "";
    if (pest === "aforo") {
      c = '<div class="aforo-grid"><div><small>Actual</small><b>' + ev.actual + "</b></div><div><small>Esperado</small><b>" + (ev.esperados || 0) + "</b></div><div><small>Capacidad</small><b>" + ev.capacidad + "</b></div></div>" +
        (ev.registro === "qr" ? '<p class="notice">Con registro QR, el aforo actual suma automáticamente los escaneos (' + asistentes(id).length + "). Puedes añadir personas sin registro abajo.</p>" : "") +
        '<label class="left">Asistentes actuales' + (ev.registro === "qr" ? " sin registro QR" : "") + '<input id="g-act" type="number" min="0" value="' + (ev.actuales || 0) + '"></label>' +
        '<label class="left">Asistentes esperados<input id="g-esp" type="number" min="0" value="' + (ev.esperados || 0) + '"></label>' +
        '<button class="primary full" id="g-ok" type="button">Guardar aforo</button>';
    } else if (pest === "aviso") {
      const falta = Math.max(0, (ev.esperados || 0) - ev.actual);
      c = '<p class="muted">El aviso llega a las personas que activaron "Recibir avisos" en este evento.' + (falta ? " Faltan " + falta + " asistentes para lo esperado." : "") + '</p><textarea id="msg" maxlength="120" rows="3" placeholder="Máximo 120 caracteres"></textarea><div class="plantillas">' +
        ["Aún quedan lugares, te esperamos.", "Necesitamos más participantes: súmate.", "Empezamos en 10 minutos.", "Cambio de sala: revisa la ruta."].map(t => '<button class="secondary" data-pl="' + esc(t) + '" type="button">' + esc(t) + "</button>").join("") +
        '</div><button class="primary full" id="msg-ok" type="button"' + (ev.estado !== "aprobado" ? " disabled" : "") + ">Enviar notificación</button>";
    } else {
      if (ev.registro !== "qr") c = '<p class="notice">Este evento es de entrada libre (sin registro de participantes).</p><button class="secondary full" id="a-on" type="button">Cambiar a registro con QR</button>';
      else {
        const l = asistentes(id);
        c = '<button class="primary full" id="a-qr" type="button"' + (ev.estado !== "aprobado" ? " disabled" : "") + '>Mostrar QR de asistencia</button><h4 class="left">Registrados: ' + l.length + "</h4>" +
          '<ul class="lista-asis">' + (l.map((p, i) => "<li><span>" + esc(p.nombre) + (p.codigo ? " <small class='muted'>· " + esc(p.codigo) + "</small>" : "") + "<br><small class='muted'>" + fmtHora(p.t) + " · " + (p.metodo === "qr" ? "QR" : "manual") + '</small></span><button class="danger" data-ret="' + i + '" type="button">Retirar</button></li>').join("") || '<li class="muted">Nadie registrado todavía.</li>') + "</ul>" +
          '<div class="fila"><input id="a-nom" placeholder="Agregar a mano (nombre)"><button class="secondary" id="a-add" type="button">Agregar</button></div><button class="secondary full" id="a-off" type="button">Cambiar a entrada libre</button>';
      }
    }
    abrirModal("<h3>" + esc(ev.nombre) + '</h3><p class="muted">' + esc(ev.lugarInfo.direccion) + "</p>" + tabs + c);
    $$("[data-gt]").forEach(b => b.onclick = () => gestionar(id, b.dataset.gt));
    if (pest === "aforo") $("#g-ok").onclick = () => { actualizarEvento(id, { actuales: Math.max(0, +$("#g-act").value || 0), esperados: Math.max(0, +$("#g-esp").value || 0) }); refrescarTodo(); toast("Aforo actualizado."); gestionar(id, "aforo"); };
    if (pest === "aviso") { $$("[data-pl]").forEach(b => b.onclick = () => { $("#msg").value = b.dataset.pl; }); $("#msg-ok").onclick = () => enviarAviso(id, $("#msg").value.trim()); }
    if (pest === "asistencia") {
      const on = $("#a-on"), off = $("#a-off");
      if (on) on.onclick = () => { actualizarEvento(id, { registro: "qr" }); refrescarTodo(); gestionar(id, "asistencia"); };
      if (off) off.onclick = () => { actualizarEvento(id, { registro: "libre" }); refrescarTodo(); gestionar(id, "asistencia"); };
      const q = $("#a-qr"); if (q) q.onclick = () => qrAsistencia(id);
      $$("[data-ret]").forEach(b => b.onclick = () => { if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = "Confirmar"; return; } const l = asistentes(id); const x = l.splice(+b.dataset.ret, 1)[0]; guardarAsistentes(id, l); toast("Se retiró a " + x.nombre + "."); refrescarTodo(); gestionar(id, "asistencia"); });
      const add = $("#a-add"); if (add) add.onclick = () => { const n = $("#a-nom").value.trim(); if (!n) return; toast(registrarAsistencia(id, { nombre: n, codigo: "" }, "manual").msg); refrescarTodo(); gestionar(id, "asistencia"); };
    }
  }

  // ---------- Asistencia con QR ----------
  function nuevoSecreto() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  const ventana = () => Math.floor(Date.now() / VENTANA_QR_MS);
  const codigoQR = (sec, v) => String(hash(sec + ":" + v) % 10000).padStart(4, "0");
  function codigoValido(id, cod) { const ev = eventosGuardados().find(e => e.id === id); if (!ev || ev.registro !== "qr") return false; const v = ventana(); return [v, v - 1, v - 2].some(w => codigoQR(ev.secreto, w) === String(cod).trim()); }
  function qrSVG(t) { const q = qrcode(0, "M"); q.addData(t); q.make(); return q.createSvgTag({ cellSize: 6, margin: 4, scalable: true }).replace("<svg ", '<svg class="qr" '); }
  function qrAsistencia(id) {
    const ev = eventosGuardados().find(e => e.id === id);
    const pintar = () => {
      const v = ventana(), cod = codigoQR(ev.secreto, v), url = urlBase() + "?asistir=" + encodeURIComponent(id) + "&c=" + cod, q = Math.ceil(((v + 1) * VENTANA_QR_MS - Date.now()) / 1000);
      $("#modal-cuerpo").innerHTML = "<h3>Asistencia · " + esc(ev.nombre) + "</h3>" + qrSVG(url) + '<div class="codigo-grande">' + cod + '</div><p class="muted">Escanea con la cámara o ingresa el código en Menú → Registrar asistencia. Cambia en ' + q + " s.</p><p><b>" + asistentes(id).length + '</b> registrados</p><button class="secondary" id="volver" type="button">Volver</button>';
      $("#volver").onclick = () => gestionar(id, "asistencia");
    };
    abrirModal(""); pintar(); timerModal = setInterval(pintar, 1000);
  }
  function registrarAsistencia(id, p, metodo) {
    const l = asistentes(id), ev = evento(id), clave = x => (x.codigo || x.nombre).toLowerCase();
    if (l.some(x => clave(x) === clave(p))) return { ok: false, msg: p.nombre + " ya estaba registrado." };
    if (ev && l.length + (ev.actuales || 0) >= ev.capacidad) return { ok: false, msg: "El evento alcanzó su capacidad." };
    l.push({ nombre: p.nombre, codigo: p.codigo || "", t: Date.now(), metodo }); guardarAsistentes(id, l);
    return { ok: true, msg: "Asistencia registrada: " + p.nombre };
  }
  function conPerfil(cont) {
    const p = leer("perfil", null); if (p) return cont(p);
    abrirModal('<h3>Tus datos</h3><p class="muted">Necesarios para registrar tu asistencia.</p><input id="pf-n" placeholder="Nombre completo" maxlength="60"><input id="pf-c" placeholder="Carnet o código de estudiante" maxlength="20"><button class="primary full" id="pf-ok" type="button">Continuar</button>');
    $("#pf-ok").onclick = () => { const n = $("#pf-n").value.trim(); if (!n) return toast("Escribe tu nombre."); const per = { nombre: n, codigo: $("#pf-c").value.trim() }; guardar("perfil", per); cerrarModal(); cont(per); };
  }
  function marcarConCodigo(id, cod) {
    const ev = evento(id); if (!ev) return toast("Evento no encontrado.");
    if (!codigoValido(id, cod)) return abrirModal('<div class="aviso error">Código vencido o incorrecto. Vuelve a escanear el QR del organizador (cambia cada 30 s).</div>');
    conPerfil(p => { const r = registrarAsistencia(id, p, "qr"); abrirModal('<div class="aviso ' + (r.ok ? "ok" : "info") + '">' + esc(r.msg) + "</div><p class='muted'>" + esc(ev.nombre) + " · " + esc(ev.lugarInfo.direccion) + '</p><button class="primary full" id="ir-ev" type="button">Cómo llegar</button>'); $("#ir-ev").onclick = () => { cerrarModal(); irEvento(id); }; refrescarTodo(); });
  }
  function pedirCodigo(sel) {
    const ab = eventos().filter(e => e.registro === "qr" && e.estado === "aprobado" && estadoFecha(e) !== "past");
    if (!ab.length) return abrirModal('<div class="aviso info">Ningún evento está registrando asistencia ahora.</div>');
    abrirModal('<h3>Registrar asistencia</h3><select id="c-ev">' + ab.map(e => '<option value="' + e.id + '"' + (e.id === sel ? " selected" : "") + ">" + esc(e.nombre) + '</option>').join("") + '</select><input id="c-cod" inputmode="numeric" maxlength="4" placeholder="Código de 4 dígitos" class="codigo-input"><button class="primary full" id="c-ok" type="button">Registrar</button>');
    $("#c-ok").onclick = () => marcarConCodigo($("#c-ev").value, $("#c-cod").value);
  }
  $("#menu-asistencia").onclick = () => { cerrarMenu(); pedirCodigo(); };

  // ---------- Avisos ----------
  const avisosMios = () => { const s = leer("seguidos", []); return leer("avisos", []).filter(a => s.includes(a.evento)); };
  function enviarAviso(id, texto) {
    if (!texto) return toast("Escribe el aviso o elige una plantilla.");
    const u = leer("ultimo_aviso", {}); if (u[id] && Date.now() - u[id] < ESPERA_AVISO_MS) return toast("Espera un minuto antes de volver a notificar este evento.");
    u[id] = Date.now(); guardar("ultimo_aviso", u);
    const ev = evento(id), av = leer("avisos", []); av.unshift({ t: Date.now(), evento: id, titulo: ev.nombre, texto }); guardar("avisos", av.slice(0, 50));
    if (leer("seguidos", []).includes(id) && "Notification" in window && Notification.permission === "granted") {
      const o = { body: texto, icon: "icono-192.png", data: { url: urlBase() + "?evento=" + id } };
      if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(ev.nombre, o)); else { try { new Notification(ev.nombre, o); } catch (e) {} }
    }
    toast("Notificación enviada a los seguidores de " + ev.nombre + "."); cerrarModal(); pintarBadge();
  }
  function pintarBadge() { const n = avisosMios().length - leer("avisos_leidos", 0); $("#badge-avisos").textContent = n > 0 ? n : ""; }
  $("#btn-avisos").onclick = () => {
    const l = avisosMios(); guardar("avisos_leidos", l.length); pintarBadge();
    abrirModal("<h3>Avisos</h3>" + (l.length ? '<ul class="lista-asis">' + l.map(a => "<li><span><b>" + esc(a.titulo) + "</b><br>" + esc(a.texto) + "<br><small class='muted'>" + fmtHora(a.t) + '</small></span><button class="primary" data-av="' + a.evento + '" type="button">Ir</button></li>').join("") + "</ul>"
      : '<p class="muted">No tienes avisos. Activa "Recibir avisos" en un evento para recibir las notificaciones de sus organizadores.</p>') +
      ("Notification" in window && Notification.permission === "default" ? '<button class="secondary full" id="perm" type="button">Activar notificaciones del dispositivo</button>' : ""));
    $$("[data-av]").forEach(b => b.onclick = () => { cerrarModal(); irEvento(b.dataset.av); });
    const p = $("#perm"); if (p) p.onclick = () => Notification.requestPermission().then(() => cerrarModal()).catch(() => {});
  };

  // =====================================================================
  // ADMINISTRACIÓN
  // =====================================================================
  $$("[data-at]").forEach(b => b.onclick = () => { $$("[data-at]").forEach(x => x.classList.toggle("active", x === b)); ["reservas", "eventos", "mantenimiento"].forEach(k => $("#at-" + k).classList.toggle("hidden", k !== b.dataset.at)); });
  function conflictos(ev) {
    const res = [], ini = new Date(ev.inicio), fin = new Date(ev.fin);
    eventos().forEach(o => { if (o.id !== ev.id && o.estado === "aprobado" && o.lugar === ev.lugar && new Date(o.inicio) < fin && new Date(o.fin) > ini) res.push("Se cruza con " + o.nombre); });
    const a = aula(ev.lugar);
    if (a) horarioAula(a, ini.getDay()).filter(x => x.tipo === "clase").forEach(x => { if (aMin(x.i) < aMin(ev.fin.slice(11, 16)) && aMin(x.f) > aMin(ev.inicio.slice(11, 16))) res.push("Clase de " + x.titulo + " (" + x.i + "–" + x.f + ")"); });
    return res;
  }
  function pintarAdmin() {
    if (sesion.rol !== "admin") return;
    const evs = eventos(), pend = evs.filter(e => e.estado === "pendiente");
    $("#admin-pendientes").innerHTML = pend.map(e => { const c = conflictos(e); return filaEvento(e, '<button class="primary" data-ap="' + e.id + '" type="button">Aprobar</button><button class="danger" data-re="' + e.id + '" type="button">Rechazar</button>').replace("</span></div>", "</span>" + (c.length ? '<span class="tag-acc">Conflicto: ' + esc(c.join("; ")) + "</span>" : '<span class="tag-ok">Sin conflictos de horario</span>') + "</div>"); }).join("") || '<p class="muted">No hay solicitudes pendientes.</p>';
    const fut = evs.filter(e => e.estado === "aprobado" && estadoFecha(e) !== "past").sort((a, b) => a.inicio.localeCompare(b.inicio));
    $("#admin-futuros").innerHTML = fut.map(e => filaEvento(e, '<button class="danger" data-del="' + e.id + '" type="button">Cancelar reserva</button>')).join("") || '<p class="muted">Sin reservas futuras.</p>';
    $("#admin-todos").innerHTML = evs.sort((a, b) => b.inicio.localeCompare(a.inicio)).map(e => filaEvento(e, '<button class="secondary" data-edit2="' + e.id + '" type="button">Editar</button><button class="danger" data-del="' + e.id + '" type="button">Eliminar</button>')).join("");
    $$("[data-ap]").forEach(b => b.onclick = () => { actualizarEvento(b.dataset.ap, { estado: "aprobado" }); toast("Reserva aprobada: el evento ya es público."); refrescarTodo(); });
    $$("[data-re]").forEach(b => b.onclick = () => { guardarEventos(eventosGuardados().filter(e => e.id !== b.dataset.re)); toast("Solicitud rechazada."); refrescarTodo(); });
    $$("[data-del]").forEach(b => b.onclick = () => { if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = "Confirmar"; return; } guardarEventos(eventosGuardados().filter(e => e.id !== b.dataset.del)); toast("Evento eliminado."); refrescarTodo(); });
    $$("[data-edit2]").forEach(b => b.onclick = () => editar(b.dataset.edit2));
    const grupos = {}; D.aristas.forEach(ar => { if (ar.tipo !== "camino" || ar.nombre) grupos[grupoArista(ar)] = grupos[grupoArista(ar)] || ar.tipo; });
    const orden = { ascensor: 0, rampa: 1, escalera: 2, camino: 3 }, cerr = new Set(leer("cerrados", []));
    $("#admin-caminos").innerHTML = Object.keys(grupos).sort((a, b) => orden[grupos[a]] - orden[grupos[b]] || a.localeCompare(b)).map(g => '<label class="' + (cerr.has(g) ? "off" : "") + '"><input type="checkbox" data-cerrar="' + esc(g) + '" ' + (cerr.has(g) ? "checked" : "") + "> " + esc(g) + "</label>").join("");
    $$("[data-cerrar]").forEach(c => c.onchange = () => { const s = new Set(leer("cerrados", [])); c.checked ? s.add(c.dataset.cerrar) : s.delete(c.dataset.cerrar); guardar("cerrados", [...s]); dibujarCaminos(); refrescarTodo(); toast(c.checked ? "Marcado fuera de servicio." : "Habilitado nuevamente."); });
    $("#admin-estado").innerHTML = [["Puntos del campus", D.nodos.length], ["Caminos", D.aristas.length], ["Aulas", D.aulas.length], ["Eventos", evs.length], ["Pendientes", pend.length], ["Fuera de servicio", cerr.size]].map(([t, v]) => "<div><small>" + t + "</small><b>" + v + "</b></div>").join("");
  }
  $("#btn-copiar-datos").onclick = () => { const t = JSON.stringify(eventosGuardados(), null, 2); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("Respaldo copiado al portapapeles."), () => toast("No se pudo copiar.")); };
  $("#btn-reset").onclick = e => { const b = e.currentTarget; if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = "Confirmar restablecer"; return; } Object.keys(localStorage).filter(k => k.startsWith(P)).forEach(k => localStorage.removeItem(k)); sesion = { rol: "visitante" }; b.dataset.seguro = ""; b.textContent = "Restablecer datos de demostración"; refrescarTodo(); irA("events"); toast("Datos restablecidos."); };

  // =====================================================================
  // OTROS
  // =====================================================================
  $("#menu-acerca").onclick = () => { cerrarMenu(); abrirModal('<h3>UCB Events</h3><p class="left">Plataforma de eventos y orientación en el campus de la UCB La Paz. Prototipo para el Reto FDI de TECH MECH 2026.</p><p class="left muted">Sin servidor: los datos se guardan en este navegador. Caminos medidos con Footpath sobre OpenStreetMap. Horarios de aulas de ejemplo.</p>'); };
  $("#chk-accesible").checked = leer("siempre_accesible", false);
  $("#chk-accesible").onchange = () => { guardar("siempre_accesible", $("#chk-accesible").checked); setModo(modoPreferido()); render(); toast($("#chk-accesible").checked ? "Las rutas usarán rampas por defecto." : "Las rutas serán las más cortas por defecto."); };
  let pInst = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); pInst = e; $("#btn-instalar").classList.remove("hidden"); });
  $("#btn-instalar").onclick = () => { if (pInst) { pInst.prompt(); pInst = null; $("#btn-instalar").classList.add("hidden"); } };
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  let tT; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("ver"); clearTimeout(tT); tT = setTimeout(() => t.classList.remove("ver"), 3800); }
  function pintarHero() {
    const ev = eventos().filter(e => e.estado === "aprobado"), vivos = ev.filter(e => estadoFecha(e) === "live").length, prox = ev.filter(e => ["today", "upcoming"].includes(estadoFecha(e))).length;
    $("#hero-stats").innerHTML = "<div><b>" + vivos + "</b><small>en curso</small></div><div><b>" + prox + "</b><small>próximos</small></div><div><b>" + D.aulas.length + "</b><small>aulas</small></div>";
  }
  function refrescarTodo() { pintarSesion(); pintarNavegacion(); opcionesDestino(); prepararForm(); render(); renderManageList(); pintarAdmin(); pintarEventosMapa(); pintarBadge(); pintarHero(); if (seccionActual === "aulas") pintarAulas(); }

  // ---------- Arranque ----------
  dibujarCaminos(); opcionesOrigen(); prepararFiltrosAulas(); pintarCampus();
  const q = new URLSearchParams(location.search);
  ponerOrigen(nodo(q.get("desde")) ? q.get("desde") : "entrada");
  refrescarTodo();
  setModo(q.get("modo") || modoPreferido());
  if (q.get("evento") && evento(q.get("evento"))) irEvento(q.get("evento"), q.get("modo"));
  else if (q.get("hasta") && (aula(q.get("hasta")) || nodo(q.get("hasta")))) irLugar(q.get("hasta"), q.get("modo"));
  else { $("#to").value = "ev:techmech"; if (!$("#to").value) $("#to").value = "coliseo"; irA("events"); }
  if (MODO_APP && !q.get("desde")) pedirGPS(true);
  if (q.get("asistir")) { const id = q.get("asistir"), c = q.get("c") || ""; try { history.replaceState(null, "", urlBase()); } catch (e) {} marcarConCodigo(id, c); }
  // Los eventos aparecen y desaparecen del mapa solos según su horario
  setInterval(() => { pintarEventosMapa(); render(); pintarHero(); }, 60e3);
})();
