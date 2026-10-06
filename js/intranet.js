const config = window.FLC_INTRANET || {};
const CLAVE_SESION = "flc-intranet-sesion";
const ETIQUETAS = { electricidad: "Electricidad", propiedades: "Propiedades" };

let sesion = null;
let moduloActivo = "";
let proyectos = [];

const login = document.getElementById("login");
const panel = document.getElementById("panel");
const pestanias = document.getElementById("pestanias");
const listado = document.getElementById("listado");
const vacio = document.getElementById("vacio");
const alta = document.getElementById("alta");
const detalle = document.getElementById("detalle");

function mostrar(nodo, visible) {
  if (nodo) nodo.hidden = !visible;
}

function mensaje(id, texto, esError) {
  const nodo = document.getElementById(id);
  if (!nodo) return;
  nodo.textContent = texto;
  nodo.classList.toggle("error", Boolean(esError));
}

function errorLegible(error) {
  if (error && error.message === "Failed to fetch") {
    return "No pude contactar Google. Publica la nueva versión del script y vuelve a intentar.";
  }
  return (error && error.message) || "No se pudo completar la consulta.";
}

function baseApi() {
  return (config.apiUrl || "").replace(/\/$/, "");
}

function scriptBase() {
  return (config.scriptUrl || "").replace(/\/$/, "");
}

async function apiGoogle(ruta, opciones) {
  const metodo = ((opciones && opciones.method) || "GET").toUpperCase();
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  const params = new URLSearchParams();
  if (sesion && sesion.correo) params.set("correo", sesion.correo);

  const checklist = ruta.match(/^\/api\/electricidad\/proyecto\/([^/]+)\/checklist\/([^/]+)$/);
  const ficha = ruta.match(/^\/api\/([^/]+)\/proyecto\/([^/]+)$/);
  const lista = ruta.match(/^\/api\/([^/]+)\/proyectos$/);

  if (ruta === "/api/login") {
    params.set("accion", "sesion");
    params.set("correo", cuerpo.correo || "");
    params.set("clave", cuerpo.clave || "");
    if (cuerpo.clave_nueva) params.set("clave_nueva", cuerpo.clave_nueva);
  } else if (checklist) {
    params.set("accion", "checklist");
    params.set("modulo", "electricidad");
    params.set("id", decodeURIComponent(checklist[1]));
    params.set("id_item", decodeURIComponent(checklist[2]));
    params.set("completado", String(cuerpo.completado));
  } else if (lista && metodo === "POST") {
    params.set("accion", "crear");
    params.set("modulo", lista[1]);
    Object.keys(cuerpo).forEach((clave) => {
      if (cuerpo[clave] !== "") params.set(clave, cuerpo[clave]);
    });
  } else if (ficha) {
    params.set("accion", "detalle");
    params.set("modulo", ficha[1]);
    params.set("id", decodeURIComponent(ficha[2]));
  } else if (lista) {
    params.set("accion", "listar");
    params.set("modulo", lista[1]);
  } else {
    throw new Error("Consulta no reconocida.");
  }

  const respuesta = await fetch(scriptBase() + "?" + params.toString());
  let datos = {};
  try {
    datos = await respuesta.json();
  } catch (error) {
    throw new Error("Google no respondió con datos. Publica la nueva versión del script.");
  }
  if (!respuesta.ok || datos.ok === false) throw new Error(datos.error || "No se pudo completar la consulta.");
  return datos;
}

async function api(ruta, opciones) {
  if (scriptBase()) return apiGoogle(ruta, opciones);
  if (!baseApi()) throw new Error("Falta la URL de la API.");
  const headers = Object.assign({ "Content-Type": "application/json" }, (opciones && opciones.headers) || {});
  if (sesion && sesion.token) headers.Authorization = "Bearer " + sesion.token;
  const respuesta = await fetch(baseApi() + ruta, Object.assign({}, opciones, { headers: headers }));
  let datos = {};
  try {
    datos = await respuesta.json();
  } catch (error) {
    throw new Error("La intranet no respondió con datos.");
  }
  if (!respuesta.ok || datos.ok === false) throw new Error(datos.error || datos.detail || "No se pudo completar la consulta.");
  return datos;
}

function idDe(registro) {
  return String(registro.id_proyecto || registro.id || registro.id_propiedad || "");
}

function tituloDe(registro) {
  return String(registro.nombre_circuito || registro.titulo || "Proyecto");
}

function texto(valor) {
  return valor == null || valor === "" ? "—" : String(valor);
}

