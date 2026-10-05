chrome.action.onClicked.addListener(async () => {

  const windows = await chrome.windows.getAll({ populate: true })
  const jaAberta = windows.find((w) =>
    w.tabs?.some((t) => t.url?.includes('index.html'))
  )

  if (jaAberta) {
    chrome.windows.update(jaAberta.id, { focused: true })
    return
  }

  chrome.windows.create({
    url: 'index.html',
    type: 'popup',
    width: 380,
    height: 540,
    top: 60,
    left: 60,
    focused: true,
  })
})
