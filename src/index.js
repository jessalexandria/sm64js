import "./template.css"
import { checkForRom, fetchRomFromTotl } from "./romTextureLoader.js"
import { initBuildMode } from "./totl_build.js"
import { GameInstance as Game } from "./game/Game"
import { playerInputUpdate } from "./player_input_manager"
import { n64GfxProcessorInstance as GFX } from "./graphics/n64GfxProcessor"

const send_display_list = (gfx_list) => { GFX.run(gfx_list) }

let n_frames = 0
let target_time = 0
let frameSpeed = 0.03

const produce_one_frame = () => {

    const start_frame = performance.now()

    playerInputUpdate() /// Keyboard buttons / joystick process to game input commands
    GFX.start_frame()
    Game.main_loop_one_iteration()
    /// Audio TODO

    const finished_frame = performance.now()
    totalFrameTimeBuffer.push(finished_frame - start_frame)

    //if (n_frames > 100000) { throw "Hit max frames" }
    //console.log("new frame: " + n_frames)
    n_frames++
}

//// implementation from Emil <3
const on_anim_frame = (time) => {

    time *= frameSpeed

    if (time >= target_time + 10.0) {
        // We are lagging 10 frames behind, probably due to coming back after inactivity,
        // so reset, with a small margin to avoid potential jitter later.
        target_time = time - 0.010
    }

    for (let i = 0; i < 2; i++) {
        // If refresh rate is 15 Hz or something we might need to generate two frames
        if (time >= target_time) {
            produce_one_frame()
            target_time = target_time + 1.0
        }
    }

    if (window.kill) throw "stopping game execution"
    requestAnimationFrame(on_anim_frame)

}

const main_func = () => {

    /// WebGL class and n64GfxProcessor class are initialized with their constructor when they are imported
    Game.attachInterfaceToGfxProcessor(send_display_list)

    on_anim_frame()

}


//////////////////// Some more website stuff

$('[data-toggle="popover"]').popover({
    container: "body",
    content: function () {
        return $('#controlsPopover').clone()
    },
})

const letterColors = ["#3e51fa", "#fa3e3e", "#00ff00", "yellow"]

const generateRainbowText = (element) => {
    var text = element.innerText
    element.innerHTML = ""
    for (let i = 0; i < text.length; i++) {
        let charElem = document.createElement("span")
        charElem.style.color = letterColors[i % 4]
        charElem.innerHTML = text[i]
        element.appendChild(charElem)
    }
}

Array.from(document.getElementsByClassName("rainbowText")).forEach((element) => {
    generateRainbowText(element)
})

const createRingBuffer = (length) => {
    let index = 0
    const buffer = []

    return {
        push: (item) => {
            buffer[index] = item
            index = (index + 1) % length
            return item
        },
        getAvg: () => {
            return buffer.reduce((a, b) => a + b, 0) / length
        }
    }
}

const totalFrameTimeBuffer = createRingBuffer(10)

const setStatsUpdate = setInterval(() => {
    const totalFrameTimeAvg = totalFrameTimeBuffer.getAvg().toFixed(2)
    const maxFps = (1000 / totalFrameTimeAvg).toFixed(2)
    document.getElementById("maxFps").innerHTML = `Effective max FPS: ${maxFps}`
    document.getElementById("timing-total").innerHTML = `${totalFrameTimeAvg}ms`
}, 500)

document.getElementById("slider").addEventListener('change', (event) => {
    frameSpeed = 1000 / event.target.value
    document.getElementById("fps").innerHTML = `${event.target.value} fps`
})

window.enterFullScreenMode = () => {
    const dstCanvas = document.getElementById('fullCanvas')
    dstCanvas.requestFullscreen()
}

window.snapshotLocation = () => {
    if (gameStarted) {
        let loc = Game.snapshot_location()
        let level = "&level=" + loc.level
        let pos = "&pos=" + Math.round(loc.yaw) + "," + Math.round(loc.x) + "," + Math.round(loc.y) + "," + Math.round(loc.z)
        let scr = window.fullWindowMode ? "&fullscreen=1" : ""
        window.history.replaceState(null, "", window.location.origin + "?autostart=1" + level + pos + scr)
    }
}

///// Start Game

let gameStarted = false

document.getElementById("startbutton").addEventListener('click', () => {
    if (gameStarted) {
        location.reload()
    }
    else {
        startGame()
    }
})

document.getElementById("mapSelect").addEventListener('change', () => {
    if (gameStarted) {
        Game.warp_to(document.getElementById("mapSelect").value)
    }
})

window.cheats = {
    disableFallDamage: false,
    disableSlopePhysics: false,
    healOnWarp: false
}


