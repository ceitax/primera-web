# FLC Ingeniería y NODO

FLC Ingeniería reúne tres frentes: electricidad, propiedades y desarrollo. El sitio público presenta la empresa. NODO es la intranet donde se gestionan los proyectos reales.

La carpeta madre de Drive es [FLC](https://drive.google.com/drive/folders/1ZtqLxSUQ98yu_iZsigyKterbvFMlwlqm). ELE-001, ELE-002 y ELE-003 ya son obras reales y no se recrean ni se renumeran. Un proyecto nuevo nace dentro de esa misma carpeta.

## Sitio público

- Inicio: la empresa, las tres áreas y el equipo que está en `3_1_Web_Equipo`.
- Electricidad: instalaciones, mantenimiento y proyectos de obra. El mapa de gestión no está aquí.
- Propiedades: catálogo y mapa de parcelas.
- Desarrollo: fichas de `03_Web_Proyectos`. Si `requiere_auth` está marcado, esa ficha no sale.
- El catálogo público no muestra responsable, carpeta, aprobador ni correos.

## NODO

La intranet abre con la línea `NODO: Gestiona proyectos de forma fácil y ordenada`. Arriba se ve el nombre de quien entró, sin el rol. La barra del sitio se mantiene.

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

## Hoja FLC_Propiedades_DB

- `700_Administradores`: correo, nombre, rol, clave y estado. El ingreso lee esta pestaña. Si la clave está vacía, la inicial es `test123` y el primer ingreso puede dejar una nueva, guardada como hash.
- `00_Correlativos`: el siguiente número. Al crear, el script usa el mayor entre ese número y los códigos que ya existen, para no pisar ELE-001.
- `00_Plantilla_Requerimientos`: tareas que se copian al checklist de un proyecto nuevo. Si una tarea apunta a `02_Certificados_SEC`, se guarda como `02_Documentos_SEC`.
- `01_Electricidad_Proyectos`: `id_proyecto`, `id_cliente`, `comuna`, `nombre_circuito`, `tipo_servicio`, `cliente_sector`, `estado`, `latitud`, `longitud`, `imagen_url`, `descripcion`, `responsable_correo`, `aprobador`, `folder_id`, `folder_url`, `fecha_creacion`, `potencia_declarada`.
- `1_1_Clientes_Electricidad`: `id_cliente`, nombre, RUT, teléfono, correo, tipo de persona, dirección y fecha.
- `1_2_Checklist_Proyectos`: tareas de cada ELE.
- `1_3_Inventario_Materiales`: materiales de cada ELE.
- `1_4 Imagenes`: `id_proyecto`, `url`, `titulo`, `comentario`.
- `02_Propiedades`: parcelas y terrenos del mapa público y de la pestaña Propiedades.
- `2_1_Solicitudes_Propiedades`: consultas, todavía sin uso en la web.
- `03_Web_Proyectos` y `3_1_Web_Equipo`: el sitio público.

El script lee y escribe por el nombre de la columna.

## Qué hace el script

El archivo es `apps-script/Codigo.gs`. Corre con la cuenta de Google dueña de la hoja, así puede escribir celdas y crear carpetas. Hay un solo archivo: un segundo `.gs` en el mismo proyecto vuelve a declarar las mismas constantes y se cae.

- Entra con el correo de `700_Administradores`. Admin ve electricidad y propiedades. Electricidad ve electricidad y clientes. Propiedades ve propiedades.
- Crea un circuito: código, fila, carpeta en FLC y las cuatro subcarpetas, más el checklist y una línea de inventario.
- Guarda la ficha y los datos del cliente.
- Termina el proyecto.
- Sube una foto desde NODO a `04_Fotografias_Obra` y agrega la fila en `1_4 Imagenes`.
- Actualizar recorre esas carpetas. Una foto nueva entra con el nombre del archivo como título y el comentario vacío. Lo ya escrito no se pisa.
- El menú de la hoja, NODO Electricidad, tiene la misma actualización de fotos.
- El catálogo público sale por `catalogoPublico`.

Para que la web publicada use este archivo hay que pegarlo en el editor de la hoja y publicar una versión nueva de la misma implementación. Guardar el editor no alcanza.
