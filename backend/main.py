import hashlib
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import jwt
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.oauth2 import service_account
from googleapiclient.discovery import build
from pydantic import BaseModel

HOJA_DEFECTO = "1VJmhwBhxQ1FA1zznP4lPfSvAcH8S3F6xUhazVTxLkUE"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
ZONA = ZoneInfo("America/Santiago")
CLAVE_PRUEBA = "test123"
SUBCARPETAS = ["01_Planos", "02_Certificados_SEC", "03_Informes_Tecnicos", "04_Fotografias_Obra"]
TAREAS_BASE = ["Fotos Tablero", "Malla", "Plano", "TE1 SEC"]

PUBLICO = {
    "electricidad": [
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
    "propiedades": [
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
    "desarrollo": ["id", "nombre", "tipo", "estado", "descripcion_corta", "tecnologias", "url_demo", "imagen_url"],
}

COLUMNAS = {
    "Proyectos_Electricidad": [
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
    "Propiedades_Loteos": [
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
    "Checklist_Proyectos": ["id_item", "id_proyecto", "tarea", "completado", "fecha_actualizacion"],
    "Inventario_Materiales": ["id_registro", "id_proyecto", "material", "cantidad", "unidad", "observacion"],
}

CLIENTES = {}


class ErrorAPI(Exception):
    def __init__(self, status, mensaje):
        self.status = status
        self.mensaje = mensaje


class Login(BaseModel):
    correo: str
    clave: str = ""
    clave_nueva: str = ""


class Alta(BaseModel):
    nombre_circuito: str = ""
    tipo_servicio: str = ""
    cliente_sector: str = ""
    latitud: str = ""
    longitud: str = ""
    estado: str = ""
    imagen_url: str = ""
    descripcion: str = ""
    titulo: str = ""
    tipo: str = ""
    precio_uf: str = ""
    superficie_m2: str = ""
    factibilidad_electrica: str = ""
    factibilidad_agua: str = ""


class Marca(BaseModel):
    completado: bool = True


def cargar_env():
    ruta = Path(__file__).with_name(".env")
    if not ruta.exists():
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        limpia = linea.strip()
        if not limpia or limpia.startswith("#") or "=" not in limpia:
            continue
        clave, valor = limpia.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip().strip('"'))


cargar_env()
app = FastAPI(title="NODO Electricidad")
origenes = [item.strip() for item in os.environ.get("CORS_ORIGINS", "*").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ErrorAPI)
def responder_error(_request, exc):
    return JSONResponse(status_code=exc.status, content={"ok": False, "error": exc.mensaje})


def texto(valor):
    return str(valor or "").strip()


def ahora():
    return datetime.now(ZONA).strftime("%Y-%m-%d %H:%M:%S")


def numero(valor):
    limpio = texto(valor).replace(" ", "").replace(",", ".")
    if not limpio:
        return ""
    try:
        return float(limpio) if "." in limpio else int(limpio)
    except ValueError:
        return ""


def hash_clave(clave):
    sal = os.urandom(16)
    firma = hashlib.pbkdf2_hmac("sha256", clave.encode("utf-8"), sal, 120000)
    return sal.hex() + ":" + firma.hex()


def clave_valida(clave, guardada):
    if not texto(guardada):
        return clave == CLAVE_PRUEBA
    try:
        sal_hex, firma_hex = texto(guardada).split(":", 1)
        firma = hashlib.pbkdf2_hmac("sha256", clave.encode("utf-8"), bytes.fromhex(sal_hex), 120000)
        return firma.hex() == firma_hex
    except ValueError:
        return False


def servicios():
    if CLIENTES:
        return CLIENTES["sheets"], CLIENTES["drive"]
    ruta = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if ruta and not Path(ruta).is_absolute():
        ruta = str(Path(__file__).with_name(ruta))
    if not ruta or not Path(ruta).exists():
        raise ErrorAPI(500, "Falta el JSON de la cuenta de servicio en el backend.")
    credenciales = service_account.Credentials.from_service_account_file(ruta, scopes=SCOPES)
    CLIENTES["sheets"] = build("sheets", "v4", credentials=credenciales, cache_discovery=False)
    CLIENTES["drive"] = build("drive", "v3", credentials=credenciales, cache_discovery=False)
    return CLIENTES["sheets"], CLIENTES["drive"]


def hoja_id():
    return os.environ.get("SHEET_ID", HOJA_DEFECTO)


def columna(numero_col):
    letras = ""
    while numero_col:
        numero_col, resto = divmod(numero_col - 1, 26)
        letras = chr(65 + resto) + letras
    return letras


def tabla(nombre):
    sheets, _drive = servicios()
    try:
        respuesta = sheets.spreadsheets().values().get(spreadsheetId=hoja_id(), range=f"'{nombre}'").execute()
    except Exception as error:
        raise ErrorAPI(500, "No pude leer " + nombre + ". " + str(error)) from error
    valores = respuesta.get("values") or []
    if not valores:
        return [], []
    encabezados = [texto(item) for item in valores[0]]
    while encabezados and not encabezados[-1]:
        encabezados.pop()
    filas = []
    for indice, fila in enumerate(valores[1:], start=2):
        if not any(texto(celda) for celda in fila):
            continue
        registro = {"_fila": indice}
        for pos, clave in enumerate(encabezados):
            if not clave:
                continue
            registro[clave] = fila[pos] if pos < len(fila) else ""
        filas.append(registro)
    return encabezados, filas


def proyectar(fila, claves):
    return {clave: fila.get(clave, "") if fila.get(clave) is not None else "" for clave in claves}


def limpia(fila):
    return {clave: valor for clave, valor in fila.items() if clave != "_fila"}


def agregar(nombre, registro):
    sheets, _drive = servicios()
    encabezados, _filas = tabla(nombre)
    if not encabezados:
        encabezados = COLUMNAS.get(nombre, list(registro.keys()))
    fila = [registro.get(clave, "") if registro.get(clave) is not None else "" for clave in encabezados]
    sheets.spreadsheets().values().append(
        spreadsheetId=hoja_id(),
        range=f"'{nombre}'!A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": [fila]},
    ).execute()


def escribir_celda(nombre, fila, encabezados, clave, valor):
    sheets, _drive = servicios()
    indice = encabezados.index(clave)
    sheets.spreadsheets().values().update(
        spreadsheetId=hoja_id(),
        range=f"'{nombre}'!{columna(indice + 1)}{fila}",
        valueInputOption="USER_ENTERED",
        body={"values": [[valor]]},
    ).execute()


def modulos_de(rol):
    limpio = texto(rol).lower()
    if limpio == "admin":
        return ["electricidad", "propiedades"]
    if limpio == "electricidad":
        return ["electricidad"]
    if limpio == "propiedades":
        return ["propiedades"]
    return []


def usuario_actual(authorization):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ErrorAPI(401, "Falta la sesión.")
    secreto = os.environ.get("JWT_SECRET", "")
    if not secreto:
        raise ErrorAPI(500, "Falta JWT_SECRET.")
    try:
        datos = jwt.decode(authorization.split(" ", 1)[1], secreto, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise ErrorAPI(401, "La sesión expiró. Entra de nuevo.") from error
    return datos


def exigir(datos, modulo):
    if modulo not in datos.get("modulos", []):
        raise ErrorAPI(403, "Este rol no puede entrar a ese módulo.")


def padre_del_libro():
    _sheets, drive = servicios()
    meta = drive.files().get(fileId=hoja_id(), fields="parents").execute()
    padres = meta.get("parents") or []
    return padres[0] if padres else None


def crear_carpeta(nombre, padre):
    _sheets, drive = servicios()
    cuerpo = {"name": nombre, "mimeType": "application/vnd.google-apps.folder"}
    if padre:
        cuerpo["parents"] = [padre]
    creada = drive.files().create(body=cuerpo, fields="id, webViewLink").execute()
    try:
        drive.permissions().create(
            fileId=creada["id"],
            body={"type": "anyone", "role": "reader"},
        ).execute()
    except Exception:
        pass
    return creada["id"], creada.get("webViewLink") or ""


def nombre_seguro(titulo):
    limpio = "".join(" " if caracter in "\\/:*?\"<>|" else caracter for caracter in texto(titulo)).strip()
    return (limpio or "proyecto")[:80]


def carpeta_obra(titulo, id_proyecto):
    madre_id, madre_url = crear_carpeta("[" + id_proyecto + "] " + nombre_seguro(titulo), padre_del_libro())
    for nombre in SUBCARPETAS:
        crear_carpeta(nombre, madre_id)
    return madre_id, madre_url


def plantilla(tipo):
    try:
        _encabezados, filas = tabla("Plantilla_Requerimientos")
    except ErrorAPI:
        filas = []
    elegidas = [fila for fila in filas if texto(fila.get("tipo")).lower() == tipo]
    elegidas.sort(key=lambda fila: numero(fila.get("orden")) or 0)
    if tipo == "checklist":
        tareas = [texto(fila.get("texto")) for fila in elegidas if texto(fila.get("texto"))]
        return tareas or TAREAS_BASE[:]
    if elegidas:
        return elegidas
    return [{"texto": "Por cubicación", "unidad": "", "observacion": ""}]


def copiar_hijos(id_proyecto):
    marca = ahora()
    for indice, tarea in enumerate(plantilla("checklist"), start=1):
        agregar(
            "Checklist_Proyectos",
            {
                "id_item": f"CHK-{id_proyecto}-{indice:02d}",
                "id_proyecto": id_proyecto,
                "tarea": tarea,
                "completado": "FALSE",
                "fecha_actualizacion": marca,
            },
        )
    for indice, item in enumerate(plantilla("inventario"), start=1):
        agregar(
            "Inventario_Materiales",
            {
                "id_registro": f"MAT-{id_proyecto}-{indice:02d}",
                "id_proyecto": id_proyecto,
                "material": texto(item.get("texto")),
                "cantidad": "",
                "unidad": texto(item.get("unidad")),
                "observacion": texto(item.get("observacion")),
            },
        )


def tomar_correlativo(clave, prefijo, columna_id, nombre_hoja):
    _encabezados, filas = tabla("Correlativos")
    actual = 1
    for fila in filas:
        if texto(fila.get("clave")) == clave and texto(fila.get("valor")):
            try:
                actual = int(float(fila["valor"]))
            except ValueError:
                actual = 1
    _encabezados_obra, obras = tabla(nombre_hoja)
    ocupados = {texto(fila.get(columna_id)) for fila in obras}
    while f"{prefijo}-{actual:03d}" in ocupados:
        actual += 1
    elegido = f"{prefijo}-{actual:03d}"
    guardar_correlativo(clave, actual + 1, filas)
    return elegido


def guardar_correlativo(clave, valor, filas):
    sheets, _drive = servicios()
    encontrada = False
    for fila in filas:
        if texto(fila.get("clave")) != clave:
            continue
        escribir_celda("Correlativos", fila["_fila"], ["clave", "valor"], "valor", valor)
        encontrada = True
    if encontrada:
        return
    sheets.spreadsheets().values().append(
        spreadsheetId=hoja_id(),
        range="'Correlativos'!A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": [[clave, valor]]},
    ).execute()


def fichas_publicas(nombre_hoja, modulo, clave_id):
    _encabezados, filas = tabla(nombre_hoja)
    if modulo == "electricidad":
        filas = [fila for fila in filas if texto(fila.get("nombre_circuito")) != "Circuito de prueba FLC"]
    return [
        proyectar(fila, PUBLICO[modulo])
        for fila in filas
        if texto(fila.get(clave_id)) and texto(fila.get(clave_id)) != clave_id
    ]


@app.post("/api/login")
def login(cuerpo: Login):
    correo = texto(cuerpo.correo).lower()
    encabezados, filas = tabla("Administradores")
    fila = next((item for item in filas if texto(item.get("Correo")).lower() == correo), None)
    if not fila:
        raise ErrorAPI(401, "Ese correo no está en Administradores.")
    if texto(fila.get("Estado")) and texto(fila.get("Estado")).lower() != "activo":
        raise ErrorAPI(403, "Ese acceso está inactivo.")
    if not clave_valida(cuerpo.clave, fila.get("Password")):
        raise ErrorAPI(401, "La clave no coincide.")
    if texto(cuerpo.clave_nueva):
        if texto(fila.get("Password")):
            raise ErrorAPI(400, "Esa cuenta ya tiene clave.")
        if "Password" not in encabezados:
            raise ErrorAPI(500, "Falta la columna Password. Corre el menú de staging en la hoja.")
        escribir_celda("Administradores", fila["_fila"], encabezados, "Password", hash_clave(cuerpo.clave_nueva))
    rol = texto(fila.get("Rol"))
    modulos = modulos_de(rol)
    if not modulos:
        raise ErrorAPI(403, "Ese rol no tiene módulos asignados.")
    secreto = os.environ.get("JWT_SECRET", "")
    if not secreto:
        raise ErrorAPI(500, "Falta JWT_SECRET.")
    token = jwt.encode(
        {
            "sub": correo,
            "nombre": texto(fila.get("Nombre")),
            "rol": rol,
            "modulos": modulos,
            "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        },
        secreto,
        algorithm="HS256",
    )
    return {
        "ok": True,
        "token": token,
        "correo": correo,
        "nombre": texto(fila.get("Nombre")),
        "rol": rol,
        "modulos": modulos,
    }


@app.get("/api/electricidad/publico")
def electricidad_publica():
    return {"ok": True, "modulo": "electricidad", "fichas": fichas_publicas("Proyectos_Electricidad", "electricidad", "id_proyecto")}


@app.get("/api/propiedades/publico")
def propiedades_publicas():
    return {"ok": True, "modulo": "propiedades", "fichas": fichas_publicas("Propiedades_Loteos", "propiedades", "id_propiedad")}


@app.get("/api/desarrollo/publico")
def desarrollo_publico():
    return {"ok": True, "modulo": "desarrollo", "fichas": fichas_publicas("FLC Desarrollo", "desarrollo", "id")}


@app.get("/api/electricidad/proyectos")
def listar_electricidad(authorization: str = Header(default="")):
    datos = usuario_actual(authorization)
    exigir(datos, "electricidad")
    _encabezados, filas = tabla("Proyectos_Electricidad")
    return {"ok": True, "modulo": "electricidad", "proyectos": [limpia(fila) for fila in filas]}


@app.get("/api/electricidad/proyecto/{id_proyecto}")
def detalle_electricidad(id_proyecto: str, authorization: str = Header(default="")):
    datos = usuario_actual(authorization)
    exigir(datos, "electricidad")
    _encabezados, filas = tabla("Proyectos_Electricidad")
    proyecto = next((fila for fila in filas if texto(fila.get("id_proyecto")) == id_proyecto), None)
    if not proyecto:
        raise ErrorAPI(404, "No está ese proyecto.")
    _c, checklist = tabla("Checklist_Proyectos")
    _i, inventario = tabla("Inventario_Materiales")
    return {
        "ok": True,
        "modulo": "electricidad",
        "proyecto": limpia(proyecto),
        "checklist": [limpia(fila) for fila in checklist if texto(fila.get("id_proyecto")) == id_proyecto],
        "inventario": [limpia(fila) for fila in inventario if texto(fila.get("id_proyecto")) == id_proyecto],
    }


@app.post("/api/electricidad/proyectos")
def crear_electricidad(cuerpo: Alta, authorization: str = Header(default="")):
    datos = usuario_actual(authorization)
    exigir(datos, "electricidad")
    nombre = texto(cuerpo.nombre_circuito)
    if not nombre:
        raise ErrorAPI(400, "Falta el nombre del circuito.")
    id_proyecto = tomar_correlativo("siguiente_ele", "ELE", "id_proyecto", "Proyectos_Electricidad")
    folder_id, folder_url = carpeta_obra(nombre, id_proyecto)
    agregar(
        "Proyectos_Electricidad",
        {
            "id_proyecto": id_proyecto,
            "nombre_circuito": nombre,
            "tipo_servicio": texto(cuerpo.tipo_servicio),
            "cliente_sector": texto(cuerpo.cliente_sector),
            "latitud": numero(cuerpo.latitud),
            "longitud": numero(cuerpo.longitud),
            "estado": texto(cuerpo.estado) or "En obra",
            "imagen_url": texto(cuerpo.imagen_url),
            "descripcion": texto(cuerpo.descripcion),
            "responsable_correo": datos["sub"],
            "folder_id": folder_id,
            "folder_url": folder_url,
            "fecha_creacion": ahora(),
        },
    )
    copiar_hijos(id_proyecto)
    return {"ok": True, "id": id_proyecto}


@app.patch("/api/electricidad/proyecto/{id_proyecto}/checklist/{id_item}")
def marcar_checklist(id_proyecto: str, id_item: str, cuerpo: Marca, authorization: str = Header(default="")):
    datos = usuario_actual(authorization)
    exigir(datos, "electricidad")
    encabezados, filas = tabla("Checklist_Proyectos")
    fila = next(
        (item for item in filas if texto(item.get("id_proyecto")) == id_proyecto and texto(item.get("id_item")) == id_item),
        None,
    )
    if not fila:
        raise ErrorAPI(404, "No está esa tarea.")
    escribir_celda("Checklist_Proyectos", fila["_fila"], encabezados, "completado", "TRUE" if cuerpo.completado else "FALSE")
    if "fecha_actualizacion" in encabezados:
        escribir_celda("Checklist_Proyectos", fila["_fila"], encabezados, "fecha_actualizacion", ahora())
    return {"ok": True}


@app.get("/api/propiedades/proyectos")
def listar_propiedades(authorization: str = Header(default="")):
    datos = usuario_actual(authorization)
    exigir(datos, "propiedades")
    _encabezados, filas = tabla("Propiedades_Loteos")
    return {"ok": True, "modulo": "propiedades", "proyectos": [limpia(fila) for fila in filas]}


@app.get("/api/propiedades/proyecto/{id_propiedad}")
def detalle_propiedad(id_propiedad: str, authorization: str = Header(default="")):
    datos = usuario_actual(authorization)
    exigir(datos, "propiedades")
    _encabezados, filas = tabla("Propiedades_Loteos")
    proyecto = next((fila for fila in filas if texto(fila.get("id_propiedad")) == id_propiedad), None)
    if not proyecto:
        raise ErrorAPI(404, "No está esa propiedad.")
    return {"ok": True, "modulo": "propiedades", "proyecto": limpia(proyecto)}


@app.post("/api/propiedades/proyectos")
def crear_propiedad(cuerpo: Alta, authorization: str = Header(default="")):
    datos = usuario_actual(authorization)
    exigir(datos, "propiedades")
    titulo = texto(cuerpo.titulo)
    if not titulo:
        raise ErrorAPI(400, "Falta el título.")
    id_propiedad = tomar_correlativo("siguiente_prop", "PROP", "id_propiedad", "Propiedades_Loteos")
    folder_id, folder_url = crear_carpeta("[" + id_propiedad + "] " + nombre_seguro(titulo), padre_del_libro())
    agregar(
        "Propiedades_Loteos",
        {
            "id_propiedad": id_propiedad,
            "titulo": titulo,
            "tipo": texto(cuerpo.tipo),
            "precio_uf": numero(cuerpo.precio_uf),
            "superficie_m2": numero(cuerpo.superficie_m2),
            "estado": texto(cuerpo.estado) or "Disponible",
            "latitud": numero(cuerpo.latitud),
            "longitud": numero(cuerpo.longitud),
            "factibilidad_electrica": texto(cuerpo.factibilidad_electrica),
            "factibilidad_agua": texto(cuerpo.factibilidad_agua),
            "imagen_url": texto(cuerpo.imagen_url),
            "descripcion": texto(cuerpo.descripcion),
            "responsable": datos["sub"],
            "folder_id": folder_id,
            "folder_url": folder_url,
            "fecha_creacion": ahora(),
        },
    )
    return {"ok": True, "id": id_propiedad}
