import { useCallback, useEffect, useState } from 'react'
import {
  listarGravacoes,
  baixarGravacao,
  excluirGravacao,
  formatarTamanho,
  obterGravacao,
} from './armazenamento.js'
import './granulado.css'
import './biblioteca.css'

const pad = (n) => String(n).padStart(2, '0')
const formatarDuracao = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
const formatarData = (t) =>
  new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function Biblioteca({ onVoltar }) {
  const [itens, setItens] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [videoModal, setVideoModal] = useState(null) // { url, nome }

  const carregar = useCallback(() => listarGravacoes().then(setItens), [])
  useEffect(() => { carregar() }, [carregar])

  const reproduzir = async (id, nome) => {
    const item = await obterGravacao(id)
    if (!item?.blob) return
    const url = URL.createObjectURL(item.blob)
    setVideoModal({ url, nome })
  }

  const fecharModal = () => {
    if (videoModal?.url) URL.revokeObjectURL(videoModal.url)
    setVideoModal(null)
  }

  const baixarTodas = async () => {
    for (const g of itens) await baixarGravacao(g.id, { saveAs: false })
  }

  const confirmarExclusao = async (id) => {
    await excluirGravacao(id)
    setExcluindo(null)
    carregar()
  }

  const total = itens?.reduce((soma, g) => soma + g.tamanho, 0) ?? 0

  return (
    <main className="bib fundo-granulado">
      <header className="bib-topo">
        {onVoltar && (
          <button className="bib-voltar" onClick={onVoltar} aria-label="Voltar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <h1 className="bib-titulo">GRAVAÇÕES</h1>
      </header>

      {/* Modal de visualização */}
      {videoModal && (
        <div className="bib-modal">
          <div className="bib-modal-corpo">
            <div className="bib-modal-topo">
              <span className="bib-modal-titulo">{videoModal.nome}</span>
              <button className="bib-modal-fechar" onClick={fecharModal}>✕</button>
            </div>
            <video src={videoModal.url} controls autoPlay className="bib-video-player" />
          </div>
        </div>
      )}

      {itens === null && <p className="bib-vazio">Carregando…</p>}

      {itens?.length === 0 && (
        <p className="bib-vazio">
          Nenhuma gravação salva ainda. Grave algo e ele aparece aqui, pronto para assistir ou baixar.
        </p>
      )}

      {itens?.length > 0 && (
        <>
          <div className="bib-resumo">
            <span>{itens.length} {itens.length === 1 ? 'vídeo' : 'vídeos'} · {formatarTamanho(total)}</span>
            <button className="bib-link" onClick={baixarTodas}>Baixar todos</button>
          </div>

          <ul className="bib-lista">
            {itens.map((g) => (
              <li key={g.id} className="bib-item">
                <div className="bib-dados">
                  <span className="bib-nome">{g.nome}</span>
                  <span className="bib-meta">
                    {formatarData(g.data)} · {formatarDuracao(g.duracao)} · {formatarTamanho(g.tamanho)}
                  </span>
                </div>

                {excluindo === g.id ? (
                  <div className="bib-confirma">
                    <button className="bib-btn bib-btn--perigo" onClick={() => confirmarExclusao(g.id)}>
                      Excluir
                    </button>
                    <button className="bib-btn" onClick={() => setExcluindo(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div className="bib-acoes">
                    <button className="bib-btn bib-btn--assistir" onClick={() => reproduzir(g.id, g.nome)}>
                      Assistir
                    </button>
                    <button className="bib-btn bib-btn--baixar" onClick={() => baixarGravacao(g.id)}>
                      Baixar
                    </button>
                    <button className="bib-lixo" onClick={() => setExcluindo(g.id)} aria-label="Excluir">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}

export default Biblioteca
