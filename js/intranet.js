const config = window.FLC_INTRANET || {};
const CLAVE_SESION = "flc-intranet-sesion";
const ETIQUETAS = { electricidad: "Electricidad", propiedades: "Propiedades", clientes: "Clientes" };

let sesion = null;
let moduloActivo = "";
let proyectos = [];
let clientes = [];
let vistaMapa = false;
let mapaIntranet = null;
let fotosDetalle = [];
let indiceFoto = 0;
let fichaAbierta = null;

const login = document.getElementById("login");
const panel = document.getElementById("panel");
const seccion = document.getElementById("seccion");
const listado = document.getElementById("listado");
const vacio = document.getElementById("vacio");
const alta = document.getElementById("alta");
const altaCliente = document.getElementById("alta-cliente");
const detalle = document.getElementById("detalle");
const mapaNodo = document.getElementById("mapa-intranet");

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

function scriptBase() {
  return (config.scriptUrl || "").replace(/\/$/, "");
}

function tieneElectricidad() {
  return Boolean(sesion && sesion.modulos && sesion.modulos.indexOf("electricidad") !== -1);
}

async function consultar(extra) {
  if (!scriptBase()) throw new Error("Falta la dirección del script de Google.");
  const params = new URLSearchParams();
  if (sesion && sesion.correo) params.set("correo", sesion.correo);
  Object.keys(extra || {}).forEach((clave) => {
    if (extra[clave] != null) params.set(clave, extra[clave]);
  });
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

async function postGoogle(datos) {
  if (!scriptBase()) throw new Error("Falta la dirección del script de Google.");
  const respuesta = await fetch(scriptBase(), {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ correo: sesion ? sesion.correo : "" }, datos)),
  });
  let cuerpo = {};
  try {
    cuerpo = await respuesta.json();
  } catch (error) {
    throw new Error("Google no recibió la foto. Publica la nueva versión del script.");
  }
  if (!respuesta.ok || cuerpo.ok === false) throw new Error(cuerpo.error || "No se pudo subir la foto.");
  return cuerpo;
}

async function apiGoogle(ruta, opciones) {
  const metodo = ((opciones && opciones.method) || "GET").toUpperCase();
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  const checklist = ruta.match(/^\/api\/electricidad\/proyecto\/([^/]+)\/checklist\/([^/]+)$/);
  const ficha = ruta.match(/^\/api\/([^/]+)\/proyecto\/([^/]+)$/);
  const lista = ruta.match(/^\/api\/([^/]+)\/proyectos$/);

  if (ruta === "/api/login") {
    return consultar({
      accion: "sesion",
      correo: cuerpo.correo || "",
      clave: cuerpo.clave || "",
      clave_nueva: cuerpo.clave_nueva || "",
    });
  }
  if (checklist) {
    return consultar({
      accion: "checklist",
      modulo: "electricidad",
      id: decodeURIComponent(checklist[1]),
      id_item: decodeURIComponent(checklist[2]),
      completado: String(cuerpo.completado),
    });
  }
  if (lista && metodo === "POST") {
    return consultar(Object.assign({ accion: "crear", modulo: lista[1] }, cuerpo));
  }
  if (ficha) {
    return consultar({ accion: "detalle", modulo: ficha[1], id: decodeURIComponent(ficha[2]) });
  }
  if (lista) return consultar({ accion: "listar", modulo: lista[1] });
  throw new Error("Consulta no reconocida.");
}

async function api(ruta, opciones) {
  if (scriptBase()) return apiGoogle(ruta, opciones);
  throw new Error("Falta la dirección del script de Google.");
}

function idDe(registro) {
  return String(registro.id_proyecto || registro.id || registro.id_cliente || "");
}

function tituloDe(registro) {
  return String(registro.nombre_circuito || registro.titulo || registro.nombre_completo || "Proyecto");
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
  document.getElementById("sesion-texto").textContent = sesion.nombre || sesion.correo;
  mostrar(document.getElementById("ordenar-google"), tieneElectricidad());
  mostrar(login, false);
  mostrar(panel, true);
  pintarSeccion();
  actualizarVista();
}

function modulosVisibles() {
  const modulos = (sesion.modulos || []).slice();
  if (tieneElectricidad() && modulos.indexOf("clientes") === -1) modulos.push("clientes");
  return modulos;
}

