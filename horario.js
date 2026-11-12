// =====================================================================
// HORARIO DE CLASES: lectura de archivos .ics (Google Calendar, Outlook…)
// y reconocimiento del aula escrita en la clase → nodo del mapa.
// Funciones puras (sin DOM).
// =====================================================================
(function (global) {
  const DIAS_ICS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  const normalizar = s => (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

  // Busca el nodo cuyo alias/nombre aparece en el texto de ubicación.
  function reconocerAula(datos, texto) {
    const t = normalizar(texto);
    if (!t) return null;
    let mejor = null, largo = 0;
    datos.nodos.forEach(n => {
      [n.id, n.nombre].concat(n.alias || []).forEach(a => {
        const na = normalizar(a);
        // Los alias con números (C-201) pesan más que los genéricos (Bloque C)
        const peso = na.length + (/[0-9]/.test(na) ? 100 : 0);
        if (na.length >= 3 && t.includes(na) && peso > largo) { mejor = n; largo = peso; }
      });
    });
    return mejor;
  }

  // "20261112T081500" o "20261112T121500Z" → {dia, hora "HH:MM"} en hora local
  function leerFechaICS(valor, esUTC) {
    const m = valor.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
    if (!m) return null;
    let d;
    if (esUTC) d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
    else d = new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    const pad = n => String(n).padStart(2, "0");
    return { dia: d.getDay(), hora: pad(d.getHours()) + ":" + pad(d.getMinutes()) };
  }

  // Devuelve [{materia, dias:[0-6], inicio, fin, ubicacion}]
  function leerICS(texto) {
    const lineas = texto.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
    const clases = [];
    let ev = null;
    lineas.forEach(l => {
      if (l.startsWith("BEGIN:VEVENT")) ev = {};
      else if (l.startsWith("END:VEVENT")) {
        if (ev && ev.inicio) {
          clases.push({
            materia: ev.materia || "Clase",
            dias: ev.dias && ev.dias.length ? ev.dias : [ev.inicio.dia],
            inicio: ev.inicio.hora,
            fin: ev.fin ? ev.fin.hora : ev.inicio.hora,
            ubicacion: ev.ubicacion || "",
          });
        }
        ev = null;
      } else if (ev) {
        const i = l.indexOf(":");
        if (i < 0) return;
        const clave = l.slice(0, i), valor = l.slice(i + 1).replace(/\\,/g, ",").replace(/\\n/g, " ");
        const nombre = clave.split(";")[0];
        if (nombre === "SUMMARY") ev.materia = valor;
        else if (nombre === "LOCATION") ev.ubicacion = valor;
        else if (nombre === "DTSTART") ev.inicio = leerFechaICS(valor, valor.endsWith("Z"));
        else if (nombre === "DTEND") ev.fin = leerFechaICS(valor, valor.endsWith("Z"));
        else if (nombre === "RRULE") {
          const by = (valor.match(/BYDAY=([^;]+)/) || [])[1];
          if (by) ev.dias = by.split(",").map(x => DIAS_ICS[x.replace(/[^A-Z]/g, "")]).filter(x => x != null);
        }
      }
    });
    return clases;
  }

  // Próxima ocurrencia de una clase a partir de "ahora" → Date
  function proximaOcurrencia(clase, ahora) {
    const [h, m] = clase.inicio.split(":").map(Number);
    let mejor = null;
    for (let k = 0; k < 8; k++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + k, h, m);
      if (clase.dias.includes(d.getDay()) && d > ahora && (!mejor || d < mejor)) mejor = d;
    }
    return mejor;
  }

  const API = { leerICS, reconocerAula, proximaOcurrencia, normalizar };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.Horario = API;
})(typeof window !== "undefined" ? window : globalThis);