const TONES = {
  violet: ['#d779ff','#6f3cff','#27113c'],
  pink: ['#ff7cc8','#a238ff','#351027'],
  cyan: ['#63edff','#446bff','#0b2d43'],
  blue: ['#6e9dff','#7c4bff','#101942'],
  amber: ['#ffd16a','#ff6d35','#3d1b10'],
  red: ['#ff667a','#a72cff','#3b0b20'],
  aqua: ['#5fffc8','#1b8cff','#063a36'],
  green: ['#89ff87','#268f80','#11341f'],
  orange: ['#ffae62','#e83c6f','#3c180e']
}
let selectedTone = 'violet'

const showAvatarSelect = (onDone) => {
  const url = new URL(window.location.href)
  let tone = url.searchParams.get('avatar')
  let name = url.searchParams.get('name')
  let imported = !!(tone || name)
  if (!tone) { try { tone = localStorage.getItem('verse-avatar-tone') } catch(e){} }
  if (!name) { try { name = localStorage.getItem('verse-avatar-name') } catch(e){} }
  if (!tone) { try { tone = localStorage.getItem('sm64-avatar-tone') } catch(e){} }
  if (!name) { try { name = localStorage.getItem('sm64-avatar-name') } catch(e){} }
  if (tone && TONES[tone]) selectedTone = tone

  document.getElementById('totlLoader').classList.add('hide')
  const sel = document.getElementById('avatarSelect')
  sel.classList.remove('hide')
  if (imported && name) document.getElementById('avatarImported').classList.remove('hide')
  const nameInput = document.getElementById('avatarName')
  if (name) nameInput.value = name

  const grid = document.getElementById('toneGrid')
  grid.innerHTML = ''
  Object.keys(TONES).forEach((key) => {
    const d = document.createElement('div')
    d.className = 'tone-swatch' + (key === selectedTone ? ' on' : '')
    d.style.background = 'linear-gradient(135deg,' + TONES[key][0] + ',' + TONES[key][1] + ')'
    d.title = key
    d.onclick = () => {
      selectedTone = key
      grid.querySelectorAll('.tone-swatch').forEach((s) => s.classList.remove('on'))
      d.classList.add('on')
    }
    grid.appendChild(d)
  })

  document.getElementById('avatarEnter').onclick = () => {
    const finalName = nameInput.value.trim() || 'player'
    try {
      localStorage.setItem('sm64-avatar-tone', selectedTone)
      localStorage.setItem('sm64-avatar-name', finalName)
    } catch(e){}
    window.totlAvatar = { tone: selectedTone, name: finalName, colors: TONES[selectedTone] }
    sel.classList.add('hide')
    // show HUD nametag
    const hud = document.getElementById('avatarHud')
    document.getElementById('avatarHudName').textContent = finalName
    document.getElementById('avatarHudDot').style.background = TONES[selectedTone][0]
    hud.classList.remove('hide')
    onDone()
  }
}

const startGame = () => {
    gameStarted = true
    setTimeout(() => { try { initBuildMode() } catch(e){} }, 1000)
    document.getElementById("totlLoader").classList.add("hide")
    document.getElementById("gameWrap").classList.remove("hide")
    main_func()
}
window.totlReset = () => { location.reload() }

window.onload = () => {
    const url = new URL(window.location.href)

    const level = url.searchParams.get("level")
    if (level) {
        const maps = document.getElementById("mapSelect").getElementsByTagName("option")
        for (const m of maps) {
            if (m.value == level) {
                m.selected = 'selected'
                break
            }
        }
    }

    let pos = url.searchParams.get("pos")
    if (pos) {
        pos = pos.split(",")
        window.debugMarioYaw = parseFloat(pos[0])
        window.debugMarioPosX = parseFloat(pos[1])
        window.debugMarioPosY = parseFloat(pos[2])
        window.debugMarioPosZ = parseFloat(pos[3])
    }

    checkForRom().then((data) => {
        if (data) {
            showAvatarSelect(startGame)
        } else {
            const msg = document.getElementById("romMessage")
            const bar = document.getElementById("totlLoadBar")
            if (msg) msg.innerHTML = "loading game assets from totl..."
            document.getElementById("rom").hidden = true
            fetchRomFromTotl((p) => {
                if (bar) bar.style.width = Math.floor(p * 100) + "%"
                const pct = document.getElementById("totlLoadPct")
                if (pct) pct.textContent = Math.floor(p * 100) + "%"
            }).then(() => {
                showAvatarSelect(startGame)
            }).catch((e) => {
                if (msg) { msg.innerHTML = "auto-load failed, upload your rom manually:"; msg.style = "color:red" }
                document.getElementById("rom").hidden = false
            })
        }
    })

    if (url.searchParams.get("autostart") && url.searchParams.get("fullscreen")) {
        var mc=document.getElementById("mainContent"); if(mc) mc.hidden = true
    } else {
        var mc=document.getElementById("mainContent"); if(mc) mc.hidden = false
    }
}