function pintarSeccion() {
  const actual = moduloActivo;
  seccion.replaceChildren();
  modulosVisibles().forEach((modulo) => {
    seccion.append(new Option(ETIQUETAS[modulo] || modulo, modulo));
  });
  if (actual) seccion.value = actual;
}

function esClientes() {
  return moduloActivo === "clientes";
}

function actualizarVista() {
  const electricidad = moduloActivo === "electricidad";
  mostrar(document.getElementById("vista-toggle"), electricidad);
  document.getElementById("abrir-alta").textContent = esClientes() ? "Nuevo cliente" : "Nuevo proyecto";
  const verMapa = electricidad && vistaMapa;
  mostrar(mapaNodo, verMapa);
  mostrar(listado, !verMapa);
  if (verMapa) mostrar(vacio, false);
  const interruptor = document.getElementById("vista-mapa");
  if (interruptor.checked !== verMapa) interruptor.checked = verMapa;
  if (verMapa) pintarMapa();
}

function camposDelModulo(modulo) {
  return document.getElementById(modulo === "electricidad" ? "campos-electricidad" : "campos-propiedades");
}

function prepararAlta() {
  if (esClientes()) {
    altaCliente.reset();
    document.getElementById("cliente-id").value = "";
    mostrar(alta, false);
    mostrar(altaCliente, true);
    document.getElementById("cliente-nombre").focus();
    return;
  }
  const esElectricidad = moduloActivo === "electricidad";
  mostrar(document.getElementById("campos-electricidad"), esElectricidad);
  mostrar(document.getElementById("campos-propiedades"), !esElectricidad);
  document.getElementById("nombre_circuito").required = esElectricidad;
  document.getElementById("titulo").required = !esElectricidad;
  document.getElementById("alta-titulo").textContent = esElectricidad ? "Nuevo circuito" : "Nuevo loteo o parcela";
  mostrar(altaCliente, false);
  mostrar(alta, true);
  if (esElectricidad) cargarOpcionesCliente().catch((error) => mensaje("mensaje-panel", errorLegible(error), true));
  camposDelModulo(moduloActivo).querySelector("input").focus();
}

async function cargarOpcionesCliente() {
  const select = document.getElementById("id_cliente");
  const datos = await consultar({ accion: "clientes" });
  clientes = datos.clientes || [];
  const actual = select.value;
  select.replaceChildren(new Option("Sin cliente", ""), new Option("Cliente nuevo", "nuevo"));
  clientes.forEach((cliente) => {
    select.append(new Option((cliente.nombre_completo || "Cliente") + " · " + cliente.id_cliente, cliente.id_cliente));
  });
  if (actual) select.value = actual;
  mostrar(document.getElementById("cliente-nuevo"), select.value === "nuevo");
}

async function elegirModulo(modulo) {
  moduloActivo = modulo;
  if (modulo !== "electricidad") vistaMapa = false;
  pintarSeccion();
  mostrar(alta, false);
  mostrar(altaCliente, false);
  alta.reset();
  try {
    await cargarListado();
  } catch (error) {
    proyectos = [];
    pintarTarjetas();
    mensaje("mensaje-panel", errorLegible(error), true);
  }
  actualizarVista();
}

async function marcarChecklist(idProyecto, idItem, listo) {
  try {
    await api("/api/electricidad/proyecto/" + encodeURIComponent(idProyecto) + "/checklist/" + encodeURIComponent(idItem), {
      method: "PATCH",
      body: JSON.stringify({ completado: listo }),
    });
    const tarjeta = proyectos.find((registro) => idDe(registro) === idProyecto);
    if (tarjeta) await abrirDetalle(tarjeta);
  } catch (error) {
    mensaje("mensaje-panel", errorLegible(error), true);
  }
}

async function cargarListado() {
  mensaje("mensaje-panel", "Cargando…", false);
  if (esClientes()) {
    const datos = await consultar({ accion: "clientes" });
    clientes = datos.clientes || [];
    pintarClientes();
  } else {
    const datos = await api("/api/" + moduloActivo + "/proyectos");
    proyectos = datos.proyectos || [];
    pintarTarjetas();
    if (moduloActivo === "electricidad" && vistaMapa) pintarMapa();
  }
  mensaje("mensaje-panel", "", false);
  actualizarVista();
}

