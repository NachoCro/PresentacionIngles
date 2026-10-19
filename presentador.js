/*!
 * presentador.js — Lógica del panel de control.
 * Vista previa actual/siguiente, mapa general 2D, guion y cronómetro.
 */
(async function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };

  var BASE_ANCHO = 1280;   // tamaño de diseño de una diapositiva
  var BASE_ALTO = 720;

  var cargando = $('#cargando');
  var error = $('#error');

  /* -------------------------------------------------------------- */
  /* 1. Cargar contenido                                             */
  /* -------------------------------------------------------------- */
  var temas;
  try {
    temas = await window.CargarDiapositivas();
  } catch (e) {
    cargando.hidden = true;
    error.hidden = false;
    $('#errorDetalle').textContent = e.message;
    console.error('[presentador]', e);
    return;
  }
  cargando.hidden = true;

  var subDiapositivas = temas.map(function (tema) {
    return Array.prototype.filter.call(tema.children, function (h) {
      return h.classList.contains('slide');
    }).length;
  });
  var totalSub = Math.max.apply(null, subDiapositivas);

  $('#dimensiones').textContent =
    temas.length + (temas.length === 1 ? ' tema' : ' temas') + ' × ' + totalSub + ' filas';

  Sincronizador.configurar({ temas: temas.length, subDiapositivas: subDiapositivas });

  /* -------------------------------------------------------------- */
  /* 2. Utilidades: montar miniaturas y escalarlas                    */
  /* -------------------------------------------------------------- */
  var escalados = new Map();   // lienzo -> marco-escala

  function slideDe(x, y) {
    var tema = temas[x];
    if (!tema) return null;
    var slides = tema.querySelectorAll(':scope > .slide');
    return slides[y] || null;
  }

  /** Clona `slide` dentro de `lienzo` a tamaño base (1280×720). */
  function montar(lienzo, slide) {
    lienzo.replaceChildren();
    if (!slide) {
      escalados.delete(lienzo);
      return;
    }
    var marco = document.createElement('div');
    marco.className = 'marco-escala';
    marco.style.width = BASE_ANCHO + 'px';
    marco.style.height = BASE_ALTO + 'px';

    var clon = slide.cloneNode(true);
    clon.removeAttribute('data-activa');
    if (clon.id) clon.removeAttribute('id');
    clon.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });

    marco.appendChild(clon);
    lienzo.appendChild(marco);
    escalados.set(lienzo, marco);
  }

  /** Ajusta la escala de todos los marcos montados al tamaño real. */
  function reescalar() {
    escalados.forEach(function (marco, lienzo) {
      var rect = lienzo.getBoundingClientRect();
      if (!rect.width) return;
      // Si el lienzo aún no tiene alto (layout pendiente), se escala
      // por anchura para no dejar nunca la previa sin escalar.
      var k = rect.height
        ? Math.min(rect.width / BASE_ANCHO, rect.height / BASE_ALTO)
        : rect.width / BASE_ANCHO;
      marco.style.transform = 'translate(-50%, -50%) scale(' + k + ')';
    });
  }

  /* -------------------------------------------------------------- */
  /* 3. Mapa general (cuadrícula 2D: columnas = X, filas = Y)         */
  /* -------------------------------------------------------------- */
  var rejilla = $('#rejilla');
  rejilla.style.setProperty('--cols', temas.length);

  temas.forEach(function (tema, x) {
    var slides = tema.querySelectorAll(':scope > .slide');
    slides.forEach(function (slide, y) {
      var celda = document.createElement('button');
      celda.type = 'button';
      celda.className = 'mini';
      celda.dataset.x = x;
      celda.dataset.y = y;
      celda.style.gridColumn = String(x + 1);
      celda.style.gridRow = String(y + 1);
      celda.setAttribute('aria-label', 'Ir a tema ' + (x + 1) + ', diapositiva ' + (y + 1));
      celda.title = slide.querySelector('.content h2')
        ? slide.querySelector('.content h2').textContent
        : 'Diapositiva';

      var lienzo = document.createElement('span');
      lienzo.className = 'mini__lienzo';

      var badge = document.createElement('span');
      badge.className = 'mini__badge';
      badge.textContent = (x + 1) + '·' + (y + 1);

      var eje = document.createElement('span');
      eje.className = 'mini__eje';
      eje.textContent = 'X' + (x + 1) + ' / Y' + (y + 1);

      celda.appendChild(lienzo);
      celda.appendChild(badge);
      celda.appendChild(eje);
      celda.addEventListener('click', function () {
        Sincronizador.irA(x, y);
      });

      rejilla.appendChild(celda);
      montar(lienzo, slide);
    });
  });

  /* -------------------------------------------------------------- */
  /* 4. Render del estado                                             */
  /* -------------------------------------------------------------- */
  var lienzoActual = $('#lienzoActual');
  var vistaSig1 = $('#vistaSiguiente1');
  var vistaSig2 = $('#vistaSiguiente2');
  var etiqueta1 = $('#etiqueta1');
  var etiqueta2 = $('#etiqueta2');
  var finMensaje = $('#finMensaje');
  var notas = $('#notas');
  var tituloDiapositiva = $('#tituloDiapositiva');
  var coordenadas = $('#coordenadas');

  function prepararSiguiente(vista, etiqueta, candidato) {
    if (!candidato) {
      vista.hidden = true;
      escalados.delete(vista.querySelector('.vista__lienzo'));
      return;
    }
    vista.hidden = false;
    etiqueta.replaceChildren();

    var tecla = document.createElement('span');
    tecla.className = 'etiqueta__tecla';
    tecla.textContent = candidato.tecla;

    etiqueta.appendChild(tecla);
    etiqueta.appendChild(document.createTextNode(' ' + candidato.texto));

    montar(vista.querySelector('.vista__lienzo'), slideDe(candidato.x, candidato.y));
  }

  function render(estado) {
    var x = estado.x;
    var y = estado.y;
    var slide = slideDe(x, y);

    /* Coordenadas en la cabecera */
    coordenadas.replaceChildren();
    var fuerte = document.createElement('b');
    fuerte.textContent = 'Tema ' + (x + 1) + '/' + temas.length;
    coordenadas.appendChild(fuerte);
    coordenadas.appendChild(
      document.createTextNode(' · Sub ' + (y + 1) + '/' + subDiapositivas[x])
    );

    /* Vista previa: actual */
    montar(lienzoActual, slide);

    /* Vista previa: siguientes candidatas (↓ profundiza, → cambia de tema) */
    var candidatos = [];
    if (y < subDiapositivas[x] - 1) {
      candidatos.push({ tecla: '↓', texto: 'Sub-diapositiva', x: x, y: y + 1 });
    }
    if (x < temas.length - 1) {
      candidatos.push({ tecla: '→', texto: 'Tema siguiente', x: x + 1, y: 0 });
    }
    prepararSiguiente(vistaSig1, etiqueta1, candidatos[0]);
    prepararSiguiente(vistaSig2, etiqueta2, candidatos[1]);
    finMensaje.hidden = candidatos.length > 0;

    /* Guion / notas */
    var aside = slide ? slide.querySelector('aside.notes') : null;
    var texto = aside ? aside.textContent.trim() : '';
    notas.textContent = texto || 'Sin notas para esta diapositiva.';
    notas.classList.toggle('vacio', !texto);

    var h2 = slide ? slide.querySelector('.content h2') : null;
    tituloDiapositiva.textContent = h2 ? h2.textContent.trim() : '—';

    /* Mapa: resaltar activa */
    var activa = null;
    rejilla.querySelectorAll('.mini').forEach(function (celda) {
      var esActiva = Number(celda.dataset.x) === x && Number(celda.dataset.y) === y;
      celda.classList.toggle('activa', esActiva);
      if (esActiva) {
        celda.setAttribute('aria-current', 'true');
        activa = celda;
      } else {
        celda.removeAttribute('aria-current');
      }
    });
    if (activa) {
      activa.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }

    /* Reescalado en el siguiente fotograma (el DOM ya está pintado) */
    requestAnimationFrame(reescalar);
  }

  Sincronizador.enCambio(render);
  render(Sincronizador.obtener());
  Sincronizador.solicitar();   // pedir el estado por si la audiencia ya está abierta

  window.addEventListener('resize', reescalar);
  if ('ResizeObserver' in window) {
    // Cubre cambios de layout que no disparan resize (p. ej. barras de scroll).
    new ResizeObserver(reescalar).observe(document.body);
  }

  /* -------------------------------------------------------------- */
  /* 5. Teclado                                                      */
  /* -------------------------------------------------------------- */
  var TECLAS = {
    ArrowLeft: 'izquierda',
    ArrowRight: 'derecha',
    ArrowUp: 'arriba',
    ArrowDown: 'abajo',
    PageDown: 'derecha',
    PageUp: 'izquierda',
    ' ': 'abajo'
  };

  window.addEventListener('keydown', function (e) {
    var foco = e.target;
    if (foco && typeof foco.closest === 'function' &&
        foco.closest('button, input, textarea, select, a')) return;
    var direccion = TECLAS[e.key];
    if (!direccion || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    Sincronizador.mover(direccion);
  });

  /* -------------------------------------------------------------- */
  /* 6. Utilidades de cabecera                                        */
  /* -------------------------------------------------------------- */
  $('#abrirAudiencia').addEventListener('click', function () {
    window.open('index.html', 'audiencia_2d');
  });
  $('#btnEmpezar').addEventListener('click', function () {
    if (cronometro.estado !== 'corriendo') cronometro.iniciar();
  });

  /* -------------------------------------------------------------- */
  /* 6b. 🔊 Clic del botoncito de la Lumina Wand                     */
  /*     Sonido compartido: ver sonido.js (window.LuminaSonido).     */
  /*     También disponible como botón discreto en la audiencia.     */
  /* -------------------------------------------------------------- */
  $('#btnClicLumina').addEventListener('click', function () {
    if (window.LuminaSonido) window.LuminaSonido.clic();
  });

  /* -------------------------------------------------------------- */
  /* 7. Cronómetro                                                    */
  /* -------------------------------------------------------------- */
  var tiempo = $('#tiempo');
  var estadoTexto = $('#estadoCronometro');
  var btnIniciar = $('#btnIniciar');
  var btnPausar = $('#btnPausar');
  var btnReiniciar = $('#btnReiniciar');

  var acumulado = 0;          // ms acumulados en sesiones anteriores
  var arranque = null;        // timestamp de la sesión en curso
  var intervalo = null;

  function msTotales() {
    return acumulado + (arranque !== null ? Date.now() - arranque : 0);
  }

  function pintarTiempo() {
    var seg = Math.floor(msTotales() / 1000);
    var m = String(Math.floor(seg / 60)).padStart(2, '0');
    var s = String(seg % 60).padStart(2, '0');
    tiempo.textContent = m + ':' + s;
  }

  function pintarEstado() {
    var corriendo = intervalo !== null;
    tiempo.classList.toggle('corriendo', corriendo);
    estadoTexto.textContent = corriendo ? 'En marcha' : (acumulado > 0 ? 'En pausa' : 'Detenido');
    btnIniciar.disabled = corriendo;
    btnPausar.disabled = !corriendo;
  }

  var cronometro = {
    get estado() { return intervalo !== null ? 'corriendo' : 'detenido'; },
    iniciar: function () {
      if (intervalo !== null) return;
      arranque = Date.now();
      intervalo = setInterval(pintarTiempo, 250);
      pintarEstado();
    },
    pausar: function () {
      if (intervalo === null) return;
      acumulado += Date.now() - arranque;
      arranque = null;
      clearInterval(intervalo);
      intervalo = null;
      pintarTiempo();
      pintarEstado();
    },
    reiniciar: function () {
      cronometro.pausar();
      acumulado = 0;
      pintarTiempo();
      pintarEstado();
    }
  };

  btnIniciar.addEventListener('click', cronometro.iniciar);
  btnPausar.addEventListener('click', cronometro.pausar);
  btnReiniciar.addEventListener('click', cronometro.reiniciar);

  pintarTiempo();
  pintarEstado();
})();