function guardarSesion(datos) {
  sesion = {
    token: datos.token,
    correo: datos.correo,
    nombre: datos.nombre,
    rol: datos.rol,
    modulos: datos.modulos || [],
  };
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
}

function pintarSesion() {
  document.getElementById("sesion-texto").textContent =
    (sesion.nombre || sesion.correo) + " · " + sesion.rol;
  mostrar(document.getElementById("ordenar-google"), String(sesion.rol || "").toLowerCase() === "admin");
  mostrar(login, false);
  mostrar(panel, true);
  pintarPestanias();
}

function pintarPestanias() {
  pestanias.replaceChildren();
  sesion.modulos.forEach((modulo) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "pestania";
    boton.setAttribute("role", "tab");
    boton.dataset.modulo = modulo;
    boton.textContent = ETIQUETAS[modulo] || modulo;
    boton.setAttribute("aria-selected", String(modulo === moduloActivo));
    boton.addEventListener("click", () => elegirModulo(modulo));
    pestanias.append(boton);
  });
}

function camposDelModulo(modulo) {
  return document.getElementById(modulo === "electricidad" ? "campos-electricidad" : "campos-propiedades");
}

function prepararAlta() {
  const esElectricidad = moduloActivo === "electricidad";
  mostrar(document.getElementById("campos-electricidad"), esElectricidad);
  mostrar(document.getElementById("campos-propiedades"), !esElectricidad);
  document.getElementById("nombre_circuito").required = esElectricidad;
  document.getElementById("titulo").required = !esElectricidad;
  document.getElementById("alta-titulo").textContent = esElectricidad
    ? "Nuevo circuito"
    : "Nuevo loteo o parcela";
}

async function elegirModulo(modulo) {
  moduloActivo = modulo;
  pintarPestanias();
  mostrar(alta, false);
  alta.reset();
  try {
    await cargarListado();
  } catch (error) {
    proyectos = [];
    pintarTarjetas();
    mensaje("mensaje-panel", errorLegible(error), true);
  }
}

async function marcarChecklist(idProyecto, idItem, listo) {
  try {
    await api("/api/electricidad/proyecto/" + encodeURIComponent(idProyecto) + "/checklist/" + encodeURIComponent(idItem), {
      method: "PATCH",
      body: JSON.stringify({ completado: listo }),
    });
    if (detalle.open) detalle.close();
    const tarjeta = proyectos.find((registro) => idDe(registro) === idProyecto);
    if (tarjeta) await abrirDetalle(tarjeta);
  } catch (error) {
    mensaje("mensaje-panel", errorLegible(error), true);
  }
}

async function cargarListado() {
  mensaje("mensaje-panel", "Cargando proyectos…", false);
  const datos = await api("/api/" + moduloActivo + "/proyectos");
  proyectos = datos.proyectos || [];
  pintarTarjetas();
  mensaje("mensaje-panel", "", false);
}

function pintarTarjetas() {
  listado.replaceChildren();
  mostrar(vacio, proyectos.length === 0);
  proyectos.forEach((registro) => {
    const tarjeta = document.createElement("button");
    tarjeta.type = "button";
    tarjeta.className = "tarjeta-proyecto";
    const titulo = document.createElement("strong");
    titulo.textContent = tituloDe(registro);
    const detalleLinea = document.createElement("span");
    detalleLinea.textContent =
      moduloActivo === "electricidad"
        ? texto(registro.cliente_sector)
        : registro.precio_uf === "" || registro.precio_uf == null
          ? "Sin precio"
          : texto(registro.precio_uf) + " UF";
    const meta = document.createElement("span");
    meta.className = "meta-proyecto";
    meta.textContent =
      texto(registro.estado) + " · " + texto(registro.responsable_correo || registro.responsable);
    tarjeta.append(titulo, detalleLinea, meta);
    tarjeta.addEventListener("click", () => abrirDetalle(registro));
    listado.append(tarjeta);
  });
}

function esEnlace(valor) {
  return /^https?:\/\//i.test(String(valor || "").trim());
}

function fotoDe(url) {
  if (!esEnlace(url)) return null;
  const imagen = document.createElement("img");
  imagen.className = "detalle-foto";
  imagen.alt = "";
  imagen.src = String(url).trim();
  return imagen;
}

function linea(etiqueta, valor) {
  const fila = document.createElement("p");
  const nombre = document.createElement("strong");
  nombre.textContent = etiqueta + ": ";
  fila.append(nombre, document.createTextNode(texto(valor)));
  return fila;
}

