import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

// ============================================================================
// CONFIGURACIÓN Y TIPOS
// ============================================================================

type WeatherType = 'rain' | 'snow' | 'clear';

interface ParticleConfig {
  emissionRate: number;
  lifetime: number;
  size: number;
  speed: number;
  windStrength: number;
  gravity: number;
  type: WeatherType;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  active: boolean;
  isSplash?: boolean;
}

interface Human {
  group: THREE.Group;
  target: THREE.Vector3;
  speed: number;
  umbrella: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
}

interface Car {
  group: THREE.Group;
  velocity: THREE.Vector3;
  headlights: THREE.SpotLight[];
  taillights: THREE.Mesh[];
}

// ============================================================================
// SISTEMA DE NUBES
// ============================================================================

class CloudSystem {
    private scene: THREE.Scene;
    private clouds: THREE.Group[] = [];
    private cloudMaterial: THREE.MeshStandardMaterial;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.cloudMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.8, flatShading: true
        });
        for(let i=0; i<15; i++) this.createCloud();
    }

    private createCloud(): void {
        const group = new THREE.Group();
        const chunks = 3 + Math.random() * 5;
        for(let i=0; i<chunks; i++) {
            const geo = new THREE.DodecahedronGeometry(2 + Math.random() * 3);
            const mesh = new THREE.Mesh(geo, this.cloudMaterial);
            mesh.position.set((Math.random()-0.5)*6, (Math.random()-0.5)*3, (Math.random()-0.5)*4);
            group.add(mesh);
        }
        group.position.set((Math.random()-0.5)*150, 40+Math.random()*10, (Math.random()-0.5)*150);
        this.scene.add(group);
        this.clouds.push(group);
    }

    public update(dt: number, weather: WeatherType): void {
        this.clouds.forEach(c => {
            c.position.x += dt * 2;
            if (c.position.x > 80) c.position.x = -80;
        });
        
        const targetColor = new THREE.Color(weather === 'rain' ? 0x555555 : weather === 'snow' ? 0xdddddd : 0xffffff);
        const targetOp = weather === 'clear' ? 0.6 : 0.9;
        
        this.cloudMaterial.color.lerp(targetColor, dt * 2.0);
        this.cloudMaterial.opacity = THREE.MathUtils.lerp(this.cloudMaterial.opacity, targetOp, dt);
    }
}

// ============================================================================
// SISTEMA DE CLIMA (PARTÍCULAS VISIBLES Y CONTROLABLES)
// ============================================================================

class WeatherParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private particleMesh!: THREE.InstancedMesh;
  public config: ParticleConfig;
  private emitterVolume: THREE.Box3;
  private emitterHelper: THREE.Box3Helper; 
  private accumulator: number = 0;
  
  private geometry!: THREE.PlaneGeometry;
  private material!: THREE.MeshBasicMaterial;
  private tempMatrix = new THREE.Matrix4();
  private tempPosition = new THREE.Vector3();
  private tempQuaternion = new THREE.Quaternion();
  private tempScale = new THREE.Vector3();

  constructor(scene: THREE.Scene, config: ParticleConfig) {
    this.scene = scene;
    this.config = config;
    
    this.emitterVolume = new THREE.Box3(new THREE.Vector3(-60, 30, -60), new THREE.Vector3(60, 45, 60));
    
    // Helper visual (Requisito PDF)
    this.emitterHelper = new THREE.Box3Helper(this.emitterVolume, 0x00ff00);
    this.emitterHelper.visible = false; 
    this.scene.add(this.emitterHelper);

    const maxParticles = 10000;
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0, maxLife: 0, size: 0, active: false
      });
    }
    
    this.createGeometry();
    this.createMaterial();
    
    this.particleMesh = new THREE.InstancedMesh(this.geometry, this.material, maxParticles);
    this.particleMesh.frustumCulled = false; 
    this.scene.add(this.particleMesh);
  }

  public setHelperVisibility(visible: boolean) {
      this.emitterHelper.visible = visible;
  }

  private createGeometry() { 
      this.geometry = new THREE.PlaneGeometry(1, 1); 
  }

  private createMaterial() {
    // Generar textura inicial
    const texture = this.generateTexture();

    this.material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.8,
      depthWrite: false, 
      blending: THREE.AdditiveBlending, 
      side: THREE.DoubleSide
    });
  }

  private generateTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0,0,32,32);
    
    const grad = ctx.createRadialGradient(16,16,0, 16,16,16);
    if (this.config.type === 'rain') {
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
    }
    
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,32,32);
    
    const tex = new THREE.Texture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  public updateConfig(newConfig: Partial<ParticleConfig>) {
    const oldType = this.config.type;
    Object.assign(this.config, newConfig);
    
    // Si cambia el tipo, regeneramos la textura y el color base
    if (newConfig.type && newConfig.type !== oldType) {
        const newTex = this.generateTexture();
        if(this.material.map) this.material.map.dispose();
        this.material.map = newTex;
        
        if (this.config.type === 'rain') this.material.color.setHex(0xaaddff);
        else this.material.color.setHex(0xffffff);
        
        this.material.needsUpdate = true;
    }
  }

  public update(dt: number, camera: THREE.Camera) {
    const isClear = this.config.type === 'clear';
    
    if (!isClear) {
        this.accumulator += dt;
        const interval = 1.0 / Math.max(1, this.config.emissionRate); // Evitar división por 0
        while (this.accumulator >= interval) {
            this.emitParticle();
            this.accumulator -= interval;
        }
    }

    let activeCount = 0;
    this.tempQuaternion.copy(camera.quaternion);

    for (const p of this.particles) {
        if (!p.active) continue;

        p.life -= dt;
        // Física básica
        p.velocity.y += this.config.gravity * dt;
        p.velocity.x = this.config.windStrength; // Viento constante en X
        p.position.addScaledVector(p.velocity, dt);

        if (p.position.y < 0 || p.life <= 0) {
            p.active = false;
            continue;
        }

        this.tempPosition.copy(p.position);
        
        if (this.config.type === 'rain') {
            this.tempScale.set(p.size * 0.08, p.size * 6.0, 1);
        } else {
            this.tempScale.set(p.size, p.size, 1);
        }
        
        this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
        this.particleMesh.setMatrixAt(activeCount, this.tempMatrix);
        activeCount++;
    }
    
    this.particleMesh.count = activeCount;
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  private emitParticle() {
    const p = this.particles.find(pt => !pt.active);
    if (!p) return;
    
    p.active = true;
    p.position.set(
        THREE.MathUtils.randFloat(this.emitterVolume.min.x, this.emitterVolume.max.x),
        THREE.MathUtils.randFloat(this.emitterVolume.min.y, this.emitterVolume.max.y),
        THREE.MathUtils.randFloat(this.emitterVolume.min.z, this.emitterVolume.max.z)
    );
    p.life = this.config.lifetime;
    p.size = this.config.size;
    
    // Usamos la velocidad configurada
    if (this.config.type === 'rain') p.velocity.set(0, -this.config.speed, 0);
    else p.velocity.set(0, -this.config.speed * 0.5, 0); // La nieve cae más lento relativo al param
  }

  public getCount() { return this.particleMesh.count; }
}

// ============================================================================
// SISTEMA DE TRÁFICO
// ============================================================================

class TrafficSystem {
    private scene: THREE.Scene;
    private cars: Car[] = [];
    private lanes = [4, -4];

    constructor(scene: THREE.Scene, count: number) {
        this.scene = scene;
        for(let i=0; i<count; i++) this.spawnCar();
    }