function pintarTarjetas() {
  listado.replaceChildren();
  mostrar(vacio, proyectos.length === 0);
  vacio.textContent = "No hay proyectos en este módulo.";
  proyectos.forEach((registro) => {
    const tarjeta = document.createElement("button");
    tarjeta.type = "button";
    tarjeta.className = "tarjeta-proyecto";
    const titulo = document.createElement("strong");
    titulo.textContent = tituloDe(registro);
    const detalleLinea = document.createElement("span");
    detalleLinea.textContent =
      moduloActivo === "electricidad"
        ? texto(registro.comuna || registro.cliente_sector)
        : registro.precio_uf === "" || registro.precio_uf == null
          ? "Sin precio"
          : texto(registro.precio_uf) + " UF";
    const meta = document.createElement("span");
    meta.className = "meta-proyecto";
    meta.textContent = texto(registro.estado);
    tarjeta.append(titulo, detalleLinea, meta);
    tarjeta.addEventListener("click", () => abrirDetalle(registro));
    listado.append(tarjeta);
  });
}

function pintarClientes() {
  listado.replaceChildren();
  mostrar(vacio, clientes.length === 0);
  vacio.textContent = "No hay clientes cargados.";
  clientes.forEach((cliente) => {
    const tarjeta = document.createElement("button");
    tarjeta.type = "button";
    tarjeta.className = "tarjeta-proyecto";
    const titulo = document.createElement("strong");
    titulo.textContent = cliente.nombre_completo || "Cliente";
    const detalleLinea = document.createElement("span");
    detalleLinea.textContent = texto(cliente.id_cliente) + " · " + texto(cliente.rut);
    const meta = document.createElement("span");
    meta.className = "meta-proyecto";
    meta.textContent = texto(cliente.telefono);
    tarjeta.append(titulo, detalleLinea, meta);
    tarjeta.addEventListener("click", () => editarCliente(cliente));
    listado.append(tarjeta);
  });
}

function editarCliente(cliente) {
  altaCliente.reset();
  document.getElementById("cliente-id").value = cliente.id_cliente || "";
  document.getElementById("cliente-nombre").value = cliente.nombre_completo || "";
  document.getElementById("cliente-rut").value = cliente.rut || "";
  document.getElementById("cliente-telefono").value = cliente.telefono || "";
  document.getElementById("cliente-correo").value = cliente.correo || "";
  document.getElementById("cliente-tipo").value = cliente.tipo_persona || "Natural";
  document.getElementById("cliente-direccion").value = cliente.direccion_facturacion || "";
  mostrar(alta, false);
  mostrar(altaCliente, true);
}

function escapar(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function numero(valor) {
  const limpio = Number(String(valor || "").trim().replace(",", "."));
  return Number.isFinite(limpio) ? limpio : null;
}

function pintarMapa() {
  if (typeof L === "undefined") {
    mensaje("mensaje-panel", "No pude cargar el mapa.", true);
    return;
  }
  if (!mapaIntranet) {
    mapaIntranet = L.map(mapaNodo, { scrollWheelZoom: false }).setView([-41.47, -72.94], 10);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "&copy; Esri, HERE, Garmin, OpenStreetMap",
    }).addTo(mapaIntranet);
  }
  mapaIntranet.eachLayer((capa) => {
    if (capa instanceof L.Marker) mapaIntranet.removeLayer(capa);
  });
  const marcas = [];
  proyectos.forEach((registro) => {
    const lat = numero(registro.latitud);
    const lng = numero(registro.longitud);
    if (lat == null || lng == null) return;
    const marca = L.marker([lat, lng]).addTo(mapaIntranet);
    marca.bindPopup("<strong>" + escapar(tituloDe(registro)) + "</strong><br>" + escapar(texto(registro.comuna)) + " · " + escapar(texto(registro.estado)));
    marca.on("click", () => abrirDetalle(registro));
    marcas.push(marca);
  });
  if (marcas.length) mapaIntranet.fitBounds(L.featureGroup(marcas).getBounds().pad(0.2));
  window.setTimeout(() => mapaIntranet.invalidateSize(), 80);
}

