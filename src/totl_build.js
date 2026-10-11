// totl build mode - minecraft-style block placement
import { spawn_object_abs_with_rot } from "./game/ObjectHelpers"
import { MODEL_BREAKABLE_BOX, MODEL_EXCLAMATION_BOX } from "./include/model_ids"

let buildMode = false
let selectedBlock = 0
const BLOCKS = [
    { model: MODEL_BREAKABLE_BOX, name: 'crate', behavior: 'bhvTotlBlock' },
    { model: MODEL_EXCLAMATION_BOX, name: '? block', behavior: 'bhvTotlBlock' },
]
let placedBlocks = []  // {x, y, z, type}

const getMario = () => {
    try {
        const gLinker = window.gLinker || null
        if (!gLinker) return null
        const mario = gLinker.ObjectListProcessor?.gMarioObject
        return mario || null
    } catch(e) { return null }
}

const getPlacePos = () => {
    const mario = getMario()
    if (!mario) return null
    const px = mario.rawData[1]  // oPosX
    const py = mario.rawData[2]  // oPosY
    const pz = mario.rawData[3]  // oPosZ
    const yaw = mario.rawData[16] // oFaceAngleYaw
    // 250 units in front, snapped to 100 grid
    const dist = 250
    const rad = yaw * Math.PI / 32768
    let x = Math.round((px + Math.sin(rad) * dist) / 100) * 100
    let z = Math.round((pz + Math.cos(rad) * dist) / 100) * 100
    let y = Math.round(py / 100) * 100
    return { x, y, z }
}

export const placeBlock = () => {
    const pos = getPlacePos()
    if (!pos) return
    const block = BLOCKS[selectedBlock]
    const mario = getMario()
    try {
        spawn_object_abs_with_rot(mario, block.model, block.behavior, pos.x, pos.y, pos.z, 0, 0, 0)
        placedBlocks.push({ x: pos.x, y: pos.y, z: pos.z, type: selectedBlock })
        saveBlocks()
        updateBuildHud()
    } catch(e) {
        console.warn('place failed', e)
    }
}

export const removeNearestBlock = () => {
    const mario = getMario()
    if (!mario || placedBlocks.length === 0) return
    const px = mario.rawData[1], pz = mario.rawData[3]
    let best = -1, bestDist = 400
    placedBlocks.forEach((b, i) => {
        const d = Math.hypot(b.x - px, b.z - pz)
        if (d < bestDist) { bestDist = d; best = i }
    })
    if (best >= 0) {
        placedBlocks.splice(best, 1)
        saveBlocks()
        // respawn all (simple approach: reload level blocks)
        location.reload()  // v1: reload to clear
    }
}

const saveBlocks = () => {
    try {
        const level = new URL(window.location.href).searchParams.get('level') || 'default'
        localStorage.setItem('totl-blocks-' + level, JSON.stringify(placedBlocks))
    } catch(e){}
}

export const loadBlocks = () => {
    try {
        const level = new URL(window.location.href).searchParams.get('level') || 'default'
        const data = localStorage.getItem('totl-blocks-' + level)
        if (data) {
            placedBlocks = JSON.parse(data)
            // respawn them
            const mario = getMario()
            if (mario) {
                placedBlocks.forEach((b) => {
                    const block = BLOCKS[b.type] || BLOCKS[0]
                    try {
                        spawn_object_abs_with_rot(mario, block.model, block.behavior, b.x, b.y, b.z, 0, 0, 0)
                    } catch(e){}
                })
            }
        }
    } catch(e){}
    updateBuildHud()
}

const updateBuildHud = () => {
    const el = document.getElementById('buildHud')
    if (el) {
        el.classList.toggle('hide', !buildMode)
        const info = document.getElementById('buildInfo')
        if (info) info.textContent = BLOCKS[selectedBlock].name + ' | ' + placedBlocks.length + ' placed'
    }
    const cross = document.getElementById('buildCrosshair')
    if (cross) cross.classList.toggle('hide', !buildMode)
}

export const toggleBuildMode = () => {
    buildMode = !buildMode
    updateBuildHud()
    return buildMode
}

export const isBuildMode = () => buildMode

export const cycleBlock = (dir) => {
    selectedBlock = (selectedBlock + dir + BLOCKS.length) % BLOCKS.length
    updateBuildHud()
}

export const initBuildMode = () => {
    window.addEventListener('keydown', (e) => {
        if (!window.gameStarted) return
        if (e.key === 'b' || e.key === 'B') {
            toggleBuildMode()
            e.preventDefault()
        } else if (buildMode) {
            if (e.key === 'Enter') { placeBlock(); e.preventDefault() }
            else if (e.key === 'x' || e.key === 'X') { removeNearestBlock(); e.preventDefault() }
            else if (e.key === '1') { selectedBlock = 0; updateBuildHud() }
            else if (e.key === '2') { selectedBlock = 1; updateBuildHud() }
        }
    })
    // load saved blocks after game starts
    setTimeout(loadBlocks, 3000)
}
