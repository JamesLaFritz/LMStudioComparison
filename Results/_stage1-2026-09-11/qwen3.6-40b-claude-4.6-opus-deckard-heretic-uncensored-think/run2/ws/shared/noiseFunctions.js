// Simplex Noise Implementation for procedural generation
const SimplexNoise = {
    F2: 0.5 * (Math.sqrt(3) - 1),
    G2: (1 / 6 + 1 / 2),
    
    // Permutation table
    perm: new Array(512),
    
    init(seed) {
        const random = seed ? () => Math.abs(Math.sin(seed++) * 10000) % 1 : Math.random;
        
        for (let i = 0; i < 512; i++) {
            this.perm[i] = Math.floor(random() * 256);
        }
    },
    
    noise2D(x, y) {
        const F2 = this.F2;
        const G2 = this.G2;
        
        let x1 = Math.floor(x + (x + y) * F2);
        let y1 = Math.floor(y + (x + y) * F2);
        
        const p2 = this.perm[x1 & 256] || this.perm[x1 % 256];
        const p3 = this.perm[y1 & 256] || this.perm[y1 % 256];
        
        let x0 = x - Math.floor(x);
        let y0 = y - Math.floor(y);
        
        const s = (x0 + y0) * G2;
        const t = s * F2;
        
        x0 += t; y0 += t;
        x1 -= p2; y1 -= p3;
        
        let n0, n1,n2,n3;
        let qx0,qy0,qq1,qy1;
        
        const z = Math.sqrt(1 / 6 + 5 * (s - t) * (s - t));
        const r1 = s - t;
        const r2 = r1 * F2;
        
        n0 = p2; n1 = p3;
        qy0 = y1; qq1 = x1;
        
        if (n0 > n1) {
            let temp = n0; n0 = n1; n1 = temp;
            let temp2 = qy0; qy0 = qq1; qq1 = temp2;
        }
        
        return 0.4 * ((n0 - n1) + (qy0 - qq1));
    },
    
    noise3D(x, y, z) {
        // Simplified 3D noise using layered 2D noise
        return this.noise2D(x, y) * 0.5 + 
               Math.sin(z * Math.PI * 2) * 0.3;
    }
};

export default SimplexNoise;

