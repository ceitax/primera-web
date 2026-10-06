const HOJA_ID = "1VJmhwBhxQ1FA1zznP4lPfSvAcH8S3F6xUhazVTxLkUE";
const CLAVE_INICIAL = "test123";

const HOJA = {
  admin: "700_Administradores",
  correlativo: "00_Correlativos",
  plantilla: "00_Plantilla_Requerimientos",
  electricidad: "01_Electricidad_Proyectos",
  propiedades: "02_Propiedades",
  solicitudes: "2_1_Solicitudes_Propiedades",
  web: "03_Web_Proyectos",
  equipo: "3_1_Web_Equipo",
  clientes: "1_1_Clientes_Electricidad",
  checklist: "1_2_Checklist_Proyectos",
  inventario: "1_3_Inventario_Materiales",
};

const ADMIN_BASE = [
  ["pceafrias7@gmail.com", "Lucas Cea", "Admin"],
  ["pabloceaduran@gmail.com", "Pablo Cea Durán", "Propiedades"],
  ["alarcon73237717@gmail.com", "Diego Levín", "Electricidad"],
];

const SUBCARPETAS = ["01_Planos", "02_Certificados_SEC", "03_Informes_Tecnicos", "04_Fotografias_Obra"];

const PUBLICO = {
  electricidad: ["id_proyecto", "nombre_circuito", "tipo_servicio", "cliente_sector", "estado", "latitud", "longitud", "imagen_url", "descripcion"],
  propiedades: ["id", "titulo", "tipo", "precio_uf", "superficie_m2", "estado", "latitud", "longitud", "factibilidad_electrica", "factibilidad_agua", "imagen_url", "descripcion"],
  desarrollo: ["id", "nombre", "tipo", "estado", "descripcion_corta", "tecnologias", "url_demo", "imagen_url"],
  equipo: ["id_miembro", "nombre", "cargo_rol", "descripcion", "imagen_url", "orden_aparicion"],
};

function doGet(e) {
  const parametros = (e && e.parameter) || {};
  try {
    const accion = parametros.accion || "estado";
    if (accion === "catalogoPublico") return responder(catalogoPublico(parametros.modulo));
    if (accion === "sesion") return responder(abrirSesion(parametros));
    if (accion === "listar") return responder(listar(parametros));
    if (accion === "detalle") return responder(detalle(parametros));
    if (accion === "checklist") return responder(marcarChecklist(parametros));
    if (accion === "crear") return responder(crear(parametros));
    if (accion === "reordenar") return responder(ordenarProyectos(parametros));
    return responder({ ok: true, servicio: "FLC" });
  } catch (error) {
    return responder({ ok: false, error: String(error.message || error) });
  }
}

