'use strict'
// Phase 1 live check. Run: scripts/clean-env xvfb-run -a -s "-screen 0 1400x900x24" node scripts/checks/p1.js OUTDIR
// A fake xdg-open on PATH records link opens, so no browser starts.
const { launch, childPid, shot, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const out = path.resolve(process.argv[2])
fs.mkdirSync(out, { recursive: true })
const fakeBin = path.join(out, 'bin')
fs.mkdirSync(fakeBin, { recursive: true })
fs.writeFileSync(path.join(fakeBin, 'xdg-open'), `#!/bin/sh\necho "$@" >> ${out}/xdg-open.txt\n`, { mode: 0o755 })
const env = { PATH: fakeBin + ':' + process.env.PATH, SKINNED_GL: 'swiftshader' }

async function typeLine (win, text) {
  await win.keyboard.type(text)
  await win.keyboard.press('Enter')
  await sleep(400)
}

async function bashPart () {
  const { app, win } = await launch(['bash', '--norc', '--noprofile', '-i'], { env })
  await sleep(1500)
  const pid = await childPid(app)
  const title = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => !w.getTitle().startsWith('visualization')).getTitle())
  const menu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu() === null)
  console.log('bash pid', pid, 'title', JSON.stringify(title), 'menu null', menu)
  await typeLine(win, 'PS1="$ "; clear')
  await typeLine(win, "printf '\\e[38;2;255;80;0mtruecolor\\e[0m wide:\\xe4\\xb8\\xad\\xe6\\x96\\x87| emoji:\\xf0\\x9f\\x99\\x82|\\n'")
  await typeLine(win, 'stty size')
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => !w.getTitle().startsWith('visualization')).setSize(820, 520))
  await sleep(800)
  await typeLine(win, 'stty size')
  await app.evaluate(({ clipboard }) => clipboard.writeText('echo pasted-ok'))
  await win.keyboard.press('Control+Shift+V')
  await sleep(300)
  await win.keyboard.press('Enter')
  await sleep(400)
  // Bracketed paste and Esc as the CLI sees them.
  await typeLine(win, "printf '\\e[?2004h'; stty -icanon -echo -iexten; head -c 40 | od -c | head -3; stty sane; printf '\\e[?2004l'")
  await app.evaluate(({ clipboard }) => clipboard.writeText('PASTE'))
  await win.keyboard.press('Control+Shift+V')
  await sleep(200)
  await win.keyboard.press('Escape')
  await win.keyboard.press('Control+v')
  await win.keyboard.type('xxxxxxxxxxxxxxxxxxxxxxxx')
  await sleep(800)
  await typeLine(win, 'sleep 100')
  await win.keyboard.press('Control+c')
  await sleep(300)
  await typeLine(win, 'echo after-ctrl-c status $?')
  await typeLine(win, "printf '\\e]8;;https://example.org/osc8\\e\\\\osc8-link\\e]8;;\\e\\\\ plain https://example.org/plain\\n'")
  await sleep(300)
  await shot(win, path.join(out, 'bash.png'))
  // Ctrl+click both links: find their cells through the page's probe.
  const cells = await win.evaluate(() => {
    const p = window.skinnedPage().panes.find(x => x.shown)
    const screen = document.querySelector('#term .pane.active .xterm-screen').getBoundingClientRect()
    const cw = screen.width / p.cols
    const ch = screen.height / p.rows
    for (let y = p.lines.length - 1; y >= 0; y--) {
      const line = p.lines[y]
      const i = line.indexOf('osc8-link plain')
      if (i >= 0 && !line.includes('printf')) {
        const row = y - p.viewportY
        const at = col => ({ x: screen.x + (col + 0.5) * cw, y: screen.y + (row + 0.5) * ch })
        return { osc8: at(i + 2), plain: at(line.indexOf('https://example.org/plain') + 5) }
      }
    }
    return null
  })
  console.log('link cells', JSON.stringify(cells))
  if (cells) {
    for (const c of [cells.osc8, cells.plain]) {
      await win.mouse.move(c.x, c.y)
      await sleep(300)
      await win.mouse.click(c.x, c.y)
      await sleep(300)
      await win.keyboard.down('Control')
      await win.mouse.move(c.x + 1, c.y)
      await sleep(300)
      await win.mouse.click(c.x + 1, c.y)
      await win.keyboard.up('Control')
      await sleep(500)
    }
  }
  console.log('xdg-open calls', fs.existsSync(path.join(out, 'xdg-open.txt')) ? JSON.stringify(fs.readFileSync(path.join(out, 'xdg-open.txt'), 'utf8')) : 'none')
  // Mouse reporting reaches the CLI.
  const box = await win.evaluate(() => {
    const t = document.querySelector('#term .pane.active .xterm-screen').getBoundingClientRect()
    return { x: t.x, y: t.y }
  })
  await typeLine(win, "printf '\\e[?1000h'; stty -icanon -echo; head -c 6 | od -c | head -1; stty sane; printf '\\e[?1000l'")
  await win.mouse.click(box.x + 100, box.y + 100)
  await sleep(600)
  await shot(win, path.join(out, 'bash-mouse.png'))
  try { execFileSync('import', ['-window', 'root', path.join(out, 'root.png')]) } catch (e) { console.log('import failed', e.message) }
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => !w.getTitle().startsWith('visualization')).close())
  await sleep(2500)
  let alive = true
  try { process.kill(pid, 0) } catch (e) { alive = false }
  console.log('bash alive after close', alive)
}

async function claudePart () {
  const { app, win } = await launch(['claude', '--permission-mode', 'default'],
    { env })
  await sleep(9000)
  const pid = await childPid(app)
  console.log('claude pid', pid)
  await shot(win, path.join(out, 'claude-banner.png'))
  await typeLine(win, 'Reply with the single word pong and nothing else.')
  await sleep(25000)
  await shot(win, path.join(out, 'claude-reply.png'))
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => !w.getTitle().startsWith('visualization')).setSize(900, 560))
  await sleep(1500)
  await shot(win, path.join(out, 'claude-resized.png'))
  await win.keyboard.press('Control+c')
  await sleep(500)
  await shot(win, path.join(out, 'claude-ctrl-c.png'))
  let alive = true
  try { process.kill(pid, 0) } catch (e) { alive = false }
  console.log('claude alive after one Ctrl-C', alive)
  try { process.kill(-pid, 'SIGHUP') } catch (e) { console.log('kill', e.code) }
  await sleep(3000)
  await app.close().catch(() => {})
}

;(async () => {
  const which = process.argv[3] || 'all'
  if (which !== 'claude') await bashPart()
  if (which !== 'bash') await claudePart()
  console.log('done')
})().catch(e => { console.error(e); process.exit(1) })