function linea(etiqueta, valor) {
  const fila = document.createElement("p");
  const nombre = document.createElement("strong");
  nombre.textContent = etiqueta + ": ";
  fila.append(nombre, document.createTextNode(texto(valor)));
  return fila;
}

function tablaChecklist(filas) {
  const seccion = document.createElement("section");
  seccion.className = "bloque-detalle";
  const encabezado = document.createElement("h3");
  encabezado.textContent = "Checklist";
  seccion.append(encabezado);
  if (!filas.length) {
    const vacioBloque = document.createElement("p");
    vacioBloque.textContent = "Sin registros.";
    seccion.append(vacioBloque);
    return seccion;
  }
  const tabla = document.createElement("table");
  tabla.className = "tabla-check";
  const cabecera = document.createElement("tr");
  ["Tarea", "Carpeta", "Estado", "Listo"].forEach((nombre) => {
    const celda = document.createElement("th");
    celda.textContent = nombre;
    cabecera.append(celda);
  });
  const thead = document.createElement("thead");
  thead.append(cabecera);
  const cuerpo = document.createElement("tbody");
  filas.forEach((fila) => cuerpo.append(fila));
  tabla.append(thead, cuerpo);
  seccion.append(tabla);
  return seccion;
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

function campoFicha(etiqueta, nombre, valor, tipo) {
  const caja = document.createElement("label");
  caja.className = "campo";
  caja.textContent = etiqueta;
  const input = document.createElement(tipo === "area" ? "textarea" : "input");
  input.name = nombre;
  input.value = valor || "";
  if (tipo === "area") input.rows = 3;
  caja.append(input);
  return caja;
}

function completadoLegible(valor) {
  const textoValor = String(valor).trim().toLowerCase();
  return textoValor === "true" || textoValor === "si" || textoValor === "sí" || textoValor === "1";
}

function miniatura(url) {
  const match = String(url || "").match(/\/d\/([^/?]+)/);
  return match ? "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w1200" : url;
}

function pintarCarrusel(contenedor) {
  contenedor.replaceChildren();
  const seccion = document.createElement("section");
  seccion.className = "bloque-detalle carrusel";
  const titulo = document.createElement("h3");
  titulo.textContent = "Fotografías";
  seccion.append(titulo);
  if (!fotosDetalle.length) {
    const vacioFoto = document.createElement("p");
    vacioFoto.textContent = "Sin fotografías. Sube una o usa Actualizar si ya está en Drive.";
    seccion.append(vacioFoto);
  } else {
    const foto = fotosDetalle[indiceFoto];
    const imagen = document.createElement("img");
    imagen.alt = foto.titulo || "Fotografía de obra";
    imagen.src = miniatura(foto.url);
    const nav = document.createElement("div");
    nav.className = "carrusel-nav";
    const anterior = document.createElement("button");
    anterior.type = "button";
    anterior.className = "btn btn-secundario";
    anterior.textContent = "Anterior";
    anterior.addEventListener("click", () => {
      indiceFoto = (indiceFoto - 1 + fotosDetalle.length) % fotosDetalle.length;
      pintarCarrusel(contenedor);
    });
    const siguiente = document.createElement("button");
    siguiente.type = "button";
    siguiente.className = "btn btn-secundario";
    siguiente.textContent = "Siguiente";
    siguiente.addEventListener("click", () => {
      indiceFoto = (indiceFoto + 1) % fotosDetalle.length;
      pintarCarrusel(contenedor);
    });
    const cuenta = document.createElement("span");
    cuenta.textContent = indiceFoto + 1 + " / " + fotosDetalle.length;
    nav.append(anterior, cuenta, siguiente);
    const tituloFoto = document.createElement("input");
    tituloFoto.value = foto.titulo || "";
    tituloFoto.setAttribute("aria-label", "Título de la foto");
    const comentario = document.createElement("textarea");
    comentario.value = foto.comentario || "";
    comentario.rows = 2;
    comentario.setAttribute("aria-label", "Comentario de la foto");
    const guardar = document.createElement("button");
    guardar.type = "button";
    guardar.className = "btn";
    guardar.textContent = "Guardar título y comentario";
    guardar.addEventListener("click", () => guardarFoto(foto.url, tituloFoto.value, comentario.value));
    seccion.append(imagen, nav, tituloFoto, comentario, guardar);
  }
  const subir = document.createElement("input");
  subir.type = "file";
  subir.accept = "image/*";
  subir.addEventListener("change", () => {
    if (subir.files && subir.files[0]) subirArchivo(subir.files[0]);
  });
  seccion.append(subir);
  contenedor.append(seccion);
}

async function guardarFoto(url, titulo, comentario) {
  try {
    await consultar({ accion: "imagen", url: url, titulo: titulo, comentario: comentario });
    const foto = fotosDetalle[indiceFoto];
    if (foto) {
      foto.titulo = titulo;
      foto.comentario = comentario;
    }
    mensaje("mensaje-panel", "Foto actualizada.", false);
  } catch (error) {
    mensaje("mensaje-panel", errorLegible(error), true);
  }
}

function subirArchivo(archivo) {
  const lector = new FileReader();
  lector.onload = async () => {
    mensaje("mensaje-panel", "Subiendo la foto a Drive…", false);
    try {
      await postGoogle({
        accion: "foto",
        id_proyecto: idDe(fichaAbierta),
        nombre: archivo.name,
        tipo: archivo.type || "image/jpeg",
        archivo: String(lector.result || ""),
        titulo: archivo.name,
        comentario: "",
      });
      await abrirDetalle(fichaAbierta);
      mensaje("mensaje-panel", "Foto guardada en la carpeta y en la hoja.", false);
    } catch (error) {
      mensaje("mensaje-panel", errorLegible(error), true);
    }
  };
  lector.readAsDataURL(archivo);
}

async function abrirDetalle(registro) {
  if (moduloActivo === "propiedades") return abrirDetallePropiedad(registro);
  mensaje("mensaje-panel", "", false);
  const datos = await api("/api/electricidad/proyecto/" + encodeURIComponent(idDe(registro)));
  const ficha = datos.proyecto || {};
  fichaAbierta = ficha;
  fotosDetalle = datos.imagenes || [];
  indiceFoto = 0;
  document.getElementById("detalle-modulo").textContent = ficha.id_proyecto || "";
  document.getElementById("detalle-titulo").textContent = tituloDe(ficha);

  const resumen = document.getElementById("detalle-resumen");
  resumen.replaceChildren();
  const cliente = datos.cliente || {};
  const formulario = document.createElement("form");
  formulario.id = "ficha-edicion";
  formulario.className = "rejilla-form";
  [
    ["Nombre", "nombre_circuito", ficha.nombre_circuito],
    ["Comuna", "comuna", ficha.comuna],
    ["Tipo de servicio", "tipo_servicio", ficha.tipo_servicio],
    ["Sector", "cliente_sector", ficha.cliente_sector],
    ["Estado", "estado", ficha.estado],
    ["Potencia declarada", "potencia_declarada", ficha.potencia_declarada],
    ["Latitud", "latitud", ficha.latitud],
    ["Longitud", "longitud", ficha.longitud],
    ["Cliente", "nombre_completo", cliente.nombre_completo],
    ["RUT", "rut", cliente.rut],
    ["Teléfono", "telefono", cliente.telefono],
    ["Correo del cliente", "correo_cliente", cliente.correo],
  ].forEach(([etiqueta, nombre, valor]) => formulario.append(campoFicha(etiqueta, nombre, valor)));
  formulario.append(campoFicha("Descripción", "descripcion", ficha.descripcion, "area"));
  const idCliente = document.createElement("input");
  idCliente.type = "hidden";
  idCliente.name = "id_cliente";
  idCliente.value = ficha.id_cliente || "";
  formulario.append(idCliente);
  resumen.append(formulario);

  const extra = document.getElementById("detalle-extra");
  extra.replaceChildren();
  const acciones = document.createElement("div");
  acciones.className = "ficha-acciones";
  const guardar = document.createElement("button");
  guardar.type = "button";
  guardar.className = "btn";
  guardar.textContent = "Guardar ficha";
  guardar.addEventListener("click", () => guardarFicha(ficha));
  const terminar = document.createElement("button");
  terminar.type = "button";
  terminar.className = "btn btn-secundario";
  terminar.textContent = "Terminar";
  terminar.addEventListener("click", () => terminarProyecto(ficha));
  acciones.append(guardar, terminar);
  extra.append(acciones);

  const planos = (datos.planos || []).map((plano) => {
    const fila = document.createElement("li");
    const enlace = document.createElement("a");
    enlace.href = plano.url;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.textContent = plano.nombre + " · V" + plano.version;
    fila.append(enlace);
    return fila;
  });
  extra.append(bloque("Última versión de planos", planos));

  const carrusel = document.createElement("div");
  extra.append(carrusel);
  pintarCarrusel(carrusel);

  const tareas = (datos.checklist || []).map((item) => {
    const listo = completadoLegible(item.completado);
    const fila = document.createElement("tr");
    const celdaTarea = document.createElement("td");
    celdaTarea.textContent = item.tarea || "Tarea";
    const celdaCarpeta = document.createElement("td");
    celdaCarpeta.textContent = item.subcarpeta_destino || "—";
    const celdaEstado = document.createElement("td");
    celdaEstado.className = listo ? "marca-lista" : "marca-pendiente";
    celdaEstado.textContent = listo ? "✅" : "❌";
    const celdaCheck = document.createElement("td");
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.checked = listo;
    casilla.setAttribute("aria-label", "Marcar " + (item.tarea || "tarea"));
    casilla.addEventListener("change", () => marcarChecklist(idDe(ficha), item.id_item, casilla.checked));
    celdaCheck.append(casilla);
    fila.append(celdaTarea, celdaCarpeta, celdaEstado, celdaCheck);
    return fila;
  });
  const materiales = (datos.inventario || []).map((item) => {
    const fila = document.createElement("li");
    const observacion = item.observacion ? " · " + item.observacion : "";
    fila.textContent = item.material + " · " + texto(item.cantidad) + " " + texto(item.unidad) + observacion;
    return fila;
  });
  extra.append(tablaChecklist(tareas), bloque("Inventario", materiales));

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
  }
  if (ficha.aprobador) carpeta.append(linea("Aprobador", ficha.aprobador));
  detalle.showModal();
}

