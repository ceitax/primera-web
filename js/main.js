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
const CLAVES_LAT = ["lat", "latitud", "latitude", "y"];
const CLAVES_LNG = ["lng", "lon", "long", "longitud", "longitude", "x"];
const CLAVES_NOMBRE = ["nombre_circuito", "nombre", "name", "proyecto", "titulo", "parcela", "lote", "lugar", "obra"];
const CLAVES_ARCHIVO = ["imagen_url", "imagen", "image", "foto", "archivo", "archivos", "url"];
const CLAVES_OCULTAS = [
  "id",
  "id_proyecto",
  "id_propiedad",
  "lat",
  "latitud",
  "lng",
  "lon",
  "long",
  "longitud",
  "reportado_por",
  ...CLAVES_ARCHIVO,
];
const ETIQUETAS_PUBLICAS = {
  nombre_circuito: "Circuito",
  tipo_servicio: "Servicio",
  cliente_sector: "Sector",
  estado: "Estado",
  descripcion: "Descripción",
  titulo: "Título",
  tipo: "Tipo",
  precio_uf: "Precio (UF)",
  superficie_m2: "Superficie (m²)",
  factibilidad_electrica: "Factibilidad eléctrica",
  factibilidad_agua: "Factibilidad de agua",
  nombre: "Nombre",
  descripcion_corta: "Descripción",
  tecnologias: "Tecnologías",
};
const CLAVES_PUBLICAS = {
  electricidad: [
    "nombre_circuito",
    "tipo_servicio",
    "cliente_sector",
    "latitud",
    "longitud",
    "estado",
    "imagen_url",
    "descripcion",
  ],
  propiedades: [
    "titulo",
    "tipo",
    "precio_uf",
    "superficie_m2",
    "estado",
    "latitud",
    "longitud",
    "factibilidad_electrica",
    "factibilidad_agua",
    "imagen_url",
    "descripcion",
  ],
};

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

function urlCatalogo(modulo) {
  const config = window.FLC_INTRANET || {};
  if (config.scriptUrl) {
    return config.scriptUrl.replace(/\/$/, "") + "?accion=catalogoPublico&modulo=" + encodeURIComponent(modulo);
  }
  const base = config.apiUrl;
  if (!base) return "";
  const rutas = {
    electricidad: "/api/electricidad/publico",
    propiedades: "/api/propiedades/publico",
    desarrollo: "/api/desarrollo/publico",
  };
  return base.replace(/\/$/, "") + (rutas[modulo] || "");
}

async function cargarCatalogo(modulo) {
  const destino = urlCatalogo(modulo);
  if (!destino) throw new Error("url");
  const respuesta = await fetch(destino);
  const datos = await respuesta.json();
  if (!datos || !datos.ok) throw new Error((datos && datos.error) || "catalogo");
  return datos.fichas || [];
}

function fichaPublica(registro, modulo) {
  const permitidas = CLAVES_PUBLICAS[modulo] || Object.keys(registro);
  const limpia = {};
  permitidas.forEach((clave) => {
    if (registro[clave] != null && registro[clave] !== "") limpia[clave] = registro[clave];
  });
  const etiquetas = {};
  Object.keys(limpia).forEach((clave) => {
    etiquetas[clave] = ETIQUETAS_PUBLICAS[clave] || clave;
  });
  return Object.assign(limpia, { _etiquetas: etiquetas });
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

function esEnlace(valor) {
  return typeof valor === "string" && /^https?:\/\//i.test(valor.trim());
}

function esImagen(url) {
  return (
    /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url) ||
    url.includes("images.unsplash.com") ||
    url.includes("googleusercontent") ||
    url.includes("drive.google.com/uc")
  );
}

function urlPorClaves(registro, claves) {
  const clave = buscarClave(registro, claves);
  const valor = clave ? String(registro[clave]).trim() : "";
  return esEnlace(valor) ? valor : "";
}

function urlImagen(registro) {
  const url = urlPorClaves(registro, ["imagen_url", "imagen", "image", "foto"]);
  return url && esImagen(url) ? url : "";
}

function urlArchivo(registro) {
  return urlPorClaves(registro, ["archivos", "archivo", "imagen_url", "imagen", "image", "foto", "url"]);
}

function detalleDe(registro) {
  return Object.entries(registro)
    .filter(([clave, valor]) => clave !== "_etiquetas" && !CLAVES_OCULTAS.includes(clave) && valor !== "" && valor != null && !esEnlace(valor))
    .map(([clave, valor]) => {
      const etiqueta = registro._etiquetas[clave] || clave;
      return "<div><strong>" + escapar(etiqueta) + ":</strong> " + escapar(valor) + "</div>";
    })
    .join("");
}

