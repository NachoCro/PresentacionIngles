/*!
 * sonido.js — Clic del botoncito de la Lumina Wand
 * ------------------------------------------------------------------
 * Sonido sintetizado con Web Audio (sin archivos de audio): un doble
 * "clic-clac" de microinterruptor, como los botones de la Wand.
 *   · Snap   = ruido seco en pass-band con decaimiento rápido.
 *   · Tick   = onda cuadrada que cae rápido (carácter de interruptor).
 *
 * Se dispara SOLO mediante llamada explícita (botón):
 *   window.LuminaSonido.clic()
 *
 * Lo usan presentador.js (botón de cabecera) y audiencia.js (botón
 * discreto de la vista de proyección).
 * ------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var audioCtx = null;

  function reproducirClic(volumen, frecuencia, retraso) {
    var t = audioCtx.currentTime + (retraso || 0);
    var dur = 0.045;
    var muestras = Math.ceil(audioCtx.sampleRate * dur);

    // 1) Snap: ruido seco con decaimiento rápido (el "clic" físico)
    var buf = audioCtx.createBuffer(1, muestras, audioCtx.sampleRate);
    var datos = buf.getChannelData(0);
    for (var i = 0; i < muestras; i++) {
      datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / muestras, 3);
    }
    var fuente = audioCtx.createBufferSource();
    fuente.buffer = buf;
    var filtro = audioCtx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = frecuencia;
    filtro.Q.value = 1.1;
    var gain = audioCtx.createGain();
    gain.gain.value = volumen;
    fuente.connect(filtro);
    filtro.connect(gain);
    gain.connect(audioCtx.destination);
    fuente.start(t);

    // 2) Tick tonal: le da el carácter de microinterruptor
    var osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(frecuencia / 2, t);
    osc.frequency.exponentialRampToValueAtTime(frecuencia / 4, t + 0.04);
    var gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0.12 * volumen, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /** Doble clic del botoncito (pulsar → soltar). Requiere un gesto previo. */
  function clic() {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    reproducirClic(0.5, 3200, 0);        // pulsación
    reproducirClic(0.3, 2600, 0.085);    // soltada (el segundo "clac")
  }

  global.LuminaSonido = { clic: clic };
})(window);
