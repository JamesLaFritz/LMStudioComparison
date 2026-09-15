import * as THREE from 'three';

// Procedural geometry factory for Space Invaders entities

export class MeshFactory {
    static createPlayerShip() {
        const group = new THREE.Group();
        
        // Main body - sleek futuristic ship shape
        const bodyShape = new THREE.Shape();
        bodyShape.moveTo(-0.5, 0);
        bodyShape.lineTo(0.5, 0);
        bodyShape.lineTo(0.3, 1.2);
        bodyShape.lineTo(0, 1.8);
        bodyShape.lineTo(-0.3, 1.2);
        bodyShape.closePath();
        
        const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.4 });
        group.add(new THREE.Mesh(bodyGeo));
        
        // Wings - swept back design
        for (let side = -1; side <= 1; side += 2) {
            const wingShape = new THREE.Shape();
            wingShape.moveTo(side * 0.5, 0);
            wingShape.lineTo(side * 2.5, -0.3);
            wingShape.lineTo(side * 2.8, -0.1);
            wingShape.lineTo(side * 0.8, 0.2);
            wingShape.closePath();
            
            const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.3 });
            group.add(new THREE.Mesh(wingGeo));
        }
        
        // Cockpit dome - glowing element
        const cockpitGeo = new THREE.SphereGeometry(0.25, 16, 8);
        cockpitGeo.scale(1, 0.6, 1);
        group.children[3].position.set(0, 0.9, 0);
        
        // Engine glow rings
        for (let i = 0; i < 2; i++) {
            const ringGeo = new THREE.TorusGeometry(0.15 + i * 0.08, 0.03, 8, 16);
            group.children[4 + i].position.set(0, -0.1, 0);
        }
        
        return group;
    }

    static createEnemyType1() {
        // Basic enemy - simple geometric form
        const group = new THREE.Group();
        
        // Main body - octagonal shape
        const bodyGeo = new THREE.CylinderGeometry(0.6, 0.5, 0.4, 8);
        group.add(new THREE.Mesh(bodyGeo));
        
        // Eye/lens - glowing center
        const eyeGeo = new THREE.SphereGeometry(0.2, 12, 12);
        eyeGeo.scale(1, 1, 0.3);
        group.children[1].position.set(0, 0, 0.5);
        
        // Wing fins
        for (let side = -1; side <= 1; side += 2) {
            const finShape = new THREE.Shape();
            finShape.moveTo(side * 0.6, 0);
            finShape.lineTo(side * 1.3, -0.4);
            finShape.lineTo(side * 1.5, 0);
            finShape.closePath();
            
            const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.2 });
            group.children[2 + Math.abs(side)].position.set(0, 0, 0);
        }
        
        return group;
    }

    static createEnemyType2() {
        // Medium enemy - more complex design
        const group = new THREE.Group();
        
        // Main body - elongated hexagonal shape
        const bodyGeo = new THREE.CylinderGeometry(0.7, 0.6, 0.5, 6);
        group.add(new THREE.Mesh(bodyGeo));
        
        // Twin eyes
        for (let i = -1; i <= 1; i += 2) {
            const eyeGeo = new THREE.SphereGeometry(0.18, 12, 12);
            eyeGeo.scale(1, 1, 0.3);
            group.children[1 + Math.abs(i)].position.set(i * 0.4, 0, 0.5);
        }
        
        // Swept wings with angular design
        for (let side = -1; side <= 1; side += 2) {
            const wingShape = new THREE.Shape();
            wingShape.moveTo(side * 0.7, 0);
            wingShape.lineTo(side * 2.0, -0.6);
            wingShape.lineTo(side * 2.3, -0.1);
            wingShape.lineTo(side * 2.5, 0.4);
            wingShape.lineTo(side * 1.8, 0.5);
            wingShape.closePath();
            
            const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.3 });
            group.children[3 + Math.abs(side)].position.set(0, 0, 0);
        }
        
        // Engine exhaust glow rings
        for (let i = 0; i < 2; i++) {
            const ringGeo = new THREE.TorusGeometry(0.15 + i * 0.1, 0.03, 8, 16);
            group.children[5 + i].position.set(0, -0.3, 0);
        }
        
        return group;
    }

    static createEnemyType3() {
        // Elite enemy - menacing design with spikes
        const group = new THREE.Group();
        
        // Main body - aggressive angular shape
        const bodyGeo = new THREE.CylinderGeometry(0.8, 0.7, 0.6, 5);
        group.add(new THREE.Mesh(bodyGeo));
        
        // Central eye - larger and more menacing
        const eyeGeo = new THREE.SphereGeometry(0.35, 12, 12);
        eyeGeo.scale(1, 1, 0.4);
        group.children[1].position.set(0, 0, 0.6);
        
        // Spikes around body
        for (let i = 0; i < 5; i++) {
            const spikeGeo = new THREE.ConeGeometry(0.2, 0.8, 4);
            const angle = (i / 5) * Math.PI * 2;
            group.children[2 + i].position.set(
                Math.cos(angle) * 1.0,
                -0.3,
                Math.sin(angle) * 1.0
            );
        }
        
        // Large swept wings
        for (let side = -1; side <= 1; side += 2) {
            const wingShape = new THREE.Shape();
            wingShape.moveTo(side * 0.8, 0);
            wingShape.lineTo(side * 3.0, -0.8);
            wingShape.lineTo(side * 3.5, -0.1);
            wingShape.lineTo(side * 3.2, 0.6);
            wingShape.closePath();
            
            const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.4 });
            group.children[7 + Math.abs(side)].position.set(0, 0, 0);
        }
        
        return group;
    }

    static createBoss() {
        // Boss enemy - massive intimidating design
        const group = new THREE.Group();
        
        // Main body - enormous hexagonal structure
        const bodyGeo = new THREE.CylinderGeometry(1.5, 1.2, 1.0, 6);
        group.add(new THREE.Mesh(bodyGeo));
        
        // Massive central eye
        const eyeGeo = new THREE.SphereGeometry(0.6, 16, 16);
       eye

</thinking>


<tool_call>
<function=write_file>
<parameter=path>
Space_Invaders/assets/soundGenerator.js