function enlaceArchivo(url) {
  if (!url) return "";
  return (
    '<a class="ver-archivos" href="' +
    escapar(url) +
    '" target="_blank" rel="noopener noreferrer">Ver archivos</a>'
  );
}

function popupDe(registro, titulo) {
  const archivo = urlArchivo(registro);
  const imagen = urlImagen(registro);
  const fondo = imagen ? ' style="background-image:url(\'' + escapar(imagen) + '\')"' : "";
  return (
    '<div class="popup-punto"' +
    fondo +
    '><div class="popup-punto-contenido"><strong>' +
    escapar(titulo) +
    "</strong>" +
    detalleDe(registro) +
    enlaceArchivo(archivo) +
    "</div></div>"
  );
}

function escribirNota(mensaje) {
  const nota = document.querySelector(".nota");
  if (nota) nota.textContent = mensaje;
}

async function pintarPuntos(mapa, modulo) {
  const lista = document.getElementById("puntos");
  escribirNota("Leyendo el catálogo…");

  let filas;
  try {
    filas = (await cargarCatalogo(modulo)).map((fila) => fichaPublica(fila, modulo));
  } catch (error) {
    escribirNota("No pude leer el catálogo. Publica la nueva versión del script de Google y vuelve a cargar.");
    return;
  }

  const puntos = filas
    .map((fila) => ({ fila, coordenadas: coordenadas(fila) }))
    .filter((punto) => punto.coordenadas);

  if (!puntos.length) {
    escribirNota("El catálogo no tiene coordenadas para mostrar en el mapa.");
    return;
  }

  const limites = [];
  if (lista) lista.replaceChildren();

  puntos.forEach((punto) => {
    const titulo = tituloDe(punto.fila);
    const archivo = urlArchivo(punto.fila);
    const imagen = urlImagen(punto.fila);
    const marcador = L.marker([punto.coordenadas.lat, punto.coordenadas.lng])
      .addTo(mapa)
      .bindPopup(popupDe(punto.fila, titulo), { className: "popup-flc", maxWidth: 260 });

    limites.push([punto.coordenadas.lat, punto.coordenadas.lng]);

    if (!lista) return;
    const item = document.createElement("li");
    item.className = "punto";
    if (imagen) item.style.backgroundImage = "url('" + imagen.replaceAll("'", "%27") + "')";

    const contenido = document.createElement("div");
    contenido.className = "punto-contenido";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = titulo;
    boton.addEventListener("click", () => {
      mapa.setView([punto.coordenadas.lat, punto.coordenadas.lng], 14);
      marcador.openPopup();
    });
    contenido.append(boton);

    if (archivo) {
      const enlace = document.createElement("a");
      enlace.className = "ver-archivos";
      enlace.href = archivo;
      enlace.target = "_blank";
      enlace.rel = "noopener noreferrer";
      enlace.textContent = "Ver archivos";
      contenido.append(enlace);
    }

    item.append(contenido);
    lista.append(item);
  });

  if (limites.length === 1) {
    mapa.setView(limites[0], 13);
  } else {
    mapa.fitBounds(limites, { padding: [32, 32] });
  }

  escribirNota(puntos.length + (puntos.length === 1 ? " punto cargado." : " puntos cargados."));
}

