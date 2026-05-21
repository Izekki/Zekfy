import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { Howl } from 'howler'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const MESSAGE_DISPLAY_DURATION_MS = 5000
const logoUrl =
  'https://github.com/user-attachments/assets/d493894a-d6e0-4622-8f5d-4674b92c1a9a'
const WAVEFORM_BAR_COUNT = 30
const WAVEFORM_MIN_HEIGHT = 14
const WAVEFORM_HEIGHT_STEP = 9
const WAVEFORM_HEIGHT_RANGE = 45

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = `${Math.floor(seconds % 60)}`.padStart(2, '0')
  return `${mins}:${secs}`
}

const getPlaylistSongs = (playlist) =>
  (playlist?.songs || [])
    .map((entry) => entry.song)
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

const waveformBars = Array.from(
  { length: WAVEFORM_BAR_COUNT },
  (_, index) => WAVEFORM_MIN_HEIGHT + ((index * WAVEFORM_HEIGHT_STEP) % WAVEFORM_HEIGHT_RANGE),
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4" />
    <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L13 20" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
)

function App() {
  const [songs, setSongs] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('all')
  const [targetPlaylistId, setTargetPlaylistId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [songUrl, setSongUrl] = useState('')
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftArtist, setDraftArtist] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedResultUrl, setSelectedResultUrl] = useState('')
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentSongId, setCurrentSongId] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const soundRef = useRef(null)
  const messageTimeoutRef = useRef(null)

  const showMessage = useCallback((text) => {
    setMessage(text)
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
    }
    messageTimeoutRef.current = setTimeout(() => setMessage(''), MESSAGE_DISPLAY_DURATION_MS)
  }, [])

  const loadLibrary = useCallback(async () => {
    const [songsResponse, playlistsResponse] = await Promise.all([
      axios.get(`${API_BASE}/api/songs`),
      axios.get(`${API_BASE}/api/playlists`),
    ])
    setSongs(songsResponse.data)
    setPlaylists(playlistsResponse.data)
  }, [])

  useEffect(() => {
    loadLibrary().catch((error) => {
      showMessage(error.response?.data?.error || 'No se pudo cargar la biblioteca.')
    })

    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current)
      }
      if (soundRef.current) {
        soundRef.current.unload()
      }
    }
  }, [loadLibrary, showMessage])

  useEffect(() => {
    if (selectedPlaylistId === 'all') return
    const exists = playlists.some((playlist) => playlist.id === selectedPlaylistId)
    if (!exists) {
      setSelectedPlaylistId('all')
    }
  }, [playlists, selectedPlaylistId])

  useEffect(() => {
    if (selectedPlaylistId !== 'all') {
      setTargetPlaylistId(selectedPlaylistId)
    }
  }, [selectedPlaylistId])

  useEffect(() => {
    const interval = setInterval(() => {
      const sound = soundRef.current
      if (!sound || !sound.playing()) return
      setPlaybackPosition(sound.seek() || 0)
      setPlaybackDuration(sound.duration() || 0)
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId],
  )

  const displayedSongs = useMemo(() => {
    if (selectedPlaylistId === 'all') {
      return [...songs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    return getPlaylistSongs(selectedPlaylist)
  }, [selectedPlaylist, selectedPlaylistId, songs])

  const currentSong = useMemo(
    () => songs.find((song) => song.id === currentSongId) || displayedSongs[0] || null,
    [currentSongId, displayedSongs, songs],
  )

  const sliderMax = playbackDuration || currentSong?.duration || 0

  const selectedResult = useMemo(
    () => searchResults.find((result) => result.url === selectedResultUrl) || null,
    [searchResults, selectedResultUrl],
  )

  const playlistOptions = useMemo(
    () => playlists.filter((playlist) => !playlist.externalUrl),
    [playlists],
  )

  const applyTrackSelection = useCallback((track, nextUrl = '') => {
    setDraftTitle(track?.title || '')
    setDraftArtist(track?.artist || '')
    setSongUrl(nextUrl || track?.url || '')
    setSelectedResultUrl(track?.url || '')
  }, [])

  const playSong = useCallback(
    (songId) => {
      if (!songId) return

      if (soundRef.current && currentSongId === songId) {
        if (soundRef.current.playing()) {
          soundRef.current.pause()
          setIsPlaying(false)
        } else {
          soundRef.current.play()
          setIsPlaying(true)
        }
        return
      }

      if (soundRef.current) {
        soundRef.current.unload()
      }

      const sound = new Howl({
        src: [`${API_BASE}/api/songs/${songId}/stream`],
        format: ['opus', 'webm'],
        html5: true,
        onplay: () => {
          setIsPlaying(true)
          setCurrentSongId(songId)
          setPlaybackDuration(sound.duration() || 0)
        },
        onpause: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false),
        onend: () => setIsPlaying(false),
        onload: () => setPlaybackDuration(sound.duration() || 0),
      })

      sound.play()
      soundRef.current = sound
    },
    [currentSongId],
  )

  const handleSeek = (event) => {
    const nextPosition = Number(event.target.value)
    setPlaybackPosition(nextPosition)
    if (soundRef.current) {
      soundRef.current.seek(nextPosition)
    }
  }

  const handleSkip = (direction) => {
    if (!displayedSongs.length) return
    const currentIndex = displayedSongs.findIndex((song) => song.id === currentSong?.id)
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + displayedSongs.length) % displayedSongs.length
    playSong(displayedSongs[nextIndex].id)
  }

  const handleSearch = async (event) => {
    event.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/api/youtube/search`, {
        query: searchQuery.trim(),
      })
      setSearchResults(response.data.results)
      applyTrackSelection(response.data.results[0])
      showMessage(`Se encontraron ${response.data.results.length} resultados en YouTube.`)
    } catch (error) {
      showMessage(error.response?.data?.error || 'No se pudo buscar en YouTube.')
    } finally {
      setLoading(false)
    }
  }

  const handleResolveUrl = async (event) => {
    event.preventDefault()
    if (!songUrl.trim()) return

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/api/songs/resolve`, {
        url: songUrl.trim(),
      })
      const track = response.data.track
      applyTrackSelection(track, songUrl.trim())
      if (track.url && response.data.source === 'youtube') {
        setSearchResults([track])
      }
      showMessage('Se completaron los datos de la canción.')
    } catch (error) {
      showMessage(error.response?.data?.error || 'No se pudo resolver la URL.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (event) => {
    event.preventDefault()
    if (!songUrl.trim() && !draftTitle.trim() && !draftArtist.trim()) return

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/api/download/single`, {
        url: songUrl.trim() || undefined,
        title: draftTitle.trim() || undefined,
        artist: draftArtist.trim() || undefined,
        sourceId: selectedResult?.sourceId,
        thumbnail: selectedResult?.thumbnail,
        playlistIds: targetPlaylistId ? [targetPlaylistId] : [],
      })

      showMessage(
        response.data.status === 'existing'
          ? 'La canción ya existía y se enlazó a la playlist.'
          : 'Canción descargada correctamente.',
      )
      await loadLibrary()
    } catch (error) {
      showMessage(error.response?.data?.error || 'No se pudo descargar la canción.')
    } finally {
      setLoading(false)
    }
  }

  const handleImportPlaylist = async (event) => {
    event.preventDefault()
    if (!playlistUrl.trim()) return

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/api/playlist/import`, {
        url: playlistUrl.trim(),
      })
      showMessage(
        `Importadas ${response.data.counts.downloaded} canciones, ${response.data.counts.skipped} omitidas y ${response.data.counts.failed} fallidas.`,
      )
      setPlaylistUrl('')
      await loadLibrary()
    } catch (error) {
      showMessage(error.response?.data?.error || 'No se pudo importar la playlist.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlaylist = async (event) => {
    event.preventDefault()
    if (!newPlaylistName.trim()) return

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/api/playlists`, {
        name: newPlaylistName.trim(),
      })
      setNewPlaylistName('')
      setSelectedPlaylistId(response.data.id)
      setTargetPlaylistId(response.data.id)
      await loadLibrary()
      showMessage('Playlist creada correctamente.')
    } catch (error) {
      showMessage(error.response?.data?.error || 'No se pudo crear la playlist.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSongToPlaylist = async (songId) => {
    if (!targetPlaylistId) {
      showMessage('Selecciona una playlist propia para agregar la canción.')
      return
    }

    setLoading(true)
    try {
      await axios.post(`${API_BASE}/api/playlists/${targetPlaylistId}/songs`, {
        songId,
      })
      await loadLibrary()
      showMessage('Canción agregada a la playlist.')
    } catch (error) {
      showMessage(error.response?.data?.error || 'No se pudo agregar la canción.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSong = async (songId) => {
    setLoading(true)
    try {
      await axios.delete(`${API_BASE}/api/songs/${songId}`)
      if (currentSongId === songId && soundRef.current) {
        soundRef.current.stop()
        setCurrentSongId('')
        setPlaybackPosition(0)
        setPlaybackDuration(0)
      }
      await loadLibrary()
      showMessage('Canción eliminada de la biblioteca.')
    } catch (error) {
      showMessage(error.response?.data?.error || 'No se pudo eliminar la canción.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] px-4 py-4 text-slate-100 lg:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] flex-col overflow-hidden rounded-[32px] border border-indigo-500/20 bg-[#070b1f] shadow-[0_0_70px_rgba(72,87,255,0.18)]">
        <header className="grid gap-4 border-b border-white/10 px-5 py-5 lg:grid-cols-[320px_1fr_560px] lg:items-center">
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt="Zekfy logo" className="h-20 w-20 rounded-3xl object-cover shadow-2xl" />
            <div>
              <p className="text-4xl font-semibold tracking-tight text-white">Zekfy</p>
              <p className="text-2xl text-indigo-300">Aurora edition · Tu música, tu mundo.</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-slate-300">
              <SearchIcon />
            </span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar canciones, artistas, álbumes..."
              className="w-full bg-transparent text-lg text-white outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Buscar
            </button>
          </form>

          <form onSubmit={handleResolveUrl} className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <p className="text-xl text-indigo-200">o ingresa una URL</p>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-slate-300">
                <LinkIcon />
              </span>
              <input
                value={songUrl}
                onChange={(event) => setSongUrl(event.target.value)}
                placeholder="https://example.com/song"
                className="w-full bg-transparent text-lg text-white outline-none placeholder:text-slate-400"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !songUrl.trim()}
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:border-indigo-300 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowIcon />
            </button>
          </form>
        </header>

        {message ? (
          <div className="border-b border-white/10 bg-indigo-500/10 px-5 py-3 text-sm text-indigo-100">
            {message}
          </div>
        ) : null}

        <div className="grid flex-1 gap-0 lg:grid-cols-[340px_1fr_360px]">
          <aside className="border-r border-white/10 bg-[radial-gradient(circle_at_top,#111836,transparent_55%)]">
            <div className="flex items-center justify-between px-5 py-5">
              <p className="text-3xl font-medium tracking-wide text-slate-200">PLAYLISTS</p>
              <button
                type="button"
                className="rounded-xl border border-white/10 p-2 text-slate-200 hover:border-indigo-300 hover:text-indigo-200"
                onClick={() => setSelectedPlaylistId('all')}
              >
                <PlusIcon />
              </button>
            </div>

            <div className="space-y-3 px-4 pb-6">
              <button
                type="button"
                onClick={() => setSelectedPlaylistId('all')}
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  selectedPlaylistId === 'all'
                    ? 'border-indigo-300/30 bg-indigo-400/15'
                    : 'border-white/5 bg-white/[0.03] hover:border-indigo-300/20'
                }`}
              >
                <p className="text-2xl font-semibold text-white">Biblioteca</p>
                <p className="mt-1 text-lg text-slate-300">{songs.length} canciones</p>
              </button>

              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => setSelectedPlaylistId(playlist.id)}
                  className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                    selectedPlaylistId === playlist.id
                      ? 'border-indigo-300/30 bg-indigo-400/15'
                      : 'border-white/5 bg-white/[0.03] hover:border-indigo-300/20'
                  }`}
                >
                  <p className="truncate text-2xl font-semibold text-white">{playlist.name}</p>
                  <p className="mt-1 text-lg text-slate-300">{playlist.songCount} canciones</p>
                  <p className="mt-2 text-sm uppercase tracking-[0.3em] text-slate-500">
                    {playlist.externalUrl ? 'Importada' : 'Propia'}
                  </p>
                </button>
              ))}
            </div>

            <div className="border-t border-white/10 px-5 py-5">
              <form onSubmit={handleCreatePlaylist} className="space-y-3">
                <p className="text-2xl font-medium text-indigo-200">Nueva playlist</p>
                <input
                  value={newPlaylistName}
                  onChange={(event) => setNewPlaylistName(event.target.value)}
                  placeholder="Ej. Noches de estudio"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg text-white outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={loading || !newPlaylistName.trim()}
                  className="w-full rounded-2xl bg-indigo-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Crear playlist
                </button>
              </form>
            </div>

            <div className="border-t border-white/10 px-5 py-5">
              <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <img
                  src={currentSong?.thumbnail || logoUrl}
                  alt={currentSong?.title || 'Canción actual'}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-white">
                    {currentSong?.title || 'Selecciona una canción'}
                  </p>
                  <p className="truncate text-lg text-slate-300">
                    {currentSong?.artist || 'Zekfy'}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <main className="border-r border-white/10 bg-[radial-gradient(circle_at_top,#17204a_0%,#0c1129_45%,#060915_100%)]">
            <section className="border-b border-white/10 px-6 py-6">
              <div className="rounded-[36px] border border-white/10 bg-black/10 p-6 shadow-[inset_0_0_80px_rgba(91,104,255,0.16)]">
                <div className="flex flex-col items-center gap-6 text-center">
                  <img
                    src={currentSong?.thumbnail || logoUrl}
                    alt={currentSong?.title || 'Portada'}
                    className="h-[360px] w-full max-w-[520px] rounded-[40px] object-cover shadow-2xl"
                  />
                  <div>
                    <p className="text-6xl font-semibold tracking-tight text-white">
                      {currentSong?.title || 'Sueños Lejanos'}
                    </p>
                    <p className="mt-2 text-4xl text-indigo-300">
                      {currentSong?.artist || 'Selecciona una canción'}
                    </p>
                  </div>

                  <div className="flex h-16 items-end gap-2">
                    {waveformBars.map((height, index) => (
                      <span
                        key={height + index}
                        className="w-2 rounded-full bg-indigo-400/80"
                        style={{ height }}
                      />
                    ))}
                  </div>

                  <div className="w-full max-w-[720px]">
                    <input
                      type="range"
                      min="0"
                      max={sliderMax}
                      step="1"
                      value={Math.min(playbackPosition, sliderMax)}
                      onChange={handleSeek}
                      className="player-range h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
                    />
                    <div className="mt-2 flex justify-between text-lg text-slate-300">
                      <span>{formatDuration(playbackPosition)}</span>
                      <span>{formatDuration(playbackDuration || currentSong?.duration || 0)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <button
                      type="button"
                      onClick={() => handleSkip(-1)}
                      className="rounded-full border border-white/10 px-5 py-4 text-3xl text-white transition hover:border-indigo-300 hover:text-indigo-200"
                    >
                      ⏮
                    </button>
                    <button
                      type="button"
                      onClick={() => currentSong && playSong(currentSong.id)}
                      className="flex h-28 w-28 items-center justify-center rounded-full border border-indigo-300/40 bg-indigo-500/10 text-5xl text-white shadow-[0_0_35px_rgba(106,119,255,0.35)] transition hover:bg-indigo-500/20"
                    >
                      {isPlaying && currentSong ? '⏸' : '▶'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSkip(1)}
                      className="rounded-full border border-white/10 px-5 py-4 text-3xl text-white transition hover:border-indigo-300 hover:text-indigo-200"
                    >
                      ⏭
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-3xl font-semibold text-white">
                    {selectedPlaylist?.name || 'Biblioteca completa'}
                  </p>
                  <p className="text-lg text-slate-300">
                    {displayedSongs.length} canciones disponibles
                  </p>
                </div>
                <select
                  value={targetPlaylistId}
                  onChange={(event) => setTargetPlaylistId(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="">Descarga sin playlist</option>
                  {playlistOptions.map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>
                      {playlist.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {displayedSongs.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-8 text-center text-lg text-slate-300">
                    No hay canciones en esta vista todavía.
                  </div>
                ) : (
                  displayedSongs.map((song) => {
                    const belongsToTarget = targetPlaylistId
                      ? song.playlists?.some((entry) => entry.playlistId === targetPlaylistId)
                      : false

                    return (
                      <div
                        key={song.id}
                        className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 lg:grid-cols-[72px_1fr_auto] lg:items-center"
                      >
                        <img
                          src={song.thumbnail || logoUrl}
                          alt={song.title}
                          className="h-[72px] w-[72px] rounded-2xl object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-2xl font-semibold text-white">{song.title}</p>
                          <p className="truncate text-lg text-slate-300">
                            {song.artist} · {formatDuration(song.duration)} · {song.source}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => playSong(song.id)}
                            className="rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
                          >
                            {currentSongId === song.id && isPlaying ? 'Pausar' : 'Reproducir'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSongToPlaylist(song.id)}
                            disabled={!targetPlaylistId || belongsToTarget}
                            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-indigo-300 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {belongsToTarget ? 'En playlist' : 'Agregar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSong(song.id)}
                            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-red-300 hover:text-red-200"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </main>

          <aside className="bg-[radial-gradient(circle_at_top,#111836,transparent_55%)] px-5 py-5">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-3xl font-semibold text-white">Resultados</p>
              <p className="mt-2 text-lg text-slate-300">
                Elige una coincidencia para completar autor y nombre automáticamente.
              </p>
              <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {searchResults.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-base text-slate-400">
                    Busca por nombre o pega una URL para ver resultados aquí.
                  </p>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.url}
                      type="button"
                      onClick={() => applyTrackSelection(result)}
                      className={`grid w-full grid-cols-[72px_1fr] gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        selectedResultUrl === result.url
                          ? 'border-indigo-300/40 bg-indigo-400/15'
                          : 'border-white/10 bg-white/[0.02] hover:border-indigo-300/20'
                      }`}
                    >
                      <img
                        src={result.thumbnail || logoUrl}
                        alt={result.title}
                        className="h-[72px] w-[72px] rounded-2xl object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-white">{result.title}</p>
                        <p className="truncate text-sm text-slate-300">{result.artist}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                          {formatDuration(result.duration)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={handleDownload} className="mt-5 space-y-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <div>
                <p className="text-3xl font-semibold text-white">Descarga rápida</p>
                <p className="mt-2 text-lg text-slate-300">
                  Puedes descargar por URL o con el resultado seleccionado.
                </p>
              </div>

              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="Nombre de la canción"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none placeholder:text-slate-400"
              />
              <input
                value={draftArtist}
                onChange={(event) => setDraftArtist(event.target.value)}
                placeholder="Autor o artista"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none placeholder:text-slate-400"
              />
              <select
                value={targetPlaylistId}
                onChange={(event) => setTargetPlaylistId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none"
              >
                <option value="">Guardar solo en biblioteca</option>
                {playlistOptions.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={loading || (!songUrl.trim() && !draftTitle.trim() && !draftArtist.trim())}
                className="w-full rounded-2xl bg-indigo-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Descargar canción
              </button>
            </form>

            <form onSubmit={handleImportPlaylist} className="mt-5 space-y-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <div>
                <p className="text-3xl font-semibold text-white">Importar playlist</p>
                <p className="mt-2 text-lg text-slate-300">
                  Soporta playlists completas de Spotify o YouTube.
                </p>
              </div>
              <input
                value={playlistUrl}
                onChange={(event) => setPlaylistUrl(event.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={loading || !playlistUrl.trim()}
                className="w-full rounded-2xl border border-indigo-300/30 bg-indigo-500/10 px-4 py-3 text-base font-semibold text-indigo-100 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Importar desde URL
              </button>
            </form>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default App
