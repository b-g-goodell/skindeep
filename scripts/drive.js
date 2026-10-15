'use strict'
// Dev driver: launch the app under Playwright's Electron driver so a test can
// type as a user would and capture the window. Run under xvfb-run.
const { _electron } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const os = require('os')

const root = path.join(__dirname, '..')

// Each launch gets a state dir of its own unless the caller names one,
// so the last skin one check records never steers the next launch
// (decision 0022). No session bus: a file dialog would otherwise go
// through the desktop's portal to the user's display, not Xvfb. No
// sound: a skin's sounds (decision 0024) would otherwise reach the
// user's speakers, so Chromium mutes all output and has no sound server.
async function launch (cmd, opts = {}) {
  const given = opts.env && opts.env.XDG_STATE_HOME
  const state = given || fs.mkdtempSync(path.join(os.tmpdir(), 'skinned-drive-'))
  const env = Object.assign({}, process.env, opts.env || {}, { XDG_STATE_HOME: state, PULSE_SERVER: 'unix:/nonexistent' })
  delete env.DBUS_SESSION_BUS_ADDRESS
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: ['--no-sandbox', '--mute-audio', ...(opts.require ? ['-r', opts.require] : []), root, ...(opts.appArgs || []), '--', ...cmd],
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

// Open the File menu by its button (decision 0022).
async function openMenu (win) {
  await win.locator('#menu-button').click()
  await sleep(400)
}

async function shot (win, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await win.screenshot({ path: file })
  return file
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = { launch, probe, childPid, openMenu, shot, sleep }
