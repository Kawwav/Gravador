// Guarda os vídeos no IndexedDB da extensão (aguenta arquivos grandes, ao contrário do chrome.storage).
const BANCO = 'kawwa-rec'
const TABELA = 'gravacoes'

const abrir = () =>
  new Promise((ok, erro) => {
    const req = indexedDB.open(BANCO, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(TABELA, { keyPath: 'id' })
    req.onsuccess = () => ok(req.result)
    req.onerror = () => erro(req.error)
  })

const executar = async (modo, fn) => {
  const db = await abrir()
  return new Promise((ok, erro) => {
    const tx = db.transaction(TABELA, modo)
    const req = fn(tx.objectStore(TABELA))
    tx.oncomplete = () => ok(req?.result)
    tx.onerror = () => erro(tx.error)
  })
}

/** Salva o Blob da gravação e devolve o registro (sem o blob) */
export async function salvarGravacao(blob, duracao) {
  const data = new Date()
  const id = crypto.randomUUID()
  const nome = `gravacao-${data.toISOString().slice(0, 19).replace(/[T:]/g, '-')}.webm`
  await executar('readwrite', (s) => s.put({ id, nome, data: data.getTime(), duracao, tamanho: blob.size, blob }))
  return { id, nome, data: data.getTime(), duracao, tamanho: blob.size }
}

/** Lista só os metadados, do mais novo para o mais antigo */
export async function listarGravacoes() {
  const todas = (await executar('readonly', (s) => s.getAll())) ?? []
  return todas
    .map(({ blob, ...meta }) => meta)
    .sort((a, b) => b.data - a.data)
}

export async function excluirGravacao(id) {
  await executar('readwrite', (s) => s.delete(id))
}

/** Baixa uma gravação. saveAs abre a janela "Salvar como" do Chrome (precisa da permissão "downloads") */
export async function baixarGravacao(id, { saveAs = true } = {}) {
  const item = await executar('readonly', (s) => s.get(id))
  if (!item) return
  const url = URL.createObjectURL(item.blob)

  if (globalThis.chrome?.downloads) {
    chrome.downloads.download({ url, filename: item.nome, saveAs }, () =>
      setTimeout(() => URL.revokeObjectURL(url), 60_000),
    )
  } else {
    const a = Object.assign(document.createElement('a'), { href: url, download: item.nome })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

export const formatarTamanho = (b) =>
  b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`


export async function obterGravacao(id) {
  return await executar('readonly', (s) => s.get(id))
}