async function abrirDetallePropiedad(registro) {
  const datos = await api("/api/propiedades/proyecto/" + encodeURIComponent(idDe(registro)));
  const ficha = datos.proyecto || {};
  document.getElementById("detalle-modulo").textContent = "Propiedades";
  document.getElementById("detalle-titulo").textContent = tituloDe(ficha);
  const resumen = document.getElementById("detalle-resumen");
  resumen.replaceChildren(
    linea("Tipo", ficha.tipo),
    linea("Precio (UF)", ficha.precio_uf),
    linea("Superficie (m²)", ficha.superficie_m2),
    linea("Factibilidad eléctrica", ficha.factibilidad_electrica),
    linea("Factibilidad de agua", ficha.factibilidad_agua),
    linea("Estado", ficha.estado),
    linea("Descripción", ficha.descripcion),
    linea("Latitud", ficha.latitud),
    linea("Longitud", ficha.longitud)
  );
  document.getElementById("detalle-extra").replaceChildren();
  document.getElementById("detalle-carpeta").replaceChildren();
  detalle.showModal();
}

function valoresDe(formulario) {
  const datos = {};
  formulario.querySelectorAll("input, select, textarea").forEach((campo) => {
    if (campo.name) datos[campo.name] = campo.value.trim();
  });
  return datos;
}

