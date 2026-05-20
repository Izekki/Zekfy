import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Howl } from 'howler'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const logoUrl =
  'https://github.com/user-attachments/assets/d493894a-d6e0-4622-8f5d-4674b92c1a9a'

const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = `${seconds % 60}`.padStart(2, '0')
  return `${mins}:${secs}`
}

function App() {
  const [songs, setSongs] = useState([])
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [singleUrl, setSingleUrl] = useState('')
  const [singleTitle, setSingleTitle] = useState('')
  const [singleArtist, setSingleArtist] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const soundRef = useRef(null)

  const loadSongs = useCallback(async () => {
    const response = await axios.get(`${API_BASE}/api/songs`)
    setSongs(response.data)
  }, [])

  useEffect(() => {
    loadSongs()
  }, [loadSongs])

  const playSong = (songId) => {
    if (soundRef.current) {
      soundRef.current.stop()
    }
    const sound = new Howl({
      src: [`${API_BASE}/api/songs/${songId}/stream`],
      format: ['opus', 'webm'],
    })
    sound.play()
    soundRef.current = sound
  }

  const handleImport = async (event) => {
    event.preventDefault()
    if (!playlistUrl) return
    setLoading(true)
    setMessage('Importando playlist...')
    try {
      const response = await axios.post(`${API_BASE}/api/playlist/import`, {
        url: playlistUrl,
      })
      setMessage(
        `Descargadas: ${response.data.counts.downloaded} | Omitidas: ${response.data.counts.skipped} | Fallidas: ${response.data.counts.failed}`,
      )
      setPlaylistUrl('')
      await loadSongs()
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error al importar la playlist.')
    } finally {
      setLoading(false)
    }
  }

  const handleSingle = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('Descargando canción...')
    try {
      const payload = {
        url: singleUrl || undefined,
        title: singleTitle || undefined,
        artist: singleArtist || undefined,
      }
      const response = await axios.post(`${API_BASE}/api/download/single`, payload)
      if (response.data.status === 'existing') {
        setMessage('La canción ya estaba en la biblioteca.')
      } else {
        setMessage('Canción descargada correctamente.')
      }
      setSingleUrl('')
      setSingleTitle('')
      setSingleArtist('')
      await loadSongs()
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error al descargar la canción.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (songId) => {
    setLoading(true)
    try {
      await axios.delete(`${API_BASE}/api/songs/${songId}`)
      await loadSongs()
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error al eliminar la canción.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col items-center gap-4 text-center">
          <img
            src={logoUrl}
            alt="Zekfy logo"
            className="h-24 w-24 rounded-3xl shadow-xl"
          />
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white">Zekfy</h1>
            <p className="text-base text-slate-300">
              Biblioteca musical personal con descargas locales y reproducción
              offline.
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleImport}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold text-white">Importar playlist</h2>
            <p className="mt-2 text-sm text-slate-300">
              Pega una URL de Spotify o YouTube para descargar todas las
              canciones.
            </p>
            <input
              type="url"
              value={playlistUrl}
              onChange={(event) => setPlaylistUrl(event.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !playlistUrl}
              className="mt-4 w-full rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Importar playlist
            </button>
          </form>

          <form
            onSubmit={handleSingle}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold text-white">
              Descargar canción individual
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Usa una URL de YouTube o el nombre + artista.
            </p>
            <input
              type="url"
              value={singleUrl}
              onChange={(event) => setSingleUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={singleTitle}
                onChange={(event) => setSingleTitle(event.target.value)}
                placeholder="Título"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
              />
              <input
                type="text"
                value={singleArtist}
                onChange={(event) => setSingleArtist(event.target.value)}
                placeholder="Artista"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || (!singleUrl && !singleTitle && !singleArtist)}
              className="mt-4 w-full rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Descargar canción
            </button>
          </form>
        </section>

        {message && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
            {message}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Biblioteca</h2>
            <span className="text-sm text-slate-400">
              {songs.length} canciones
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {songs.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aún no hay canciones descargadas.
              </p>
            ) : (
              songs.map((song) => (
                <div
                  key={song.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {song.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {song.artist} · {formatDuration(song.duration)} · {song.source}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => playSong(song.id)}
                      className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
                    >
                      Reproducir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(song.id)}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-red-400 hover:text-red-300"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
