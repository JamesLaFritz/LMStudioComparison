import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export class SceneManager {
  constructor() {
    this._assets = []
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 100)
    this.camera.position.set(0, 0, 20)
    this.camera.lookAt(0, 0, 0)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    document.body.appendChild(this.renderer.domElement)
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2, 0.4, 0.2
    )
    this.composer.addPass(bloom)
    this.composer.addPass(new OutputPass())
    this._bloomPass = bloom
    window.addEventListener('resize', () => this.onResize())
    this._addLighting()
  }

  _addLighting() {
    const hemi = new THREE.HemisphereLight(0x220044, 0x001122, 0.4)
    this.scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 0.3)
    dir.position.set(0, 5, 5)
    this.scene.add(dir)
  }

  track(obj) {
    this._assets.push(obj)
    return obj
  }

  disposeGameAssets() {
    for (const a of this._assets) {
      if (a.geometry) a.geometry.dispose()
      if (a.material) {
        if (Array.isArray(a.material)) a.material.forEach(m => m.dispose())
        else a.material.dispose()
      }
      if (a.map) a.map.dispose()
      if (a.dispose) a.dispose()
    }
    this._assets.length = 0
  }

  onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    const aspect = w / h
    const viewH = 4
    const viewW = viewH * aspect
    this.camera.left = -viewW
    this.camera.right = viewW
    this.camera.top = viewH
    this.camera.bottom = -viewH
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
  }

  dispose() {
    this.disposeGameAssets()
    for (const child of this.scene.children) {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
        else child.material.dispose()
      }
    }
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
  }
}
