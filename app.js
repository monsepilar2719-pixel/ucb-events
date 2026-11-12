// =====================================================================
// UCB EVENTS · lógica de la app
// Interfaz basada en la versión del equipo (tarjetas, pestañas, panel de
// organizadores) + rutas reales, accesibilidad, horario, avisos y asistencia QR.
// Prototipo sin servidor: todo se guarda en el navegador (localStorage).
// =====================================================================
(function () {
  "use strict";
  const D = window.DATOS;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nodo = id => D.nodos.find(n => n.id === id);
  const pad = n => String(n).padStart(2, "0");

  // ---------- Configuración de la demo ----------
  const CUENTAS = { // SOLO DEMOSTRACIÓN: en producción, login institucional y permisos en el servidor
    organizador: { clave: "ucb2026", rol: "organizador", nombre: "Mecacentro UCB" },
    admin:       { clave: "ucb2026", rol: "admin",       nombre: "Administración UCB" },
  };
  const AFORO_VENCE_MS = 2 * 3600e3;  // el aforo declarado vence a las 2 h
  const ESPERA_AVISO_MS = 60e3;       // anti-spam por evento (producción: 30 min)
  const VENTANA_QR_MS = 30e3;         // el QR de asistencia cambia cada 30 s
  const MARGEN_CLASE_S = 180;         // llegar 3 min antes a clase

  // ---------- Almacenamiento ----------
  const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem("ucbev_" + k)); return v == null ? def : v; } catch (e) { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem("ucbev_" + k, JSON.stringify(v)); } catch (e) {} };

  // ---------- Sesión y roles ----------
  let sesion = leer("sesion", { rol: "visitante" });
  const perfil = () => leer("perfil", null);
  const tieneCuenta = () => sesion.rol !== "visitante";
  const esGestor = () => sesion.rol === "organizador" || sesion.rol === "admin";
  const puedeGestionar = ev => sesion.rol === "admin" || (sesion.rol === "organizador" && ev.organizador === sesion.nombre);
  const nombreSesion = () => sesion.rol === "estudiante" ? (perfil() || {}).nombre || "Estudiante" : sesion.rol === "visitante" ? "Visitante" : sesion.nombre;
  const ROL_TXT = { visitante: "Sin cuenta", estudiante: "Estudiante", organizador: "Organizador", admin: "Administrador" };

  // ---------- Eventos ----------
  function eventosGuardados() {
    let evs = leer("eventos", null);
    if (!evs) {
      evs = D.eventos.map(e => Object.assign({ estado: "aprobado", asistencia: false }, e));
      guardar("eventos", evs);
    }
    return evs;
  }
  function guardarEventos(evs) { guardar("eventos", evs); }
  const asistentes = id => leer("asistencias", {})[id] || [];
  function guardarAsistentes(id, lista) { const a = leer("asistencias", {}); a[id] = lista; guardar("asistencias", a); }

  function eventos() {
    const aforos = leer("aforos", {});
    return eventosGuardados().map(e => {
      const ev = Object.assign({}, e);
      if (ev.asistencia) {
        const n = asistentes(ev.id).length;
        ev.aforo_pct = ev.capacidad ? Math.min(100, Math.round(n / ev.capacidad * 100)) : null;
        ev.aforo_auto = true; ev.asistentes_n = n;
      } else if (aforos[ev.id]) {
        const a = aforos[ev.id];
        if (Date.now() - a.t < AFORO_VENCE_MS) { ev.aforo_pct = a.pct; ev.aforo_t = a.t; }
        else ev.aforo_pct = null;
      }
      return ev;
    });
  }
  const evento = id => eventos().find(e => e.id === id);

  function estadoFecha(ev) {
    const ahora = new Date(), ini = new Date(ev.inicio), fin = new Date(ev.fin || ev.inicio);
    if (fin < ahora) return "past";
    if (ini.toDateString() === ahora.toDateString() || (ini <= ahora && fin >= ahora)) return "today";
    return "upcoming";
  }
  const ETQ_FECHA = { past: "Evento pasado", today: "Es hoy", upcoming: "Próximo evento" };
  function nivelAforo(pct) {
    if (pct == null) return { c: "", t: "Aforo sin dato" };
    if (pct >= 100) return { c: "lleno", t: "Lleno" };
    if (pct >= 80) return { c: "alto", t: "Casi lleno" };
    if (pct >= 50) return { c: "medio", t: "Ocupación moderada" };
    return { c: "", t: "Hay espacio" };
  }
  const fmtFecha = iso => new Date(iso).toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short" });
  const fmtHora = t => new Date(t).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
  const fmtMin = s => Math.max(1, Math.round(s / 60)) + " min";

  // =====================================================================
  // NAVEGACIÓN: pestañas y menú desplegable
  // =====================================================================
  const SECCIONES = ["events", "map", "horario", "avisos", "organizer", "admin"];
  function irA(id) {
    if (id === "admin" && sesion.rol !== "admin") id = "organizer";
    SECCIONES.forEach(s => $("#" + s).classList.toggle("hidden", s !== id));
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === id));
    $$(".menu-item[data-ir]").forEach(t => t.classList.toggle("activo", t.dataset.ir === id));
    if (id === "map") setTimeout(() => mapa.invalidateSize(), 50);
    if (id === "avisos") { guardar("avisos_leidos", avisosMios().length); pintarBadge(); pintarAvisos(); }
    if (id === "horario") pintarHorario();
    cerrarMenu();
  }
  $$(".tab").forEach(b => b.onclick = () => irA(b.dataset.tab));
  $$(".menu-item[data-ir]").forEach(b => b.onclick = () => irA(b.dataset.ir));

  function abrirMenu() { $("#menu").classList.add("abierto"); $("#velo").classList.remove("hidden"); $("#menu").setAttribute("aria-hidden", "false"); $("#btn-menu").setAttribute("aria-expanded", "true"); }
  function cerrarMenu() { $("#menu").classList.remove("abierto"); $("#velo").classList.add("hidden"); $("#menu").setAttribute("aria-hidden", "true"); $("#btn-menu").setAttribute("aria-expanded", "false"); }
  $("#btn-menu").onclick = abrirMenu;
  $("#chip-sesion").onclick = abrirMenu;
  $("#btn-cerrar-menu").onclick = cerrarMenu;
  $("#velo").onclick = cerrarMenu;
  document.addEventListener("keydown", e => { if (e.key === "Escape") { cerrarMenu(); cerrarModal(); } });

  function pintarSesion() {
    $("#chip-sesion").textContent = "👤 " + nombreSesion();
    $("#menu-nombre").textContent = nombreSesion();
    $("#menu-rol").textContent = ROL_TXT[sesion.rol];
    $("#menu-admin").classList.toggle("hidden", sesion.rol !== "admin");
    let h = "";
    if (sesion.rol === "visitante") {
      h = '<button class="primary" data-s="estudiante" type="button">🎓 Soy estudiante</button>' +
          '<button class="secondary" data-s="gestor" type="button">🛠️ Ingresar como organizador o admin</button>';
    } else if (sesion.rol === "estudiante") {
      const p = perfil() || {};
      h = '<p class="muted">Código: ' + esc(p.codigo || "—") + '</p><button class="secondary" data-s="editar" type="button">Editar mis datos</button>' +
          '<button class="danger" data-s="salir" type="button">Cerrar sesión</button>';
    } else {
      h = '<button class="secondary" data-s="panel" type="button">Ir a mi panel</button><button class="danger" data-s="salir" type="button">Cerrar sesión</button>';
    }
    $("#menu-sesion").innerHTML = h;
    $$("#menu-sesion [data-s]").forEach(b => b.onclick = () => {
      const a = b.dataset.s;
      if (a === "estudiante" || a === "editar") { cerrarMenu(); pedirPerfil(() => toast("¡Listo! Entraste como estudiante.")); }
      else if (a === "gestor" || a === "panel") irA("organizer");
      else if (a === "salir") cerrarSesion();
    });
  }
  function cambiarSesion(s) { sesion = s; guardar("sesion", s); refrescarTodo(); }
  function cerrarSesion() { cambiarSesion({ rol: "visitante" }); cerrarMenu(); toast("Sesión cerrada."); }

  // =====================================================================
  // MAPA REAL (Leaflet + OpenStreetMap) y PLANO UCB
  // =====================================================================
  const centro = [D.nodos.reduce((s, n) => s + n.lat, 0) / D.nodos.length, D.nodos.reduce((s, n) => s + n.lng, 0) / D.nodos.length];
  const mapa = L.map("mapa", { zoomControl: true }).setView(centro, 18);
  // ---- Fondo del mapa ----
  // Por defecto: OpenFreeMap (datos de OpenStreetMap, gratis, sin clave y sin bloqueos).
  // El servidor tile.openstreetmap.org bloquea a apps como esta (política de uso), por eso no se usa por defecto.
  const CFG = window.MAPA || {};
  const fondo = CFG.fondo || "openfreemap";
  function sinFondo(msg) { $("#mapa").classList.add("sin-fondo"); if (msg) toast(msg); }
  if (fondo === "openfreemap" && L.maplibreGL) {
    try {
      const capa = L.maplibreGL({
        style: "https://tiles.openfreemap.org/styles/" + (CFG.estilo || "positron"),
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(mapa);
      let avisado = false;
      capa.getMaplibreMap().on("error", () => {
        if (!avisado) { avisado = true; sinFondo(navigator.onLine === false ? "Sin internet: el fondo del mapa no carga. Las rutas funcionan igual; usa también «Plano UCB»." : ""); }
      });
    } catch (e) { sinFondo("Este dispositivo no puede dibujar el mapa base. Usa «Plano UCB»; las rutas funcionan igual."); }
  } else if (fondo === "osm" || fondo === "carto") {
    const usarCarto = fondo === "carto" && CFG.carto_key;
    L.tileLayer(usarCarto
      ? "https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=" + encodeURIComponent(CFG.carto_key)
      : "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20, maxNativeZoom: 19, subdomains: "abcd", referrerPolicy: "strict-origin-when-cross-origin",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' + (usarCarto ? ' &copy; <a href="https://carto.com/attribution/">CARTO</a>' : ""),
    }).addTo(mapa);
  } else sinFondo();

  const ESTILO = {
    camino:   { color: "#8e9aa6", weight: 4 },
    rampa:    { color: "#25a58b", weight: 5 },
    escalera: { color: "#d9442b", weight: 4, dashArray: "4 6" },
    ascensor: { color: "#8b4fd6", weight: 5 },
  };
  // Geometría de una arista (si viene de OpenStreetMap/Footpath trae "puntos")
  function geometria(ar, desdeId) {
    const a = nodo(ar.a), b = nodo(ar.b);
    let pts = ar.puntos && ar.puntos.length ? ar.puntos.slice() : [[a.lat, a.lng], [b.lat, b.lng]];
    if (desdeId && desdeId !== ar.a) pts.reverse();
    return pts;
  }
  const grupoArista = ar => ar.nombre || (nodo(ar.a).nombre + " ↔ " + nodo(ar.b).nombre + " (" + ar.tipo + ")");
  function cerradas() {
    const g = new Set(leer("cerrados", []));
    return new Set(D.aristas.map((ar, i) => g.has(grupoArista(ar)) ? i : -1).filter(i => i >= 0));
  }
  const opcionesRuta = () => ({ cerradas: cerradas() });

  const capaCaminos = L.layerGroup().addTo(mapa);
  function dibujarCaminos() {
    capaCaminos.clearLayers();
    const c = cerradas();
    D.aristas.forEach((ar, i) => {
      const a = nodo(ar.a), b = nodo(ar.b);
      if (!a || !b || (a.lat === b.lat && a.lng === b.lng)) return;
      const off = c.has(i);
      L.polyline(geometria(ar), off ? { color: "#000", weight: 3, dashArray: "2 8", opacity: .6 } : (ESTILO[ar.tipo] || ESTILO.camino))
        .bindTooltip((off ? "⛔ CERRADO · " : "") + ar.tipo + (ar.nota ? " · " + ar.nota : "")).addTo(capaCaminos);
    });
  }
  D.nodos.forEach(n => {
    const html = n.tipo === "bano" ? '<div class="pin pin-bano">🚻</div>' : '<div class="pin pin-' + n.tipo + '"></div>';
    const tam = n.tipo === "bano" ? 24 : 14;
    L.marker([n.lat, n.lng], { icon: L.divIcon({ className: "", html, iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2] }), zIndexOffset: n.piso * 10 })
      .addTo(mapa).bindPopup("<b>" + esc(n.nombre) + "</b><br>" + (n.piso ? "Piso " + n.piso : "Planta baja") +
        (n.tipo === "bano" ? (n.accesible ? " · ♿ accesible" : " · no accesible") : "") +
        '<div class="pop-acc"><button class="secondary" data-desde="' + n.id + '">Salgo de aquí</button><button class="primary" data-hasta="' + n.id + '">Ir aquí</button></div>');
  });
  mapa.on("popupopen", e => {
    e.popup.getElement().querySelectorAll("button").forEach(btn => btn.onclick = () => {
      if (btn.dataset.desde) $("#from").value = btn.dataset.desde;
      if (btn.dataset.hasta) $("#to").value = btn.dataset.hasta;
      mapa.closePopup(); pintarPlano();
      if ($("#from").value !== $("#to").value) calcular();
    });
  });

  // ---- Plano UCB (imagen oficial con pines y ruta en SVG) ----
  const etiquetaCorta = n => n.tipo === "bano" ? "🚻" : n.tipo === "entrada" ? "Entrada" : n.id === "coliseo" ? "Coliseo" : n.bloque ? n.bloque : n.nombre.split(" ")[0];
  function pintarPlano(ruta) {
    const desde = origen().id, hasta = $("#to").value;
    $("#plano-pins").innerHTML = D.nodos.filter(n => n.plano && n.piso === 0 && n.tipo !== "punto").map(n =>
      '<button type="button" class="ppin' + (n.tipo === "bano" ? " bano" : "") + (n.id === desde || n.id === hasta ? " sel" : "") +
      '" style="left:' + (n.plano[0] / 643 * 100) + "%;top:" + (n.plano[1] / 490 * 100) + '%" data-n="' + n.id + '" title="' + esc(n.nombre) + '">' + esc(etiquetaCorta(n)) + "</button>").join("");
    $$("#plano-pins .ppin").forEach(b => b.onclick = () => { $("#to").value = b.dataset.n; pintarPlano(); toast("Destino: " + nodo(b.dataset.n).nombre); calcular(); });
    let svg = "";
    if (ruta && ruta.ok) {
      const pts = ruta.nodos.filter(n => n.plano).map(n => n.plano.join(",")).join(" ");
      const ini = ruta.nodos[0].plano, fin = ruta.nodos[ruta.nodos.length - 1].plano;
      svg = '<polyline points="' + pts + '" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<polyline points="' + pts + '" fill="none" stroke="#2f7bf6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
            (ini ? '<circle cx="' + ini[0] + '" cy="' + ini[1] + '" r="7" fill="#2f7bf6" stroke="#fff" stroke-width="3"/>' : "") +
            (fin ? '<circle cx="' + fin[0] + '" cy="' + fin[1] + '" r="8" fill="#e8890c" stroke="#fff" stroke-width="3"/>' : "");
    }
    $("#plano-svg").innerHTML = svg;
  }
  let ultimaRuta = null;
  $$(".seg-btn").forEach(b => b.onclick = () => {
    $$(".seg-btn").forEach(x => x.classList.toggle("active", x === b));
    const plano = b.dataset.vista === "plano";
    $("#plano").classList.toggle("hidden", !plano);
    $("#mapa").classList.toggle("hidden", plano);
    if (!plano) setTimeout(() => mapa.invalidateSize(), 50);
    pintarPlano(ultimaRuta);
  });

  // =====================================================================
  // UBICACIÓN: en la página web se elige a mano; en la app instalada se usa el GPS
  // =====================================================================
  const MODO_APP = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const GPS_ID = "__gps";
  let posGPS = null, marcadorGPS = null, circuloGPS = null, vigilando = null, ultimaPosRuta = null;
  function ponerOpcionGPS() {
    const sel = $("#from");
    if (!sel.querySelector('option[value="' + GPS_ID + '"]')) {
      const o = document.createElement("option"); o.value = GPS_ID; o.textContent = "📍 Mi ubicación (GPS)"; sel.insertBefore(o, sel.firstChild);
    }
  }
  function actualizarGPS(pos, alPrimerFix) {
    const lat = pos.coords.latitude, lng = pos.coords.longitude, acc = pos.coords.accuracy || 30;
    const { nodo: n, distancia } = Ruteo.nodoMasCercano(D, lat, lng);
    if (distancia > 400) {
      if (alPrimerFix) toast("Tu GPS indica que estás fuera del campus (a " + Math.round(distancia) + " m). Elige tu punto de partida en la lista.");
      return false;
    }
    posGPS = { lat, lng, acc, nodo: n.id, dist: distancia };
    if (!marcadorGPS) {
      circuloGPS = L.circle([lat, lng], { radius: acc, color: "#2f7bf6", weight: 1, fillOpacity: .12 }).addTo(mapa);
      marcadorGPS = L.circleMarker([lat, lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#2f7bf6", fillOpacity: 1 }).addTo(mapa).bindTooltip("Estás aquí");
    } else { marcadorGPS.setLatLng([lat, lng]); circuloGPS.setLatLng([lat, lng]).setRadius(acc); }
    ponerOpcionGPS();
    if (alPrimerFix) { $("#from").value = GPS_ID; pintarPlano(ultimaRuta); }
    // Recalcula la ruta si la persona avanzó más de 20 m
    if ($("#from").value === GPS_ID && ultimaRuta && ultimaRuta.ok && (!ultimaPosRuta || Ruteo.haversine(ultimaPosRuta, posGPS) > 20)) calcular();
    return true;
  }
  function pedirGPS(continuo) {
    if (!navigator.geolocation) { toast("Este dispositivo no tiene ubicación. Elige tu punto de partida en la lista."); return; }
    let primero = true;
    const ok = pos => { const v = actualizarGPS(pos, primero); if (primero && v) toast("📍 Usando tu ubicación GPS como punto de partida."); if (primero && v && !continuo) calcular(); primero = false; };
    const err = () => toast("No se pudo obtener tu ubicación. Elige tu punto de partida en la lista o escanea un QR.");
    const opt = { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 };
    if (continuo) { if (vigilando === null) vigilando = navigator.geolocation.watchPosition(ok, err, opt); }
    else navigator.geolocation.getCurrentPosition(ok, err, opt);
  }
  // Origen real de la ruta: un punto del campus, o el más cercano a la posición GPS
  function origen() {
    const v = $("#from").value;
    if (v === GPS_ID && posGPS) return { id: posGPS.nodo, gps: posGPS };
    return { id: v === GPS_ID ? "entrada" : v, gps: null };
  }
  const nombreOrigen = () => origen().gps ? "tu ubicación" : nodo(origen().id).nombre;
  // Agrega a la ruta el tramo desde la posición GPS hasta el punto más cercano
  function conTramoGPS(r, o) {
    if (!r.ok || !o.gps || o.gps.dist < 8) return r;
    const d = Math.round(o.gps.dist);
    return Object.assign({}, r, {
      metros: r.metros + d, segundos: r.segundos + Math.round(d / 1.2), minutos: Math.max(1, Math.round((r.segundos + d / 1.2) / 60)),
      pasos: [{ icono: "📍", texto: "Desde tu ubicación, camina " + d + " m hasta " + nodo(o.id).nombre }].concat(r.pasos), inicioGPS: [o.gps.lat, o.gps.lng],
    });
  }

  // =====================================================================
  // RUTAS
  // =====================================================================
  const ordenNodos = D.nodos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  function opciones(sel, filtro) {
    sel.innerHTML = ordenNodos.filter(filtro || (() => true)).map(n => '<option value="' + n.id + '">' + (n.tipo === "bano" ? "🚻 " : "") + esc(n.nombre) + "</option>").join("");
  }
  opciones($("#from")); opciones($("#to"));
  opciones($("#ev-lugar"), n => n.tipo !== "bano");
  opciones($("#cl-aula"), n => n.tipo !== "bano");
  const modo = () => document.querySelector('input[name="modo"]:checked').value;
  const setModo = m => { const r = document.querySelector('input[name="modo"][value="' + m + '"]'); if (r) r.checked = true; };
  const modoPreferido = () => leer("siempre_accesible", false) ? "accesible" : "corta";

  let capaRuta = null;
  function dibujarRuta(r) {
    ultimaRuta = r;
    if (capaRuta) { mapa.removeLayer(capaRuta); capaRuta = null; }
    pintarPlano(r);
    if (!r || !r.ok) return;
    let coords = [];
    if (r.inicioGPS) coords.push(r.inicioGPS);
    r.tramos.forEach((t, i) => { const g = geometria(t.arista, t.desde.id); coords = coords.concat(i > 0 ? g.slice(1) : g); });
    capaRuta = L.layerGroup([
      L.polyline(coords, { color: "#fff", weight: 11, opacity: .95 }),
      L.polyline(coords, { color: "#2f7bf6", weight: 6 }),
      L.circleMarker(coords[0], { radius: 8, color: "#fff", weight: 3, fillColor: "#2f7bf6", fillOpacity: 1 }),
      L.circleMarker(coords[coords.length - 1], { radius: 9, color: "#fff", weight: 3, fillColor: "#e8890c", fillOpacity: 1 }),
    ]).addTo(mapa);
    if (!$("#mapa").classList.contains("hidden")) mapa.fitBounds(L.latLngBounds(coords).pad(0.4));
  }

  function pintarResultado(r, m, extra) {
    const out = $("#route-result");
    dibujarRuta(r);
    if (!r.ok) {
      out.innerHTML = '<div class="aviso ' + (r.mismoLugar ? "info" : "error") + '"><b>' + (m === "accesible" && !r.mismoLugar ? "♿ " : "") + esc(r.motivo) + "</b>" + (extra || "") + "</div>";
      return;
    }
    const d = r.destino;
    out.innerHTML = '<div class="resumen">' + r.metros + " m · " + r.minutos + " min</div>" +
      '<div class="muted">Hasta <b>' + esc(d.nombre) + "</b> · subida +" + r.subida_m + " m" + (r.bajada_m ? " · bajada −" + r.bajada_m + " m" : "") + "</div>" + (extra || "") +
      "<ol>" + r.pasos.map(p => "<li><span>" + p.icono + "</span><span>" + esc(p.texto) + "</span></li>").join("") +
      "<li><span>🏁</span><span>Llegaste a " + esc(d.nombre) + "</span></li></ol>";
  }

  function calcular() {
    const o = origen(), desde = o.id, hasta = $("#to").value, m = modo();
    actualizarURL();
    if (o.gps) ultimaPosRuta = { lat: o.gps.lat, lng: o.gps.lng };
    const r = conTramoGPS(Ruteo.ruta(D, desde, hasta, m, opcionesRuta()), o);
    let extra = "";
    if (!r.ok && m === "accesible" && !r.mismoLugar) {
      const alt = conTramoGPS(Ruteo.ruta(D, desde, hasta, "corta", opcionesRuta()), o);
      extra = "<br>" + (alt.ok ? "El único acceso disponible tiene gradas (" + alt.metros + " m). " : "") + "Contacta al organizador para trasladar la actividad o coordinar asistencia.";
    } else if (r.ok && m !== "accesible" && r.usaEscaleras) {
      const acc = conTramoGPS(Ruteo.ruta(D, desde, hasta, "accesible", opcionesRuta()), o);
      extra = acc.ok
        ? '<div class="aviso info">♿ Esta ruta tiene gradas. Sin gradas: ' + acc.metros + " m · " + acc.minutos + " min" + (acc.metros > r.metros ? " (+" + (acc.metros - r.metros) + " m)" : "") + ' <button class="secondary" id="btn-ver-acc" type="button">Ver</button></div>'
        : '<div class="aviso error">♿ Este destino no tiene ruta sin gradas disponible.</div>';
    } else if (r.ok && m === "accesible") {
      extra = '<div class="aviso ok">♿ Ruta sin gradas' + (r.usaAscensor ? ", usa ascensor" : "") + ".</div>";
    }
    pintarResultado(r, m, extra);
    const b = $("#btn-ver-acc"); if (b) b.onclick = () => { setModo("accesible"); calcular(); };
  }
  function irRuta(lugar) {
    $("#to").value = lugar;
    if ($("#from").value === lugar) $("#from").value = posGPS ? GPS_ID : "entrada";
    setModo(modoPreferido()); irA("map"); calcular();
  }
  function banoMasCercano() {
    const m = modo(), acc = m === "accesible";
    const o = origen(), r = conTramoGPS(Ruteo.rutaAlMasCercano(D, o.id, n => n.tipo === "bano" && (!acc || n.accesible), m, opcionesRuta()), o);
    if (r.ok) $("#to").value = r.destino.id;
    pintarResultado(r, m, r.ok ? '<div class="aviso info">🚻 Baño más cercano' + (acc ? " accesible" : "") + "</div>" : "");
  }
  $("#route-btn").onclick = calcular;
  $("#btn-bano").onclick = banoMasCercano;
  $$('input[name="modo"]').forEach(r => r.onchange = () => calcular());
  $("#from").onchange = () => { pintarPlano(ultimaRuta); pintarHorario(); };
  $("#to").onchange = () => pintarPlano(ultimaRuta);

  $("#btn-gps").onclick = () => pedirGPS(MODO_APP);
  // Tocar un lugar vacío del mapa: "Estoy aquí" (punto más cercano) o "Voy aquí"
  mapa.on("click", e => {
    const { nodo: n } = Ruteo.nodoMasCercano(D, e.latlng.lat, e.latlng.lng);
    L.popup().setLatLng(e.latlng).setContent("Punto más cercano:<br><b>" + esc(n.nombre) + '</b><div class="pop-acc"><button class="secondary" data-desde="' + n.id + '">Estoy aquí</button><button class="primary" data-hasta="' + n.id + '">Voy aquí</button></div>').openOn(mapa);
  });

  // ---------- Enlaces y compartir ----------
  const urlBase = () => location.href.split("?")[0].split("#")[0];
  function urlRuta(desde, hasta, m) {
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde); if (hasta) p.set("hasta", hasta); if (m && m !== "corta") p.set("modo", m);
    const q = p.toString(); return urlBase() + (q ? "?" + q : "");
  }
  function actualizarURL() { try { history.replaceState(null, "", urlRuta($("#from").value === GPS_ID ? null : $("#from").value, $("#to").value, modo())); } catch (e) {} }
  $("#btn-compartir").onclick = () => {
    const url = urlRuta(null, $("#to").value, modo());
    if (navigator.share) navigator.share({ title: "UCB Events", text: "Así llegas:", url }).catch(() => {});
    else window.open("https://wa.me/?text=" + encodeURIComponent("Así llegas: " + url), "_blank");
  };

  // =====================================================================
  // EVENTOS (tarjetas)
  // =====================================================================
  function linkCalendar(titulo, ini, fin, lugarId, recur) {
    const f = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "T" + pad(d.getHours()) + pad(d.getMinutes()) + "00";
    const l = nodo(lugarId);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(titulo) + "&dates=" + f(ini) + "/" + f(fin) +
      "&ctz=America/La_Paz&location=" + encodeURIComponent((l ? l.nombre : "") + ", UCB La Paz") +
      "&details=" + encodeURIComponent("Cómo llegar: " + urlRuta(null, lugarId)) + (recur ? "&recur=" + encodeURIComponent(recur) : "");
  }
  const accesibleDesdeIngreso = lugar => lugar === "entrada" || Ruteo.ruta(D, "entrada", lugar, "accesible", opcionesRuta()).ok;
  const clavePersona = p => (p.codigo || p.nombre || "").toString().trim().toLowerCase();
  const yaAsistio = id => { const p = perfil(); return !!p && asistentes(id).some(x => clavePersona(x) === clavePersona(p)); };

  function render() {
    const q = $("#search").value.toLowerCase().trim(), cat = $("#category").value, fil = $("#date-filter").value;
    const seguidos = leer("seguidos", []);
    const lista = eventos().filter(ev => {
      if (ev.estado !== "aprobado" && !puedeGestionar(ev)) return false;
      const l = nodo(ev.lugar);
      const texto = (ev.nombre + " " + (l ? l.nombre : "") + " " + (ev.descripcion || "") + " " + ev.organizador).toLowerCase();
      const st = estadoFecha(ev);
      return (!q || texto.includes(q)) && (!cat || ev.categoria === cat) && (fil === "all" || (fil === "past" ? st === "past" : st !== "past"));
    }).sort((a, b) => {
      const ap = estadoFecha(a) === "past", bp = estadoFecha(b) === "past";
      if (ap !== bp) return ap ? 1 : -1;
      return ap ? b.inicio.localeCompare(a.inicio) : a.inicio.localeCompare(b.inicio);
    });
    $("#event-count").textContent = lista.length + " evento(s)";
    $("#event-list").innerHTML = lista.length ? lista.map(ev => {
      const l = nodo(ev.lugar), st = estadoFecha(ev), past = st === "past";
      const niv = nivelAforo(ev.aforo_pct), acc = accesibleDesdeIngreso(ev.lugar);
      const ocup = ev.aforo_auto ? ev.asistentes_n + " / " + ev.capacidad + " asistentes" : (ev.aforo_pct == null ? "Aforo sin dato" : niv.t) + (ev.capacidad ? " · cap. " + ev.capacidad : "");
      return '<article class="event-card ' + (past ? "past-event" : "") + '">' +
        '<div class="event-top"><span class="category-tag">' + esc(ev.categoria || "Evento") + '</span><span class="date-badge ' + (past ? "past" : st === "today" ? "today" : "") + '">' + ETQ_FECHA[st] + "</span></div>" +
        "<h3>" + esc(ev.nombre) + "</h3>" +
        (ev.estado === "pendiente" ? '<span class="tag-pend">Pendiente de aprobación</span>' : "") +
        '<div class="event-meta">📅 ' + fmtFecha(ev.inicio) + " · " + fmtHora(ev.inicio) + "<br>📍 " + esc(l ? l.nombre : ev.lugar) + "<br>🎙️ " + esc(ev.organizador) +
        (ev.descripcion ? "<br>" + esc(ev.descripcion) : "") + "</div>" +
        (acc ? "" : '<span class="tag-acc">♿ Sin acceso sin gradas registrado</span>') +
        '<div class="occupancy"><span class="' + niv.c + '" style="width:' + (ev.aforo_pct || 0) + '%"></span></div>' +
        '<div class="occupancy-label"><span>' + ocup + "</span><b>" + (ev.aforo_pct == null ? "—" : ev.aforo_pct + "%") + "</b></div>" +
        '<div class="card-actions">' +
          '<button class="secondary" data-vermapa="' + ev.lugar + '" type="button">Ver en mapa</button>' +
          (past ? '<button class="secondary" disabled type="button">Evento finalizado</button>' : '<button class="primary" data-route="' + ev.lugar + '" type="button">Cómo llegar</button>') +
        "</div>" +
        (past ? "" : '<div class="card-actions">' +
          '<a class="secondary" target="_blank" rel="noopener" href="' + linkCalendar(ev.nombre, new Date(ev.inicio), new Date(ev.fin || ev.inicio), ev.lugar) + '">+ Calendar</a>' +
          (tieneCuenta() ? '<button class="secondary" data-seguir="' + ev.id + '" type="button">' + (seguidos.includes(ev.id) ? "✓ Siguiendo" : "🔔 Seguir") + "</button>" : "") +
          '<button class="secondary" data-qrev="' + ev.id + '" type="button">QR del evento</button>' +
          (ev.asistencia && ev.estado === "aprobado" ? (yaAsistio(ev.id) ? '<span class="tag-ok">✅ Asistencia registrada</span>' : '<button class="secondary" data-marcar="' + ev.id + '" type="button">✅ Registrar asistencia</button>') : "") +
          (puedeGestionar(ev) ? '<button class="primary" data-gest="' + ev.id + '" type="button">Gestionar</button>' : "") +
        "</div>") +
        "</article>";
    }).join("") : '<p class="muted">No se encontraron eventos.</p>';

    $$("[data-vermapa]").forEach(b => b.onclick = () => { $("#to").value = b.dataset.vermapa; irA("map"); const n = nodo(b.dataset.vermapa); mapa.setView([n.lat, n.lng], 19); pintarPlano(ultimaRuta); });
    $$("[data-route]").forEach(b => b.onclick = () => irRuta(b.dataset.route));
    $$("[data-seguir]").forEach(b => b.onclick = () => {
      const s = new Set(leer("seguidos", [])); s.has(b.dataset.seguir) ? s.delete(b.dataset.seguir) : s.add(b.dataset.seguir);
      guardar("seguidos", [...s]);
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
      render();
    });
    $$("[data-qrev]").forEach(b => b.onclick = () => qrEvento(b.dataset.qrev));
    $$("[data-marcar]").forEach(b => b.onclick = () => pedirCodigo(b.dataset.marcar));
    $$("[data-gest]").forEach(b => b.onclick = () => gestionar(b.dataset.gest, "aforo"));
    renderManageList();
  }
  $("#search").oninput = render; $("#category").onchange = render; $("#date-filter").onchange = render;

  // =====================================================================
  // PANEL DE ORGANIZADORES (login, crear, editar, eliminar, gestionar)
  // =====================================================================
  $("#login-form").onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target), u = f.get("username").trim().toLowerCase(), c = CUENTAS[u];
    if (c && f.get("password") === c.clave) {
      cambiarSesion({ rol: c.rol, usuario: u, nombre: c.nombre });
      $("#login-message").textContent = ""; e.target.reset();
      toast("Bienvenido/a, " + c.nombre + ".");
    } else $("#login-message").textContent = "Usuario o contraseña incorrectos.";
  };
  $("#logout-btn").onclick = () => { cerrarSesion(); resetForm(); };

  function pintarPanelOrg() {
    const dentro = esGestor();
    $("#organizer-login").classList.toggle("hidden", dentro);
    $("#organizer-panel").classList.toggle("hidden", !dentro);
    if (dentro) $("#org-saludo").innerHTML = "Sesión: <b>" + esc(sesion.nombre) + "</b> (" + ROL_TXT[sesion.rol].toLowerCase() + "). " +
      (sesion.rol === "admin" ? "Puedes gestionar todos los eventos y aprobar los pendientes." : "Puedes gestionar tus eventos; los nuevos quedan pendientes hasta que un administrador los apruebe.");
  }
  function resetForm() {
    const f = $("#event-form"); f.reset(); f.elements.id.value = "";
    $("#form-title").textContent = "Crear un evento"; $("#save-event-btn").textContent = "Guardar evento";
    $("#cancel-edit-btn").classList.add("hidden"); $("#form-message").textContent = "";
  }
  $("#cancel-edit-btn").onclick = resetForm;

  function renderManageList() {
    const box = $("#manage-event-list");
    if (!esGestor()) { box.innerHTML = ""; return; }
    const mios = eventos().filter(puedeGestionar).sort((a, b) => b.inicio.localeCompare(a.inicio));
    box.innerHTML = mios.length ? mios.map(ev => '<div class="manage-row"><div class="manage-info"><b>' + esc(ev.nombre) + "</b><span>" +
      fmtFecha(ev.inicio) + " " + fmtHora(ev.inicio) + " · " + ETQ_FECHA[estadoFecha(ev)] + " · " + esc((nodo(ev.lugar) || {}).nombre || ev.lugar) +
      (ev.estado === "pendiente" ? " · ⏳ pendiente" : "") + (ev.asistencia ? " · ✅ asistencia QR (" + asistentes(ev.id).length + ")" : "") + "</span></div>" +
      '<div class="manage-actions">' + (sesion.rol === "admin" && ev.estado === "pendiente" ? '<button class="primary" data-aprobar="' + ev.id + '" type="button">Aprobar</button>' : "") +
      '<button class="primary" data-gest="' + ev.id + '" type="button">Gestionar</button><button class="secondary" data-edit="' + ev.id + '" type="button">Editar</button>' +
      '<button class="danger" data-delete="' + ev.id + '" type="button">Eliminar</button></div></div>').join("") : '<p class="muted">Todavía no tienes eventos.</p>';
    box.querySelectorAll("[data-gest]").forEach(b => b.onclick = () => gestionar(b.dataset.gest, "aforo"));
    box.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editar(b.dataset.edit));
    box.querySelectorAll("[data-aprobar]").forEach(b => b.onclick = () => cambiarEstado(b.dataset.aprobar, "aprobado"));
    box.querySelectorAll("[data-delete]").forEach(b => b.onclick = () => {
      if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = "¿Seguro? Toca otra vez"; return; }
      guardarEventos(eventosGuardados().filter(e => e.id !== b.dataset.delete));
      $("#form-message").textContent = "Evento eliminado."; refrescarTodo();
    });
  }
  function editar(id) {
    const ev = eventosGuardados().find(e => e.id === id); if (!ev) return;
    const f = $("#event-form").elements;
    f.id.value = ev.id; f.name.value = ev.nombre; f.category.value = ev.categoria || ""; f.date.value = ev.inicio.slice(0, 10); f.time.value = ev.inicio.slice(11, 16);
    f.place.value = ev.lugar; f.capacity.value = ev.capacidad || ""; f.description.value = ev.descripcion || ""; f.asistencia.checked = !!ev.asistencia;
    $("#form-title").textContent = "Editar evento"; $("#save-event-btn").textContent = "Guardar cambios"; $("#cancel-edit-btn").classList.remove("hidden");
    irA("organizer"); $("#event-form").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("#event-form").onsubmit = e => {
    e.preventDefault(); if (!esGestor()) return;
    const f = new FormData(e.target), cap = Number(f.get("capacity"));
    if (!Number.isInteger(cap) || cap < 1) { $("#form-message").textContent = "Ingresa una capacidad válida."; return; }
    const inicio = f.get("date") + "T" + f.get("time");
    const finD = new Date(new Date(inicio).getTime() + 2 * 3600e3);
    const fin = finD.getFullYear() + "-" + pad(finD.getMonth() + 1) + "-" + pad(finD.getDate()) + "T" + pad(finD.getHours()) + ":" + pad(finD.getMinutes());
    const datos = { nombre: f.get("name").trim(), categoria: f.get("category"), inicio, fin, lugar: f.get("place"), capacidad: cap, descripcion: f.get("description").trim(), asistencia: !!f.get("asistencia") };
    const evs = eventosGuardados(), id = f.get("id");
    if (id) {
      const ev = evs.find(x => x.id === id);
      if (ev) {
        Object.assign(ev, datos);
        // Si cambia la duración por la fecha nueva se mantiene 2 h desde el inicio
        if (datos.asistencia && !ev.secreto) ev.secreto = nuevoSecreto();
      }
      $("#form-message").textContent = "Cambios guardados.";
    } else {
      evs.push(Object.assign({ id: "ev" + Date.now(), organizador: sesion.nombre, estado: sesion.rol === "admin" ? "aprobado" : "pendiente", aforo_pct: null, secreto: nuevoSecreto() }, datos));
      $("#form-message").textContent = sesion.rol === "admin" ? "Evento publicado." : "Evento enviado: queda pendiente hasta que un administrador lo apruebe.";
    }
    guardarEventos(evs);
    const msg = $("#form-message").textContent; resetForm(); $("#form-message").textContent = msg;
    refrescarTodo();
  };
  function cambiarEstado(id, estado) {
    let evs = eventosGuardados();
    evs = estado ? evs.map(e => e.id === id ? Object.assign(e, { estado }) : e) : evs.filter(e => e.id !== id);
    guardarEventos(evs); toast(estado ? "Evento aprobado: ya es visible para todos." : "Evento rechazado."); refrescarTodo();
  }

  // ---------- Modal "Gestionar" (aforo, avisos, asistencia) ----------
  let timerModal = null;
  function abrirModal(html) { clearInterval(timerModal); timerModal = null; $("#modal-cuerpo").innerHTML = html; $("#modal").classList.remove("hidden"); }
  function cerrarModal() { $("#modal").classList.add("hidden"); clearInterval(timerModal); timerModal = null; }
  $("#modal-cerrar").onclick = cerrarModal;
  $("#modal").onclick = e => { if (e.target.id === "modal") cerrarModal(); };

  function gestionar(id, pestaña) {
    const ev = evento(id); if (!ev || !puedeGestionar(ev)) return;
    const tabs = '<div class="gest-tabs">' + [["aforo", "Aforo"], ["aviso", "Aviso"], ["asistencia", "Asistencia"]]
      .map(([k, t]) => '<button class="secondary' + (k === pestaña ? " active" : "") + '" data-gt="' + k + '" type="button">' + t + "</button>").join("") + "</div>";
    let cuerpo = "";
    if (pestaña === "aforo") {
      cuerpo = ev.asistencia
        ? '<p class="notice">Este evento registra asistencia con QR: el aforo se calcula solo (' + ev.asistentes_n + " / " + ev.capacidad + ").</p>"
        : '<p class="muted">¿Qué porcentaje del lugar está lleno ahora? Vence a las 2 h si no se actualiza.</p>' +
          '<div class="codigo-grande"><span id="pct-v">' + (ev.aforo_pct == null ? 0 : ev.aforo_pct) + "</span>%</div>" +
          '<input type="range" min="0" max="100" step="5" value="' + (ev.aforo_pct || 0) + '" id="pct-r">' +
          '<button class="primary full" id="pct-ok" type="button">Actualizar aforo</button>';
    } else if (pestaña === "aviso") {
      cuerpo = '<p class="muted">Llega a quienes siguen el evento (🔔). Máx. 120 caracteres; un aviso por minuto.</p>' +
        '<textarea id="msg" maxlength="120" rows="3" placeholder="Ej.: Quedan lugares, ¡te esperamos!"></textarea><div class="plantillas">' +
        ["Quedan lugares, ¡te esperamos!", "Empezamos en 10 minutos", "Cambio de sala: revisa la ruta"].map(t => '<button class="secondary" data-pl="' + esc(t) + '" type="button">' + esc(t) + "</button>").join("") +
        '</div><button class="primary full" id="msg-ok" type="button"' + (ev.estado !== "aprobado" ? " disabled" : "") + ">📣 Enviar aviso</button>" +
        (ev.estado !== "aprobado" ? '<p class="muted">Disponible cuando el evento esté aprobado.</p>' : "");
    } else {
      const lista = asistentes(id);
      cuerpo = '<label class="check-line" style="justify-content:center;display:flex;gap:8px"><input type="checkbox" id="asis-on" ' + (ev.asistencia ? "checked" : "") + "> Registrar asistencia con QR</label>" +
        (ev.asistencia ? '<button class="primary full" id="asis-qr" type="button"' + (ev.estado !== "aprobado" ? " disabled" : "") + '>📷 Mostrar QR de asistencia</button>' +
          '<h3 class="left">Asistentes: ' + lista.length + " / " + ev.capacidad + "</h3>" +
          '<ul class="lista-asis">' + (lista.map((p, i) => "<li><span>" + esc(p.nombre) + (p.codigo ? " <small class='muted'>· " + esc(p.codigo) + "</small>" : "") +
            "<br><small class='muted'>" + fmtHora(p.t) + " · " + (p.metodo === "qr" ? "QR" : "manual") + '</small></span><button class="danger" data-ret="' + i + '" type="button">Retirar</button></li>').join("") || '<li class="muted">Nadie registrado todavía.</li>') + "</ul>" +
          '<div class="fila"><input id="asis-nombre" placeholder="Agregar a mano (nombre)"><button class="secondary" id="asis-add" type="button">Agregar</button></div>' +
          '<button class="secondary full" id="asis-copiar" type="button">📋 Copiar lista (para Excel)</button>' : "");
    }
    abrirModal("<h3>" + esc(ev.nombre) + "</h3>" + tabs + cuerpo);
    $$("[data-gt]").forEach(b => b.onclick = () => gestionar(id, b.dataset.gt));
    if (pestaña === "aforo" && !ev.asistencia) {
      $("#pct-r").oninput = () => { $("#pct-v").textContent = $("#pct-r").value; };
      $("#pct-ok").onclick = () => {
        const pct = +$("#pct-r").value, a = leer("aforos", {}); a[id] = { pct, t: Date.now() }; guardar("aforos", a);
        refrescarTodo(); toast("Aforo actualizado: " + pct + " %." + (pct < 50 ? " ¿Avisas a los seguidores que quedan lugares?" : ""));
        if (pct < 50) gestionar(id, "aviso"); else cerrarModal();
      };
    }
    if (pestaña === "aviso") {
      $$("[data-pl]").forEach(b => b.onclick = () => { $("#msg").value = b.dataset.pl; });
      $("#msg-ok").onclick = () => enviarAviso(id, $("#msg").value.trim());
    }
    if (pestaña === "asistencia") {
      $("#asis-on").onchange = () => {
        const evs = eventosGuardados(), e2 = evs.find(x => x.id === id);
        e2.asistencia = $("#asis-on").checked; if (!e2.secreto) e2.secreto = nuevoSecreto();
        guardarEventos(evs); refrescarTodo(); gestionar(id, "asistencia");
      };
      const q = $("#asis-qr"); if (q) q.onclick = () => qrAsistencia(id);
      $$("[data-ret]").forEach(b => b.onclick = () => {
        if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = "¿Seguro?"; return; }
        const l = asistentes(id), quitado = l.splice(+b.dataset.ret, 1)[0]; guardarAsistentes(id, l);
        toast("Se retiró a " + quitado.nombre + "."); refrescarTodo(); gestionar(id, "asistencia");
      });
      const add = $("#asis-add"); if (add) add.onclick = () => {
        const nombre = $("#asis-nombre").value.trim(); if (!nombre) { toast("Escribe el nombre."); return; }
        toast(registrarAsistencia(id, { nombre, codigo: "" }, "manual").msg); refrescarTodo(); gestionar(id, "asistencia");
      };
      const cp = $("#asis-copiar"); if (cp) cp.onclick = () => {
        const txt = ["Nombre\tCódigo\tHora\tMétodo"].concat(asistentes(id).map(p => [p.nombre, p.codigo || "", new Date(p.t).toLocaleString("es-BO"), p.metodo].join("\t"))).join("\n");
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast("Lista copiada: pégala en Excel o Sheets."), () => descargar(txt, ev.nombre));
      };
    }
  }
  function descargar(txt, nombre) {
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + txt.replace(/\t/g, ",")], { type: "text/csv;charset=utf-8" }));
      a.download = "asistencia_" + nombre.replace(/[^\w]+/g, "_") + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast("No se pudo copiar ni descargar la lista."); }
  }

  // =====================================================================
  // ASISTENCIA CON QR
  // =====================================================================
  const nuevoSecreto = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  function codigoQR(secreto, ventana) {
    let h = 2166136261; const s = secreto + ":" + ventana;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return String((h >>> 0) % 10000).padStart(4, "0");
  }
  const ventana = () => Math.floor(Date.now() / VENTANA_QR_MS);
  function codigoValido(id, cod) {
    const ev = eventosGuardados().find(e => e.id === id);
    if (!ev || !ev.asistencia || !ev.secreto) return false;
    const v = ventana(); return [v, v - 1, v - 2].some(w => codigoQR(ev.secreto, w) === String(cod).trim());
  }
  function qrSVG(texto) {
    const q = qrcode(0, "M"); q.addData(texto); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 4, scalable: true }).replace("<svg ", '<svg class="qr" ');
  }
  function qrAsistencia(id) {
    const ev = eventosGuardados().find(e => e.id === id);
    const pintar = () => {
      const v = ventana(), cod = codigoQR(ev.secreto, v);
      const url = urlBase() + "?asistir=" + encodeURIComponent(id) + "&c=" + cod;
      const quedan = Math.ceil(((v + 1) * VENTANA_QR_MS - Date.now()) / 1000);
      $("#modal-cuerpo").innerHTML = "<h3>Asistencia · " + esc(ev.nombre) + "</h3>" + qrSVG(url) + '<div class="codigo-grande">' + cod + "</div>" +
        '<p class="muted">Escanea con la cámara, o en la app: menú ☰ → Registrar asistencia y escribe el código. Cambia en <b>' + quedan + " s</b>.</p>" +
        "<p><b>" + asistentes(id).length + "</b> asistentes registrados</p>" + '<button class="secondary" id="volver-gest" type="button">← Volver</button>';
      $("#volver-gest").onclick = () => gestionar(id, "asistencia");
    };
    abrirModal(""); pintar(); timerModal = setInterval(pintar, 1000);
  }
  function qrEvento(id) {
    const ev = evento(id), url = urlBase() + "?evento=" + encodeURIComponent(id);
    abrirModal("<h3>" + esc(ev.nombre) + "</h3>" + qrSVG(url) + '<p class="muted">QR para el afiche: abre la ruta hasta ' + esc(nodo(ev.lugar).nombre) + "</p><input readonly value=\"" + esc(url) + '">');
  }
  function registrarAsistencia(id, persona, metodo) {
    const l = asistentes(id), ev = evento(id);
    if (l.some(x => clavePersona(x) === clavePersona(persona))) return { ok: false, msg: persona.nombre + " ya tenía la asistencia registrada." };
    if (ev && ev.capacidad && l.length >= ev.capacidad) return { ok: false, msg: "El evento ya alcanzó su capacidad (" + ev.capacidad + ")." };
    l.push({ nombre: persona.nombre, codigo: persona.codigo || "", t: Date.now(), metodo }); guardarAsistentes(id, l);
    return { ok: true, msg: "✅ Asistencia registrada: " + persona.nombre + " · " + (ev ? ev.nombre : "") };
  }
  function pedirPerfil(continuar) {
    const p = perfil() || {};
    abrirModal("<h3>Tus datos de estudiante</h3><p class='muted'>Se usan para tu horario y para registrar tu asistencia. En la versión final se toman de tu cuenta institucional.</p>" +
      '<input id="pf-nombre" placeholder="Nombre completo" maxlength="60" value="' + esc(p.nombre || "") + '"><input id="pf-codigo" placeholder="Código de estudiante o CI" maxlength="20" value="' + esc(p.codigo || "") + '">' +
      '<button class="primary full" id="pf-ok" type="button">Continuar</button>');
    $("#pf-ok").onclick = () => {
      const nombre = $("#pf-nombre").value.trim(), codigo = $("#pf-codigo").value.trim();
      if (!nombre) { toast("Escribe tu nombre."); return; }
      guardar("perfil", { nombre, codigo });
      if (sesion.rol === "visitante") cambiarSesion({ rol: "estudiante" }); else refrescarTodo();
      cerrarModal(); continuar({ nombre, codigo });
    };
  }
  const conPerfil = cont => (sesion.rol !== "visitante" && perfil()) ? cont(perfil()) : pedirPerfil(cont);
  function marcarConCodigo(id, cod) {
    const ev = evento(id);
    if (!ev) { toast("Evento no encontrado."); return; }
    if (!codigoValido(id, cod)) { abrirModal('<div class="aviso error"><b>Código vencido o incorrecto.</b><br>Vuelve a escanear el QR del organizador (cambia cada 30 s).</div>'); return; }
    conPerfil(p => {
      const r = registrarAsistencia(id, p, "qr");
      abrirModal('<div class="aviso ' + (r.ok ? "ok" : "info") + '"><b>' + esc(r.msg) + '</b></div><p class="muted">' + fmtFecha(ev.inicio) + " · " + esc(nodo(ev.lugar).nombre) + "</p>" +
        '<button class="primary full" id="ir-ev" type="button">Cómo llegar</button>');
      $("#ir-ev").onclick = () => { cerrarModal(); irRuta(ev.lugar); };
      refrescarTodo();
    });
  }
  function pedirCodigo(idSel) {
    const abiertos = eventos().filter(e => e.asistencia && e.estado === "aprobado" && estadoFecha(e) !== "past");
    if (!abiertos.length) { abrirModal('<div class="aviso info">Ningún evento está registrando asistencia en este momento.</div>'); return; }
    abrirModal("<h3>Registrar asistencia</h3><p class='muted'>Escanea el QR del organizador con la cámara, o elige el evento y escribe el código de 4 dígitos.</p>" +
      '<select id="cod-ev">' + abiertos.map(e => '<option value="' + e.id + '"' + (e.id === idSel ? " selected" : "") + ">" + esc(e.nombre) + "</option>").join("") + "</select>" +
      '<input id="cod-asis" inputmode="numeric" maxlength="4" placeholder="0000" class="codigo-input"><button class="primary full" id="cod-ok" type="button">Registrar</button>');
    $("#cod-ok").onclick = () => marcarConCodigo($("#cod-ev").value, $("#cod-asis").value);
  }
  $("#menu-asistencia").onclick = () => { cerrarMenu(); pedirCodigo(); };

  // =====================================================================
  // AVISOS
  // =====================================================================
  const avisosMios = () => { const s = leer("seguidos", []); return tieneCuenta() ? leer("avisos", []).filter(a => s.includes(a.evento)) : []; };
  function enviarAviso(id, texto) {
    if (!texto) { toast("Escribe el aviso o elige una plantilla."); return; }
    const ult = leer("ultimo_aviso", {});
    if (ult[id] && Date.now() - ult[id] < ESPERA_AVISO_MS) { toast("Anti-spam: espera " + Math.ceil((ESPERA_AVISO_MS - (Date.now() - ult[id])) / 1000) + " s para volver a avisar."); return; }
    ult[id] = Date.now(); guardar("ultimo_aviso", ult);
    const ev = evento(id), av = leer("avisos", []);
    av.unshift({ t: Date.now(), evento: id, titulo: ev.nombre, texto }); guardar("avisos", av.slice(0, 50));
    if (leer("seguidos", []).includes(id)) notificar(ev.nombre, texto, ev.lugar);
    toast("📣 Aviso enviado a los seguidores de " + ev.nombre + "."); cerrarModal(); pintarBadge(); pintarAvisos();
  }
  function notificar(titulo, cuerpo, lugar) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opts = { body: cuerpo, icon: "icono-192.png", data: { url: urlRuta(null, lugar) } };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(titulo, opts));
    else { try { new Notification(titulo, opts); } catch (e) {} }
  }
  function pintarAvisos() {
    const l = avisosMios();
    $("#lista-avisos").innerHTML = !tieneCuenta()
      ? '<p class="notice">Abre el menú ☰ → <b>Soy estudiante</b> para seguir eventos y recibir avisos.</p>'
      : l.map(a => { const ev = evento(a.evento); return '<div class="manage-row"><div class="manage-info"><b>📣 ' + esc(a.titulo) + "</b><span>" + esc(a.texto) + " · " + fmtHora(a.t) + "</span></div>" +
          (ev ? '<div class="manage-actions"><button class="primary" data-ira="' + ev.lugar + '" type="button">Cómo llegar</button></div>' : "") + "</div>"; }).join("") ||
        '<p class="muted">Aún no hay avisos. Sigue un evento (🔔 Seguir) para recibir los avisos de sus organizadores.</p>';
    $$("[data-ira]").forEach(b => b.onclick = () => irRuta(b.dataset.ira));
    $("#btn-permiso").classList.toggle("hidden", !tieneCuenta() || !("Notification" in window) || Notification.permission !== "default");
  }
  $("#btn-permiso").onclick = () => Notification.requestPermission().then(pintarAvisos).catch(() => {});
  function pintarBadge() {
    const n = avisosMios().length - leer("avisos_leidos", 0);
    $("#badge-avisos").textContent = n > 0 ? n : "";
    $("#badge-menu").classList.toggle("hidden", !(n > 0));
  }

  // =====================================================================
  // MI HORARIO
  // =====================================================================
  const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"], DIAS_RR = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  function pintarHorario() {
    const sin = sesion.rol === "visitante";
    $("#horario-sin-cuenta").classList.toggle("hidden", !sin);
    $("#horario-contenido").classList.toggle("hidden", sin);
    if (sin) return;
    const clases = leer("clases", []), ahora = new Date();
    let prox = null;
    clases.filter(c => c.nodo).forEach(c => { const d = Horario.proximaOcurrencia(c, ahora); if (d && (!prox || d < prox.fecha)) prox = { c, fecha: d }; });
    if (prox) {
      const m = modoPreferido(), o = origen(), r = conTramoGPS(Ruteo.ruta(D, o.id, prox.c.nodo, m, opcionesRuta()), o), seg = r.ok ? r.segundos : 0;
      const salir = Math.round((prox.fecha - ahora) / 1000 - seg - MARGEN_CLASE_S);
      const cuando = prox.fecha.toDateString() === ahora.toDateString() ? "Hoy" : DIAS[prox.fecha.getDay()];
      const txt = salir <= 0 ? "<b class='urg'>¡Sal ya!</b>" : salir < 3 * 3600 ? "Sal en <b>" + fmtMin(salir) + "</b>" : "Sal a las <b>" + fmtHora(prox.fecha.getTime() - (seg + MARGEN_CLASE_S) * 1000) + "</b>";
      $("#proxima-clase").innerHTML = '<div class="prox"><p class="eyebrow">PRÓXIMA CLASE</p><b style="font:800 20px Manrope">' + esc(prox.c.materia) + "</b><span>" + cuando + " " + prox.c.inicio + " · " + esc(nodo(prox.c.nodo).nombre) + "</span>" +
        "<span>" + txt + (r.ok ? " · " + r.metros + " m desde " + esc(nombreOrigen()) + (m === "accesible" ? " (sin gradas)" : "") : "") + "</span>" +
        '<button class="primary" data-clase="' + prox.c.nodo + '" type="button">Cómo llegar</button></div>';
    } else $("#proxima-clase").innerHTML = '<p class="notice">Importa tu horario o agrega tus clases para ver a qué hora salir.</p>';

    $("#lista-clases").innerHTML = clases.map((c, i) => {
      const n = c.nodo && nodo(c.nodo), d = Horario.proximaOcurrencia(c, ahora) || new Date();
      const [h1, m1] = c.inicio.split(":").map(Number), [h2, m2] = c.fin.split(":").map(Number);
      const ini = new Date(d); ini.setHours(h1, m1); const fin = new Date(d); fin.setHours(h2, m2);
      return '<div class="manage-row"><div class="manage-info"><b>' + esc(c.materia) + "</b><span>" + c.dias.map(x => DIAS[x]).join(", ") + " · " + c.inicio + "–" + c.fin + " · " +
        (n ? esc(n.nombre) : '<span class="tag-acc">Aula no reconocida: ' + esc(c.ubicacion || "sin ubicación") + "</span>") + "</span>" +
        (n ? "" : '<select data-asig="' + i + '"><option value="">Asignar aula…</option>' + ordenNodos.filter(x => x.tipo !== "bano").map(x => '<option value="' + x.id + '">' + esc(x.nombre) + "</option>").join("") + "</select>") +
        '</div><div class="manage-actions">' + (n ? '<button class="primary" data-clase="' + n.id + '" type="button">Cómo llegar</button><a class="secondary" target="_blank" rel="noopener" href="' +
        linkCalendar(c.materia, ini, fin, n.id, "RRULE:FREQ=WEEKLY;BYDAY=" + c.dias.map(x => DIAS_RR[x]).join(",")) + '">+ Calendar</a>' : "") +
        '<button class="danger" data-borrar="' + i + '" type="button">Quitar</button></div></div>';
    }).join("") || '<p class="muted">Sin clases cargadas.</p>';
    $$("[data-clase]").forEach(b => b.onclick = () => irRuta(b.dataset.clase));
    $$("[data-borrar]").forEach(b => b.onclick = () => { const cl = leer("clases", []); cl.splice(+b.dataset.borrar, 1); guardar("clases", cl); pintarHorario(); });
    $$("[data-asig]").forEach(s => s.onchange = () => { const cl = leer("clases", []); cl[+s.dataset.asig].nodo = s.value || null; guardar("clases", cl); pintarHorario(); });
  }
  $("#archivo-ics").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      const nuevas = Horario.leerICS(txt).map(c => Object.assign(c, { nodo: (Horario.reconocerAula(D, c.ubicacion) || {}).id || null }));
      if (!nuevas.length) { toast("No se encontraron clases en el archivo."); return; }
      guardar("clases", leer("clases", []).concat(nuevas));
      toast(nuevas.length + " clases importadas · " + nuevas.filter(c => c.nodo).length + " con aula reconocida.");
      e.target.value = ""; pintarHorario();
    });
  };
  $("#btn-agregar-clase").onclick = () => {
    const materia = $("#cl-materia").value.trim(), dias = $$(".cl-dia:checked").map(x => +x.value), inicio = $("#cl-inicio").value, fin = $("#cl-fin").value;
    if (!materia || !dias.length || !inicio || !fin) { toast("Completa materia, días y horario."); return; }
    const n = nodo($("#cl-aula").value), cl = leer("clases", []);
    cl.push({ materia, dias, inicio, fin, ubicacion: n.nombre, nodo: n.id }); guardar("clases", cl);
    $("#cl-materia").value = ""; $$(".cl-dia").forEach(x => { x.checked = false; }); pintarHorario();
  };
  $("#btn-borrar-horario").onclick = e => {
    const b = e.currentTarget;
    if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { b.dataset.seguro = ""; b.textContent = "Quitar todo el horario"; }, 4000); return; }
    b.dataset.seguro = ""; b.textContent = "Quitar todo el horario"; guardar("clases", []); pintarHorario();
  };

  // =====================================================================
  // ADMINISTRACIÓN
  // =====================================================================
  function pintarAdmin() {
    if (sesion.rol !== "admin") return;
    const pend = eventosGuardados().filter(e => e.estado === "pendiente");
    $("#admin-pendientes").innerHTML = pend.length ? pend.map(e => '<div class="manage-row"><div class="manage-info"><b>' + esc(e.nombre) + "</b><span>" + fmtFecha(e.inicio) + " " + fmtHora(e.inicio) + " · " +
      esc(nodo(e.lugar).nombre) + " · " + esc(e.organizador) + '</span></div><div class="manage-actions"><button class="primary" data-ap="' + e.id + '" type="button">Aprobar</button><button class="danger" data-re="' + e.id + '" type="button">Rechazar</button></div></div>').join("")
      : '<p class="muted">No hay eventos pendientes.</p>';
    $$("[data-ap]").forEach(b => b.onclick = () => cambiarEstado(b.dataset.ap, "aprobado"));
    $$("[data-re]").forEach(b => b.onclick = () => cambiarEstado(b.dataset.re, null));
    const grupos = {}; D.aristas.forEach(ar => { grupos[grupoArista(ar)] = grupos[grupoArista(ar)] || ar.tipo; });
    const orden = { ascensor: 0, rampa: 1, camino: 2, escalera: 3 }, cerr = new Set(leer("cerrados", []));
    $("#admin-caminos").innerHTML = Object.keys(grupos).sort((a, b) => orden[grupos[a]] - orden[grupos[b]] || a.localeCompare(b)).map(g =>
      '<label class="' + (cerr.has(g) ? "off" : "") + '"><input type="checkbox" data-cerrar="' + esc(g) + '" ' + (cerr.has(g) ? "checked" : "") + "> ⛔ " +
      { ascensor: "🛗", rampa: "♿", camino: "🚶", escalera: "🪜" }[grupos[g]] + " " + esc(g) + "</label>").join("");
    $$("[data-cerrar]").forEach(c => c.onchange = () => {
      const s = new Set(leer("cerrados", [])); c.checked ? s.add(c.dataset.cerrar) : s.delete(c.dataset.cerrar); guardar("cerrados", [...s]);
      dibujarCaminos(); refrescarTodo(); toast(c.checked ? "Marcado fuera de servicio: las rutas ya lo evitan." : "Habilitado nuevamente.");
    });
  }

  // =====================================================================
  // ACERCA DE, INSTALACIÓN, TOAST
  // =====================================================================
  $("#menu-acerca").onclick = () => {
    cerrarMenu();
    abrirModal('<h3>UCB Events</h3><p class="muted left">Eventos de la UCB y rutas dentro del campus, con rutas sin gradas, baños, horario de clases, avisos de organizadores y asistencia con QR. Prototipo para TECH MECH 2026 (Reto FDI).</p>' +
      '<p class="muted left">Prototipo sin servidor: los datos se guardan en este navegador. Mapa © colaboradores de OpenStreetMap. Ubicaciones provisionales por verificar en el campus.</p>' +
      '<button class="danger" id="reset-demo" type="button">Restablecer datos de demostración</button>');
    $("#reset-demo").onclick = e => {
      const b = e.currentTarget; if (b.dataset.seguro !== "1") { b.dataset.seguro = "1"; b.textContent = "¿Seguro? Toca otra vez"; return; }
      Object.keys(localStorage).filter(k => k.startsWith("ucbev_")).forEach(k => localStorage.removeItem(k));
      sesion = { rol: "visitante" }; cerrarModal(); refrescarTodo(); toast("Datos de demostración restablecidos.");
    };
  };
  $("#chk-accesible").checked = leer("siempre_accesible", false);
  $("#chk-accesible").onchange = () => { guardar("siempre_accesible", $("#chk-accesible").checked); setModo(modoPreferido()); pintarHorario(); toast($("#chk-accesible").checked ? "♿ Las rutas serán sin gradas por defecto." : "Rutas más cortas por defecto."); };

  let promptInstalar = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); promptInstalar = e; $("#btn-instalar").classList.remove("hidden"); });
  $("#btn-instalar").onclick = () => { if (promptInstalar) { promptInstalar.prompt(); promptInstalar = null; $("#btn-instalar").classList.add("hidden"); } };
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

  let tToast;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("ver"); clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove("ver"), 3800); }

  function refrescarTodo() { pintarSesion(); pintarPanelOrg(); render(); pintarHorario(); pintarAvisos(); pintarBadge(); pintarAdmin(); }

  // =====================================================================
  // ARRANQUE: ?desde= &hasta= &evento= &modo= &asistir= &c=
  // =====================================================================
  dibujarCaminos();
  const q = new URLSearchParams(location.search);
  $("#from").value = nodo(q.get("desde")) ? q.get("desde") : "entrada";
  const evQ = q.get("evento") && evento(q.get("evento"));
  const hasta = evQ ? evQ.lugar : q.get("hasta");
  $("#to").value = nodo(hasta) ? hasta : "coliseo";
  setModo(q.get("modo") || modoPreferido());
  refrescarTodo();
  pintarPlano();
  if (hasta && nodo(hasta)) { irA("map"); calcular(); } else irA("events");
  if (MODO_APP && !q.get("desde")) pedirGPS(true);  // App instalada: usa el GPS automáticamente
  $("#btn-gps").textContent = MODO_APP ? "📍 Usar mi ubicación (GPS)" : "📍 Usar mi ubicación (opcional)";
  if (q.get("asistir")) { const id = q.get("asistir"), c = q.get("c") || ""; try { history.replaceState(null, "", urlBase()); } catch (e) {} marcarConCodigo(id, c); }
  setInterval(() => { if (!$("#horario").classList.contains("hidden")) pintarHorario(); }, 60e3);
})();
