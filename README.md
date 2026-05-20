# Zekfy

Aplicación personal estilo Spotify para gestionar una biblioteca musical local con descargas desde playlists de Spotify o YouTube. El backend descarga el audio con **yt-dlp**, lo convierte a **Opus 64 kbps** con **FFmpeg** y lo sirve desde una API REST. El frontend (React + Vite) permite importar playlists, descargar canciones y reproducirlas offline.

> ⚠️ Proyecto de uso personal/educativo. El scraping de YouTube puede violar sus términos de servicio. Úsalo bajo tu responsabilidad.

## Requisitos del sistema

- Node.js 18+
- FFmpeg (con libopus)
- yt-dlp
- SQLite (local) o PostgreSQL (nube)

Instalación de dependencias externas (ejemplo en Linux):

```bash
sudo apt install ffmpeg
pip install yt-dlp
```

## Estructura

```
backend/   # API + Prisma + descargas
frontend/  # UI React + Vite + Tailwind
```

## Configuración del backend

1. Instala dependencias:

```bash
cd backend
npm install
```

2. Crea tu `.env` basado en el ejemplo:

```bash
cp .env.example .env
```

3. Configura `DATABASE_URL`:

- SQLite local:
  ```
  DATABASE_URL="file:./dev.db"
  ```
- PostgreSQL nube:
  ```
  DATABASE_URL="postgresql://usuario:password@host:5432/zekfy"
  ```

Para PostgreSQL debes usar el schema con proveedor `postgresql` (`prisma/schema.postgres.prisma`) o actualizar el proveedor en `prisma/schema.prisma` antes de migrar. Ejemplo:

```bash
npx prisma migrate dev --schema prisma/schema.postgres.prisma
```

4. Genera y migra la base de datos:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Inicia el backend:

```bash
npm run dev
```

El servidor queda disponible en `http://localhost:3000`.

## Configuración del frontend

1. Instala dependencias:

```bash
cd frontend
npm install
```

2. (Opcional) Configura la URL del backend:

Crea un `.env` en `frontend/` con:

```
VITE_API_URL="http://localhost:3000"
```

3. Levanta el frontend:

```bash
npm run dev
```

## Endpoints principales

| Método | Endpoint | Descripción |
| --- | --- | --- |
| POST | `/api/playlist/import` | Descarga una playlist completa desde Spotify o YouTube |
| GET | `/api/songs` | Lista todas las canciones en la biblioteca |
| GET | `/api/songs/:id/stream` | Reproduce el archivo de audio |
| POST | `/api/download/single` | Descarga una canción individual |
| DELETE | `/api/songs/:id` | Elimina una canción y su archivo |

## Guía rápida de importación

1. Asegúrate de tener `FFmpeg` y `yt-dlp` instalados.
2. Configura el `.env` con tu `DATABASE_URL` y credenciales de Spotify.
3. Inicia backend y frontend.
4. Pega una URL de playlist en la UI y presiona **Importar playlist**.
5. Reproduce las canciones desde la sección **Biblioteca**.

## Notas

- Para Spotify se requieren `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET`.
- Las canciones se guardan en `backend/downloads/` en formato `.opus`.
- Ajusta la concurrencia con `DOWNLOAD_CONCURRENCY` si quieres limitar descargas simultáneas.
