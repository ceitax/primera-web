# NODO

NODO es la gestión interna. Vive en el Apps Script `1qR1avnvMEncFOrol6Oscz-AauJdNpWL9h8SuZ-WbfCyFAzgI_ufrcWSw`, dentro de la hoja [GrupoFrias_DB](https://docs.google.com/spreadsheets/d/1VJmhwBhxQ1FA1zznP4lPfSvAcH8S3F6xUhazVTxLkUE/edit). El código que usa estas tablas está en `codigo_a_migrar.gs`.

La carpeta madre de Drive es [FLC](https://drive.google.com/drive/folders/1ZtqLxSUQ98yu_iZsigyKterbvFMlwlqm). ELE-001, ELE-002 y ELE-003 ya son obras reales y no se recrean ni se renumeran. Un proyecto nuevo nace dentro de esa misma carpeta.

El ingreso abre con el correo de `700_Administradores`. Arriba se ve el nombre de quien entró, sin el rol. Admin ve electricidad y propiedades. Electricidad ve electricidad y clientes. Propiedades ve propiedades.

- Electricidad se ve por tarjetas o por mapa. El mapa usa la latitud y la longitud de cada proyecto.
- Propiedades sigue en tarjetas, con su formulario de alta.
- Clientes lista, crea y edita las personas de `1_1_Clientes_Electricidad`.
- Nuevo proyecto envía todos los datos. El script toma el siguiente código ELE, escribe la fila, crea la carpeta y copia el checklist.
- Actualizar, el botón rojo, revisa `04_Fotografias_Obra` de cada proyecto y agrega en la hoja las fotos que falten. No cambia títulos, comentarios ni códigos.

La ficha de un circuito muestra comuna, potencia, cliente, la última versión de cada plano (`V1`, `V2` en `01_Planos`), el checklist, el inventario y un carrusel de fotos. El título y el comentario de cada foto se guardan en la hoja. Terminar escribe el correo de la sesión en `aprobador` y deja el estado en Terminado.

## Carpetas de cada proyecto

Dentro de `[ELE-00X] Nombre`:

- `01_Planos`: PDF con versión al final del nombre. La ficha muestra la versión más alta.
- `02_Documentos_SEC`: documentos entregados por la SEC.
- `03_Informes_Tecnicos`: el resto de documentos técnicos.
- `04_Fotografias_Obra`: respaldos fotográficos. Cada imagen tiene título y comentario.

## Hoja GrupoFrias_DB

El script lee y escribe por el nombre de la columna.

- `700_Administradores`: correo, nombre, rol, clave y estado. El ingreso lee esta pestaña. Si la clave está vacía, el primer ingreso usa la clave inicial del script y puede dejar una nueva, guardada como hash.
- `00_Correlativos`: el siguiente número, por tipo `ELECTRICIDAD` o `PROPIEDADES`. Al crear, el script usa el mayor entre ese número y los códigos que ya existen, para no pisar ELE-001.
- `00_Plantilla_Requerimientos`: tareas que se copian al checklist de un proyecto nuevo. Si una tarea apunta a `02_Certificados_SEC`, se guarda como `02_Documentos_SEC`.
- `01_Electricidad_Proyectos`: `id_proyecto`, `id_cliente`, `comuna`, `nombre_circuito`, `tipo_servicio`, `cliente_sector`, `estado`, `latitud`, `longitud`, `imagen_url`, `descripcion`, `responsable_correo`, `aprobador`, `folder_id`, `folder_url`, `fecha_creacion`, `potencia_declarada`.
- `1_1_Clientes_Electricidad`: `id_cliente`, nombre, RUT, teléfono, correo, tipo de persona, dirección de facturación y fecha de registro.
- `1_2_Checklist_Proyectos`: tareas de cada ELE. Cada fila tiene `id_item`, `id_proyecto`, tarea, subcarpeta, completado y fecha.
- `1_3_Inventario_Materiales`: materiales de cada ELE.
- `1_4 Imagenes`: `id_proyecto`, `url`, `titulo`, `comentario`.
- `02_Propiedades`: parcelas y terrenos de la pestaña Propiedades. El código es `PROP-00X`.
- `2_1_Solicitudes_Propiedades`: consultas. NODO todavía no la usa.

`03_Web_Proyectos` y `3_1_Web_Equipo` están en la misma hoja. NODO no las lee ni las escribe.