function enlacePublico(url) {
  const destino = String(url || "").trim();
  if (!/^https?:\/\//i.test(destino) || destino === "#") return "";
  return destino;
}

async function pintarDesarrollo(contenedor) {
  const nota = document.getElementById("nota-desarrollo");
  if (nota) nota.textContent = "Leyendo el catálogo…";
  contenedor.replaceChildren();

  let fichas;
  try {
    fichas = await cargarCatalogo("desarrollo");
  } catch (error) {
    if (nota) nota.textContent = "No pude leer el catálogo. Publica la nueva versión del script de Google y vuelve a cargar.";
    return;
  }

  if (!fichas.length) {
    if (nota) nota.textContent = "El catálogo de desarrollo todavía no tiene fichas.";
    return;
  }

  fichas.forEach((ficha) => {
    const articulo = document.createElement("article");
    articulo.className = "card";

    const insignia = document.createElement("span");
    insignia.className = "badge badge-desarrollo";
    insignia.textContent = ficha.estado || ficha.tipo || "Desarrollo";

    const titulo = document.createElement("h3");
    titulo.textContent = ficha.nombre || "Proyecto";

    articulo.append(insignia, titulo);

    if (ficha.descripcion_corta) {
      const textoFicha = document.createElement("p");
      textoFicha.textContent = ficha.descripcion_corta;
      articulo.append(textoFicha);
    }
    if (ficha.tecnologias) {
      const tecnologias = document.createElement("p");
      tecnologias.textContent = ficha.tecnologias;
      articulo.append(tecnologias);
    }

    const demo = enlacePublico(ficha.url_demo);
    if (demo) {
      const enlace = document.createElement("a");
      enlace.href = demo;
      enlace.target = "_blank";
      enlace.rel = "noopener noreferrer";
      enlace.textContent = "Ver proyecto";
      articulo.append(enlace);
    }

    contenedor.append(articulo);
  });

  if (nota) nota.textContent = fichas.length + (fichas.length === 1 ? " ficha cargada." : " fichas cargadas.");
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
  pintarPuntos(mapa, contenedorMapa.dataset.modulo || "");
}

function pintarEquipo(contenedor) {
  const nota = document.getElementById("nota-equipo");
  if (nota) nota.textContent = "Leyendo el equipo…";
  contenedor.replaceChildren();
  cargarCatalogo("equipo")
    .then(function (fichas) {
      fichas.forEach(function (persona) {
        const articulo = document.createElement("article");
        articulo.className = "card";
        const titulo = document.createElement("h3");
        titulo.textContent = persona.nombre || "Integrante";
        articulo.append(titulo);
        if (persona.cargo_rol) {
          const cargo = document.createElement("p");
          cargo.textContent = persona.cargo_rol;
          articulo.append(cargo);
        }
        if (persona.descripcion) {
          const textoPersona = document.createElement("p");
          textoPersona.textContent = persona.descripcion;
          articulo.append(textoPersona);
        }
        contenedor.append(articulo);
      });
      if (nota) nota.textContent = fichas.length ? "" : "El equipo todavía no está cargado.";
    })
    .catch(function () {
      if (nota) nota.textContent = "No pude leer el equipo. Publica la nueva versión del script de Google.";
    });
}

const fichasDesarrollo = document.getElementById("fichas-desarrollo");
const fichasEquipo = document.getElementById("fichas-equipo");
if (fichasEquipo) pintarEquipo(fichasEquipo);
if (fichasDesarrollo) pintarDesarrollo(fichasDesarrollo);

function scriptBasePublico() {
  const config = window.FLC_INTRANET || {};
  return (config.scriptUrl || "").replace(/\/$/, "");
}

function notaEstado(nodo, mensaje, esError) {
  if (!nodo) return;
  nodo.textContent = mensaje;
  nodo.classList.toggle("is-error", Boolean(esError));
}

function initCotizacion(formulario) {
  const nota = document.getElementById("cotizar-estado");
  const boton = formulario.querySelector("[type=submit]");

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!formulario.reportValidity()) return;

    const datos = Object.fromEntries(new FormData(formulario).entries());
    const base = scriptBasePublico();
    if (!base) {
      notaEstado(nota, "Falta la dirección del script de Google.", true);
      return;
    }

    if (boton) boton.disabled = true;
    notaEstado(nota, "Enviando…", false);

    try {
      const respuesta = await fetch(base + "?" + new URLSearchParams({
        accion: "cotizar",
        nombre: datos.nombre || "",
        telefono: datos.telefono || "",
        correo: datos.correo || "",
        servicio: datos.servicio || "",
        mensaje: datos.mensaje || "",
      }), {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          accion: "cotizar",
          nombre: datos.nombre || "",
          telefono: datos.telefono || "",
          correo: datos.correo || "",
          servicio: datos.servicio || "",
          mensaje: datos.mensaje || "",
        }),
      });
      let cuerpo = {};
      try {
        cuerpo = await respuesta.json();
      } catch (error) {
        throw new Error("Google no respondió con datos. Publica la nueva versión del script.");
      }
      if (!respuesta.ok || cuerpo.ok === false || cuerpo.cotizacion !== true) {
        throw new Error(
          cuerpo.error || "El script publicado todavía no recibe cotizaciones. Publica la nueva versión del script."
        );
      }
      formulario.reset();
      notaEstado(nota, "Recibimos tu solicitud. El equipo te contactará.", false);
    } catch (error) {
      const mensaje =
        error && error.message === "Failed to fetch"
          ? "No pude contactar Google. Publica la nueva versión del script y vuelve a intentar."
          : (error && error.message) || "No se pudo enviar la cotización.";
      notaEstado(nota, mensaje, true);
    } finally {
      if (boton) boton.disabled = false;
    }
  });
}

const FOTO_ORIGEN_RESPALDO = {
  nombre: "Campo",
  url: "https://drive.google.com/thumbnail?id=1iNHYQGFzIcQOlSL5mIxiHJOU4C_B8O6-&sz=w1600",
};

function urlFotos(album) {
  const base = scriptBasePublico();
  if (!base) return "";
  return base + "?accion=fotosPublicas&album=" + encodeURIComponent(album);
}

function tituloFoto(nombre) {
  const base = String(nombre || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base || /^(img|dsc|foto|image|pict)\s*\d+$/i.test(base)) return "";
  return base;
}

