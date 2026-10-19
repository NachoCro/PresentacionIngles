/*!
 * sincronizador.js
 * ------------------------------------------------------------------
 * Estado global de la presentación (coordenadas X, Y) y comunicación
 * bidireccional entre la ventana de Audiencia y la de Presentador.
 *
 * · Canal principal : BroadcastChannel('presentacion_2d')
 * · Respaldo        : eventos 'storage' de localStorage (si el canal
 *                     broadcast no está disponible y, de paso, para
 *                     restaurar el estado tras recargar una ventana).
 *
 * Reglas de navegación:
 *   - X = tema horizontal (0 .. temas-1)
 *   - Y = sub-diapositiva vertical (0 .. subDiapositivas[X]-1)
 *   - Al cambiar de tema (izquierda/derecha) Y se reinicia a 0.
 * ------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var NOMBRE_CANAL = 'presentacion_2d';
  var CLAVE_ESTADO = 'presentacion_2d:estado';

  /* ---------------------------------------------------------------- */
  /* Estado interno                                                     */
  /* ---------------------------------------------------------------- */
  var estado = { x: 0, y: 0 };
  var limites = null;      // { temas: n, subDiapositivas: [n, n, ...] } tras configurar()
  var oyentes = [];        // callbacks de UI
  var canal = null;

  /* ---------------------------------------------------------------- */
  /* Utilidades                                                         */
  /* ---------------------------------------------------------------- */
  function limitar(valor, min, max) {
    var n = Math.round(Number(valor));
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  /** Cuenta de sub-diapositivas del tema `x` (mínimo 1). */
  function cantidadSub(x) {
    if (!limites) return 1;
    return Math.max(1, limites.subDiapositivas[x] || 1);
  }

  /** Normaliza unas coordenadas contra los límites conocidos. */
  function normalizar(x, y) {
    if (!limites) return { x: Number(x) || 0, y: Number(y) || 0 };
    var nx = limitar(x, 0, limites.temas - 1);
    var ny = limitar(y, 0, cantidadSub(nx) - 1);
    return { x: nx, y: ny };
  }

  function persistir() {
    try { global.localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado)); } catch (_) {}
  }

  function notificar(origen) {
    var copia = { x: estado.x, y: estado.y };
    oyentes.forEach(function (fn) { fn(copia, origen || 'local'); });
  }

  function transmitir() {
    if (!canal) return;
    try { canal.postMessage({ tipo: 'estado', x: estado.x, y: estado.y }); } catch (_) {}
  }

  /** Aplica coordenadas recibidas desde OTRA ventana (no se reenvían). */
  function adoptar(x, y, origen) {
    var n = normalizar(x, y);
    if (n.x === estado.x && n.y === estado.y) return false;
    estado.x = n.x;
    estado.y = n.y;
    persistir();
    notificar(origen || 'remoto');
    return true;
  }

  /** Aplica coordenadas propias y las publica al resto de ventanas. */
  function fijar(x, y, origen) {
    var n = normalizar(x, y);
    if (n.x === estado.x && n.y === estado.y) return false;
    estado.x = n.x;
    estado.y = n.y;
    persistir();
    transmitir();
    notificar(origen || 'local');
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* API pública                                                        */
  /* ---------------------------------------------------------------- */
  var Sincronizador = {

    /** Inicia canal y restaura el último estado guardado. Llamar 1 vez. */
    iniciar: function () {
      if (canal !== null) return Sincronizador;

      // 1. Restaurar estado persistido (por si la ventana se recargó).
      try {
        var guardado = global.localStorage.getItem(CLAVE_ESTADO);
        if (guardado) {
          var s = JSON.parse(guardado);
          estado.x = Number(s.x) || 0;
          estado.y = Number(s.y) || 0;
        }
      } catch (_) {}

      // 2. Canal principal: BroadcastChannel.
      if ('BroadcastChannel' in global) {
        try {
          canal = new global.BroadcastChannel(NOMBRE_CANAL);
          canal.onmessage = function (evento) {
            var m = evento.data || {};
            if (m.tipo === 'estado') adoptar(m.x, m.y, 'canal');
            else if (m.tipo === 'solicitar-estado') transmitir();
          };
        } catch (_) { canal = null; }
      }

      // 3. Respaldo / complemento: eventos de storage (otra ventana del
      //    mismo origen escribió el estado en localStorage).
      global.addEventListener('storage', function (evento) {
        if (evento.key !== CLAVE_ESTADO || !evento.newValue) return;
        try {
          var s = JSON.parse(evento.newValue);
          adoptar(s.x, s.y, 'storage');
        } catch (_) {}
      });

      return Sincronizador;
    },

    /**
     * Declara las dimensiones de la matriz de diapositivas.
     * @param {{temas:number, subDiapositivas:number[]}} dim
     */
    configurar: function (dim) {
      limites = {
        temas: Math.max(1, Number(dim.temas) || 1),
        subDiapositivas: (dim.subDiapositivas || []).map(function (n) { return Math.max(1, Number(n) || 1); })
      };
      // Re-normalizar el estado actual contra los nuevos límites
      // (p. ej. si al recargar se quitó una sub-diapositiva).
      var n = normalizar(estado.x, estado.y);
      if (n.x !== estado.x || n.y !== estado.y) {
        estado.x = n.x;
        estado.y = n.y;
        persistir();
      }
      transmitir();
      notificar('configurado');
      return { x: estado.x, y: estado.y };
    },

    /** Copia inmutable del estado actual. */
    obtener: function () {
      return { x: estado.x, y: estado.y };
    },

    /** Suscripción a cambios de estado. Devuelve la función de baja. */
    enCambio: function (fn) {
      oyentes.push(fn);
      return function () {
        var i = oyentes.indexOf(fn);
        if (i > -1) oyentes.splice(i, 1);
      };
    },

    /**
     * Navegación por ejes. Cambia de tema => Y vuelve a 0.
     * @param {'arriba'|'abajo'|'izquierda'|'derecha'} direccion
     */
    mover: function (direccion) {
      if (!limites) return false;
      var x = estado.x;
      var y = estado.y;

      switch (direccion) {
        case 'izquierda':
          if (x <= 0) return false;
          x -= 1;
          y = 0;                       // reset vertical al cambiar de tema
          break;
        case 'derecha':
          if (x >= limites.temas - 1) return false;
          x += 1;
          y = 0;                       // reset vertical al cambiar de tema
          break;
        case 'arriba':
          if (y <= 0) return false;
          y -= 1;
          break;
        case 'abajo':
          if (y >= cantidadSub(x) - 1) return false;
          y += 1;
          break;
        default:
          return false;
      }
      return fijar(x, y);
    },

    /**
     * Salto directo a unas coordenadas (mapa del presentador).
     * Si `y` no se indica, se asume 0.
     */
    irA: function (x, y) {
      return fijar(x, typeof y === 'number' ? y : 0);
    },

    /** Pide al resto de ventanas que reenvíen su estado actual. */
    solicitar: function () {
      if (!canal) return;
      try { canal.postMessage({ tipo: 'solicitar-estado' }); } catch (_) {}
    },

    /** Reenvía el estado actual (útil al terminar de montar la UI). */
    publicar: transmitir
  };

  Sincronizador.iniciar();
  global.Sincronizador = Sincronizador;
})(window);
