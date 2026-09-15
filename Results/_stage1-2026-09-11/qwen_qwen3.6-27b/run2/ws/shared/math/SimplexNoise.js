// Deterministic 2D/3D simplex noise — compact implementation
export class SimplexNoise {
  constructor(seed = Math.random()) {
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    this.p = [];
    for (let i = 0; i < 256; i++) this.p[i] = i;
    // Shuffle with seed
    let s = seed * 2147483647;
    if (s <= 0) s += 2147483646;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
    }
    this.perm = new Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
  }

  dot3(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }

  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
    let n0, n1, n2;
    let t0 = 0.5 - x0*x0 - y0*y0;
    n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * this.dot3(this.grad3[gi0], x0, y0, 0));
    let t1 = 0.5 - x1*x1 - y1*y1;
    n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * this.dot3(this.grad3[gi1], x1, y1, 0));
    let t2 = 0.5 - x2*x2 - y2*y2;
    n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * this.dot3(this.grad3[gi2], x2, y2, 0));
    return 70 * (n0 + n1 + n2);
  }

  noise3D(xin, yin, zin) {
    const F3 = 1/3, G3 = 1/6;
    const s = (xin+yin+zin)*F3;
    const i=Math.floor(xin+s), j=Math.floor(yin+s), k=Math.floor(zin+s);
    const t=(i+j+k)*G3;
    const X0=i-t, Y0=j-t, Z0=k-t;
    const x0=xin-X0, y0=yin-Y0, z0=zin-Z0;
    let i1,j1,k1,i2,j2,k2;
    if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0}
    else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1}
    else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1}}
    else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1}
    else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1}
    else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0}}
    const x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
    const x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
    const x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
    const ii=i&255,jj=j&255,kk=k&255;
    const gi0=this.perm[ii+this.perm[jj+this.perm[kk]]]%12;
    const gi1=this.perm[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]]%12;
    const gi2=this.perm[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]]%12;
    const gi3=this.perm[ii+1+this.perm[jj+1+this.perm[kk+1]]]%12;
    let n0,n1,n2,n3;
    let t0=0.6-x0*x0-y0*y0-z0*z0;n0=t0<0?0:(t0*=t0,t0*t0*this.dot3(this.grad3[gi0],x0,y0,z0));
    let t1=0.6-x1*x1-y1*y1-z1*z1;n1=t1<0?0:(t1*=t1,t1*t1*this.dot3(this.grad3[gi1],x1,y1,z1));
    let t2=0.6-x2*x2-y2*y2-z2*z2;n2=t2<0?0:(t2*=t2,t2*t2*this.dot3(this.grad3[gi2],x2,y2,z2));
    let t3=0.6-x3*x3-y3*y3-z3*z3;n3=t3<0?0:(t3*=t3,t3*t3*this.dot3(this.grad3[gi3],x3,y3,z3));
    return 32*(n0+n1+n2+n3);
  }

  fbm(x, y, octaves = 4) {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.noise2D(x * freq, y * freq) * amp;
      max += amp; amp *= 0.5; freq *= 2;
    }
    return val / max;
  }
}
