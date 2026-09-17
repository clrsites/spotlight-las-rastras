# Sitio flipbook del newsletter

El sitio muestra siempre `newsletter.pdf` en un lector institucional inspirado en la portada de Spotlight Las Rastras. Para publicar una nueva edición:

1. Exporta el newsletter como PDF.
2. Expórtalo en orientación horizontal y nómbralo `newsletter.pdf`.
3. Reemplaza `newsletter.pdf` en la carpeta principal del repositorio.
4. Confirma y publica el cambio en el repositorio.

El enlace del sitio no cambia. La página añade automáticamente una versión temporal a la URL del PDF para evitar que los lectores vean una edición antigua guardada por el navegador.

## Archivos principales

- `newsletter.pdf`: edición mensual que se debe reemplazar.
- `index.html`: estructura del sitio.
- `styles.css`: diseño visual.
- `app.js`: lector PDF y efecto flipbook.

Para cambiar el nombre visible del newsletter, edita el título dentro de `index.html`.
