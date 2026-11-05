const ALBUMES_PUBLICOS = {
  origen: { tipo: "archivo", id: "1iNHYQGFzIcQOlSL5mIxiHJOU4C_B8O6-" },
  proceso: { tipo: "carpeta", id: "17za_k2NMnEvoG7Oi1NCoya1AtFflPwaQ" },
  equipo: { tipo: "carpeta", id: "1jyanb2FTiRX6f9hoJilt7C53_Vk70S7d" },
};
const TOPE_FOTOS_PUBLICAS = 12;
const ESCANEO_FOTOS_PUBLICAS = 40;

function datosDeEntrada(e) {
  const datos = {};
  const parametros = (e && e.parameter) || {};
  Object.keys(parametros).forEach(function (clave) {
    const valor = parametros[clave];
    datos[clave] = Array.isArray(valor) ? valor[0] : valor;
  });
  try {
    const cuerpo = JSON.parse((e && e.postData && e.postData.contents) || "");
    if (cuerpo && typeof cuerpo === "object") {
      Object.keys(cuerpo).forEach(function (clave) {
        if (cuerpo[clave] != null && cuerpo[clave] !== "") datos[clave] = cuerpo[clave];
      });
    }
  } catch (error) {}
  return datos;
}

function doGet(e) {
  return atender(datosDeEntrada(e));
}

function doPost(e) {
  return atender(datosDeEntrada(e));
}

function atender(parametros) {
  try {
    const accion = parametros.accion || "estado";
    if (accion === "fotosPublicas") return responder(fotosPublicas(parametros));
    return responder({ ok: true, servicio: "Grupo Frias Web" });
  } catch (error) {
    return responder({ ok: false, error: String(error.message || error) });
  }
}

function fotosPublicas(parametros) {
  const album = String(parametros.album || "").toLowerCase();
  const config = ALBUMES_PUBLICOS[album];
  if (!config) throw new Error("Álbum no reconocido.");
  const imagenes = [];
  const visitar = function (archivo) {
    if (imagenes.length >= ESCANEO_FOTOS_PUBLICAS) return;
    if (String(archivo.getMimeType() || "").indexOf("image/") !== 0) return;
    imagenes.push(archivo);
  };
  if (config.tipo === "carpeta") {
    const carpeta = DriveApp.getFolderById(config.id);
    const archivos = carpeta.getFiles();
    while (archivos.hasNext() && imagenes.length < ESCANEO_FOTOS_PUBLICAS) visitar(archivos.next());
  } else {
    const archivo = DriveApp.getFileById(config.id);
    const padres = archivo.getParents();
    if (padres.hasNext()) {
      const carpeta = padres.next();
      const archivos = carpeta.getFiles();
      while (archivos.hasNext() && imagenes.length < ESCANEO_FOTOS_PUBLICAS) visitar(archivos.next());
    } else {
      visitar(archivo);
    }
  }
  imagenes.sort(function (a, b) {
    return String(a.getName()).localeCompare(String(b.getName()), "es");
  });
  const fotos = imagenes.slice(0, TOPE_FOTOS_PUBLICAS).map(fotoPublica);
  if (!fotos.length) throw new Error("Esa carpeta no tiene imágenes.");
  return { ok: true, album: album, fotos: fotos };
}

function fotoPublica(archivo) {
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const id = archivo.getId();
  return {
    id: id,
    nombre: archivo.getName(),
    url: "https://drive.google.com/thumbnail?id=" + id + "&sz=w1600",
  };
}

function responder(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}
