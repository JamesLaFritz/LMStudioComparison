// Neon three-point rig: cool hemisphere fill, bright key, magenta rim. Lights are created once;
// games modulate intensity rather than adding/removing lights (which would recompile every material).
import { HemisphereLight, DirectionalLight, Color } from 'three';

export function createNeonLighting(
  scene,
  {
    hemiSky = 0x1b2140,
    hemiGround = 0x0a0614,
    hemiIntensity = 0.55,
    keyColor = 0xcfe8ff,
    keyIntensity = 0.9,
    keyPosition = [6, 18, 12],
    rimColor = 0xff2bd6,
    rimIntensity = 0.45,
    rimPosition = [-8, 6, -10],
    target = [0, 0, 0],
  } = {},
) {
  const hemi = new HemisphereLight(new Color(hemiSky), new Color(hemiGround), hemiIntensity);
  const key = new DirectionalLight(new Color(keyColor), keyIntensity);
  const rim = new DirectionalLight(new Color(rimColor), rimIntensity);

  key.position.set(keyPosition[0], keyPosition[1], keyPosition[2]);
  rim.position.set(rimPosition[0], rimPosition[1], rimPosition[2]);
  key.target.position.set(target[0], target[1], target[2]);
  rim.target.position.set(target[0], target[1], target[2]);

  scene.add(hemi, key, key.target, rim, rim.target);

  return {
    hemi,
    key,
    rim,
    dispose() {
      scene.remove(hemi, key, key.target, rim, rim.target);
      hemi.dispose();
      key.dispose();
      rim.dispose();
    },
  };
}
