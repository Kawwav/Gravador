import { useState } from 'react'
import './granulado.css'
import './gravador.css'

const FONTES = [
  { id: 'tela', nome: 'Tela inteira' },
  { id: 'janela', nome: 'Janela' },
  { id: 'aba', nome: 'Aba' },
]

const pad = (n) => String(n).padStart(2, '0')
const formatar = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`

function Gravador({
  estado = 'ocioso',
  contagem = 3,
  segundos = 0,
  arquivo = null,
  videoUrl = null,
  onIniciar = () => {},
  onCancelarContagem = () => {},
  onPausar = () => {},
  onRetomar = () => {},
  onParar = () => {},
  onSalvar = () => {},
  onDescartar = () => {},
  onAbrirMiniPopup = () => {},
  totalSalvas = 0,
  onAbrirBiblioteca = () => {},
}) {
  const [fonte, setFonte] = useState('tela')
  const [audioSistema, setAudioSistema] = useState(true)
  const [microfone, setMicrofone] = useState(false)

  const ativo = estado === 'gravando' || estado === 'pausado'

  return (
    <main className={`grv grv--${estado} fundo-granulado`}>
      <header className="grv-topo">
        <span className="grv-marca">KAWWA REC</span>
        <span className="grv-status">
          <i className="grv-ponto" />
          {estado === 'contagem' && 'Iniciando…'}
          {estado === 'gravando' && 'Gravando'}
          {estado === 'pausado' && 'Pausado'}
          {estado === 'ocioso' && 'Pronto'}
          {estado === 'pronto' && 'Finalizado'}
        </span>
      </header>

      {(estado === 'ocioso' || estado === 'pronto') && (
        <button className="grv-biblioteca" onClick={onAbrirBiblioteca}>
          <span>Minhas gravações</span>
          <b>{totalSalvas}</b>
        </button>
      )}

      {/* Configuração inicial */}
      {estado === 'ocioso' && (
        <>
          <h1 className="grv-titulo">
            <span>O QUE</span>
            <span>GRAVAR?</span>
          </h1>

          <div className="grv-fontes" role="radiogroup" aria-label="Fonte da gravação">
            {FONTES.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={fonte === f.id}
                className={`grv-fonte ${fonte === f.id ? 'ativa' : ''}`}
                onClick={() => setFonte(f.id)}
              >
                {f.nome}
              </button>
            ))}
          </div>

          <div className="grv-opcoes">
            <label className="grv-opcao">
              <input
                type="checkbox"
                checked={audioSistema}
                onChange={(e) => setAudioSistema(e.target.checked)}
              />
              <span className="grv-chave" />
              Áudio do sistema
            </label>
            <label className="grv-opcao">
              <input
                type="checkbox"
                checked={microfone}
                onChange={(e) => setMicrofone(e.target.checked)}
              />
              <span className="grv-chave" />
              Microfone
            </label>
          </div>

          <button
            className="grv-btn grv-btn--principal"
            onClick={() => onIniciar({ fonte, audioSistema, microfone })}
          >
            Iniciar gravação
          </button>
        </>
      )}

      {/* Contagem regressiva 3 a 0 */}
      {estado === 'contagem' && (
        <div className="grv-contagem-box">
          <h1 className="grv-titulo">
            <span>PREPARE-SE</span>
            <span>EM...</span>
          </h1>
          <div className="grv-contagem-num" key={contagem}>
            {contagem > 0 ? contagem : 'REC'}
          </div>
          <button className="grv-btn grv-btn--texto" onClick={onCancelarContagem}>
            Cancelar
          </button>
        </div>
      )}

      {/* Gravação ativa */}
      {ativo && (
        <>
          <div className="grv-tempo" aria-live="off">
            {formatar(segundos)}
          </div>
          <p className="grv-info">
            {FONTES.find((f) => f.id === fonte)?.nome}
            {audioSistema ? ', com áudio' : ', sem áudio'}
            {microfone ? ', mic ligado' : ''}
          </p>

          <button className="grv-btn-pip" onClick={onAbrirMiniPopup} title="Abrir pop flutuante">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <rect x="11" y="9" width="9" height="6" fill="currentColor" opacity="0.3" />
            </svg>
            Mini controle flutuante
          </button>

          <div className="grv-acoes">
            {estado === 'gravando' ? (
              <button className="grv-btn" onClick={onPausar}>
                Pausar
              </button>
            ) : (
              <button className="grv-btn" onClick={onRetomar}>
                Retomar
              </button>
            )}
            <button className="grv-btn grv-btn--principal" onClick={onParar}>
              Parar
            </button>
          </div>
        </>
      )}

      {/* Visualizar e Salvar vídeo */}
      {estado === 'pronto' && (
        <>
          <h1 className="grv-titulo">
            <span>ASSISTA E</span>
            <span>SALVE</span>
          </h1>

          {videoUrl && (
            <div className="grv-player-container">
              <video
                src={videoUrl}
                controls
                playsInline
                className="grv-video"
              />
            </div>
          )}

          <div className="grv-arquivo">
            <span className="grv-arquivo-nome">{arquivo?.nome ?? 'gravacao.webm'}</span>
            <span className="grv-arquivo-info">
              {formatar(arquivo?.duracao ?? segundos)} {arquivo?.tamanho ? `· ${arquivo.tamanho}` : ''}
            </span>
          </div>

          <button className="grv-btn grv-btn--principal" onClick={onSalvar}>
            Salvar no Computador
          </button>
          <button className="grv-btn grv-btn--texto" onClick={onDescartar}>
            Gravar de novo
          </button>
        </>
      )}
    </main>
  )
}

export default Gravador
