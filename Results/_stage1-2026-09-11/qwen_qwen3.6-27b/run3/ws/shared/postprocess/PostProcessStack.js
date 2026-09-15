import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export class PostProcessStack {
  constructor(renderer, width, height) {
    this._renderer = renderer
    this._composer = new EffectComposer(renderer)

    const renderPass = new RenderPass(null, null) // scene/camera injected at render time
    this._renderPass = renderPass
    this._composer.addPass(renderPass)

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.2,   // strength
      0.4,   // radius
      0.2    // threshold
    )
    this._bloomPass = bloomPass
    this._composer.addPass(bloomPass)

    const outputPass = new OutputPass()
    this._outputPass = outputPass
    this._composer.addPass(outputPass)
  }

  setSceneAndCamera(scene, camera) {
    this._renderPass.scene = scene
    this._renderPass.camera = camera
  }

  get composer() {
    return this._composer
  }

  resize(width, height) {
    this._composer.setSize(width, height)
    this._bloomPass.resolution.set(width, height)
  }

  dispose() {
    this._composer.removePass(this._bloomPass)
    this._composer.removePass(this._outputPass)
    this._composer.removePass(this._renderPass)
    this._composer.dispose()
  }
}