function bloque(titulo, nodos) {
  const seccion = document.createElement("section");
  seccion.className = "bloque-detalle";
  const encabezado = document.createElement("h3");
  encabezado.textContent = titulo;
  seccion.append(encabezado);
  if (!nodos.length) {
    const vacioBloque = document.createElement("p");
    vacioBloque.textContent = "Sin registros.";
    seccion.append(vacioBloque);
    return seccion;
  }
  const lista = document.createElement("ul");
  nodos.forEach((nodo) => lista.append(nodo));
  seccion.append(lista);
  return seccion;
}

function completadoLegible(valor) {
  const textoValor = String(valor).trim().toLowerCase();
  return textoValor === "true" || textoValor === "si" || textoValor === "sí" || textoValor === "1";
}

async function abrirDetalle(registro) {
  mensaje("mensaje-panel", "", false);
  const datos = await api("/api/" + moduloActivo + "/proyecto/" + encodeURIComponent(idDe(registro)));
  const ficha = datos.proyecto || {};
  document.getElementById("detalle-modulo").textContent = ETIQUETAS[moduloActivo] || moduloActivo;
  document.getElementById("detalle-titulo").textContent = tituloDe(ficha);

  const resumen = document.getElementById("detalle-resumen");
  resumen.replaceChildren();
  const foto = fotoDe(ficha.imagen_url);
  if (foto) resumen.append(foto);
  if (moduloActivo === "electricidad") {
    resumen.append(
      linea("Tipo de servicio", ficha.tipo_servicio),
      linea("Cliente o sector", ficha.cliente_sector),
      linea("Estado", ficha.estado),
      linea("Descripción", ficha.descripcion),
      linea("Responsable", ficha.responsable_correo),
      linea("Latitud", ficha.latitud),
      linea("Longitud", ficha.longitud)
    );
  } else {
    resumen.append(
      linea("Tipo", ficha.tipo),
      linea("Precio (UF)", ficha.precio_uf),
      linea("Superficie (m²)", ficha.superficie_m2),
      linea("Factibilidad eléctrica", ficha.factibilidad_electrica),
      linea("Factibilidad de agua", ficha.factibilidad_agua),
      linea("Estado", ficha.estado),
      linea("Descripción", ficha.descripcion),
      linea("Responsable", ficha.contacto || ficha.responsable),
      linea("Latitud", ficha.latitud),
      linea("Longitud", ficha.longitud)
    );
  }
  resumen.querySelectorAll("p").forEach((fila) => {
    if (fila.textContent.startsWith("Descripción:")) fila.classList.add("detalle-ancho");
  });

  const extra = document.getElementById("detalle-extra");
  extra.replaceChildren();
  if (moduloActivo === "electricidad") {
    const tareas = (datos.checklist || []).map((item) => {
      const fila = document.createElement("li");
      const listo = completadoLegible(item.completado);
      const carpetaTarea = item.subcarpeta_destino ? " · " + item.subcarpeta_destino : "";
      fila.textContent = item.tarea + carpetaTarea + (listo ? " · Listo" : " · Pendiente");
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn btn-secundario";
      boton.textContent = listo ? "Marcar pendiente" : "Marcar listo";
      boton.addEventListener("click", () => marcarChecklist(idDe(ficha), item.id_item, !listo));
      fila.append(" ", boton);
      return fila;
    });
    const materiales = (datos.inventario || []).map((item) => {
      const fila = document.createElement("li");
      const observacion = item.observacion ? " · " + item.observacion : "";
      fila.textContent = item.material + " · " + texto(item.cantidad) + " " + texto(item.unidad) + observacion;
      return fila;
    });
    extra.append(bloque("Checklist", tareas), bloque("Inventario", materiales));
  }

  const carpeta = document.getElementById("detalle-carpeta");
  carpeta.replaceChildren();
  if (ficha.folder_url) {
    const enlace = document.createElement("a");
    enlace.className = "btn";
    enlace.href = ficha.folder_url;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.textContent = "Abrir carpeta";
    carpeta.append(enlace);
  } else {
    carpeta.textContent = "Esta ficha todavía no tiene carpeta.";
  }
  detalle.showModal();
}

function datosDeAlta() {
  const campos = camposDelModulo(moduloActivo);
  const datos = {};
  campos.querySelectorAll("input, select, textarea").forEach((campo) => {
    datos[campo.name] = campo.value.trim();
  });
  return datos;
}

