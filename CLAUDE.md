# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

PWA de gestión de vacaciones para el equipo de Mecafilter. Sin framework ni bundler: HTML + CSS + JS vanilla desplegado en Netlify, con Firebase como backend en tiempo real. No hay `package.json`, `npm`, ni proceso de build.

## Desarrollo local

Abrir directamente en el navegador o servir con cualquier servidor estático:

```bash
# Opción rápida
python3 -m http.server 8080
# o
npx serve .
```

No hay tests, linter ni paso de compilación. Los cambios son inmediatos al recargar el navegador.

## Despliegue

El proyecto se despliega en Netlify automáticamente al hacer push a `main`. Los headers HTTP están en `_headers`.  
Cuando se añadan archivos JS nuevos hay que actualizar la lista `ASSETS` en `sw.js` y subir el número `CACHE_NAME` para que el Service Worker invalide la caché.

## Arquitectura

### Flujo de carga
```
login.html  →  Firebase Auth  →  splash.html (sync Firestore)  →  index.html
```
`firebase.js` redirige a `login.html` si no hay sesión activa. `startSync()` hace un fetch inicial de Firestore y luego mantiene un `onSnapshot` en tiempo real.

### Estado global (`state.js`)
Un objeto `state` se persiste en `localStorage` clave `vac-app-v3` y se sincroniza con Firestore en `vacaciones/estado`. **Toda modificación de datos debe llamar a `saveState()`**, que graba en localStorage y dispara `saveToFirebase()`.

Estructura del estado:
```js
{
  employees: [{ id, name, role, color, totalDays, birthday }],
  marks: { "YYYY-MM-DD": { empId: "V"|"O" } },   // V=vacaciones, O=otros
  festivos: { "YYYY-MM-DD": true },
  currentYear, nextId, theme,
  conflictThreshold, conflictThresholdTotal,
  customRoles, compatibleRoles          // compatibleRoles se serializa como JSON string en Firestore
}
```

### Módulos JS (cargados en orden)
| Archivo | Responsabilidad |
|---|---|
| `state.js` | Estado global, utilidades de fecha, helpers de renderizado, `showView()`, funciones de tema y sidebar |
| `firebase.js` | Auth, Firestore read/write, `loadSecret()` para API keys privadas |
| `calendar.js` | Render de Dashboard, vista Anual, vista Mensual, modal de día, detección de conflictos |
| `employees.js` | CRUD de empleados, color picker, gestión de puestos y pares compatibles |
| `export-import.js` | Exportación PDF (jsPDF) e ICS, importación de documentos con IA |
| `gantt.js` | Vista Gantt (wallchart mensual): un día por columna, un empleado por fila |

### Navegación entre vistas
`showView(v)` en `state.js` activa la vista (`dashboard` | `annual` | `monthly` | `gantt`), actualiza el `nav-item` activo en la sidebar, cambia el título del header y llama al renderer correspondiente. Los `.tab-btn` del `<header>` oculto se mantienen solo para compatibilidad con `calendar.js` (que los usa para detectar la vista activa al guardar el modal de día).

### Temas
Tres temas gestionados con variables CSS en `styles.css`: `dark` (por defecto, acento naranja `#f5a623`), `light` (acento índigo `#4f46e5`) y `mecafilter` (acento verde `#509E48`). Se aplican añadiendo/quitando clases `light` / `mecafilter` en `<body>`. `applyTheme()` actualiza el botón de la sidebar sin sobreescribir el SVG interior.

### Claves privadas (API keys)
Las API keys sensibles (p.ej. OpenAI para importación con IA) se guardan en Firestore en `config/secrets` y se leen en tiempo de ejecución con `loadSecret('nombre_campo')`. Nunca se incluyen en el código fuente.

## Convenciones clave

- **Fechas** siempre en formato `"YYYY-MM-DD"` (función `dateKey(y, m, d)` donde `m` es 0-based).
- **IDs de empleado** son números enteros; `state.nextId` se incrementa al crear uno nuevo.
- Para añadir una vista nueva: crear el renderer en un archivo `.js` propio, añadir el `<div class="view" id="view-X">` en `index.html`, un `nav-item` en la sidebar, la entrada en el objeto `meta` de `showView()`, y `if (v === 'X') renderX();` al final de `showView()`. Actualizar también `ASSETS` en `sw.js`.
