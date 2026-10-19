# Sistema de Presentaciones 2D — Proyecto base

Presentaciones en **HTML + CSS + JavaScript nativo** (sin frameworks ni librerías)
con arquitectura de **dos ventanas sincronizadas**: la pantalla de **Audiencia**
(proyección) y el panel del **Presentador** (dashboard de control).

Navegación en dos ejes:

- **Eje X (← →)** — temas principales horizontales. Al cambiar de tema, **Y se reinicia a 0**.
- **Eje Y (↑ ↓)** — sub-diapositivas verticales de profundización dentro de cada tema.

## Cómo ejecutarlo

El contenido se carga con `fetch('diapositivas.html')`, así que el proyecto
necesita un **servidor local** (los navegadores bloquean `fetch` en `file://`):

```bash
# cualquiera de estas opciones, desde la carpeta del proyecto
npx serve .
python -m http.server
```

o bien abrir la carpeta en VS Code y usar **Live Server** (botón derecho → *Open with Live Server*).

Luego:

1. Abre `presentador.html` (panel de control).
2. Pulsa **Abrir Audiencia** (o abre `index.html` en otra ventana/monitor).
3. Ambas ventanas quedan sincronizadas al instante.

> En la vista de audiencia **solo se ve la diapositiva**: sin HUD, sin
> botones ni decoración. Se navega con las **flechas del teclado** o con
> **gestos de deslizar** (swipe) en pantallas táctiles, y la tecla **P**
> abre el panel del presentador.

## Estructura

```
proyectoDiapo/
├── index.html              Vista de Audiencia (proyección a pantalla completa)
├── presentador.html        Vista del Presentador (dashboard)
├── diapositivas.html       ★ CONTENIDO modular (único archivo a editar)
├── sincronizador.js        Estado global (X, Y) + BroadcastChannel
├── cargar-diapositivas.js  Carga y normaliza diapositivas.html
├── audiencia.js            Lógica de la vista de proyección
├── presentador.js          Lógica del panel de control
├── sonido.js               Clic sintetizado del botoncito (Web Audio)
├── img/                    Foto del producto (poster de la slide)
├── media/                  Vídeo del producto (slide de revelación)
└── css/
    ├── base.css            Tokens, reset y estilos de .slide (compartido)
    ├── diapositivas.css    Componentes visuales del contenido (dw-*)
    ├── audiencia.css       Escenario 2D (vista limpia, sin botones)
    └── presentador.css     Layout del dashboard
```

## Cómo editar el contenido

Todo el contenido vive en **`diapositivas.html`** con marcado estricto:

```html
<div class="horizontal-topic">            <!-- Tema principal (X) -->
  <section class="slide">                 <!-- Sub-diapositiva (Y) -->
    <div class="content">                 <!-- Visible en proyección -->
      <h2>Título de la Diapositiva</h2>
      <p>Contenido visual para la audiencia...</p>
    </div>
    <aside class="notes">                 <!-- Guion del orador (nunca se ve) -->
      Guion del presentador: puntos clave, consejos de oratoria...
    </aside>
  </section>

  <section class="slide"> ... </section>  <!-- Otra sub-diapositiva = Y + 1 -->
</div>
```

- **Nuevo tema (X + 1):** copia un bloque `<div class="horizontal-topic">…</div>`.
- **Nueva sub-diapositiva (Y + 1):** copia un `<section class="slide">` dentro del tema.
- La cuadrícula del mapa, las vistas previas y los límites de navegación se
  redibujan **solos**; no hay que tocar ningún JS.

## Sincronización

- Canal: **`BroadcastChannel('presentacion_2d')`** (nativo del navegador).
- Mensajes: `{tipo:'estado', x, y}` y `{tipo:'solicitar-estado'}` (una ventana
  que se abre tarde pide el estado actual).
- **Respaldo:** eventos `storage` de `localStorage`, que además recuerdan la
  última posición al recargar.
- Ambas ventanas pueden mandar cambios (Audiencia ↔ Presentador es bidireccional).
- `sincronizador.js` valida siempre las coordenadas contra la matriz real y
  garantiza que **cambiar de tema horizontal pone Y = 0**.

## Teclas y controles

| Acción | Audiencia | Presentador |
|---|---|---|
| Tema siguiente / anterior | `→` / `←` o swipe horizontal | `→` / `←` (también `Espacio` / `PageUp`) |
| Sub-diapositiva abajo / arriba | `↓` / `↑` o swipe vertical | `↓` / `↑` |
| Salto directo | — | clic en cualquier miniatura del mapa |
| Cronómetro | — | botones Iniciar / Pausar / Reiniciar (+ *Empezar cronómetro* en la cabecera) |
| Abrir la otra ventana | tecla `P` (abre el panel) | botón *Abrir Audiencia* |

La audiencia no tiene interfaz propia: durante la proyección solo se ve la
diapositiva. Los gestos de deslizar tienen un umbral de 55 px para no
dispararse por accidente.

## Escalado de diapositivas

Las diapositivas se diseñan a **1280 × 720** y se escalan con `transform`
en las miniaturas/vistas previas del presentador. En la pantalla de audiencia
se llenan a pantalla completa usando **unidades de contenedor (`cqw`)**, con
fallback a `vw` en navegadores antiguos, de modo que la tipografía se
proporcione igual en proyección y en vista previa.

## Comprobado en

Chrome/Edge, Firefox y Safari modernos (requieren soporte de
`BroadcastChannel`, `container queries` e `inert`, todos disponibles desde 2023;
si falta alguno el proyecto sigue funcionando con los respaldos indicados).
