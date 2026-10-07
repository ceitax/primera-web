const HOJA_ID = "1VJmhwBhxQ1FA1zznP4lPfSvAcH8S3F6xUhazVTxLkUE";
const CARPETA_FLC = "1ZtqLxSUQ98yu_iZsigyKterbvFMlwlqm";
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
  imagenes: "1_4 Imagenes",
};

const ADMIN_BASE = [
  ["pceafrias7@gmail.com", "Lucas Cea", "Admin"],
  ["pabloceaduran@gmail.com", "Pablo Cea Durán", "Propiedades"],
  ["alarcon73237717@gmail.com", "Diego Levín", "Electricidad"],
];

const SUBCARPETAS = ["01_Planos", "02_Documentos_SEC", "03_Informes_Tecnicos", "04_Fotografias_Obra"];

const CAMPOS_PROYECTO = [
  "nombre_circuito",
  "tipo_servicio",
  "cliente_sector",
  "estado",
  "latitud",
  "longitud",
  "imagen_url",
  "descripcion",
  "comuna",
  "potencia_declarada",
  "id_cliente",
  "responsable_correo",
];

const CAMPOS_CLIENTE = ["nombre_completo", "rut", "telefono", "correo", "tipo_persona", "direccion_facturacion"];

const PUBLICO = {
  electricidad: ["id_proyecto", "nombre_circuito", "tipo_servicio", "cliente_sector", "estado", "latitud", "longitud", "imagen_url", "descripcion"],
  propiedades: ["id", "titulo", "tipo", "precio_uf", "superficie_m2", "estado", "latitud", "longitud", "factibilidad_electrica", "factibilidad_agua", "imagen_url", "descripcion"],
  desarrollo: ["id", "nombre", "tipo", "estado", "descripcion_corta", "tecnologias", "url_demo", "imagen_url"],
  equipo: ["id_miembro", "nombre", "cargo_rol", "descripcion", "imagen_url", "orden_aparicion"],
};

function doGet(e) {
  return atender((e && e.parameter) || {});
}

function doPost(e) {
  try {
    const datos = JSON.parse((e.postData && e.postData.contents) || "{}");
    return atender(datos);
  } catch (error) {
    return responder({ ok: false, error: String(error.message || error) });
  }
}