    private spawnCar() {
        const group = new THREE.Group();
        const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.4);
        
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4), new THREE.MeshStandardMaterial({color, roughness:0.2}));
        body.position.y = 0.6;
        body.castShadow = true;
        group.add(body);
        
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2), new THREE.MeshStandardMaterial({color:0x222222}));
        cabin.position.set(0, 1.3, -0.2);
        group.add(cabin);

        const headlights = [this.createSpot(-0.6, 0.8, 2.1), this.createSpot(0.6, 0.8, 2.1)];
        headlights.forEach(h => group.add(h, h.target));

        const taillights = [this.createTailLight(-0.6, 0.8, -2.05), this.createTailLight(0.6, 0.8, -2.05)];
        taillights.forEach(t => group.add(t));

        const wGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4);
        const wMat = new THREE.MeshStandardMaterial({color:0x111111});
        [[-1, 1.2], [1, 1.2], [-1, -1.2], [1, -1.2]].forEach(pos => {
            const w = new THREE.Mesh(wGeo, wMat);
            w.rotation.z = Math.PI/2;
            w.position.set(pos[0], 0.35, pos[1]);
            group.add(w);
        });

        const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
        const zPos = (Math.random() - 0.5) * 100;
        group.position.set(lane, 0, zPos);
        const speed = 8 + Math.random() * 4;
        const velocity = new THREE.Vector3(0, 0, lane > 0 ? speed : -speed);
        if (lane < 0) group.rotation.y = Math.PI;

        this.scene.add(group);
        this.cars.push({ group, velocity, headlights, taillights });
    }

    private createSpot(x:number, y:number, z:number) {
        const s = new THREE.SpotLight(0xfffee0, 0, 30, 0.5, 0.5, 1);
        s.position.set(x,y,z);
        s.target.position.set(x, 0, z+5);
        return s;
    }
    private createTailLight(x:number, y:number, z:number) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.2,0.1), new THREE.MeshBasicMaterial({color:0x550000}));
        m.position.set(x,y,z);
        return m;
    }

    public update(dt: number, isNight: boolean) {
        for(const car of this.cars) {
            car.group.position.addScaledVector(car.velocity, dt);
            if (car.group.position.z > 60) car.group.position.z = -60;
            if (car.group.position.z < -60) car.group.position.z = 60;

            const intensity = isNight ? 2 : 0; 
            car.headlights.forEach(h => h.intensity = intensity);
            const tailColor = isNight ? 0xff0000 : 0x550000;
            car.taillights.forEach(t => {
                (t.material as THREE.MeshBasicMaterial).color.setHex(tailColor);
            });
        }
    }
}

// ============================================================================
// SISTEMA DE POBLACIÓN
// ============================================================================

class PopulationSystem {
  private scene: THREE.Scene;
  private humans: Human[] = [];

  constructor(scene: THREE.Scene, count: number) {
    this.scene = scene;
    for (let i = 0; i < count; i++) this.createHuman();
  }

  private createHuman() {
    const group = new THREE.Group();
    const color = new THREE.Color().setHSL(Math.random(), 0.6, 0.4);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.7), new THREE.MeshStandardMaterial({color}));
    body.position.y = 1.1;
    group.add(body);
    
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshStandardMaterial({color: 0xffccaa}));
    head.position.y = 1.6;
    group.add(head);

    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7);
    const leftLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({color:0x333344}));
    leftLeg.position.set(-0.12, 0.35, 0);
    group.add(leftLeg);
    const rightLeg = leftLeg.clone();
    rightLeg.position.set(0.12, 0.35, 0);
    group.add(rightLeg);

    const umb = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.2, 8, 1, true), new THREE.MeshStandardMaterial({color:0x111111, side:2}));
    cover.position.y = 0.5;
    umb.add(cover);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8), new THREE.MeshStandardMaterial({color:0x555555}));
    stick.position.y = 0.1;
    umb.add(stick);
    umb.position.set(0.2, 1.4, 0.2);
    umb.rotation.z = -0.2;
    umb.visible = false;
    group.add(umb);

    let x = 0;
    do { x = (Math.random() - 0.5) * 80; } while (Math.abs(x) < 9); 

    group.position.set(x, 0.1, (Math.random() - 0.5) * 80);
    this.scene.add(group);

    this.humans.push({
        group, target: this.getSafeTarget(group.position), speed: 1 + Math.random(),
        umbrella: umb, leftLeg, rightLeg
    });
  }

  private getSafeTarget(currentPos: THREE.Vector3): THREE.Vector3 {
      const isLeft = currentPos.x < 0;
      let x = isLeft ? -10 - Math.random() * 30 : 10 + Math.random() * 30;
      return new THREE.Vector3(x, 0.1, (Math.random() - 0.5) * 80);
  }

  public update(dt: number, isRaining: boolean) {
      const t = Date.now() * 0.005;
      for(const h of this.humans) {
          h.umbrella.visible = isRaining;
          const dir = new THREE.Vector3().subVectors(h.target, h.group.position);
          if (dir.length() < 0.5) h.target = this.getSafeTarget(h.group.position);
          else {
              dir.normalize();
              h.group.position.addScaledVector(dir, h.speed * dt);
              h.group.lookAt(h.target.x, h.group.position.y, h.target.z);
              h.leftLeg.rotation.x = Math.sin(t * h.speed) * 0.5;
              h.rightLeg.rotation.x = Math.sin(t * h.speed + Math.PI) * 0.5;
          }
      }
  }
}

