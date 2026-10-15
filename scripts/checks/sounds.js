'use strict'
// Live checks of skin sounds (decision 0024). Run under xvfb-run:
//   node scripts/checks/sounds.js OUT play|mute|start|skins|coffee
// scripts/drive.js mutes Chromium's output and gives it no sound server,
// so these read the page's player state, never the speakers.
const { launch, openMenu, sleep } = require('../drive.js')
const fs = require('fs')
const path = require('path')

const out = path.resolve(process.argv[2])
const what = process.argv[3]
const root = path.join(__dirname, '..', '..')
const keysFake = path.join(root, 'scripts', 'fake', 'keys')
const fixture = path.join(root, 'test', 'fixtures', 'skins', 'sounds')
fs.mkdirSync(out, { recursive: true })
const env = { SKINNED_GL: 'swiftshader', SKINNED_CHECK_OUT: out }

function check (ok, msg) {
  if (!ok) throw new Error(msg)
}

const sounds = win => win.evaluate(() => window.skinnedPage().sounds)

async function start (appArgs, extra = {}) {
  const r = await launch([keysFake], { appArgs: ['--no-viz', ...appArgs], env: Object.assign({}, env, extra) })
  await sleep(3500)
  return r
}

async function end (app) {
  await app.close().catch(() => {})
}

// Chromium's own output is muted in every driven launch.
async function silent (app) {
  const s = await app.evaluate(({ app, BrowserWindow }) => ({
    switch: app.commandLine.hasSwitch('mute-audio'),
    muted: BrowserWindow.getAllWindows().map(w => w.webContents.isAudioMuted())
  }))
  console.log('chromium output', JSON.stringify(s))
  check(s.switch, 'the driver must pass --mute-audio')
}

async function menuItem (win, text) {
  await openMenu(win)
  await win.locator('#menu .item', { hasText: text }).click()
  await sleep(800)
}

// The loop plays, the random sound has played after its wait, both at
// half the manifest's volume.
async function play () {
  const { app, win } = await start(['--skin', fixture])
  await silent(app)
  const s = await sounds(win)
  console.log(JSON.stringify(s))
  await end(app)
  check(s.skin === 'sounds' && !s.muted && s.sounds.length === 2, 'want two sounds of the fixture skin, unmuted')
  const [loop, shot] = s.sounds
  check(loop.mode === 'loop' && loop.loop && !loop.paused && loop.currentTime > 0 && loop.error === null, 'the loop must be playing')
  check(Math.abs(loop.volume - 0.2) < 1e-6, `the loop at half of 0.4, saw ${loop.volume}`)
  check(shot.mode === 'random' && shot.plays >= 1 && shot.error === null, 'the random sound must have played within 3.5 s of a [1, 2] s wait')
  check(Math.abs(shot.volume - 0.15) < 1e-6, `the random sound at half the default 0.3, saw ${shot.volume}`)
  check(s.sounds.every(x => x.src.startsWith('skin://sounds/sounds/')), 'want only the skin\'s own files')
}

// The menu mutes every sound and wait, and unmutes them.
async function mute () {
  const { app, win } = await start(['--skin', fixture])
  const items = await (async () => {
    await openMenu(win)
    const t = await win.evaluate(() => [...document.querySelectorAll('#menu .item')].map(e => e.textContent))
    await win.keyboard.press('Escape')
    return t
  })()
  await menuItem(win, 'Mute skin sounds')
  const off = await sounds(win)
  await openMenu(win)
  const again = await win.evaluate(() => [...document.querySelectorAll('#menu .item')].map(e => e.textContent))
  await win.locator('#menu .item', { hasText: 'Unmute skin sounds' }).click()
  await sleep(1500)
  const on = await sounds(win)
  console.log(JSON.stringify({ items, off, again, on: on.sounds.map(x => ({ file: x.file, paused: x.paused })) }))
  await end(app)
  check(items.includes('Mute skin sounds'), 'want Mute skin sounds in the menu')
  check(off.muted && off.sounds.length === 0, 'muted, no sound may remain')
  check(again.includes('Unmute skin sounds'), 'want Unmute skin sounds once muted')
  check(!on.muted && on.sounds.length === 2 && !on.sounds[0].paused, 'unmuted, the loop must play again')
}

// --mute and SKINNED_MUTE=1 start muted, and nothing plays.
async function startMuted () {
  const seen = {}
  for (const [name, args, extra] of [['option', ['--mute'], {}], ['env', [], { SKINNED_MUTE: '1' }]]) {
    const { app, win } = await start(['--skin', fixture, ...args], extra)
    seen[name] = await sounds(win)
    await end(app)
  }
  console.log(JSON.stringify(seen))
  for (const [name, s] of Object.entries(seen)) check(s.muted && s.sounds.length === 0, `${name}: want muted with nothing playing`)
}

// Sounds play only while their skin is current: a switch stops them, a
// reload restarts them.
async function skins () {
  const { app, win } = await start(['--skin', fixture])
  const before = await sounds(win)
  const firstSrc = before.sounds.map(x => x.src)
  await menuItem(win, 'deck')
  const deck = await sounds(win)
  await openMenu(win)
  await win.locator('#menu .item', { hasText: 'sounds' }).first().click()
  await sleep(1500)
  const back = await sounds(win)
  console.log(JSON.stringify({ before: before.sounds.length, deck, back: back.sounds.map(x => ({ file: x.file, paused: x.paused })) }))
  await end(app)
  check(firstSrc.length === 2, 'want the fixture\'s two sounds first')
  check(deck.skin === 'deck' && deck.sounds.length === 0, 'deck has no sounds: nothing may play after the switch')
  check(back.skin === 'sounds' && back.sounds.length === 2 && !back.sounds[0].paused, 'back on the fixture, its loop plays again')
}

// The coffee skin's murmur loops past its end, through the protocol's
// byte ranges, and every one-shot waits its turn without an error.
async function coffee () {
  const { app, win } = await start(['--skin', 'coffee'])
  await sleep(38000)
  const s = await sounds(win)
  console.log(JSON.stringify(s.sounds.map(x => ({ file: x.file, paused: x.paused, t: x.currentTime, plays: x.plays, error: x.error }))))
  await end(app)
  const loop = s.sounds.find(x => x.file === 'sounds/murmur.ogg')
  check(s.sounds.length === 11 && s.sounds.every(x => x.error === null), 'want the eleven coffee sounds, none failed')
  check(loop && !loop.paused && loop.currentTime < 36 - 3500 / 1000, `the 36 s murmur must have looped, saw ${loop && loop.currentTime}`)
}

;({ play, mute, start: startMuted, skins, coffee })[what]().then(() => console.log('done')).catch(e => { console.error(e); process.exit(1) })
