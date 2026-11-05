# Página comercial

Una sola página para el cliente: `index.html`. El estilo está en `css/style.css`. El comportamiento está en `js/main.js`. La dirección del script público está en `js/intranet-config.js`.

La página publicada es GitHub Pages. El script público es el Apps Script que ya usa esa dirección. El archivo local es `apps-script/Codigo.gs`. `clasp push` lo sube a ese mismo proyecto. `clasp deploy` publica una versión nueva de la misma implementación, sin cambiar la dirección.

Ese script solo entrega las fotos de los tres álbumes. La cotización no pasa por él.

## Bloques de la página

- Inicio: texto, WhatsApp, correo y el ancla de cotización. El logo es `img/logos/FriasCuadrado.jpg`.
- Nosotros: el texto del origen y el carrusel `origen`. Debajo, las tres tarjetas del equipo.
- Servicios: tres tarjetas, sin enlace a otra página. Electricidad usa `img/logos/FriasE.jpg`, Construcción usa `img/logos/FriasC.jpg` y Territorio usa `img/logos/FriasT.jpg`. Cada una abre WhatsApp con su propio mensaje.
- Cómo trabajamos: el carrusel `proceso` y el pedido de catálogo por WhatsApp.
- Cotizar: el formulario de la página.
- Pie: `contacto@grupofrias.cl`, `+56978623493` y la dirección de Puerto Montt.

## Fotos

`js/main.js` pide cada álbum al script con `fotosPublicas`. El script lee Drive, deja cada imagen visible con el enlace y devuelve la miniatura.

- `origen`, carrusel de Nosotros. Parte del archivo `1iNHYQGFzIcQOlSL5mIxiHJOU4C_B8O6-` y lista las imágenes de su carpeta. Si el script no responde, queda esa misma foto. Si la imagen falla, queda `img/casa_generica.jpg`.
- `proceso`, carrusel de Cómo trabajamos. Carpeta `17za_k2NMnEvoG7Oi1NCoya1AtFflPwaQ`.
- `equipo`, las tres tarjetas. Carpeta `1jyanb2FTiRX6f9hoJilt7C53_Vk70S7d`. El orden lo da el número del nombre: `1.jpg` es Pablo Cea Frías, `2.jpg` es Diego Levín Alarcón y `3.jpg` es Robinson Levín Frías. Si una foto no carga, queda la inicial.

Cada álbum muestra hasta 12 imágenes, ordenadas por nombre.

## Cotización

El formulario lo envía `js/main.js` a FormSubmit. El mensaje llega a `contacto@grupofrias.cl`, con copia a `pceafrias7@gmail.com`, `alarcon73237717@gmail.com` y `roblejan.levin@gmail.com`. Al responder, la respuesta sale al correo que escribió el cliente.

Los campos son nombre, teléfono, correo, servicio y mensaje. El servicio es Frías Electricidad, Frías Construcción o Frías Territorio.

## Contacto directo

El WhatsApp de la barra, del inicio y del pie es `+56978623493`, con el mensaje de cotizar un proyecto. Electricidad, Construcción y Territorio agregan el nombre de su área. El catálogo pide los proyectos y diseños de casas, y no usa el mensaje de cotización. El botón Enviar correo abre `contacto@grupofrias.cl`.