// ============================================================================
// CONSTRUCTOR DE ESCENARIO
// ============================================================================

class SceneBuilder {
    private scene: THREE.Scene;
    public streetLights: THREE.PointLight[] = [];
    public windows: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene) { this.scene = scene; }

    public build() {
        this.createRoad();
        this.createSidewalks();
        this.createBuildings();
        this.createPark();
        this.createStreetLights();
    }

    private createRoad() {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(16, 200), new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.8}));
        road.rotation.x = -Math.PI/2;
        road.position.y = 0.02;
        road.receiveShadow = true;
        this.scene.add(road);

        const lineGeo = new THREE.PlaneGeometry(0.3, 4);
        const lineMat = new THREE.MeshBasicMaterial({color: 0xffffff});
        for(let z=-90; z<90; z+=8) {
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI/2;
            line.position.set(0, 0.03, z);
            this.scene.add(line);
        }
    }

    private createSidewalks() {
        const s1 = new THREE.Mesh(new THREE.PlaneGeometry(10, 200), new THREE.MeshStandardMaterial({color: 0x555555}));
        s1.rotation.x = -Math.PI/2;
        s1.position.set(-13, 0.05, 0);
        s1.receiveShadow = true;
        this.scene.add(s1);
        const s2 = s1.clone();
        s2.position.set(13, 0.05, 0);
        this.scene.add(s2);
    }

    private createBuildings() {
        for (let z = -80; z <= 80; z += 12) this.createDutchHouse(-22, 0, z);
        this.createChurch(0, 0, -90);
    }

    private createPark() {
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 200), new THREE.MeshStandardMaterial({color: 0x338833, roughness: 1}));
        grass.rotation.x = -Math.PI/2;
        grass.position.set(50, 0.04, 0);
        grass.receiveShadow = true;
        this.scene.add(grass);

        const lake = new THREE.Mesh(new THREE.CircleGeometry(15, 32), new THREE.MeshStandardMaterial({color: 0x0066aa, roughness: 0.1, metalness: 0.8}));
        lake.rotation.x = -Math.PI/2;
        lake.position.set(50, 0.06, 20);
        this.scene.add(lake);

        const swing = new THREE.Group();
        swing.position.set(40, 0, -20);
        const legGeo = new THREE.CylinderGeometry(0.1,0.1,4);
        const legMat = new THREE.MeshStandardMaterial({color:0x8d6e63});
        const l1 = new THREE.Mesh(legGeo, legMat); l1.position.set(-2, 2, 0); l1.rotation.z = 0.3;
        const l2 = new THREE.Mesh(legGeo, legMat); l2.position.set(2, 2, 0); l2.rotation.z = -0.3;
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,5), legMat);
        bar.rotation.z = Math.PI/2; bar.position.y = 3.8;
        swing.add(l1, l2, bar);
        this.scene.add(swing);

        this.createBench(35, 0, 20, Math.PI/2);
        this.createBench(65, 0, 20, -Math.PI/2);

        for(let i=0; i<30; i++) {
            const x = 30 + Math.random() * 40;
            const z = (Math.random() - 0.5) * 180;
            if (new THREE.Vector3(x,0,z).distanceTo(new THREE.Vector3(50,0,20)) > 16) this.createTree(x, 0, z);
        }
    }

    private createDutchHouse(x: number, y: number, z: number) {
        const color = new THREE.Color().setHSL(Math.random(), 0.6, 0.4);
        const w = 7, h = 10 + Math.random()*4, d = 8;
        const house = new THREE.Group();
        house.position.set(x, y, z);
        house.rotation.y = Math.PI/2;

        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({color}));
        body.position.y = h/2;
        body.castShadow = true;
        body.receiveShadow = true;
        house.add(body);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(d*0.8, 4, 4), new THREE.MeshStandardMaterial({color: 0x222222}));
        roof.position.y = h + 2;
        roof.rotation.y = Math.PI/4;
        roof.scale.set(1,1, w/d * 1.5);
        house.add(roof);

        const winMat = new THREE.MeshStandardMaterial({color: 0xffffaa, emissive: 0xffaa00, emissiveIntensity: 0});
        for(let wy=3; wy<h-1; wy+=3) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2), winMat);
            win.position.set(w/2+0.05, wy, 0);
            win.rotation.y = Math.PI/2;
            house.add(win);
            this.windows.push(win);
        }
        this.scene.add(house);
    }

    private createTree(x: number, y: number, z: number) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3), new THREE.MeshStandardMaterial({color:0x5d4037}));
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        group.add(trunk);
        const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(2), new THREE.MeshStandardMaterial({color:0x2e7d32}));
        leaves.position.y = 4;
        leaves.castShadow = true;
        group.add(leaves);
        this.scene.add(group);
    }

    private createBench(x: number, y: number, z: number, ry: number) {
        const bench = new THREE.Group();
        bench.position.set(x, y, z);
        bench.rotation.y = ry;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.6), new THREE.MeshStandardMaterial({color:0x5d4037}));
        seat.position.y = 0.5;
        bench.add(seat);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.6), new THREE.MeshStandardMaterial({color:0x222222}));
        const l1 = leg.clone(); l1.position.set(-0.8, 0.25, 0);
        const l2 = leg.clone(); l2.position.set(0.8, 0.25, 0);
        bench.add(l1, l2);
        this.scene.add(bench);
    }

    private createStreetLights() {
        for(let z=-80; z<=80; z+=20) {
            this.addLight(-9, z);
            this.addLight(9, z);
        }
    }

    private addLight(x: number, z: number) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,5), new THREE.MeshStandardMaterial({color:0x111111}));
        pole.position.set(x, 2.5, z);
        this.scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshBasicMaterial({color: 0xffaa00}));
        bulb.position.set(x, 5, z);
        this.scene.add(bulb);
        const light = new THREE.PointLight(0xffaa00, 0, 15);
        light.position.set(x, 4.5, z);
        this.scene.add(light);
        this.streetLights.push(light);
    }

    private createChurch(x: number, y: number, z: number) {
        const g = new THREE.Group();
        g.position.set(x,y,z);
        const base = new THREE.Mesh(new THREE.BoxGeometry(12, 15, 12), new THREE.MeshStandardMaterial({color:0x887766}));
        base.position.y = 7.5;
        base.castShadow=true;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 15, 4), new THREE.MeshStandardMaterial({color:0x333333}));
        roof.position.y = 22.5;
        roof.rotation.y = Math.PI/4;
        g.add(base, roof);
        this.scene.add(g);
    }
}

