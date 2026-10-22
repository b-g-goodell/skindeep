'use strict'
// Dev driver: launch the app under Playwright's Electron driver so a test can
// type as a user would and capture the window. Run under xvfb-run.
const { _electron } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawnSync } = require('child_process')

const root = path.join(__dirname, '..')

// Chromium's sandbox, as bin/skinned probes it (decision 0001), once per
// process. Where it cannot start, a check runs only with
// SKINNED_UNSAFE_NO_SANDBOX=1, which launches Electron with --no-sandbox.
let sandboxOk = false
function checkSandbox () {
  if (sandboxOk) return
  const electron = require('electron')
  const r = spawnSync('sh', ['-c', '. "$1" && sandbox_starts "$2"', 'sh', path.join(root, 'scripts', 'sandbox.sh'), electron])
  if (r.status !== 0) throw new Error(`Chromium's sandbox does not start for ${electron}: run install.sh once, or set SKINNED_UNSAFE_NO_SANDBOX=1 to run without it`)
  sandboxOk = true
}

// opts.root: an app tree other than this checkout. Each launch gets a
// state dir of its own unless the caller names one,
// so the last skin one check records never steers the next launch
// (decision 0022). No session bus: a file dialog would otherwise go
// through the desktop's portal to the user's display, not Xvfb. No
// sound: a skin's sounds (decision 0024) would otherwise reach the
// user's speakers, so Chromium mutes all output and has no sound server.
async function launch (cmd, opts = {}) {
  const unsafe = process.env.SKINNED_UNSAFE_NO_SANDBOX === '1'
  if (!unsafe) checkSandbox()
  const given = opts.env && opts.env.XDG_STATE_HOME
  const state = given || fs.mkdtempSync(path.join(os.tmpdir(), 'skinned-drive-'))
  const env = Object.assign({}, process.env, opts.env || {}, { XDG_STATE_HOME: state, PULSE_SERVER: 'unix:/nonexistent' })
  delete env.DBUS_SESSION_BUS_ADDRESS
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [...(unsafe ? ['--no-sandbox'] : []), '--mute-audio', ...(opts.require ? ['-r', opts.require] : []), opts.root || root, ...(opts.appArgs || []), '--', ...cmd],
    cwd: opts.cwd || root,
    env
  })
  if (!given) app.on('close', () => fs.rmSync(state, { recursive: true, force: true }))
  const win = await app.firstWindow()
  const pids = { electron: app.process().pid }
  return { app, win, pids }
}

// The app's one probe: { childPid, following, snapshot }. following is
// the agent's report (decision 0021), snapshot the bus.
async function probe (app) {
  return app.evaluate(() => global.skinnedProbe())
}

async function childPid (app) {
  return (await probe(app)).childPid
}

// Open a menu, File, Agents, Skins or Visualization, by the skin's
// button and the bar's title (decision 0022). The drop-down opens on File.
async function openMenu (win, name = 'File') {
  await win.locator('#menu-button').click()
  await sleep(400)
  if (name === 'File') return
  await win.locator('#menu .bar .title', { hasText: name }).click()
  await sleep(300)
}

async function shot (win, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await win.screenshot({ path: file })
  return file
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = { launch, probe, childPid, openMenu, shot, sleep }