async function registrar(evento) {
  evento.preventDefault();
  const boton = alta.querySelector("button[type=submit]");
  boton.disabled = true;
  mensaje("mensaje-panel", "Guardando y creando la carpeta…", false);
  try {
    await api("/api/" + moduloActivo + "/proyectos", {
      method: "POST",
      body: JSON.stringify(datosDeAlta()),
    });
    alta.reset();
    mostrar(alta, false);
    await cargarListado();
    mensaje("mensaje-panel", "Proyecto registrado.", false);
  } catch (error) {
    mensaje("mensaje-panel", errorLegible(error), true);
  } finally {
    boton.disabled = false;
  }
}

async function entrar(evento) {
  evento.preventDefault();
  const boton = login.querySelector("button[type=submit]");
  const correo = document.getElementById("correo").value.trim();
  const clave = document.getElementById("clave").value;
  const claveNueva = document.getElementById("clave-nueva").value;
  boton.disabled = true;
  mensaje("mensaje-login", "Comprobando acceso…", false);
  try {
    const datos = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ correo: correo, clave: clave, clave_nueva: claveNueva }),
    });
    if (!datos.modulos || !datos.modulos.length) throw new Error("Ese rol no tiene módulos asignados.");
    guardarSesion(datos);
    moduloActivo = sesion.modulos[0];
    pintarSesion();
    mensaje("mensaje-login", "", false);
  } catch (error) {
    mensaje("mensaje-login", errorLegible(error), true);
    return;
  } finally {
    boton.disabled = false;
  }
  try {
    await cargarListado();
  } catch (error) {
    proyectos = [];
    pintarTarjetas();
    mensaje("mensaje-panel", errorLegible(error), true);
  }
}

function salir() {
  sesion = null;
  moduloActivo = "";
  proyectos = [];
  sessionStorage.removeItem(CLAVE_SESION);
  if (detalle.open) detalle.close();
  mostrar(alta, false);
  mostrar(panel, false);
  mostrar(login, true);
  mensaje("mensaje-login", "", false);
  mensaje("mensaje-panel", "", false);
}

async function ordenarEnGoogle() {
  if (!sesion || String(sesion.rol).toLowerCase() !== "admin") return;
  const seguro = window.confirm(
    "Esto deja los proyectos en ELE-001, ELE-002…, renombra cada carpeta a [código] Nombre y alinea checklist e inventario. No borra archivos."
  );
  if (!seguro) return;
  mensaje("mensaje-panel", "Ordenando códigos y carpetas en Google…", false);
  try {
    const params = new URLSearchParams({ accion: "reordenar", correo: sesion.correo });
    const respuesta = await fetch(scriptBase() + "?" + params.toString());
    const datos = await respuesta.json();
    if (!datos.ok) throw new Error(datos.error || "No se pudo ordenar.");
    await cargarListado();
    mensaje("mensaje-panel", datos.mensaje || "Proyectos ordenados.", false);
  } catch (error) {
    mensaje("mensaje-panel", errorLegible(error), true);
  }
}

login.addEventListener("submit", entrar);
document.getElementById("ordenar-google").addEventListener("click", ordenarEnGoogle);
document.getElementById("salir").addEventListener("click", salir);
document.getElementById("abrir-alta").addEventListener("click", () => {
  prepararAlta();
  mostrar(alta, true);
  camposDelModulo(moduloActivo).querySelector("input").focus();
});
document.getElementById("cancelar-alta").addEventListener("click", () => {
  alta.reset();
  mostrar(alta, false);
});
alta.addEventListener("submit", registrar);
document.getElementById("cerrar-detalle").addEventListener("click", () => detalle.close());

const interruptor = document.querySelector(".nav-toggle");
const cabecera = document.querySelector(".site-header");
if (cabecera && interruptor) {
  interruptor.addEventListener("click", () => {
    const abierto = cabecera.classList.toggle("is-open");
    interruptor.setAttribute("aria-expanded", String(abierto));
  });
}

const guardada = sessionStorage.getItem(CLAVE_SESION);
if (guardada) {
  try {
    const previa = JSON.parse(guardada);
    if (!previa.token) throw new Error("sesion vieja");
    document.getElementById("correo").value = previa.correo || "";
    sesion = previa;
    moduloActivo = (sesion.modulos && sesion.modulos[0]) || "";
    pintarSesion();
    cargarListado().catch((error) => {
      proyectos = [];
      pintarTarjetas();
      mensaje("mensaje-panel", errorLegible(error), true);
    });
  } catch (error) {
    sessionStorage.removeItem(CLAVE_SESION);
  }
}
