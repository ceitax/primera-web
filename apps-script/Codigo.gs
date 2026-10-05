const HOJA_ID = "1VJmhwBhxQ1FA1zznP4lPfSvAcH8S3F6xUhazVTxLkUE";
const MARCA_INICIALIZADA = "FLC_DB_INICIALIZADA";

const CIRCUITO_PRUEBA = "Circuito de prueba FLC";

const HOJAS = {
  Administradores: ["Correo", "Nombre", "Rol"],
  Proyectos_Electricidad: [
    "id_proyecto",
    "nombre_circuito",
    "tipo_servicio",
    "cliente_sector",
    "latitud",
    "longitud",
    "estado",
    "imagen_url",
    "descripcion",
    "responsable_correo",
    "folder_id",
    "folder_url",
    "fecha_creacion",
  ],
  Checklist_Proyectos: ["id_item", "id_proyecto", "tarea", "completado", "fecha_actualizacion"],
  Inventario_Materiales: ["id_registro", "id_proyecto", "material", "cantidad", "unidad", "observacion"],
  Propiedades_Loteos: [
    "id_propiedad",
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
    "responsable",
    "folder_id",
    "folder_url",
    "fecha_creacion",
  ],
};

const CATALOGO_PUBLICO = {
  electricidad: {
    hoja: "Proyectos_Electricidad",
    claves: [
      "id_proyecto",
      "nombre_circuito",
      "tipo_servicio",
      "cliente_sector",
      "latitud",
      "longitud",
      "estado",
      "imagen_url",
      "descripcion",
    ],
  },
  propiedades: {
    hoja: "Propiedades_Loteos",
    claves: [
      "id_propiedad",
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
  },
  desarrollo: {
    hoja: "FLC Desarrollo",
    claves: ["id", "nombre", "tipo", "estado", "descripcion_corta", "tecnologias", "url_demo", "imagen_url"],
  },
};

const ADMINISTRADORES = [
  ["pceafrias7@gmail.com", "Lucas Cea", "Admin"],
  ["pabloceaduran@gmail.com", "Pablo Cea Durán", "Propiedades"],
  ["alarcon73237717@gmail.com", "Diego Levín", "Electricidad"],
];

function libroActivo() {
  const activo = SpreadsheetApp.getActiveSpreadsheet();
  return activo || SpreadsheetApp.openById(HOJA_ID);
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const accion = String(params.accion || "").trim().toLowerCase();
    if (!accion) return responder({ ok: true, servicio: "FLC Intranet API" });

    const libro = libroActivo();
    if (accion === "catalogopublico") {
      return responder(catalogoPublico(libro, params.modulo));
    }

    const sesion = buscarAdministrador(libro, params.correo);
    if (!sesion) return responder({ ok: false, error: "Ese correo no está en Administradores." });

    if (accion === "sesion") {
      return responder({
        ok: true,
        correo: sesion.correo,
        nombre: sesion.nombre,
        rol: sesion.rol,
        modulos: modulosDe(sesion.rol),
      });
    }

    const modulo = String(params.modulo || "").trim().toLowerCase();
    exigirModulo(sesion.rol, modulo);

    if (accion === "listar") {
      return responder({ ok: true, modulo: modulo, proyectos: listarModulo(libro, modulo) });
    }
    if (accion === "detalle") {
      const id = String(params.id || "").trim();
      if (!id) return responder({ ok: false, error: "Falta el id." });
      return responder(detalleDe(libro, modulo, id));
    }
    return responder({ ok: false, error: "Acción desconocida." });
  } catch (error) {
    return responder({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const cuerpo = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const accion = String(cuerpo.accion || "").trim().toLowerCase();
    if (accion !== "crear") return responder({ ok: false, error: "Acción desconocida." });

    const libro = libroActivo();
    const sesion = buscarAdministrador(libro, cuerpo.correo);
    if (!sesion) return responder({ ok: false, error: "Ese correo no está en Administradores." });

    const modulo = String(cuerpo.modulo || "").trim().toLowerCase();
    exigirModulo(sesion.rol, modulo);

    const candado = LockService.getScriptLock();
    candado.waitLock(15000);
    try {
      const id = crearRegistro(libro, modulo, cuerpo.datos || {}, sesion);
      return responder({ ok: true, id: id });
    } finally {
      candado.releaseLock();
    }
  } catch (error) {
    return responder({ ok: false, error: error.message });
  }
}

function inicializarBaseDeDatos() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(MARCA_INICIALIZADA) === "1") {
    return "La base ya fue inicializada. No se repitió la carga.";
  }

  const libro = libroActivo();
  Object.keys(HOJAS).forEach((nombre) => asegurarHoja(libro, nombre));
  insertarAdministradores(libro);

  const proyectos = libro.getSheetByName("Proyectos_Electricidad");
  const yaExiste = filasDe(proyectos).some((fila) => String(fila.nombre_circuito) === "Circuito de prueba FLC");
  if (!yaExiste) crearCircuitoDePrueba(libro);

  props.setProperty(MARCA_INICIALIZADA, "1");
  return "Listo: pestañas, administradores, proyecto de prueba y carpeta.";
}