function doPost(e) {
  try {
    const datos = JSON.parse((e.postData && e.postData.contents) || "{}");
    if (datos.accion === "crear") return responder(crear(datos));
    if (datos.accion === "reordenar") return responder(ordenarProyectos(datos));
    return responder({ ok: false, error: "Acción no reconocida." });
  } catch (error) {
    return responder({ ok: false, error: String(error.message || error) });
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚡ NODO Electricidad")
    .addItem("Ordenar códigos y carpetas", "ordenarDesdeMenu")
    .addToUi();
}

function ordenarDesdeMenu() {
  const ui = SpreadsheetApp.getUi();
  const aviso = ui.alert(
    "Ordenar proyectos",
    "Esto deja los códigos ELE en serie, renombra cada carpeta a [ELE-00X] Nombre y alinea checklist e inventario. No borra archivos.",
    ui.ButtonSet.YES_NO
  );
  if (aviso !== ui.Button.YES) return;
  const resultado = ordenarElectricidad();
  ui.alert(resultado.mensaje);
}

function catalogoPublico(modulo) {
  const nombre = String(modulo || "").toLowerCase();
  const hojaNombre = { electricidad: HOJA.electricidad, propiedades: HOJA.propiedades, desarrollo: HOJA.web, equipo: HOJA.equipo }[nombre];
  if (!hojaNombre) throw new Error("Módulo público no reconocido.");
  const permitidas = PUBLICO[nombre];
  let origen = leerObjetos(hojaNombre);
  if (nombre === "desarrollo") {
    origen = origen.filter(function (fila) {
      const marca = String(fila.requiere_auth || "").toLowerCase();
      return marca !== "true" && marca !== "sí" && marca !== "si";
    });
  }
  let fichas = origen.map(function (fila) {
    const limpia = {};
    permitidas.forEach(function (clave) {
      if (fila[clave] !== "") limpia[clave] = fila[clave];
    });
    return limpia;
  });
  if (nombre === "equipo") {
    fichas.sort(function (a, b) {
      return Number(a.orden_aparicion || 0) - Number(b.orden_aparicion || 0);
    });
  }
  return { ok: true, modulo: nombre, fichas: fichas };
}

function abrirSesion(parametros) {
  asegurarAdministradores();
  const admin = administradorPorCorreo(parametros.correo);
  if (!admin) throw new Error("Ese correo no está en 700_Administradores.");
  if (!claveAceptada(admin, parametros.clave, parametros.clave_nueva)) {
    throw new Error("La clave no coincide. Si la celda está vacía, la clave inicial es test123.");
  }
  const modulos = modulosDe(admin.rol);
  if (!modulos.length) throw new Error("Ese rol no tiene módulos asignados.");
  return {
    ok: true,
    token: "google",
    correo: admin.correo,
    nombre: admin.nombre,
    rol: admin.rol,
    modulos: modulos,
  };
}

function listar(parametros) {
  const admin = exigir(parametros.correo, parametros.modulo);
  const hoja = parametros.modulo === "propiedades" ? HOJA.propiedades : HOJA.electricidad;
  return { ok: true, rol: admin.rol, proyectos: leerObjetos(hoja) };
}

function detalle(parametros) {
  exigir(parametros.correo, parametros.modulo);
  const id = texto(parametros.id);
  const hoja = parametros.modulo === "propiedades" ? HOJA.propiedades : HOJA.electricidad;
  const clave = parametros.modulo === "propiedades" ? "id" : "id_proyecto";
  const proyecto = leerObjetos(hoja).filter(function (fila) {
    return fila[clave] === id;
  })[0];
  if (!proyecto) throw new Error("No encontré ese proyecto.");
  if (parametros.modulo !== "electricidad") return { ok: true, proyecto: proyecto, checklist: [], inventario: [] };
  return {
    ok: true,
    proyecto: proyecto,
    checklist: leerObjetos(HOJA.checklist).filter(function (fila) { return fila.id_proyecto === id; }),
    inventario: leerObjetos(HOJA.inventario).filter(function (fila) { return fila.id_proyecto === id; }),
  };
}

function marcarChecklist(parametros) {
  exigir(parametros.correo, "electricidad");
  const idItem = texto(parametros.id_item);
  const hoja = hojaDe(HOJA.checklist);
  const valores = hoja.getDataRange().getValues();
  const columnas = indices(valores[0]);
  const colItem = columnas.id_item;
  const colHecho = columnas.completado;
  const colFecha = columnas.fecha_actualizacion;
  if (colItem == null) throw new Error("Falta la columna id_item.");
  for (var fila = 1; fila < valores.length; fila++) {
    if (texto(valores[fila][colItem]) !== idItem) continue;
    if (colHecho != null) hoja.getRange(fila + 1, colHecho + 1).setValue(parametros.completado === "true" || parametros.completado === true);
    if (colFecha != null) hoja.getRange(fila + 1, colFecha + 1).setValue(new Date());
    return { ok: true, id_item: idItem };
  }
  throw new Error("No encontré esa tarea.");
}

function crear(parametros) {
  exigir(parametros.correo, parametros.modulo);
  if (parametros.modulo === "propiedades") return crearPropiedad(parametros);
  return crearElectricidad(parametros);
}

function crearElectricidad(parametros) {
  const nombre = texto(parametros.nombre_circuito);
  if (!nombre) throw new Error("Falta el nombre del circuito.");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const numero = leerSiguiente("ELECTRICIDAD");
    const id = codigo("ELE", numero);
    const carpeta = crearCarpetaObra(id, nombre);
    const fila = {
      id_proyecto: id,
      nombre_circuito: nombre,
      tipo_servicio: texto(parametros.tipo_servicio),
      cliente_sector: texto(parametros.cliente_sector),
      estado: texto(parametros.estado) || "En obra",
      latitud: texto(parametros.latitud),
      longitud: texto(parametros.longitud),
      imagen_url: texto(parametros.imagen_url),
      descripcion: texto(parametros.descripcion),
      responsable_correo: texto(parametros.correo),
      folder_id: carpeta.getId(),
      folder_url: carpeta.getUrl(),
      fecha_creacion: Utilities.formatDate(new Date(), "America/Santiago", "yyyy-MM-dd"),
    };
    agregarFila(HOJA.electricidad, fila);
    copiarChecklist(id);
    agregarFila(HOJA.inventario, {
      id_registro: "MAT-" + id + "-01",
      id_proyecto: id,
      material: "Por cubicación",
      cantidad: "",
      unidad: "gl",
      observacion: "Pendiente de asignación",
    });
    guardarSiguiente("ELECTRICIDAD", numero + 1);
    return { ok: true, id_proyecto: id, folder_url: carpeta.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

function crearPropiedad(parametros) {
  const titulo = texto(parametros.titulo);
  if (!titulo) throw new Error("Falta el título.");
  const numero = siguientePropiedad();
  const id = codigo("PROP", numero);
  agregarFila(HOJA.propiedades, {
    id: id,
    titulo: titulo,
    tipo: texto(parametros.tipo),
    precio_uf: texto(parametros.precio_uf),
    superficie_m2: texto(parametros.superficie_m2),
    estado: texto(parametros.estado) || "Disponible",
    latitud: texto(parametros.latitud),
    longitud: texto(parametros.longitud),
    factibilidad_electrica: texto(parametros.factibilidad_electrica),
    factibilidad_agua: texto(parametros.factibilidad_agua),
    imagen_url: texto(parametros.imagen_url),
    descripcion: texto(parametros.descripcion),
    contacto: texto(parametros.correo),
  });
  guardarSiguiente("PROPIEDADES", numero + 1);
  return { ok: true, id: id };
}

function ordenarProyectos(parametros) {
  const admin = exigir(parametros.correo, "electricidad");
  if (String(admin.rol).toLowerCase() !== "admin") throw new Error("Solo un administrador puede ordenar los códigos.");
  return ordenarElectricidad();
}

function ordenarElectricidad() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const hoja = hojaDe(HOJA.electricidad);
    const valores = hoja.getDataRange().getValues();
    const columnas = indices(valores[0]);
    const filas = [];
    for (var i = 1; i < valores.length; i++) {
      if (!texto(valores[i][columnas.id_proyecto])) continue;
      filas.push({ fila: i + 1, id: texto(valores[i][columnas.id_proyecto]), nombre: texto(valores[i][columnas.nombre_circuito]), folderId: texto(valores[i][columnas.folder_id]) });
    }
    const mapa = {};
    filas.forEach(function (proyecto, indice) {
      mapa[proyecto.id] = codigo("ELE", indice + 1);
    });
    var carpetas = 0;
    var archivos = 0;
    var omitidas = [];
    filas.forEach(function (proyecto) {
      const nuevo = mapa[proyecto.id];
      hoja.getRange(proyecto.fila, columnas.id_proyecto + 1).setValue(nuevo);
      if (!proyecto.folderId) return;
      try {
        const carpeta = DriveApp.getFolderById(proyecto.folderId);
        carpeta.setName("[" + nuevo + "] " + limpiarNombre(proyecto.nombre));
        asegurarSubcarpetas(carpeta);
        archivos += renombrarContenido(carpeta, proyecto.id, nuevo);
        carpetas++;
      } catch (error) {
        omitidas.push(nuevo);
      }
    });
    reescribirHijos(HOJA.checklist, "id_item", "CHK", mapa);
    reescribirHijos(HOJA.inventario, "id_registro", "MAT", mapa);
    guardarSiguiente("ELECTRICIDAD", filas.length + 1);
    return {
      ok: true,
      proyectos: filas.length,
      carpetas: carpetas,
      archivos: archivos,
      siguiente: codigo("ELE", filas.length + 1),
      mensaje:
        "Quedaron " +
        filas.length +
        " proyectos. Siguiente código libre: " +
        codigo("ELE", filas.length + 1) +
        ". Carpetas renombradas: " +
        carpetas +
        (omitidas.length ? ". Sin carpeta: " + omitidas.join(", ") : "") +
        ".",
    };
  } finally {
    lock.releaseLock();
  }
}

function reescribirHijos(nombreHoja, columnaId, prefijo, mapa) {
  const hoja = hojaDe(nombreHoja);
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return;
  const columnas = indices(valores[0]);
  const colProyecto = columnas.id_proyecto;
  const colId = columnas[columnaId];
  if (colProyecto == null || colId == null) return;
  const grupos = {};
  for (var fila = 1; fila < valores.length; fila++) {
    const actual = texto(valores[fila][colProyecto]);
    if (!actual) continue;
    const nuevo = mapa[actual] || actual;
    if (!grupos[nuevo]) grupos[nuevo] = [];
    grupos[nuevo].push(fila + 1);
  }
  Object.keys(grupos).forEach(function (idProyecto) {
    grupos[idProyecto].forEach(function (numeroFila, indice) {
      hoja.getRange(numeroFila, colProyecto + 1).setValue(idProyecto);
      hoja.getRange(numeroFila, colId + 1).setValue(prefijo + "-" + idProyecto + "-" + dosDigitos(indice + 1));
    });
  });
}

function copiarChecklist(idProyecto) {
  const plantilla = leerObjetos(HOJA.plantilla);
  plantilla.forEach(function (req, indice) {
    agregarFila(HOJA.checklist, {
      id_item: "CHK-" + idProyecto + "-" + dosDigitos(indice + 1),
      id_proyecto: idProyecto,
      tarea: req.tarea_requerida || req.texto || "",
      subcarpeta_destino: req.subcarpeta_destino || "",
      completado: false,
      drive_file_id: "",
      fecha_actualizacion: Utilities.formatDate(new Date(), "America/Santiago", "yyyy-MM-dd"),
    });
  });
}

function crearCarpetaObra(id, nombre) {
  const madre = carpetaMadre();
  const carpeta = madre.createFolder("[" + id + "] " + limpiarNombre(nombre));
  asegurarSubcarpetas(carpeta);
  carpeta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return carpeta;
}

function asegurarSubcarpetas(carpeta) {
  const existentes = {};
  const hijos = carpeta.getFolders();
  while (hijos.hasNext()) existentes[hijos.next().getName()] = true;
  SUBCARPETAS.forEach(function (nombre) {
    if (!existentes[nombre]) carpeta.createFolder(nombre);
  });
}

function renombrarContenido(carpeta, viejo, nuevo) {
  if (!viejo || viejo === nuevo) return 0;
  var cantidad = 0;
  const archivos = carpeta.getFiles();
  while (archivos.hasNext()) {
    const archivo = archivos.next();
    const nombre = archivo.getName();
    if (nombre.indexOf(viejo) === -1) continue;
    archivo.setName(nombre.split(viejo).join(nuevo));
    cantidad++;
  }
  const carpetas = carpeta.getFolders();
  while (carpetas.hasNext()) cantidad += renombrarContenido(carpetas.next(), viejo, nuevo);
  return cantidad;
}

function siguientePropiedad() {
  const guardado = leerSiguiente("PROPIEDADES");
  var maximo = guardado - 1;
  leerObjetos(HOJA.propiedades).forEach(function (fila) {
    const numero = numeroDeCodigo(fila.id);
    if (numero > maximo) maximo = numero;
  });
  return maximo + 1;
}

function leerSiguiente(tipo) {
  const hoja = hojaDe(HOJA.correlativo);
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return 1;
  const columnas = indices(valores[0]);
  const colTipo = columnas.tipo_entidad != null ? columnas.tipo_entidad : columnas.clave;
  const colValor = columnaSiguiente(columnas);
  if (colTipo == null || colValor == null) return 1;
  for (var fila = 1; fila < valores.length; fila++) {
    if (texto(valores[fila][colTipo]).toUpperCase() !== tipo) continue;
    const numero = Number(valores[fila][colValor]);
    return numero > 0 ? numero : 1;
  }
  return 1;
}

function guardarSiguiente(tipo, numero) {
  const hoja = hojaDe(HOJA.correlativo);
  const valores = hoja.getDataRange().getValues();
  const columnas = indices(valores[0]);
  const colTipo = columnas.tipo_entidad != null ? columnas.tipo_entidad : columnas.clave;
  const colValor = columnaSiguiente(columnas);
  if (colTipo == null || colValor == null) return;
  for (var fila = 1; fila < valores.length; fila++) {
    if (texto(valores[fila][colTipo]).toUpperCase() !== tipo) continue;
    hoja.getRange(fila + 1, colValor + 1).setValue(numero);
    return;
  }
  const nueva = [];
  for (var col = 0; col < valores[0].length; col++) nueva.push("");
  nueva[colTipo] = tipo;
  nueva[colValor] = numero;
  hoja.appendRow(nueva);
}

function columnaSiguiente(columnas) {
  const nombres = Object.keys(columnas);
  for (var i = 0; i < nombres.length; i++) {
    if (nombres[i].indexOf("siguiente") === 0 || nombres[i] === "valor") return columnas[nombres[i]];
  }
  return null;
}

function asegurarAdministradores() {
  const hoja = hojaDe(HOJA.admin);
  if (hoja.getLastRow() < 1 || !texto(hoja.getRange(1, 1).getValue())) {
    hoja.getRange(1, 1, 1, 5).setValues([["Correo", "Nombre", "Rol", "Password", "Estado"]]);
  }
  const valores = hoja.getDataRange().getValues();
  const columnas = indices(valores[0]);
  if (columnas.correo == null) return;
  const existentes = {};
  for (var fila = 1; fila < valores.length; fila++) {
    const correo = texto(valores[fila][columnas.correo]).toLowerCase();
    if (correo) existentes[correo] = true;
  }
  if (Object.keys(existentes).length) return;
  ADMIN_BASE.forEach(function (persona) {
    const nueva = [];
    for (var col = 0; col < valores[0].length; col++) nueva.push("");
    nueva[columnas.correo] = persona[0];
    if (columnas.nombre != null) nueva[columnas.nombre] = persona[1];
    if (columnas.rol != null) nueva[columnas.rol] = persona[2];
    if (columnas.password != null) nueva[columnas.password] = "";
    if (columnas.estado != null) nueva[columnas.estado] = "Activo";
    hoja.appendRow(nueva);
  });
}

function administradorPorCorreo(correo) {
  const buscado = texto(correo).toLowerCase();
  const personas = leerObjetos(HOJA.admin);
  for (var i = 0; i < personas.length; i++) {
    if (texto(personas[i].correo).toLowerCase() === buscado) return personas[i];
  }
  return null;
}

function claveAceptada(admin, clave, claveNueva) {
  const ingresada = String(clave || "");
  const guardada = texto(admin.password);
  if (!guardada) {
    if (ingresada !== CLAVE_INICIAL) return false;
    if (texto(claveNueva)) guardarClave(admin.correo, texto(claveNueva));
    return true;
  }
  if (guardada === hashClave(ingresada) || guardada === ingresada) return true;
  return false;
}

function guardarClave(correo, clave) {
  const hoja = hojaDe(HOJA.admin);
  const valores = hoja.getDataRange().getValues();
  const columnas = indices(valores[0]);
  if (columnas.correo == null || columnas.password == null) return;
  for (var fila = 1; fila < valores.length; fila++) {
    if (texto(valores[fila][columnas.correo]).toLowerCase() !== texto(correo).toLowerCase()) continue;
    hoja.getRange(fila + 1, columnas.password + 1).setValue(hashClave(clave));
    return;
  }
}

function hashClave(clave) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(clave), Utilities.Charset.UTF_8);
  return bytes.map(function (byte) {
    const valor = byte < 0 ? byte + 256 : byte;
    return ("0" + valor.toString(16)).slice(-2);
  }).join("");
}

