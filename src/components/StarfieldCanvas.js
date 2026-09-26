/**
 * Starfield & Heart Burst Canvas Background
 * Performance optimized particle system for romantic ambient glow
 */
export class StarfieldCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.bursts = [];
    this.particleCount = 50; // Lightweight for maximum performance
    this.animationFrameId = null;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.createParticles();
    this.animate();
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2 + 0.8,
        speedY: (Math.random() * 0.4 + 0.1) * -1, // Upward drift
        speedX: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.7 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        type: Math.random() > 0.85 ? 'heart' : 'star'
      });
    }
  }

  triggerBurst(originX, originY) {
    const burstCount = 18;
    for (let i = 0; i < burstCount; i++) {
      const angle = (Math.PI * 2 / burstCount) * i + Math.random() * 0.5;
      const speed = Math.random() * 3.5 + 1.5;
      this.bursts.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 6 + 4,
        opacity: 1,
        color: i % 2 === 0 ? '#FB7185' : '#F43F5E',
        life: 1
      });
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Render background particles
    this.particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.opacity += Math.sin(Date.now() * p.twinkleSpeed) * 0.01;

      // Wrap boundaries
      if (p.y < -10) {
        p.y = this.height + 10;
        p.x = Math.random() * this.width;
      }
      if (p.x < -10) p.x = this.width + 10;
      if (p.x > this.width + 10) p.x = -10;

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0.1, Math.min(0.9, p.opacity));

      if (p.type === 'heart') {
        this.drawMiniHeart(p.x, p.y, p.size * 2.5, '#FB7185');
      } else {
        this.ctx.fillStyle = '#FFF1F2';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#FB7185';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    // Render click bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.05; // Gentle gravity effect
      b.opacity -= 0.02;
      b.life -= 0.02;

      if (b.opacity <= 0) {
        this.bursts.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = b.opacity;
      this.drawMiniHeart(b.x, b.y, b.size, b.color);
      this.ctx.restore();
    }

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  drawMiniHeart(x, y, size, color) {
    this.ctx.fillStyle = color;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = color;
    this.ctx.beginPath();
    const topCurveHeight = size * 0.3;
    this.ctx.moveTo(x, y + topCurveHeight);
    // Left curve
    this.ctx.bezierCurveTo(
      x, y, 
      x - size / 2, y, 
      x - size / 2, y + topCurveHeight
    );
    // Bottom left
    this.ctx.bezierCurveTo(
      x - size / 2, y + (size + topCurveHeight) / 2, 
      x, y + (size + topCurveHeight) / 1.4, 
      x, y + size
    );
    // Bottom right
    this.ctx.bezierCurveTo(
      x, y + (size + topCurveHeight) / 1.4, 
      x + size / 2, y + (size + topCurveHeight) / 2, 
      x + size / 2, y + topCurveHeight
    );
    // Right curve
    this.ctx.bezierCurveTo(
      x + size / 2, y, 
      x, y, 
      x, y + topCurveHeight
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