function corregirAdministradores() {
  escribirAdministradores(libroActivo());
  return "Administradores quedó solo con Lucas Cea, Pablo Cea Durán y Diego Levín.";
}

function insertarAdministradores(libro) {
  escribirAdministradores(libro);
}

function escribirAdministradores(libro) {
  const hoja = asegurarHoja(libro, "Administradores");
  hoja.clear();
  hoja.getRange(1, 1, 1, HOJAS.Administradores.length).setValues([HOJAS.Administradores]);
  hoja.getRange(2, 1, ADMINISTRADORES.length, HOJAS.Administradores.length).setValues(ADMINISTRADORES);
  hoja.setFrozenRows(1);
}

function crearCircuitoDePrueba(libro) {
  const id = nuevoId("ELE");
  const ahora = marcaLegible();
  const carpeta = crearCarpetaProyecto(libro, "Circuito de prueba FLC", id);
  escribirFila(libro.getSheetByName("Proyectos_Electricidad"), {
    id_proyecto: id,
    nombre_circuito: "Circuito de prueba FLC",
    cliente_sector: "Sector demo",
    latitud: -37.47,
    longitud: -72.35,
    estado: "En obra",
    responsable_correo: "pceafrias7@gmail.com",
    folder_id: carpeta.id,
    folder_url: carpeta.url,
    fecha_creacion: ahora,
  });

  ["Replanteo de postes", "Tendido de conductor", "Pruebas de aislamiento"].forEach((tarea) => {
    escribirFila(libro.getSheetByName("Checklist_Proyectos"), {
      id_item: nuevoId("CHK"),
      id_proyecto: id,
      tarea: tarea,
      completado: "FALSE",
      fecha_actualizacion: ahora,
    });
  });

  [
    ["Cable concéntrico 2x6", 100, "m", "Ejemplo de tendido"],
    ["Poste hormigón 8 m", 4, "un", "Ejemplo de apoyos"],
  ].forEach((material) => {
    escribirFila(libro.getSheetByName("Inventario_Materiales"), {
      id_registro: nuevoId("MAT"),
      id_proyecto: id,
      material: material[0],
      cantidad: material[1],
      unidad: material[2],
      observacion: material[3],
    });
  });
}

function crearRegistro(libro, modulo, datos, sesion) {
  if (modulo === "electricidad") {
    const nombre = String(datos.nombre_circuito || "").trim();
    if (!nombre) throw new Error("Falta el nombre del circuito.");
    const id = nuevoId("ELE");
    const carpeta = crearCarpetaProyecto(libro, nombre, id);
    escribirFila(asegurarHoja(libro, "Proyectos_Electricidad"), {
      id_proyecto: id,
      nombre_circuito: nombre,
      tipo_servicio: texto(datos.tipo_servicio),
      cliente_sector: texto(datos.cliente_sector),
      latitud: numero(datos.latitud),
      longitud: numero(datos.longitud),
      estado: String(datos.estado || "En obra").trim(),
      imagen_url: texto(datos.imagen_url),
      descripcion: texto(datos.descripcion),
      responsable_correo: sesion.correo,
      folder_id: carpeta.id,
      folder_url: carpeta.url,
      fecha_creacion: marcaLegible(),
    });
    return id;
  }

  const titulo = String(datos.titulo || "").trim();
  if (!titulo) throw new Error("Falta el título.");
  const id = nuevoId("PROP");
  const carpeta = crearCarpetaProyecto(libro, titulo, id);
  escribirFila(asegurarHoja(libro, "Propiedades_Loteos"), {
    id_propiedad: id,
    titulo: titulo,
    tipo: texto(datos.tipo),
    precio_uf: numero(datos.precio_uf),
    superficie_m2: numero(datos.superficie_m2),
    estado: String(datos.estado || "Disponible").trim(),
    latitud: numero(datos.latitud),
    longitud: numero(datos.longitud),
    factibilidad_electrica: texto(datos.factibilidad_electrica),
    factibilidad_agua: texto(datos.factibilidad_agua),
    imagen_url: texto(datos.imagen_url),
    descripcion: texto(datos.descripcion),
    responsable: sesion.correo,
    folder_id: carpeta.id,
    folder_url: carpeta.url,
    fecha_creacion: marcaLegible(),
  });
  return id;
}