function pasoCarrusel(pista) {
  const slide = pista.querySelector(".carrusel-marco-slide, .carrusel-slide");
  if (!slide) return pista.clientWidth;
  const estilos = getComputedStyle(pista);
  const gap = parseFloat(estilos.columnGap || estilos.gap || "0") || 0;
  return slide.getBoundingClientRect().width + gap;
}

function enlazarCarrusel(carrusel, pista) {
  const controles = carrusel.querySelector(".carrusel-controles");
  const slides = pista.querySelectorAll(".carrusel-marco-slide, .carrusel-slide");
  if (controles) controles.hidden = slides.length < 2;

  carrusel.querySelectorAll(".carrusel-btn").forEach((boton) => {
    boton.addEventListener("click", () => {
      const dir = Number(boton.dataset.dir) || 1;
      pista.scrollBy({ left: dir * pasoCarrusel(pista), behavior: "smooth" });
    });
  });

  carrusel.addEventListener("keydown", (evento) => {
    if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
    evento.preventDefault();
    const dir = evento.key === "ArrowRight" ? 1 : -1;
    pista.scrollBy({ left: dir * pasoCarrusel(pista), behavior: "smooth" });
  });
}

function pintarFotos(pista, fotos, album) {
  const altBase = album === "origen" ? "Fotografía del campo, raíces del Grupo Frías" : "Imagen del flujo de trabajo de Grupo Frías";
  pista.replaceChildren();
  fotos.forEach((foto) => {
    const slide = document.createElement("div");
    slide.className = "carrusel-marco-slide";
    const img = document.createElement("img");
    img.src = foto.url;
    img.alt = tituloFoto(foto.nombre) || altBase;
    img.loading = "lazy";
    img.addEventListener("error", function onError() {
      img.removeEventListener("error", onError);
      if (album === "origen") {
        img.src = "img/casa_generica.jpg";
        return;
      }
      const hueco = document.createElement("div");
      hueco.className = "carrusel-foto carrusel-foto-vacia";
      hueco.setAttribute("aria-hidden", "true");
      img.replaceWith(hueco);
    });
    slide.append(img);
    pista.append(slide);
  });
}

async function initCarruselFotos(carrusel) {
  const pista = carrusel.querySelector(".carrusel-marco-pista");
  const nota = carrusel.querySelector(".carrusel-nota");
  const album = carrusel.dataset.album;
  if (!pista || !album) return;

  let fotos = [];
  try {
    const destino = urlFotos(album);
    if (!destino) throw new Error("url");
    const respuesta = await fetch(destino);
    const datos = await respuesta.json();
    if (!datos || !datos.ok || !Array.isArray(datos.fotos)) throw new Error((datos && datos.error) || "fotos");
    fotos = datos.fotos.filter((foto) => foto && foto.url);
  } catch (error) {
    fotos = [];
  }

  if (!fotos.length && album === "origen") fotos = [FOTO_ORIGEN_RESPALDO];
  if (!fotos.length) {
    const controles = carrusel.querySelector(".carrusel-controles");
    if (controles) controles.hidden = true;
    if (nota) {
      nota.hidden = false;
      nota.textContent = "Las fotos de este recorrido se ven al publicar la nueva versión del script de Google.";
    }
    return;
  }

  pintarFotos(pista, fotos, album);
  if (nota) nota.hidden = true;
  enlazarCarrusel(carrusel, pista);
}

function ordenNombreFoto(nombre) {
  const numero = parseInt(String(nombre || ""), 10);
  return Number.isFinite(numero) ? numero : 999;
}

async function initFotosEquipo() {
  const retratos = document.querySelectorAll(".equipo-foto");
  if (!retratos.length) return;
  try {
    const destino = urlFotos("equipo");
    if (!destino) return;
    const respuesta = await fetch(destino);
    const datos = await respuesta.json();
    if (!datos || !datos.ok || !Array.isArray(datos.fotos)) return;
    const fotos = datos.fotos
      .filter((foto) => foto && foto.url)
      .sort((a, b) => ordenNombreFoto(a.nombre) - ordenNombreFoto(b.nombre));
    retratos.forEach((img, indice) => {
      const foto = fotos[indice];
      if (!foto) return;
      img.addEventListener("load", () => {
        img.hidden = false;
      });
      img.addEventListener("error", () => {
        img.hidden = true;
      });
      img.src = foto.url;
    });
  } catch (error) {
    retratos.forEach((img) => {
      img.hidden = true;
    });
  }
}

const formCotizar = document.getElementById("form-cotizar");
if (formCotizar) initCotizacion(formCotizar);
document.querySelectorAll(".carrusel-marco").forEach((carrusel) => initCarruselFotos(carrusel));
initFotosEquipo();
