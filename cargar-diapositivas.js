/*!
 * cargar-diapositivas.js
 * ------------------------------------------------------------------
 * Carga y normaliza el contenido modular de diapositivas.html.
 * Devuelve un array de nodos <div class="horizontal-topic"> ya
 * importados en el documento actual, cada uno etiquetado con
 * data-tema / data-sub para poder localizar cualquier slide por (X, Y).
 * ------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  /**
   * @param {string} [ruta] Ruta del archivo de contenido.
   * @returns {Promise<HTMLDivElement[]>}
   */
  async function CargarDiapositivas(ruta) {
    ruta = ruta || 'diapositivas.html';

    var respuesta;
    try {
      respuesta = await fetch(ruta, { cache: 'no-store' });
    } catch (error) {
      throw new Error(
        'No se pudo leer ' + ruta + '. Si abriste el proyecto con doble clic (file://), ' +
        'el navegador bloquea la carga: sirve la carpeta con un servidor local ' +
        '(por ejemplo: npx serve . · python -m http.server · o Live Server de VS Code).'
      );
    }

    if (!respuesta.ok) {
      throw new Error('No se pudo cargar ' + ruta + ' (HTTP ' + respuesta.status + ').');
    }

    var texto = await respuesta.text();
    var documento = new DOMParser().parseFromString(texto, 'text/html');
    var temas = Array.prototype.slice.call(documento.querySelectorAll('.horizontal-topic'));

    if (!temas.length) {
      throw new Error('No se encontró ningún .horizontal-topic dentro de ' + ruta + '.');
    }

    return temas.map(function (tema, x) {
      var nodo = document.importNode(tema, true);
      var slides = Array.prototype.filter.call(nodo.children, function (hijo) {
        return hijo.classList.contains('slide');
      });
      slides.forEach(function (slide, y) {
        slide.dataset.tema = String(x);
        slide.dataset.sub = String(y);
      });
      if (!slides.length) {
        console.warn('[cargar-diapositivas] El tema ' + x + ' no tiene ninguna .slide.');
      }
      return nodo;
    });
  }

  global.CargarDiapositivas = CargarDiapositivas;
})(window);