function exigir(correo, modulo) {
  asegurarAdministradores();
  const admin = administradorPorCorreo(correo);
  if (!admin) throw new Error("No hay acceso para ese correo.");
  if (texto(admin.estado) && texto(admin.estado).toLowerCase() !== "activo") throw new Error("Esa cuenta está inactiva.");
  const modulos = modulosDe(admin.rol);
  if (modulo && modulos.indexOf(modulo) === -1) throw new Error("Ese rol no abre este módulo.");
  return admin;
}

function modulosDe(rol) {
  const nombre = texto(rol).toLowerCase();
  if (nombre === "admin") return ["electricidad", "propiedades"];
  if (nombre.indexOf("elect") !== -1) return ["electricidad"];
  if (nombre.indexOf("prop") !== -1) return ["propiedades"];
  return [];
}

function leerObjetos(nombreHoja) {
  const hoja = hojaDe(nombreHoja);
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return [];
  const encabezado = valores[0].map(normalizarClave);
  const filas = [];
  for (var fila = 1; fila < valores.length; fila++) {
    if (!valores[fila].some(function (celda) { return texto(celda) !== ""; })) continue;
    const objeto = {};
    encabezado.forEach(function (clave, columna) {
      if (!clave) return;
      objeto[clave] = texto(valores[fila][columna]);
    });
    filas.push(objeto);
  }
  return filas;
}

