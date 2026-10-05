import { useEffect, useRef, useState } from 'react'
import Gravador from './Gravador.jsx'
import Biblioteca from './Biblioteca.jsx'
import { listarGravacoes, salvarGravacao, baixarGravacao, formatarTamanho } from './armazenamento.js'
import './pip.css'

export default function Popup() {
  const [tela, setTela] = useState('gravar')
  const [estado, setEstado] = useState('ocioso') // 'ocioso' | 'contagem' | 'gravando' | 'pausado' | 'pronto'
  const [contagem, setContagem] = useState(3)
  const [arquivo, setArquivo] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [total, setTotal] = useState(0)
  const [segundos, setSegundos] = useState(0)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const micStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const chunksRef = useRef([])
  const tempoInicioRef = useRef(0)
  const tempoPausadoRef = useRef(0)
  const momentoPausaRef = useRef(0)
  const timerContagemRef = useRef(null)
  const pipWindowRef = useRef(null)

  const contar = () => listarGravacoes().then((l) => setTotal(l.length))
  useEffect(() => {
    contar()
  }, [tela, estado])

  // Cronômetro principal
  useEffect(() => {
    if (estado === 'ocioso' || estado === 'contagem') {
      setSegundos(0)
    }
    if (estado !== 'gravando') return

    const t = setInterval(() => {
      setSegundos((s) => s + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [estado])

  // Sincroniza o cronômetro com a mini janela flutuante
  useEffect(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      const pipDoc = pipWindowRef.current.document
      const tempoEl = pipDoc.getElementById('pip-tempo')
      const btnPausa = pipDoc.getElementById('pip-btn-pausa')
      const statusEl = pipDoc.getElementById('pip-status')

      const pad = (n) => String(n).padStart(2, '0')
      const formatado = `${pad(Math.floor(segundos / 60))}:${pad(segundos % 60)}`

      if (tempoEl) tempoEl.textContent = formatado
      if (btnPausa) btnPausa.textContent = estado === 'pausado' ? 'RETOMAR' : 'PAUSAR'
      if (statusEl) statusEl.textContent = estado === 'pausado' ? 'PAUSADO' : 'REC'
    }
  }, [segundos, estado])

  const fecharPip = () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close()
    }
    pipWindowRef.current = null
  }

  const limparStreams = () => {
    fecharPip()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (timerContagemRef.current) {
      clearInterval(timerContagemRef.current)
      timerContagemRef.current = null
    }
  }

  // Mini janela flutuante Always-On-Top
  const abrirMiniPopupFlutuante = async () => {
    if (!('documentPictureInPicture' in window) || pipWindowRef.current) return

    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 260,
        height: 110,
      })
      pipWindowRef.current = pipWin

      // Clona as folhas de estilo do documento principal para a janela flutuante
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        pipWin.document.head.appendChild(node.cloneNode(true))
      })

      pipWin.document.body.innerHTML = `
        <div class="pip-topo">
          <div><span class="pip-ponto"></span><span id="pip-status">REC</span></div>
          <span>KAWWA REC</span>
        </div>
        <div class="pip-tempo" id="pip-tempo">00:00</div>
        <div class="pip-acoes">
          <button class="pip-btn" id="pip-btn-pausa">PAUSAR</button>
          <button class="pip-btn pip-btn--parar" id="pip-btn-parar">PARAR</button>
        </div>
      `

      pipWin.document.getElementById('pip-btn-pausa').onclick = () => {
        if (recorderRef.current?.state === 'recording') pausarGravacao()
        else retomarGravacao()
      }

      pipWin.document.getElementById('pip-btn-parar').onclick = () => {
        pararGravacao()
      }

      pipWin.addEventListener('pagehide', () => {
        pipWindowRef.current = null
      })
    } catch (err) {
      console.warn('Picture-in-Picture não inicializado:', err)
    }
  }

  // Abre o mini controle flutuante automaticamente ao sair da aba
  useEffect(() => {
    const aoMudarVisibilidade = () => {
      if (document.hidden && (estado === 'gravando' || estado === 'pausado')) {
        abrirMiniPopupFlutuante()
      }
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade)
  }, [estado])

  // Mede a duração real do arquivo WebM (que normalmente volta como Infinity)
  const medirDuracaoReal = (blob, fallback) =>
    new Promise((resolve) => {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => {
        if (v.duration === Infinity) {
          v.currentTime = 1e7
          v.ontimeupdate = () => {
            v.ontimeupdate = null
            resolve(Math.round(v.duration))
            v.remove()
          }
        } else {
          resolve(Math.round(v.duration))
          v.remove()
        }
      }
      v.onerror = () => resolve(fallback)
      v.src = URL.createObjectURL(blob)
    })

  const aoFinalizar = async (blob, duracao) => {
    const url = URL.createObjectURL(blob)
    setVideoUrl(url)

    const duracaoReal = await medirDuracaoReal(blob, duracao)
    const salvo = await salvarGravacao(blob, duracaoReal)

    setArquivo({
      id: salvo.id,
      nome: salvo.nome,
      tamanho: formatarTamanho(salvo.tamanho),
      duracao: salvo.duracao,
    })
    setEstado('pronto')
  }

  // 1. Captura a 30 FPS estáveis (evita descarte de quadros e vídeo mais curto que o real)
  const iniciarCaptura = async ({ fonte, audioSistema, microfone }) => {
    try {
      const displaySurface = fonte === 'tela' ? 'monitor' : fonte === 'janela' ? 'window' : 'browser'

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface,
          frameRate: { ideal: 30, max: 30 },
          cursor: 'always',
        },
        audio: audioSistema,
      })

      let finalStream = screenStream
      let micStream = null
      let audioCtx = null

      if (microfone) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          })
          audioCtx = new (window.AudioContext || window.webkitAudioContext)()
          const destination = audioCtx.createMediaStreamDestination()

          if (screenStream.getAudioTracks().length > 0) {
            const sysSource = audioCtx.createMediaStreamSource(screenStream)
            sysSource.connect(destination)
          }

          const micSource = audioCtx.createMediaStreamSource(micStream)
          micSource.connect(destination)

          finalStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...destination.stream.getAudioTracks(),
          ])
        } catch (e) {
          console.warn('Microfone recusado:', e)
        }
      }

      streamRef.current = finalStream
      micStreamRef.current = micStream
      audioContextRef.current = audioCtx
      chunksRef.current = []

      // Se o usuário clicar em "Interromper compartilhamento" na barra nativa
      const videoTrack = screenStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.onended = () => pararGravacao()
      }

      // 2. Contagem regressiva de 3 a 0
      setEstado('contagem')
      setContagem(3)

      let contador = 3
      timerContagemRef.current = setInterval(() => {
        contador -= 1
        if (contador > 0) {
          setContagem(contador)
        } else {
          clearInterval(timerContagemRef.current)
          timerContagemRef.current = null
          setContagem(0)
          dispararGravacao(finalStream)
        }
      }, 1000)
    } catch (err) {
      limparStreams()
      setEstado('ocioso')
    }
  }

  // 3. Gravação com codec leve acelerado por hardware e bitrate seguro
  const dispararGravacao = (stream) => {
    try {
      const codecs = [
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm',
      ]
      const mimeType = codecs.find((c) => MediaRecorder.isTypeSupported(c)) || 'video/webm'

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3_500_000,
      })
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const duracaoTotal = Math.max(
          1,
          Math.round((Date.now() - tempoInicioRef.current - tempoPausadoRef.current) / 1000),
        )
        const blob = new Blob(chunksRef.current, { type: mimeType })
        limparStreams()
        await aoFinalizar(blob, duracaoTotal)
      }

      tempoInicioRef.current = Date.now()
      tempoPausadoRef.current = 0
      momentoPausaRef.current = 0

      // Sem intervalo de tempo: gravação contínua sem micro-engasgos
      recorder.start()
      setEstado('gravando')
    } catch (err) {
      limparStreams()
      setEstado('ocioso')
    }
  }

  const pausarGravacao = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.pause()
      momentoPausaRef.current = Date.now()
      setEstado('pausado')
    }
  }

  const retomarGravacao = () => {
    if (recorderRef.current && recorderRef.current.state === 'paused') {
      recorderRef.current.resume()
      if (momentoPausaRef.current) {
        tempoPausadoRef.current += Date.now() - momentoPausaRef.current
        momentoPausaRef.current = 0
      }
      setEstado('gravando')
    }
  }

  const pararGravacao = () => {
    if (timerContagemRef.current) {
      clearInterval(timerContagemRef.current)
      timerContagemRef.current = null
      limparStreams()
      setEstado('ocioso')
      return
    }

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    } else {
      limparStreams()
      setEstado('ocioso')
    }
  }

  if (tela === 'biblioteca') return <Biblioteca onVoltar={() => setTela('gravar')} />

  return (
    <Gravador
      estado={estado}
      contagem={contagem}
      segundos={segundos}
      arquivo={arquivo}
      videoUrl={videoUrl}
      totalSalvas={total}
      onAbrirMiniPopup={abrirMiniPopupFlutuante}
      onAbrirBiblioteca={() => setTela('biblioteca')}
      onIniciar={iniciarCaptura}
      onCancelarContagem={() => {
        limparStreams()
        setEstado('ocioso')
      }}
      onPausar={pausarGravacao}
      onRetomar={retomarGravacao}
      onParar={pararGravacao}
      onSalvar={() => arquivo && baixarGravacao(arquivo.id)}
      onDescartar={() => {
        if (videoUrl) URL.revokeObjectURL(videoUrl)
        setVideoUrl(null)
        setArquivo(null)
        setEstado('ocioso')
      }}
    />
  )
}