async function guardarFicha(ficha) {
  const formulario = document.getElementById("ficha-edicion");
  if (!formulario) return;
  mensaje("mensaje-panel", "Guardando la ficha…", false);
  try {
    await consultar(Object.assign({ accion: "guardar", id: idDe(ficha) }, valoresDe(formulario)));
    await cargarListado();
    mensaje("mensaje-panel", "Ficha guardada.", false);
    if (detalle.open) detalle.close();
  } catch (error) {
    mensaje("mensaje-panel", errorLegible(error), true);
  }
}

async function terminarProyecto(ficha) {
  const seguro = window.confirm("Esto deja el proyecto en Terminado y escribe tu correo como aprobador.");
  if (!seguro) return;
  try {
    await consultar({ accion: "terminar", id: idDe(ficha) });
    await cargarListado();
    if (detalle.open) detalle.close();
    mensaje("mensaje-panel", "Proyecto terminado.", false);
  } catch (error) {
    mensaje("mensaje-panel", errorLegible(error), true);
  }
}

function datosDeAlta() {
  const datos = valoresDe(camposDelModulo(moduloActivo));
  if (datos.id_cliente !== "nuevo") {
    delete datos.nombre_completo;
    delete datos.rut;
    delete datos.telefono;
    delete datos.correo_cliente;
    delete datos.tipo_persona;
    delete datos.direccion_facturacion;
  }
  return datos;
}

