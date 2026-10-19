/*!
 * audiencia.js — Lógica de la vista de proyección.
 * Monta el contenido en el escenario 2D, lo desplaza con transform
 * y reacciona a los cambios de estado (propios o recibidos del panel).
 */
(async function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };

  var escenario = $('#escenario');
  var cargando = $('#cargando');
  var error = $('#error');

  /* -------------------------------------------------------------- */
  /* 1. Cargar contenido y montar el escenario                        */
  /* -------------------------------------------------------------- */
  var temas;
  try {
    temas = await window.CargarDiapositivas();
  } catch (e) {
    cargando.hidden = true;
    error.hidden = false;
    $('#errorDetalle').textContent = e.message;
    console.error('[audiencia]', e);
    return;
  }

  var diapositivas = [];      // [{ x, y, el }]
  var subDiapositivas = [];   // cantidad de slides por tema

  temas.forEach(function (tema) {
    escenario.appendChild(tema);
    var slides = Array.prototype.filter.call(tema.children, function (h) {
      return h.classList.contains('slide');
    });
    var x = subDiapositivas.length;
    slides.forEach(function (slide, y) {
      slide.style.setProperty('--y', y);
      diapositivas.push({ x: x, y: y, el: slide });
    });
    subDiapositivas.push(slides.length);
  });

  // El sincronizador ya conoce la matriz: puede validar coordenadas.
  Sincronizador.configurar({ temas: temas.length, subDiapositivas: subDiapositivas });
  cargando.hidden = true;

  /* -------------------------------------------------------------- */
  /* 2. Render del estado                                             */
  /* -------------------------------------------------------------- */
  function render(estado) {
    var x = estado.x;
    var y = estado.y;

    escenario.style.setProperty('--x', x);
    escenario.style.setProperty('--y', y);

    diapositivas.forEach(function (d) {
      var activa = d.x === x && d.y === y;
      d.el.dataset.activa = activa ? 'true' : 'false';
      d.el.setAttribute('aria-hidden', activa ? 'false' : 'true');
      d.el.inert = !activa;   // evita tabular fuera de la diapositiva activa
    });
  }

  Sincronizador.enCambio(render);
  render(Sincronizador.obtener());
  Sincronizador.solicitar();   // pedir el estado por si el panel ya está abierto

  /* -------------------------------------------------------------- */
  /* 3. Entradas: teclado y gestos                                    */
  /* -------------------------------------------------------------- */
  var TECLAS = {
    ArrowLeft: 'izquierda',
    ArrowRight: 'derecha',
    ArrowUp: 'arriba',
    ArrowDown: 'abajo'
  };

  window.addEventListener('keydown', function (e) {
    // P → abrir el panel del presentador (nada visible en pantalla)
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      window.open('presentador.html', 'presentador_2d');
      return;
    }
    var direccion = TECLAS[e.key];
    if (!direccion || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    Sincronizador.mover(direccion);
  });

  // Gestos de deslizamiento (tablets / móviles)
  var toque = null;
  window.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    toque = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  window.addEventListener('touchend', function (e) {
    if (!toque || !e.changedTouches.length) return;
    var dx = e.changedTouches[0].clientX - toque.x;
    var dy = e.changedTouches[0].clientY - toque.y;
    toque = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 55) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      Sincronizador.mover(dx > 0 ? 'izquierda' : 'derecha');
    } else {
      Sincronizador.mover(dy > 0 ? 'arriba' : 'abajo');
    }
  }, { passive: true });
})();