// ============================================================================
// APP PRINCIPAL (ESTABLE)
// ============================================================================

class App {
  private scene!: THREE.Scene;
  private perspectiveCamera!: THREE.PerspectiveCamera;
  private orthographicCamera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  
  private particleSystem!: WeatherParticleSystem;
  private cloudSystem!: CloudSystem;
  private sceneBuilder!: SceneBuilder;
  private populationSystem!: PopulationSystem;
  private trafficSystem!: TrafficSystem;
  
  private gui!: GUI;
  
  public timeOfDay = 12; 
  public timeSpeed = 1.0;
  
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  
  private lastTime = 0;
  private frameCount = 0;
  private fpsTime = 0;
  private stats = { fps: 0 };
  private usePerspective = true;

  constructor() {
    this.init();
    this.animate();
  }

  private init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.008);

    const aspect = window.innerWidth / window.innerHeight;
    this.perspectiveCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 300);
    this.perspectiveCamera.position.set(0, 30, 60);
    this.perspectiveCamera.lookAt(0, 0, 0);

    const fSize = 60;
    this.orthographicCamera = new THREE.OrthographicCamera(
        -fSize * aspect / 2, fSize * aspect / 2, fSize / 2, -fSize / 2, 0.1, 300
    );
    this.orthographicCamera.position.set(0, 40, 60);
    this.orthographicCamera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => this.onResize());

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(50, 100, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.scene.add(this.sunLight);

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({color: 0x111111}));
    plane.rotation.x = -Math.PI/2;
    plane.position.y = -0.1;
    this.scene.add(plane);

    this.sceneBuilder = new SceneBuilder(this.scene);
    this.sceneBuilder.build();

    // Configuración inicial del clima: SOLEADO (Clear)
    const weatherConfig: ParticleConfig = {
        emissionRate: 0, lifetime: 2, size: 0.8, speed: 18, windStrength: 0.5, gravity: -9.8, type: 'clear'
    };
    this.particleSystem = new WeatherParticleSystem(this.scene, weatherConfig);
    this.cloudSystem = new CloudSystem(this.scene);
    this.populationSystem = new PopulationSystem(this.scene, 40);
    this.trafficSystem = new TrafficSystem(this.scene, 15);

    this.controls = new OrbitControls(this.perspectiveCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI/2 - 0.05;

    this.setupGUI();
    this.setupStatsDisplay();
    this.setupKeyboard();
  }

  private getCurrentCamera(): THREE.Camera {
      return this.usePerspective ? this.perspectiveCamera : this.orthographicCamera;
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      // CAMBIO DE CÁMARA
      if (key === 'c') {
        this.usePerspective = !this.usePerspective;
        const newCam = this.getCurrentCamera();
        this.controls.object = newCam;
      }
      // AUDITORÍA (REQUISITO PDF)
      if (key === 'i') {
          console.log('--- AUDITORÍA DE GEOMETRÍA ---');
          console.log('Objetos en escena:', this.scene.children.length);
          console.log('Geometrías en memoria:', this.renderer.info.memory.geometries);
          console.log('Texturas en memoria:', this.renderer.info.memory.textures);
          console.log('Render Calls:', this.renderer.info.render.calls);
          console.log('Triángulos:', this.renderer.info.render.triangles);
          console.log('Partículas Activas:', this.particleSystem.getCount());
          console.log('------------------------------');
          alert("Auditoría ejecutada en Consola (F12)"); // Feedback visual para usuario
      }
    });
  }

  private setupGUI() {
    this.gui = new GUI();
    // params públicos para que se puedan escuchar
    const params = { 
        type: 'clear' as WeatherType, 
        emissionRate: 0,
        speed: 18,
        windStrength: 0.5,
        showHelper: false, 
        camera: 'Perspective' 
    };
    
    const wFolder = this.gui.addFolder('Clima');
    
    // Selector de Tipo
    wFolder.add(params, 'type', ['clear', 'rain', 'snow']).onChange((v: WeatherType) => {
        // Presets recomendados
        if (v === 'rain') { 
            params.emissionRate = 2500; 
            params.speed = 18; 
            params.windStrength = 0.5;
        } else if (v === 'snow') { 
            params.emissionRate = 1500; 
            params.speed = 3; 
            params.windStrength = 1.5; 
        } else {
            params.emissionRate = 0;
        }
        
        // Actualizar sistema
        this.particleSystem.updateConfig({ 
            type: v, 
            emissionRate: params.emissionRate, 
            speed: params.speed, 
            windStrength: params.windStrength 
        });
    });

    // Deslizadores RESTAURADOS (Con .listen() para que se actualicen solos al cambiar el preset)
    wFolder.add(params, 'emissionRate', 0, 5000).name('Densidad').listen().onChange((v: number) => {
        this.particleSystem.updateConfig({ emissionRate: v });
    });
    
    wFolder.add(params, 'speed', 0, 50).name('Velocidad').listen().onChange((v: number) => {
        this.particleSystem.updateConfig({ speed: v });
    });

    wFolder.add(params, 'windStrength', 0, 10).name('Viento').listen().onChange((v: number) => {
        this.particleSystem.updateConfig({ windStrength: v });
    });

    const tFolder = this.gui.addFolder('Tiempo');
    tFolder.add(this, 'timeSpeed', 0, 10).name('Velocidad Ciclo');
    tFolder.add(this, 'timeOfDay', 0, 24).listen().name('Hora (0-24)');

    const cFolder = this.gui.addFolder('Cámara');
    cFolder.add(params, 'camera', ['Perspective', 'Orthographic']).onChange((v: string) => {
        this.usePerspective = v === 'Perspective';
        const newCam = this.getCurrentCamera();
        this.controls.object = newCam;
    });

    const dFolder = this.gui.addFolder('Debug (PDF)');
    dFolder.add(params, 'showHelper').name('Mostrar Emitter Box').onChange((v: boolean) => {
        this.particleSystem.setHelperVisibility(v);
    });
  }

  private updateEnvironment(dt: number) {
      this.timeOfDay += dt * this.timeSpeed;
      if (this.timeOfDay >= 24) this.timeOfDay = 0;

      const h = this.timeOfDay;
      const isNight = h < 6 || h > 18;
      const ang = (h/24) * Math.PI * 2;
      this.sunLight.position.set(Math.sin(ang)*100, Math.cos(ang)*100, 0);

      let skyColor = new THREE.Color();
      if (isNight) {
          skyColor.set(0x050515);
          this.sunLight.intensity = 0;
          this.hemiLight.intensity = 0.1;
      } else {
          if (h > 6 && h < 8) skyColor.set(0xffaa55).lerp(new THREE.Color(0x87CEEB), (h-6)/2);
          else if (h > 16 && h < 18) skyColor.set(0x87CEEB).lerp(new THREE.Color(0xffaa55), (h-16)/2);
          else skyColor.set(0x87CEEB);
          this.sunLight.intensity = 1.2;
          this.hemiLight.intensity = 0.6;
      }
      
      if (this.particleSystem.config.type !== 'clear') {
          skyColor.lerp(new THREE.Color(0x222222), 0.8);
          this.sunLight.intensity *= 0.3;
      }

      this.scene.background = skyColor;
      if (this.scene.fog) (this.scene.fog as THREE.FogExp2).color = skyColor;

      const lightInt = isNight ? 2 : 0; 
      this.sceneBuilder.streetLights.forEach(l => l.intensity = lightInt);
      this.sceneBuilder.windows.forEach(w => (w.material as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 1 : 0);
      
      return isNight;
  }

  private setupStatsDisplay() {
      const div = document.createElement('div');
      div.id = 'stats';
      div.style.cssText = 'position:fixed;top:10px;left:10px;color:white;background:#00000088;padding:10px;font-family:monospace;pointer-events:none;';
      document.body.appendChild(div);
  }

  private updateStats(dt: number) {
      this.frameCount++;
      this.fpsTime += dt;
      if (this.fpsTime >= 0.5) {
          this.stats.fps = Math.round(this.frameCount/this.fpsTime);
          this.frameCount = 0; this.fpsTime = 0;
          const el = document.getElementById('stats');
          if(el) {
              const cam = this.usePerspective ? 'Perspectiva' : 'Ortográfica';
              el.innerHTML = `FPS: ${this.stats.fps}<br>Cámara: ${cam} (Tecla C)<br>Partículas: ${this.particleSystem.getCount()}<br>Tecla 'I' para Auditoría`;
          }
      }
  }

  private onResize() {
      const aspect = window.innerWidth/window.innerHeight;
      this.perspectiveCamera.aspect = aspect;
      this.perspectiveCamera.updateProjectionMatrix();
      
      const fSize = 60;
      this.orthographicCamera.left = -fSize * aspect / 2;
      this.orthographicCamera.right = fSize * aspect / 2;
      this.orthographicCamera.top = fSize / 2;
      this.orthographicCamera.bottom = -fSize / 2;
      this.orthographicCamera.updateProjectionMatrix();

      this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate() {
      requestAnimationFrame(() => this.animate());
      const now = performance.now();
      const dt = Math.min((now - this.lastTime)/1000, 0.1);
      this.lastTime = now;

      const isNight = this.updateEnvironment(dt);
      const wType = this.particleSystem.config.type;

      this.controls.update();
      const cam = this.getCurrentCamera();
      
      this.particleSystem.update(dt, cam);
      this.cloudSystem.update(dt, wType);
      this.trafficSystem.update(dt, isNight);
      this.populationSystem.update(dt, wType === 'rain');
      this.updateStats(dt);

      this.renderer.render(this.scene, cam);
  }
}

window.addEventListener('DOMContentLoaded', () => new App());