function atender(parametros) {
  try {
    const accion = parametros.accion || "estado";
    if (accion === "catalogoPublico") return responder(catalogoPublico(parametros.modulo));
    if (accion === "sesion") return responder(abrirSesion(parametros));
    if (accion === "listar") return responder(listar(parametros));
    if (accion === "detalle") return responder(detalle(parametros));
    if (accion === "checklist") return responder(marcarChecklist(parametros));
    if (accion === "crear") return responder(crear(parametros));
    if (accion === "guardar") return responder(guardarProyecto(parametros));
    if (accion === "terminar") return responder(terminarProyecto(parametros));
    if (accion === "clientes") return responder(listarClientes(parametros));
    if (accion === "cliente") return responder(guardarCliente(parametros));
    if (accion === "foto") return responder(subirFoto(parametros));
    if (accion === "imagen") return responder(guardarImagen(parametros));
    if (accion === "actualizar" || accion === "reordenar") return responder(sincronizarFotos(parametros));
    return responder({ ok: true, servicio: "FLC" });
  } catch (error) {
    return responder({ ok: false, error: String(error.message || error) });
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("NODO Electricidad")
    .addItem("Actualizar fotos desde Drive", "actualizarDesdeMenu")
    .addToUi();
}

function actualizarDesdeMenu() {
  const resultado = sincronizarFotos({});
  SpreadsheetApp.getUi().alert(resultado.mensaje);
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
  const fichas = origen.map(function (fila) {
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

function listarClientes(parametros) {
  exigir(parametros.correo, "electricidad");
  return { ok: true, clientes: leerObjetos(HOJA.clientes) };
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
  if (parametros.modulo !== "electricidad") return { ok: true, proyecto: proyecto, checklist: [], inventario: [], imagenes: [], planos: [] };
  const cliente = leerObjetos(HOJA.clientes).filter(function (fila) {
    return fila.id_cliente === texto(proyecto.id_cliente);
  })[0] || null;
  return {
    ok: true,
    proyecto: proyecto,
    cliente: cliente,
    checklist: leerObjetos(HOJA.checklist).filter(function (fila) { return fila.id_proyecto === id; }),
    inventario: leerObjetos(HOJA.inventario).filter(function (fila) { return fila.id_proyecto === id; }),
    imagenes: leerObjetos(HOJA.imagenes).filter(function (fila) { return fila.id_proyecto === id && fila.url; }),
    planos: planosDe(proyecto.folder_id),
  };
}

function marcarChecklist(parametros) {
  exigir(parametros.correo, "electricidad");
  const idItem = texto(parametros.id_item);
  const hoja = hojaDe(HOJA.checklist);
  const valores = hoja.getDataRange().getValues();
  const columnas = indices(valores[0]);
  if (columnas.id_item == null) throw new Error("Falta la columna id_item.");
  for (var fila = 1; fila < valores.length; fila++) {
    if (texto(valores[fila][columnas.id_item]) !== idItem) continue;
    if (columnas.completado != null) hoja.getRange(fila + 1, columnas.completado + 1).setValue(parametros.completado === "true" || parametros.completado === true);
    if (columnas.fecha_actualizacion != null) hoja.getRange(fila + 1, columnas.fecha_actualizacion + 1).setValue(new Date());
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
    const idCliente = resolverCliente(parametros);
    const numero = siguienteCodigo("ELECTRICIDAD", HOJA.electricidad, "id_proyecto");
    const id = codigo("ELE", numero);
    const carpeta = crearCarpetaObra(id, nombre);
    const fila = {
      id_proyecto: id,
      id_cliente: idCliente,
      comuna: texto(parametros.comuna),
      nombre_circuito: nombre,
      tipo_servicio: texto(parametros.tipo_servicio),
      cliente_sector: texto(parametros.cliente_sector),
      estado: texto(parametros.estado) || "En obra",
      latitud: texto(parametros.latitud),
      longitud: texto(parametros.longitud),
      imagen_url: texto(parametros.imagen_url),
      descripcion: texto(parametros.descripcion),
      responsable_correo: texto(parametros.responsable_correo) || texto(parametros.correo),
      aprobador: "",
      folder_id: carpeta.getId(),
      folder_url: carpeta.getUrl(),
      fecha_creacion: Utilities.formatDate(new Date(), "America/Santiago", "yyyy-MM-dd"),
      potencia_declarada: texto(parametros.potencia_declarada),
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
    return { ok: true, id_proyecto: id, id_cliente: idCliente, folder_url: carpeta.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

function crearPropiedad(parametros) {
  const titulo = texto(parametros.titulo);
  if (!titulo) throw new Error("Falta el título.");
  const numero = siguienteCodigo("PROPIEDADES", HOJA.propiedades, "id");
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

function guardarProyecto(parametros) {
  exigir(parametros.correo, "electricidad");
  const id = texto(parametros.id || parametros.id_proyecto);
  if (!id) throw new Error("Falta el proyecto.");
  const idCliente = resolverCliente(parametros);
  const cambios = {};
  CAMPOS_PROYECTO.forEach(function (clave) {
    if (parametros[clave] == null) return;
    if (clave === "id_cliente" && (texto(parametros[clave]) === "" || texto(parametros[clave]) === "nuevo")) return;
    cambios[clave] = texto(parametros[clave]);
  });
  if (idCliente) cambios.id_cliente = idCliente;
  if (!actualizarPorClave(HOJA.electricidad, "id_proyecto", id, cambios)) throw new Error("No encontré ese proyecto.");
  if (idCliente && texto(parametros.nombre_completo)) guardarCliente(Object.assign({}, parametros, { id_cliente: idCliente, correo: parametros.correo }));
  return { ok: true, id_proyecto: id, id_cliente: idCliente };
}

function terminarProyecto(parametros) {
  const admin = exigir(parametros.correo, "electricidad");
  const id = texto(parametros.id || parametros.id_proyecto);
  if (!id) throw new Error("Falta el proyecto.");
  const cambios = { aprobador: admin.correo, estado: "Terminado" };
  if (!actualizarPorClave(HOJA.electricidad, "id_proyecto", id, cambios)) throw new Error("No encontré ese proyecto.");
  return { ok: true, id_proyecto: id, aprobador: admin.correo, estado: "Terminado" };
}

function guardarCliente(parametros) {
  exigir(parametros.correo, "electricidad");
  const cambios = cambiosCliente(parametros);
  const id = texto(parametros.id_cliente);
  if (id && id !== "nuevo") {
    if (!texto(cambios.nombre_completo) && Object.keys(cambios).length === 0) return { ok: true, id_cliente: id };
    if (!actualizarPorClave(HOJA.clientes, "id_cliente", id, cambios)) throw new Error("No encontré ese cliente.");
    return { ok: true, id_cliente: id };
  }
  if (!texto(cambios.nombre_completo)) throw new Error("Falta el nombre del cliente.");
  const numero = siguienteCliente();
  const nuevo = codigo("CLT", numero);
  cambios.id_cliente = nuevo;
  if (!cambios.fecha_registro) cambios.fecha_registro = Utilities.formatDate(new Date(), "America/Santiago", "yyyy-MM-dd");
  agregarFila(HOJA.clientes, cambios);
  return { ok: true, id_cliente: nuevo };
}

function subirFoto(parametros) {
  exigir(parametros.correo, "electricidad");
  const id = texto(parametros.id_proyecto || parametros.id);
  const proyecto = proyectoElectricidad(id);
  if (!proyecto.folder_id) throw new Error("Ese proyecto no tiene carpeta.");
  if (!parametros.archivo) throw new Error("Falta la foto.");
  const carpeta = subcarpeta(proyecto.folder_id, "04_Fotografias_Obra");
  const nombre = texto(parametros.nombre) || "foto.jpg";
  const archivo = carpeta.createFile(Utilities.newBlob(bytesDeArchivo(parametros.archivo), parametros.tipo || "image/jpeg", nombre));
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = "https://drive.google.com/file/d/" + archivo.getId() + "/view";
  agregarFila(HOJA.imagenes, {
    id_proyecto: id,
    url: url,
    titulo: texto(parametros.titulo) || nombre,
    comentario: texto(parametros.comentario),
  });
  return { ok: true, id_proyecto: id, url: url };
}

function guardarImagen(parametros) {
  exigir(parametros.correo, "electricidad");
  const url = texto(parametros.url);
  if (!url) throw new Error("Falta la foto.");
  const cambios = {};
  if (parametros.titulo != null) cambios.titulo = texto(parametros.titulo);
  if (parametros.comentario != null) cambios.comentario = texto(parametros.comentario);
  if (!actualizarPorClave(HOJA.imagenes, "url", url, cambios)) throw new Error("No encontré esa foto en la hoja.");
  return { ok: true, url: url };
}

function sincronizarFotos(parametros) {
  if (parametros && parametros.correo) exigir(parametros.correo, "electricidad");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const conocidas = {};
    leerObjetos(HOJA.imagenes).forEach(function (fila) {
      const idArchivo = idDeUrl(fila.url);
      if (idArchivo) conocidas[idArchivo] = true;
    });
    var nuevas = 0;
    leerObjetos(HOJA.electricidad).forEach(function (proyecto) {
      if (!proyecto.folder_id || !proyecto.id_proyecto) return;
      var fotos;
      try {
        fotos = DriveApp.getFolderById(proyecto.folder_id).getFoldersByName("04_Fotografias_Obra");
      } catch (error) {
        return;
      }
      if (!fotos.hasNext()) return;
      const archivos = fotos.next().getFiles();
      while (archivos.hasNext()) {
        const archivo = archivos.next();
        if (!esImagen(archivo) || conocidas[archivo.getId()]) continue;
        archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        agregarFila(HOJA.imagenes, {
          id_proyecto: proyecto.id_proyecto,
          url: "https://drive.google.com/file/d/" + archivo.getId() + "/view",
          titulo: archivo.getName(),
          comentario: "",
        });
        conocidas[archivo.getId()] = true;
        nuevas++;
      }
    });
    return {
      ok: true,
      nuevas: nuevas,
      mensaje: nuevas === 1 ? "Se agregó 1 foto nueva. Los títulos y comentarios que ya estaban siguen igual." : "Se agregaron " + nuevas + " fotos nuevas. Los títulos y comentarios que ya estaban siguen igual.",
    };
  } finally {
    lock.releaseLock();
  }
}

function resolverCliente(parametros) {
  const id = texto(parametros.id_cliente);
  if (id && id !== "nuevo") {
    if (texto(parametros.nombre_completo)) {
      actualizarPorClave(HOJA.clientes, "id_cliente", id, cambiosCliente(parametros));
    }
    return id;
  }
  if (!texto(parametros.nombre_completo)) return "";
  const creado = guardarCliente(parametros);
  return creado.id_cliente;
}

function cambiosCliente(parametros) {
  const cambios = {};
  if (parametros.nombre_completo != null) cambios.nombre_completo = texto(parametros.nombre_completo);
  if (parametros.rut != null) cambios.rut = texto(parametros.rut);
  if (parametros.telefono != null) cambios.telefono = texto(parametros.telefono);
  if (parametros.correo_cliente != null) cambios.correo = texto(parametros.correo_cliente);
  if (parametros.tipo_persona != null) cambios.tipo_persona = texto(parametros.tipo_persona);
  if (parametros.direccion_facturacion != null) cambios.direccion_facturacion = texto(parametros.direccion_facturacion);
  return cambios;
}

function proyectoElectricidad(id) {
  const proyecto = leerObjetos(HOJA.electricidad).filter(function (fila) {
    return fila.id_proyecto === id;
  })[0];
  if (!proyecto) throw new Error("No encontré ese proyecto.");
  return proyecto;
}

function planosDe(folderId) {
  if (!folderId) return [];
  var madre;
  try {
    madre = DriveApp.getFolderById(folderId);
  } catch (error) {
    return [];
  }
  const hijos = madre.getFoldersByName("01_Planos");
  if (!hijos.hasNext()) return [];
  const grupos = {};
  const archivos = hijos.next().getFiles();
  while (archivos.hasNext()) {
    const archivo = archivos.next();
    const nombre = archivo.getName();
    const match = nombre.match(/^(.*?)[\s._-]*V(\d+)(\.[^.]+)?$/i);
    if (!match) continue;
    const base = texto(match[1]).replace(/[\s._-]+$/g, "") || nombre;
    const version = Number(match[2]);
    if (!grupos[base] || version > grupos[base].version) {
      grupos[base] = { nombre: base, version: version, archivo: nombre, url: archivo.getUrl() };
    }
  }
  return Object.keys(grupos).map(function (clave) { return grupos[clave]; });
}

function copiarChecklist(idProyecto) {
  leerObjetos(HOJA.plantilla).forEach(function (req, indice) {
    var destino = texto(req.subcarpeta_destino);
    if (destino === "02_Certificados_SEC") destino = "02_Documentos_SEC";
    agregarFila(HOJA.checklist, {
      id_item: "CHK-" + idProyecto + "-" + dosDigitos(indice + 1),
      id_proyecto: idProyecto,
      tarea: req.tarea_requerida || req.texto || "",
      subcarpeta_destino: destino,
      completado: false,
      drive_file_id: "",
      fecha_actualizacion: Utilities.formatDate(new Date(), "America/Santiago", "yyyy-MM-dd"),
    });
  });
}

function crearCarpetaObra(id, nombre) {
  const carpeta = DriveApp.getFolderById(CARPETA_FLC).createFolder("[" + id + "] " + limpiarNombre(nombre));
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

function subcarpeta(folderId, nombre) {
  const madre = DriveApp.getFolderById(folderId);
  const hijos = madre.getFoldersByName(nombre);
  return hijos.hasNext() ? hijos.next() : madre.createFolder(nombre);
}

function siguienteCodigo(tipo, nombreHoja, columna) {
  var maximo = leerSiguiente(tipo) - 1;
  leerObjetos(nombreHoja).forEach(function (fila) {
    const numero = numeroDeCodigo(fila[columna]);
    if (numero > maximo) maximo = numero;
  });
  return maximo + 1;
}

function siguienteCliente() {
  var maximo = 0;
  leerObjetos(HOJA.clientes).forEach(function (fila) {
    const numero = numeroDeCodigo(fila.id_cliente);
    if (numero > maximo) maximo = numero;
  });
  return maximo + 1;
}

function actualizarPorClave(nombreHoja, columnaClave, valorClave, cambios) {
  const hoja = hojaDe(nombreHoja);
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return false;
  const columnas = indices(valores[0]);
  const colClave = columnas[columnaClave];
  if (colClave == null) throw new Error("Falta la columna " + columnaClave + ".");
  for (var fila = 1; fila < valores.length; fila++) {
    if (texto(valores[fila][colClave]) !== texto(valorClave)) continue;
    Object.keys(cambios).forEach(function (clave) {
      if (columnas[clave] == null) return;
      hoja.getRange(fila + 1, columnas[clave] + 1).setValue(cambios[clave]);
    });
    return true;
  }
  return false;
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
  const encabezado = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1)).getValues()[0];
  hoja.appendRow(encabezado.map(function (clave) {
    const normal = normalizarClave(clave);
    return objeto[normal] == null ? "" : objeto[normal];
  }));
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

function idDeUrl(url) {
  const marca = texto(url);
  const match = marca.match(/\/d\/([^/?]+)/) || marca.match(/[?&]id=([^&]+)/);
  return match ? match[1] : "";
}

function esImagen(archivo) {
  const mime = String(archivo.getMimeType() || "");
  if (mime.indexOf("image/") === 0) return true;
  return /\.(jpe?g|png|webp|gif|heic)$/i.test(archivo.getName());
}

function bytesDeArchivo(bruto) {
  var limpio = String(bruto || "");
  const coma = limpio.indexOf(",");
  if (limpio.indexOf("base64") !== -1 && coma !== -1) limpio = limpio.slice(coma + 1);
  return Utilities.base64Decode(limpio);
}

function responder(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}
