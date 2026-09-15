import { Vector3 } from '../utils/math.js';

// Max trail segments
const MAX_TRAIL_SEGMENTS = 3;

// Max instances for InstancedMesh
const MAX_INSTANCED_MESH = 100;

// Trail segment class
export class TrailSegment {
  constructor() {
    this.position = new Vector3();
    this.time = 0;
  }
}

// Motion trail manager
export class MotionTrailManager {
  constructor() {
    this.trails = new Map();
    this.instances = [];
    this.instanceCount = 0;
  }

  // Add a new trail to an object
  addTrail(objectId, object) {
    if (this.trails.has(objectId)) return;
    
    this.trails.set(objectId, {
      object,
      segments: [],
      lastUpdateTime: performance.now()
    });
  }

  // Update all trails
  update(deltaTime) {
    const now = performance.now();
    
    for (const [objectId, trail] of this.trails.entries()) {
      const { object, segments, lastUpdateTime } = trail;
      
      // Skip if not moving fast enough
      const speed = object.velocity ? object.velocity.length() : 0;
      if (speed < 4) continue;
      
      // Only update every 100ms
      if (now - lastUpdateTime < 100) continue;
      
      // Add new segment
      const newSegment = new TrailSegment();
      newSegment.position.copy(object.position);
      newSegment.time = now;
      
      // Add to segments
      segments.push(newSegment);
      
      // Limit to max segments
      if (segments.length > MAX_TRAIL_SEGMENTS) {
        segments.shift();
      }
      
      // Update last update time
      trail.lastUpdateTime = now;
    }
  }

  // Get trail mesh for rendering
  getTrailMesh() {
    // Clear existing instances
    this.instances.length = 0;
    
    // Add instances for each trail
    for (const [objectId, trail] of this.trails.entries()) {
      const { segments } = trail;
      
      // Skip if no segments
      if (segments.length < 2) continue;
      
      // Create trail mesh
      const mesh = {
        id: objectId,
        position: new Vector3(),
        rotation: new Vector3(),
        scale: new Vector3(0.1, 0.1, 0.1),
        segments: []
      };
      
      // Add segments
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        mesh.segments.push({
          position: segment.position.clone(),
          time: segment.time
        });
      }
      
      // Add to instances
      this.instances.push(mesh);
      
      // Limit total instances
      if (this.instances.length >= MAX_INSTANCED_MESH) break;
    }
    
    return this.instances;
  }

  // Clear all trails
  clear() {
    this.trails.clear();
    this.instances.length = 0;
  }
}