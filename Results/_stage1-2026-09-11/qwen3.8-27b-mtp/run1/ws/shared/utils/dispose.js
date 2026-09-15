// One-time disposal of GPU resources. Every dispose() call is guarded so that
// teardown can be called multiple times without throwing or double-freed state.

const DISPOSED = new WeakSet();

function guardDispose(obj) {
  if (!obj || obj.__emberDisposed) return;
  try {
    obj.dispose();
  } catch (e) {
    // Resource already gone — treat as disposed, never let teardown throw.
  }
  obj.__emberDisposed = true;
}

/**
 * Deep-dispose a scene-graph root: geometry, materials (incl. arrays), and every
 * texture slot on each material. Idempotent per resource.
 */
export function deepDispose(root) {
  if (!root || !root.traverse) return;
  const seen = new Set();

  const disposeMaterial = (mat) => {
    if (!mat || seen.has(mat)) return;
    seen.add(mat);
    for (const key of Object.keys(mat)) {
      const v = mat[key];
      if (v && typeof v === 'object' && v.isTexture) guardDispose(v);
    }
    guardDispose(mat);
  };

  root.traverse((node) => {
    if (node.geometry) {
      if (!seen.has(node.geometry)) {
        seen.add(node.geometry);
        guardDispose(node.geometry);
      }
    }
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const m of mats) disposeMaterial(m);
  });

  // InstancedMesh instance buffers are part of the geometry — covered above.
}

/** Dispose a standalone texture or material not attached to a scene graph. */
export function disposeResource(res) {
  guardDispose(res);
}
