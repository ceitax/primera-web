const header = document.querySelector(".site-header");
const toggle = document.querySelector(".nav-toggle");

if (header && toggle) {
  toggle.addEventListener("click", () => {
    const abierto = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(abierto));
  });
}

const pagina = location.pathname.split("/").pop() || "index.html";

document.querySelectorAll(".nav a").forEach((enlace) => {
  const destino = enlace.getAttribute("href") || "";
  if (destino.includes("#")) return;

  const archivo = destino.split("/").pop();
  const esInicio = archivo === "index.html" && (pagina === "" || pagina === "index.html");
  if (esInicio || archivo === pagina) {
    enlace.setAttribute("aria-current", "page");
  }
});

const contenedorMapa = document.getElementById("mapa");
const HOJA_ID = "1VJmhwBhxQ1FA1zznP4lPfSvAcH8S3F6xUhazVTxLkUE";
const CLAVES_LAT = ["lat", "latitud", "latitude", "y"];
const CLAVES_LNG = ["lng", "lon", "long", "longitud", "longitude", "x"];
const CLAVES_NOMBRE = ["nombre", "name", "proyecto", "titulo", "parcela", "lote", "lugar", "obra"];

function textoPlano(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escapar(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function aNumero(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (valor == null || valor === "") return null;
  const numero = Number(String(valor).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

function cargarHoja(nombre) {
  return new Promise((resolve, reject) => {
    const callback = "flcHoja_" + Date.now();
    const script = document.createElement("script");
    let cerrado = false;

    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      clearTimeout(tiempo);
      delete window[callback];
      script.remove();
    };

    const tiempo = setTimeout(() => {
      cerrar();
      reject(new Error("tiempo"));
    }, 8000);

    window[callback] = (respuesta) => {
      cerrar();
      if (!respuesta || respuesta.status !== "ok" || !respuesta.table) {
        reject(new Error("hoja"));
        return;
      }
      resolve(respuesta.table);
    };

    script.onerror = () => {
      cerrar();
      reject(new Error("red"));
    };

    script.src =
      "https://docs.google.com/spreadsheets/d/" +
      HOJA_ID +
      "/gviz/tq?tqx=out:json;responseHandler:" +
      callback +
      "&sheet=" +
      encodeURIComponent(nombre);

    document.head.appendChild(script);
  });
}

function filasDeTabla(tabla) {
  const columnas = (tabla.cols || []).map((columna, indice) => ({
    indice,
    clave: textoPlano(columna.label || columna.id || "columna " + (indice + 1)),
    etiqueta: columna.label || columna.id || "Columna " + (indice + 1),
  }));

  return (tabla.rows || []).map((fila) => {
    const registro = {};
    columnas.forEach((columna) => {
      const celda = fila.c ? fila.c[columna.indice] : null;
      const valor = celda ? (celda.f ?? celda.v) : "";
      registro[columna.clave] = valor ?? "";
      registro._etiquetas = registro._etiquetas || {};
      registro._etiquetas[columna.clave] = columna.etiqueta;
    });
    return registro;
  });
}

function buscarClave(registro, claves) {
  return claves.find((clave) => Object.prototype.hasOwnProperty.call(registro, clave));
}

function coordenadas(registro) {
  const claveLat = buscarClave(registro, CLAVES_LAT);
  const claveLng = buscarClave(registro, CLAVES_LNG);
  if (claveLat && claveLng) {
    const lat = aNumero(registro[claveLat]);
    const lng = aNumero(registro[claveLng]);
    if (lat != null && lng != null) return { lat, lng };
  }

  for (const valor of Object.values(registro)) {
    if (typeof valor !== "string") continue;
    const coincidencia = valor.match(/(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!coincidencia) continue;
    const lat = aNumero(coincidencia[1]);
    const lng = aNumero(coincidencia[2]);
    if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

function tituloDe(registro) {
  const clave = buscarClave(registro, CLAVES_NOMBRE);
  if (clave && registro[clave]) return String(registro[clave]);
  const primerTexto = Object.entries(registro).find(
    ([claveCampo, valor]) => claveCampo !== "_etiquetas" && typeof valor === "string" && valor.trim()
  );
  return primerTexto ? primerTexto[1] : "Punto";
}

function detalleDe(registro) {
  return Object.entries(registro)
    .filter(([clave, valor]) => clave !== "_etiquetas" && valor !== "" && valor != null)
    .map(([clave, valor]) => {
      const etiqueta = registro._etiquetas[clave] || clave;
      return "<div><strong>" + escapar(etiqueta) + ":</strong> " + escapar(valor) + "</div>";
    })
    .join("");
}

function escribirNota(mensaje) {
  const nota = document.querySelector(".nota");
  if (nota) nota.textContent = mensaje;
}

async function pintarPuntos(mapa, nombreHoja) {
  const lista = document.getElementById("puntos");
  escribirNota("Leyendo la pestaña " + nombreHoja + "…");

  let filas;
  try {
    filas = filasDeTabla(await cargarHoja(nombreHoja));
  } catch (error) {
    escribirNota(
      "No pude leer la planilla. El enlace sigue pidiendo inicio de sesión en Google. En Compartir, elige «Cualquier persona con el enlace»."
    );
    return;
  }

  const puntos = filas
    .map((fila) => ({ fila, coordenadas: coordenadas(fila) }))
    .filter((punto) => punto.coordenadas);

  if (!puntos.length) {
    const columnas = filas[0] ? Object.keys(filas[0]._etiquetas || {}).join(", ") : "ninguna";
    escribirNota(
      "La pestaña no tiene coordenadas reconocibles. Usa columnas Latitud y Longitud. Columnas encontradas: " +
        columnas +
        "."
    );
    return;
  }

  const limites = [];
  if (lista) lista.replaceChildren();

  puntos.forEach((punto) => {
    const titulo = tituloDe(punto.fila);
    const marcador = L.marker([punto.coordenadas.lat, punto.coordenadas.lng])
      .addTo(mapa)
      .bindPopup("<strong>" + escapar(titulo) + "</strong>" + detalleDe(punto.fila));

    limites.push([punto.coordenadas.lat, punto.coordenadas.lng]);

    if (!lista) return;
    const item = document.createElement("li");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = titulo;
    boton.addEventListener("click", () => {
      mapa.setView([punto.coordenadas.lat, punto.coordenadas.lng], 14);
      marcador.openPopup();
    });
    item.append(boton);
    lista.append(item);
  });

  if (limites.length === 1) {
    mapa.setView(limites[0], 13);
  } else {
    mapa.fitBounds(limites, { padding: [32, 32] });
  }

  escribirNota(puntos.length + " puntos cargados desde " + nombreHoja + ".");
}

if (contenedorMapa && typeof L !== "undefined") {
  const mapa = L.map(contenedorMapa, { scrollWheelZoom: false }).setView([-38.4, -63.6], 4);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "&copy; Esri, HERE, Garmin, OpenStreetMap",
    }
  ).addTo(mapa);

  window.flcMapa = mapa;
  pintarPuntos(mapa, contenedorMapa.dataset.fuente || "");
}
