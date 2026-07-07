# Teleprompter

Teleprompter profesional como PWA: pega tu texto, pulsa **▶ Reproducir** y listo. Funciona sin conexión y se puede instalar como aplicación en tu laptop.

## Cómo usarlo

1. Sirve la carpeta con cualquier servidor estático, por ejemplo:
   ```
   npx serve .
   ```
   (o publícalo en GitHub Pages — funciona tal cual, con rutas relativas).
2. Abre la URL en Chrome o Edge.
3. Pega tu guion, pulsa **▶ Reproducir** (o `Ctrl+Enter`).
4. Para instalarlo como app: botón **⬇ Instalar** en la barra superior, o el ícono de instalación de la barra de direcciones.

> El texto y todos los ajustes se guardan automáticamente en el navegador.

## Características

- **Velocidad ajustable** (10–400 px/s) en tiempo real, o **modo duración**: indica el tiempo total (mm:ss) y la velocidad se calcula sola.
- **Texto**: tamaño (24–160 px), fuente, negrita, interlineado, espaciado entre letras y alineación.
- **Colores**: presets clásicos (amarillo/negro, blanco/negro, etc.) o selector personalizado de texto y fondo.
- **Espejo horizontal y vertical** para cristal de teleprompter (beam splitter).
- **Guía de lectura**: línea, flecha o ambas, con posición, color y opacidad ajustables.
- **Márgenes laterales** para estrechar la columna de texto y reducir el movimiento ocular.
- **Cuenta regresiva** configurable (0–10 s) antes de empezar.
- **Vista previa en vivo** en el panel de ajustes: cada cambio se ve al instante sobre tu propio guion, animado a la velocidad configurada.
- **Barra de progreso** clicable y tiempo restante estimado.
- Estimación de duración hablada (150 palabras/min) en el editor.
- Pantalla completa automática al reproducir (desactivable).
- La pantalla no se apaga durante la reproducción (Wake Lock).
- Controles que se ocultan solos mientras lees.
- **Funciona offline** (service worker) e instalable como PWA.

## Atajos de teclado (en el prompter)

| Tecla | Acción |
|---|---|
| `Espacio` o clic en el texto | Pausar / reanudar |
| `↑` / `↓` | Velocidad ±5 (con `Shift`: ±20) |
| `←` / `→` | Retroceder / avanzar 3 s |
| `Re Pág` / `Av Pág` | Saltar ±10 s |
| `Inicio` / `Fin` | Ir al principio / final |
| `+` / `-` | Tamaño de letra |
| `F` | Pantalla completa |
| `M` | Espejo horizontal |
| Rueda del ratón | Desplazamiento manual |
| `Esc` | Salir del prompter |

En el editor: `Ctrl+Enter` reproduce.

## Estructura

```
index.html            Interfaz (editor, prompter, panel de ajustes)
styles.css            Estilos
app.js                Lógica: motor de scroll, ajustes, vista previa, PWA
sw.js                 Service worker (offline, cache-first)
manifest.webmanifest  Manifiesto PWA
icons/                Íconos de la app
```

Sin dependencias ni build: HTML, CSS y JavaScript puros.
