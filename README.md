# Sitio flipbook del newsletter

El sitio muestra siempre `newsletter.pdf` en un lector institucional inspirado en la portada de Spotlight Las Rastras. Para publicar una nueva edición:

1. Exporta el newsletter como PDF.
2. Expórtalo en orientación horizontal y nómbralo `newsletter.pdf`.
3. Reemplaza `newsletter.pdf` en la carpeta principal del repositorio.
4. Copia los videos en la misma carpeta con los nombres `video1.mp4` y `video2.mp4`.
5. Actualiza `EDITION_VERSION` en `app.js` con el año y mes de la nueva edición, por ejemplo `2026-10`.
6. Confirma y publica los cambios en el repositorio.

Los reproductores se muestran sobre los cuadros de video de las páginas 30 y 31. No es necesario incrustar los videos dentro del PDF.

El enlace del sitio no cambia. `EDITION_VERSION` controla la versión del PDF y los videos para aprovechar la caché sin mostrar una edición antigua.

## Archivos principales

- `newsletter.pdf`: edición mensual que se debe reemplazar.
- `video1.mp4`: video reproducible de la página 30.
- `video2.mp4`: video reproducible de la página 31.
- `index.html`: estructura del sitio.
- `styles.css`: diseño visual.
- `app.js`: lector PDF y efecto flipbook.

Para cambiar el nombre visible del newsletter, edita el título dentro de `index.html`.