function listarModulo(libro, modulo) {
  const nombre = modulo === "electricidad" ? "Proyectos_Electricidad" : "Propiedades_Loteos";
  const hoja = libro.getSheetByName(nombre);
  return hoja ? filasDe(hoja) : [];
}

function detalleDe(libro, modulo, id) {
  if (modulo === "electricidad") {
    const proyecto = listarModulo(libro, modulo).find((fila) => String(fila.id_proyecto) === id);
    if (!proyecto) return { ok: false, error: "No está ese proyecto." };
    return {
      ok: true,
      modulo: modulo,
      proyecto: proyecto,
      checklist: filasDe(libro.getSheetByName("Checklist_Proyectos")).filter((fila) => String(fila.id_proyecto) === id),
      inventario: filasDe(libro.getSheetByName("Inventario_Materiales")).filter((fila) => String(fila.id_proyecto) === id),
    };
  }

  const proyecto = listarModulo(libro, modulo).find((fila) => String(fila.id_propiedad) === id);
  if (!proyecto) return { ok: false, error: "No está esa propiedad." };
  return { ok: true, modulo: modulo, proyecto: proyecto };
}

function buscarAdministrador(libro, correo) {
  const normalizado = normalizarCorreo(correo);
  if (!normalizado) return null;
  const hoja = libro.getSheetByName("Administradores");
  if (!hoja) return null;
  const fila = filasDe(hoja).find((item) => normalizarCorreo(item.Correo) === normalizado);
  if (!fila) return null;
  return {
    correo: normalizado,
    nombre: String(fila.Nombre || "").trim(),
    rol: String(fila.Rol || "").trim(),
  };
}

function modulosDe(rol) {
  const limpio = String(rol || "").trim().toLowerCase();
  if (limpio === "admin") return ["electricidad", "propiedades"];
  if (limpio === "electricidad") return ["electricidad"];
  if (limpio === "propiedades") return ["propiedades"];
  return [];
}

function exigirModulo(rol, modulo) {
  if (!modulosDe(rol).includes(modulo)) throw new Error("Este rol no puede entrar a ese módulo.");
}