function agregarFila(nombreHoja, objeto) {
  const hoja = hojaDe(nombreHoja);
  const encabezado = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const fila = encabezado.map(function (clave) {
    const normal = normalizarClave(clave);
    return objeto[normal] == null ? "" : objeto[normal];
  });
  hoja.appendRow(fila);
}

function hojaDe(nombre) {
  const hoja = SpreadsheetApp.openById(HOJA_ID).getSheetByName(nombre);
  if (!hoja) throw new Error("No existe la pestaña " + nombre + ".");
  return hoja;
}

function indices(encabezado) {
  const mapa = {};
  encabezado.forEach(function (clave, columna) {
    const normal = normalizarClave(clave);
    if (normal) mapa[normal] = columna;
  });
  return mapa;
}

function normalizarClave(valor) {
  return texto(valor).toLowerCase().replace(/\s+/g, "_");
}

function texto(valor) {
  if (valor == null) return "";
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    return Utilities.formatDate(valor, "America/Santiago", "yyyy-MM-dd");
  }
  return String(valor).trim();
}

function codigo(prefijo, numero) {
  return prefijo + "-" + ("00" + Number(numero)).slice(-3);
}

function dosDigitos(numero) {
  return ("0" + Number(numero)).slice(-2);
}

function numeroDeCodigo(valor) {
  const partes = texto(valor).split("-");
  const numero = Number(partes[partes.length - 1]);
  return numero > 0 ? numero : 0;
}

function limpiarNombre(nombre) {
  return texto(nombre).replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").slice(0, 80) || "Proyecto";
}

function carpetaMadre() {
  const padres = DriveApp.getFileById(HOJA_ID).getParents();
  return padres.hasNext() ? padres.next() : DriveApp.getRootFolder();
}

function responder(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}
