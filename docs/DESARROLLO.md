# FitWeek: guía de desarrollo y publicación

Instrucciones técnicas para ejecutar, compilar, publicar e instalar FitWeek desde Windows sin necesidad de una Mac. Para la descripción de la app, ver el [README](../README.md).

## Requisitos (Windows)

1. Instalá **Node.js 22 LTS** desde <https://nodejs.org> (con las opciones por defecto).
2. Instalá **Git** desde <https://git-scm.com> (solo si vas a publicar desde la terminal).
3. Abrí una terminal (PowerShell) en la carpeta del proyecto y ejecutá esto una sola vez:

```powershell
npm install
```

## Desarrollar

```powershell
npm run dev
```

Abrí la dirección que muestra la terminal (por ejemplo `http://localhost:5173`) en Chrome o Edge. Para verla como en un iPhone, presioná **F12** y activá el modo dispositivo con **Ctrl+Shift+M**.

> En modo desarrollo el modo offline está desactivado a propósito. Para probarlo, usá `npm run build` y `npm run preview`.

## Tests

```powershell
npm test
```

Verifican la rotación del ciclo (incluido el ejemplo lunes D1 → martes falta → miércoles D2…), las estadísticas, el respaldo y que los 3 idiomas tengan todos los textos.

## Compilar

```powershell
npm run build
npm run preview
```

`build` hace tres cosas:

1. Compila Tailwind 4 con su CLI y genera `src/styles/app.css`.
2. Compila la app con Vite en la carpeta `dist/`.
3. Genera `dist/sw.js` con la lista de archivos que se guardan para usar la app sin conexión.

## Publicar en GitHub Pages

El repositorio ya trae el flujo `.github/workflows/deploy.yml`, que en cada push a `main` instala dependencias, corre los tests, compila y publica.

**Configurar una sola vez:** en GitHub, entrá al repositorio → **Settings** → **Pages** → en **Build and deployment** → **Source**, elegí **GitHub Actions**. Si queda en "Deploy from a branch", GitHub publica el código sin compilar y la app no funciona.

**Trabajar desde Windows:** el repositorio de GitHub es la copia principal. Clonalo una vez:

```powershell
git clone https://github.com/BradithanApps/fitweek.git
cd fitweek
npm install
```

Para publicar un cambio:

```powershell
git add .
git commit -m "Describe el cambio"
git push
```

Si es la primera vez que usás `git commit`, Git te puede pedir tu nombre y email:

```powershell
git config --global user.name "Tu nombre"
git config --global user.email "tu@email.com"
```

Seguí el avance en la pestaña **Actions** del repositorio. Cuando termine, la app queda en:

**https://bradithanapps.github.io/fitweek/**

## Instalar en el iPhone

1. Abrí la URL en **Safari** (no en Chrome: en iPhone solo Safari permite instalarla).
2. Tocá **Compartir** (el cuadrado con la flecha) → **Añadir a pantalla de inicio** → **Añadir**.
3. Abrí FitWeek desde el ícono **una vez con conexión**, para que se descargue todo.
4. Probá en **modo avión**: tiene que abrir y funcionar igual.
5. En **Ajustes → Acerca de**, "Sin conexión" tiene que decir **Lista**.

Para compartirla, mandá el link: cada persona la instala igual y tiene sus propios datos. En Android se instala desde Chrome con **Instalar app**.

## Actualizaciones

Después de un `git push`, la próxima vez que alguien abra la app con conexión aparece el aviso **"Hay una nueva versión"** con el botón **Actualizar**. El aviso nunca interrumpe un entreno: si hay uno en curso, aparece al terminarlo.

## Respaldo

Los datos viven **solo en el teléfono**. Si se borra la app de la pantalla de inicio, se pierden.

- **Exportar:** en **Ajustes → Exportar respaldo**, el iPhone abre la hoja de compartir. Elegí **Guardar en Archivos**, AirDrop o la opción que prefieras.
- **Importar:** en **Ajustes → Importar respaldo**, elegís entre:
  - **Fusionar**, que agrega lo que falta sin borrar nada;
  - **Reemplazar todo**.

---

## Estructura

```
index.html                 Estructura base
public/                    manifest.webmanifest e iconos
src/main.js                Arranque, rutas, barra de pestañas
src/styles/input.css       Tailwind 4 (tokens de diseño en @theme)
src/i18n/                  es.js, pt.js, en.js + formatos con Intl
src/domain/                Lógica pura (testeada):
  cycle.js                 rotación del ciclo y proyección semanal
  stats.js                 racha, volumen, récords
  workout.js               sesión de entrenamiento
  backup.js                validar, exportar, fusionar
  seed.js                  ejemplo de 5 Días
src/db/                    IndexedDB (migraciones versionadas) y repositorios
src/views/                 Pantallas
src/ui/                    DOM seguro, iconos SVG, componentes
sw/sw.js                   Service Worker (plantilla)
scripts/build-sw.mjs       Genera dist/sw.js con la lista de precarga
tests/                     Tests con node --test
```

### Editar el ejemplo de 5 Días

Está en `src/domain/seed.js`. Cada Día es una lista de `['clave', series, reps]` y los nombres están en los 3 idiomas en el objeto `EX`. Solo se usa la primera vez que alguien abre la app (o desde Plan → "Cargar ejemplo" con el ciclo vacío). Lo que ya está guardado en el teléfono se edita desde la app.

### Cambios en la estructura de datos

Si en el futuro cambia la forma de guardar datos, subí `DB_VERSION` en `src/db/db.js` y agregá una migración nueva en `MIGRATIONS`. Nunca edites las migraciones existentes: otras personas ya tienen datos con esa estructura.