function asegurarHoja(libro, nombre) {
  let hoja = libro.getSheetByName(nombre);
  if (!hoja) hoja = libro.insertSheet(nombre);
  const encabezados = HOJAS[nombre];
  const primera = String(hoja.getRange(1, 1).getValue() || "").trim();
  if (hoja.getLastRow() === 0 || !primera) {
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function encabezadosDe(hoja) {
  if (!hoja || hoja.getLastColumn() < 1) return [];
  const fila = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map((valor) => String(valor || "").trim());
  while (fila.length && !fila[fila.length - 1]) fila.pop();
  return fila;
}

function filasDe(hoja) {
  if (!hoja || hoja.getLastRow() < 2) return [];
  const encabezados = encabezadosDe(hoja);
  if (!encabezados.length) return [];
  const valores = hoja.getRange(2, 1, hoja.getLastRow() - 1, encabezados.length).getValues();
  return valores
    .filter((fila) => fila.some((celda) => String(celda || "").trim() !== ""))
    .map((fila) => {
      const registro = {};
      encabezados.forEach((clave, indice) => {
        registro[clave] = valorPlano(fila[indice]);
      });
      return registro;
    });
}

function escribirFila(hoja, registro) {
  if (!hoja) throw new Error("No está la pestaña de destino.");
  const encabezados = encabezadosDe(hoja);
  if (!encabezados.length) throw new Error("La pestaña no tiene cabeceras.");
  hoja.appendRow(encabezados.map((clave) => (registro[clave] == null ? "" : registro[clave])));
}

function crearCarpetaProyecto(libro, titulo, id) {
  return obtenerOCrearCarpeta(libro, titulo, id);
}

function setup_definitivo() {
  const libro = libroActivo();
  ampliarHoja(libro, "Proyectos_Electricidad");
  ampliarHoja(libro, "Propiedades_Loteos");

  const electricidad = migrarCatalogo(libro, {
    origen: "FLC Electricidad",
    destino: "Proyectos_Electricidad",
    claveDestino: "id_proyecto",
    armar: function (fila, ahora) {
      return {
        id_proyecto: texto(fila.id),
        nombre_circuito: texto(fila.titulo),
        tipo_servicio: texto(fila.tipo_servicio),
        cliente_sector: texto(fila.cliente_sector),
        latitud: numero(fila.latitud),
        longitud: numero(fila.longitud),
        estado: texto(fila.estado),
        imagen_url: texto(fila.imagen_url),
        descripcion: texto(fila.descripcion),
        responsable_correo: "",
        folder_id: "",
        folder_url: "",
        fecha_creacion: ahora,
      };
    },
  });

  const propiedades = migrarCatalogo(libro, {
    origen: "FLC Propiedades",
    destino: "Propiedades_Loteos",
    claveDestino: "id_propiedad",
    armar: function (fila, ahora) {
      return {
        id_propiedad: texto(fila.id),
        titulo: texto(fila.titulo),
        tipo: texto(fila.tipo),
        precio_uf: numero(fila.precio_uf),
        superficie_m2: numero(fila.superficie_m2),
        estado: texto(fila.estado),
        latitud: numero(fila.latitud),
        longitud: numero(fila.longitud),
        factibilidad_electrica: texto(fila.factibilidad_electrica),
        factibilidad_agua: texto(fila.factibilidad_agua),
        imagen_url: texto(fila.imagen_url),
        descripcion: texto(fila.descripcion),
        responsable: "",
        folder_id: "",
        folder_url: "",
        fecha_creacion: ahora,
      };
    },
  });

  const carpetasElectricidad = asegurarCarpetas(libro, "Proyectos_Electricidad", "id_proyecto", "nombre_circuito");
  const carpetasPropiedades = asegurarCarpetas(libro, "Propiedades_Loteos", "id_propiedad", "titulo");

  return (
    "NODO listo. Electricidad nuevas: " +
    electricidad +
    ". Propiedades nuevas: " +
    propiedades +
    ". Carpetas creadas o reutilizadas: " +
    (carpetasElectricidad + carpetasPropiedades) +
    "."
  );
}

function ampliarHoja(libro, nombre) {
  const hoja = asegurarHoja(libro, nombre);
  const filas = filasDe(hoja);
  const encabezados = HOJAS[nombre];
  const ancho = Math.max(hoja.getLastColumn(), encabezados.length, 1);
  if (hoja.getLastRow() > 0) hoja.getRange(1, 1, hoja.getLastRow(), ancho).clearContent();
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  hoja.setFrozenRows(1);
  if (!filas.length) return hoja;
  const valores = filas.map((fila) => encabezados.map((clave) => (fila[clave] == null ? "" : fila[clave])));
  hoja.getRange(2, 1, valores.length, encabezados.length).setValues(valores);
  return hoja;
}

function migrarCatalogo(libro, spec) {
  const origen = libro.getSheetByName(spec.origen);
  const destino = libro.getSheetByName(spec.destino);
  if (!origen) throw new Error("No está la pestaña " + spec.origen + ".");
  if (!destino) throw new Error("No está la pestaña " + spec.destino + ".");

  const existentes = {};
  filasDe(destino).forEach((fila) => {
    const id = texto(fila[spec.claveDestino]);
    if (id) existentes[id] = true;
  });

  const ahora = marcaLegible();
  let nuevas = 0;
  filasConEncabezado(origen, "id").forEach((fila) => {
    const id = texto(fila.id);
    if (!id || id === "id" || existentes[id]) return;
    escribirFila(destino, spec.armar(fila, ahora));
    existentes[id] = true;
    nuevas += 1;
  });
  return nuevas;
}

function asegurarCarpetas(libro, nombreHoja, claveId, claveTitulo) {
  const hoja = libro.getSheetByName(nombreHoja);
  if (!hoja) return 0;
  let creadas = 0;
  filasDe(hoja).forEach((fila) => {
    if (texto(fila.folder_url)) return;
    const id = texto(fila[claveId]);
    if (!id) return;
    const carpeta = obtenerOCrearCarpeta(libro, fila[claveTitulo], id);
    actualizarFila(hoja, claveId, id, { folder_id: carpeta.id, folder_url: carpeta.url });
    creadas += 1;
  });
  return creadas;
}

function obtenerOCrearCarpeta(libro, titulo, id) {
  const padre = carpetaDelLibro(libro);
  const prefijo = "[" + id + "] ";
  const hijas = padre.getFolders();
  while (hijas.hasNext()) {
    const hija = hijas.next();
    if (hija.getName().indexOf(prefijo) === 0) return publicarCarpeta(hija);
  }
  return publicarCarpeta(padre.createFolder(prefijo + limpiarNombre(titulo)));
}

function publicarCarpeta(carpeta) {
  carpeta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: carpeta.getId(), url: carpeta.getUrl() };
}

function actualizarFila(hoja, claveId, id, cambios) {
  const encabezados = encabezadosDe(hoja);
  const indiceId = encabezados.indexOf(claveId);
  if (indiceId < 0 || hoja.getLastRow() < 2) return;
  const ids = hoja.getRange(2, indiceId + 1, hoja.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i += 1) {
    if (String(ids[i][0]) !== String(id)) continue;
    const filaNum = i + 2;
    Object.keys(cambios).forEach((clave) => {
      const columna = encabezados.indexOf(clave);
      if (columna >= 0) hoja.getRange(filaNum, columna + 1).setValue(cambios[clave]);
    });
    return;
  }
}

function catalogoPublico(libro, modulo) {
  const clave = String(modulo || "").trim().toLowerCase();
  const definicion = CATALOGO_PUBLICO[clave];
  if (!definicion) return { ok: false, error: "Módulo desconocido." };

  const hoja = libro.getSheetByName(definicion.hoja);
  let filas = [];
  if (hoja) {
    filas = clave === "desarrollo" ? filasConEncabezado(hoja, "id") : filasDe(hoja);
  }
  if (clave === "electricidad") {
    filas = filas.filter((fila) => texto(fila.nombre_circuito) !== CIRCUITO_PRUEBA);
  }

  const claveId = clave === "electricidad" ? "id_proyecto" : clave === "propiedades" ? "id_propiedad" : "id";
  const fichas = filas
    .filter((fila) => {
      const id = texto(fila[claveId]);
      return id && id !== claveId;
    })
    .map((fila) => {
      const ficha = {};
      definicion.claves.forEach((campo) => {
        ficha[campo] = fila[campo] == null ? "" : fila[campo];
      });
      return ficha;
    });

  return { ok: true, modulo: clave, fichas: fichas };
}

function filasConEncabezado(hoja, primeraClave) {
  if (!hoja || hoja.getLastRow() < 1 || hoja.getLastColumn() < 1) return [];
  const valores = hoja.getRange(1, 1, hoja.getLastRow(), hoja.getLastColumn()).getValues();
  let indice = -1;
  for (let i = 0; i < valores.length && i < 5; i += 1) {
    if (String(valores[i][0] || "").trim() === primeraClave) {
      indice = i;
      break;
    }
  }
  if (indice < 0) return filasDe(hoja);

  const encabezados = valores[indice].map((valor) => String(valor || "").trim());
  while (encabezados.length && !encabezados[encabezados.length - 1]) encabezados.pop();
  return valores
    .slice(indice + 1)
    .filter((fila) => fila.some((celda) => String(celda || "").trim() !== ""))
    .map((fila) => {
      const registro = {};
      encabezados.forEach((campo, i) => {
        if (!campo) return;
        registro[campo] = valorPlano(fila[i]);
      });
      return registro;
    });
}

function texto(valor) {
  return String(valor || "").trim();
}

function carpetaDelLibro(libro) {
  const padres = DriveApp.getFileById(libro.getId()).getParents();
  return padres.hasNext() ? padres.next() : DriveApp.getRootFolder();
}

function valorPlano(valor) {
  if (valor instanceof Date) return Utilities.formatDate(valor, "America/Santiago", "yyyy-MM-dd HH:mm:ss");
  if (valor == null) return "";
  return valor;
}

function nuevoId(prefijo) {
  return prefijo + "-" + marcaDeTiempo() + "-" + Utilities.getUuid().slice(0, 4);
}

function marcaDeTiempo() {
  return Utilities.formatDate(new Date(), "America/Santiago", "yyyyMMdd-HHmmss");
}

function marcaLegible() {
  return Utilities.formatDate(new Date(), "America/Santiago", "yyyy-MM-dd HH:mm:ss");
}

function numero(valor) {
  if (valor == null || valor === "") return "";
  const limpio = String(valor).trim().replace(/\s/g, "").replace(",", ".");
  return limpio === "" || isNaN(limpio) ? "" : Number(limpio);
}

function normalizarCorreo(valor) {
  return String(valor || "").trim().toLowerCase();
}

function limpiarNombre(nombre) {
  return String(nombre || "proyecto").replace(/[\\/:*?"<>|]/g, " ").trim().slice(0, 80);
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