async function registrar(evento) {
  evento.preventDefault();
  const boton = alta.querySelector("button[type=submit]");
  boton.disabled = true;
  const datos = datosDeAlta();
  if (datos.id_cliente === "nuevo" && !datos.nombre_completo) {
    mensaje("mensaje-panel", "Falta el nombre del cliente.", true);
    boton.disabled = false;
    return;
  }
  mensaje("mensaje-panel", "Guardando y creando la carpeta…", false);
  try {
    await api("/api/" + moduloActivo + "/proyectos", {
      method: "POST",
      body: JSON.stringify(datos),
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

async function registrarCliente(evento) {
  evento.preventDefault();
  const boton = altaCliente.querySelector("button[type=submit]");
  boton.disabled = true;
  try {
    await consultar(Object.assign({ accion: "cliente" }, valoresDe(altaCliente)));
    altaCliente.reset();
    mostrar(altaCliente, false);
    await cargarListado();
    mensaje("mensaje-panel", "Cliente guardado.", false);
  } catch (error) {
    mensaje("mensaje-panel", errorLegible(error), true);
  } finally {
    boton.disabled = false;
  }
}

async function entrar(evento) {
  evento.preventDefault();
  const boton = login.querySelector("button[type=submit]");
  boton.disabled = true;
  mensaje("mensaje-login", "Comprobando acceso…", false);
  try {
    const datos = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        correo: document.getElementById("correo").value.trim(),
        clave: document.getElementById("clave").value,
        clave_nueva: document.getElementById("clave-nueva").value,
      }),
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
  vistaMapa = false;
  sessionStorage.removeItem(CLAVE_SESION);
  if (detalle.open) detalle.close();
  const guiaDialogo = document.getElementById("guia-dialog");
  if (guiaDialogo.open) guiaDialogo.close();
  mostrar(alta, false);
  mostrar(altaCliente, false);
  mostrar(panel, false);
  mostrar(login, true);
  mensaje("mensaje-login", "", false);
  mensaje("mensaje-panel", "", false);
}

async function actualizarTablas() {
  if (!tieneElectricidad()) return;
  const seguro = window.confirm("Revisa las carpetas de fotos y agrega en la hoja las que falten. No cambia títulos, comentarios ni códigos.");
  if (!seguro) return;
  mensaje("mensaje-panel", "Actualizando fotos desde Drive…", false);
  try {
    const datos = await consultar({ accion: "actualizar" });
    if (moduloActivo === "electricidad" || esClientes()) await cargarListado();
    mensaje("mensaje-panel", datos.mensaje || "Tablas actualizadas.", false);
  } catch (error) {
    mensaje("mensaje-panel", errorLegible(error), true);
  }
}

login.addEventListener("submit", entrar);
document.getElementById("ordenar-google").addEventListener("click", actualizarTablas);
document.getElementById("salir").addEventListener("click", salir);
document.getElementById("abrir-alta").addEventListener("click", prepararAlta);
document.getElementById("cancelar-alta").addEventListener("click", () => {
  alta.reset();
  mostrar(alta, false);
});
document.getElementById("cancelar-cliente").addEventListener("click", () => {
  altaCliente.reset();
  mostrar(altaCliente, false);
});
document.getElementById("id_cliente").addEventListener("change", (evento) => {
  mostrar(document.getElementById("cliente-nuevo"), evento.target.value === "nuevo");
});
document.getElementById("vista-mapa").addEventListener("change", (evento) => {
  vistaMapa = evento.target.checked;
  actualizarVista();
});
seccion.addEventListener("change", () => elegirModulo(seccion.value));
document.getElementById("guia").addEventListener("click", () => document.getElementById("guia-dialog").showModal());
document.getElementById("cerrar-guia").addEventListener("click", () => document.getElementById("guia-dialog").close());
alta.addEventListener("submit", registrar);
altaCliente.addEventListener("submit", registrarCliente);
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
