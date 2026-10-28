// Schematic 3D bedside: patient on a bed, radial (or femoral) catheter, tubing, transducer on an IV pole,
// pressure bag, and the phlebostatic axis. Reads the rig state; never owns it. Units: cm, y up, floor at 0.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...o });
const POLE = new THREE.Vector3(5, 0, 78);

function sprite(text, color = '#e8eef6') {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 512; c.height = 96;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.renderOrder = 10; s.scale.set(40, 7.5, 1);
  s.userData.set = (t, col = color) => {
    if (s.userData.text === t + col) return; s.userData.text = t + col;
    g.clearRect(0, 0, 512, 96); g.font = '600 40px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(500, g.measureText(t).width + 30); g.fillStyle = '#0b1119cc'; g.fillRect(256 - w / 2, 14, w, 68);
    g.fillStyle = col; g.fillText(t, 256, 49); s.material.map.needsUpdate = true;
  };
  s.userData.set(text); return s;
}

export class Bedside {
  constructor(mount) {
    this.mount = mount;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    mount.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.resetView();
    this.scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x20242c, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-80, 260, 160); this.scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(260, 48), mat(0x1a222d)); floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    this.labelsOn = true; this.onDrag = null; this.onStopcock = null;
    this.build();
    // drag the transducer up and down; click the stopcock to turn it
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane();
    const pointer = (e) => { const r = this.renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, this.camera); };
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      pointer(e);
      const hit = ray.intersectObjects([this.tx, this.cock], true)[0];
      if (!hit) return;
      if (hit.object === this.cock || hit.object.parent === this.cock) { this.onStopcock?.(); return; }
      this.dragging = true; this.controls.enabled = false; el.setPointerCapture(e.pointerId);
      plane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize(), this.tx.position);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return; pointer(e);
      const p = new THREE.Vector3(); if (ray.ray.intersectPlane(plane, p)) this.onDrag?.(Math.round(Math.min(150, Math.max(60, p.y))));
    });
    for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, () => { this.dragging = false; this.controls.enabled = true; });
    new ResizeObserver(() => this.resize()).observe(mount); this.resize();
  }
  resetView() { this.camera.position.set(150, 200, 330); this.controls.target.set(-5, 95, 30); this.controls.update(); }
  resize() { const w = this.mount.clientWidth || 1, h = this.mount.clientHeight || 1; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  build() {
    const S = this.scene;
    // bed + patient move together when the bed height changes
    this.bed = new THREE.Group(); S.add(this.bed);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(200, 8, 90), mat(0x3a4656)); frame.position.set(0, -26, 0); this.bed.add(frame);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(196, 10, 86), mat(0x6c7d92)); mattress.position.set(0, -17, 0); this.bed.add(mattress);
    for (const x of [-90, 90]) for (const z of [-38, 38]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 74), mat(0x2a323d)); leg.position.set(x, -67, z); this.bed.add(leg); }
    const skin = mat(0xd9a68a);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(13, 60, 6, 16), mat(0x5b7fa6)); torso.rotation.z = Math.PI / 2; torso.scale.set(1, 1, 1.4); torso.position.set(-30, 0, 0); this.bed.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 14), skin); head.position.set(-82, 2, 0); this.bed.add(head);
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(10, 70, 6, 12), mat(0x4a6a8f)); legs.rotation.z = Math.PI / 2; legs.scale.set(1, 1, 1.5); legs.position.set(45, -4, 0); this.bed.add(legs);
    // right arm out on an arm board toward the pole (patient's right = +z here)
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(4, 48, 4, 10), skin); arm.rotation.x = Math.PI / 2; arm.position.set(-50, -6, 45); this.bed.add(arm);
    const board = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 50), mat(0x3a4656)); board.position.set(-50, -11, 50); this.bed.add(board);
    this.wrist = new THREE.Vector3(-50, -5, 68); this.groin = new THREE.Vector3(8, 6, 10);
    // phlebostatic axis: 4th intercostal space, mid-axillary line (mid-chest depth)
    this.axisDot = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), mat(0x36e2b4, { emissive: 0x36e2b4, emissiveIntensity: 0.8 }));
    this.axisDot.position.set(-42, 0, 18); this.bed.add(this.axisDot);
    this.axisLine = this.dashed(0x36e2b4); S.add(this.axisLine);
    this.txLine = this.dashed(0xffb02e); S.add(this.txLine);
    // IV pole, bag, transducer
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 210), mat(0xb8c4d2, { metalness: 0.6, roughness: 0.3 })); pole.position.copy(POLE).setY(105); S.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 3, 5), mat(0x2a323d)); base.position.copy(POLE).setY(2); S.add(base);
    this.bag = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 14), mat(0x8fb8ff, { transparent: true, opacity: 0.75 })); this.bag.scale.set(1, 1.6, 0.6); this.bag.position.set(POLE.x + 10, 182, POLE.z); S.add(this.bag);
    this.tx = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 5), mat(0xeef3f8)); this.tx.add(body);
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2, 16), mat(0x9fe3ff, { transparent: true, opacity: 0.8 })); dome.rotation.x = Math.PI / 2; dome.position.z = 3; this.tx.add(dome);
    this.cock = new THREE.Group(); const handle = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 1.4), mat(0x2f8cff)); handle.position.y = 3; this.cock.add(handle);
    this.cock.position.set(-7, 0, 0); this.tx.add(this.cock);
    S.add(this.tx);
    this.damperMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 6, 12), mat(0xffd23f)); S.add(this.damperMesh);
    this.clot = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), mat(0x6b0a12)); S.add(this.clot);
    this.bubbles = [0, 1, 2].map(() => { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 })); S.add(b); return b; });
    this.cath = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 6), mat(0xffd23f)); S.add(this.cath);
    this.tube = null; this.flushTube = null;
    this.lbl = { axis: sprite('Phlebostatic axis', '#36e2b4'), tx: sprite('Transducer', '#ffb02e'), bag: sprite('Bag 300 mmHg'), cock: sprite('Stopcock: patient') };
    for (const l of Object.values(this.lbl)) S.add(l);
  }
  dashed(color) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: 4, gapSize: 3, depthTest: false })); l.renderOrder = 5; return l;
  }
  setLine(l, a, b) { l.geometry.setFromPoints([a, b]); l.computeLineDistances(); }
  tubeMesh(points, color, r = 0.9) {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 120, r, 8), mat(color, { transparent: true, opacity: 0.85 }));
    this.scene.add(m); return m;
  }
  setLabels(on) { this.labelsOn = on; for (const l of Object.values(this.lbl)) l.visible = on; }

  /** sys from the rig; site 'radial' | 'aortic'; flushing: flush valve open */
  update(sys, site, flushing, t = 0) {
    const bedY = sys.axisH; this.bed.position.set(0, bedY, 0);
    const txP = new THREE.Vector3(POLE.x - 6, sys.txH, POLE.z); this.tx.position.copy(txP);
    this.cock.rotation.z = sys.stopcock === 'air' ? Math.PI / 2 : 0;
    const axisW = this.axisDot.getWorldPosition(new THREE.Vector3());
    this.setLine(this.axisLine, axisW, new THREE.Vector3(POLE.x, axisW.y, POLE.z));
    this.setLine(this.txLine, txP, new THREE.Vector3(axisW.x, txP.y, axisW.z));
    this.txLine.visible = Math.abs(sys.txH - sys.axisH) >= 1;
    const tip = (site === 'aortic' ? this.groin : this.wrist).clone().add(this.bed.position);
    this.cath.position.copy(tip);
    const key = JSON.stringify([sys.kink, sys.extension, sys.damper, sys.txH, sys.axisH, site]);
    if (key !== this.key) {
      this.key = key; this.tube?.removeFromParent(); this.flushTube?.removeFromParent();
      const a = tip, b = txP.clone().add(new THREE.Vector3(-7, 0, 0)), mid = a.clone().lerp(b, 0.5);
      const pts = [a, a.clone().add(new THREE.Vector3(0, 2, 8))];
      if (sys.kink) pts.push(a.clone().add(new THREE.Vector3(6, 3, 14)), a.clone().add(new THREE.Vector3(-1, 3.4, 15)), a.clone().add(new THREE.Vector3(5, 3, 17)));
      if (sys.extension) pts.push(mid.clone().setY(25), mid.clone().add(new THREE.Vector3(30, 0, 10)).setY(20));
      else pts.push(mid.clone().setY(Math.min(a.y, b.y) - 15));
      pts.push(b);
      this.tubePts = pts; this.tube = this.tubeMesh(pts, sys.kink ? 0xff9a9a : 0xdfe8f2);
      this.flushTube = this.tubeMesh([txP.clone().add(new THREE.Vector3(5, 0, 0)), new THREE.Vector3(POLE.x + 8, (txP.y + 172) / 2, POLE.z + 3), new THREE.Vector3(POLE.x + 10, 172, POLE.z)], 0xdfe8f2, 0.6);
      this.curve = new THREE.CatmullRomCurve3(pts);
    }
    this.damperMesh.visible = sys.damper; if (sys.damper) this.damperMesh.position.copy(this.curve.getPoint(0.85));
    this.clot.visible = sys.clot; this.clot.position.copy(tip);
    const nb = sys.airLarge ? 3 : sys.airSmall ? 1 : 0;
    this.bubbles.forEach((b, i) => {
      b.visible = i < nb; if (!b.visible) return;
      b.position.copy(this.curve.getPoint(0.9 - i * 0.05)); b.position.y += 0.3 * Math.sin(t * 3 + i);
      b.scale.setScalar(sys.airLarge ? 1.8 : 1.1);
    });
    const fill = Math.max(0.35, Math.min(1, sys.bag / 300)); this.bag.scale.set(fill, 1.6 * (0.6 + 0.4 * fill), 0.6 * fill);
    this.bag.material.color.set(flushing ? 0xffd23f : sys.bag >= 250 ? 0x8fb8ff : 0xff8a8a);
    const off = Math.round((sys.txH - sys.axisH)), lp = (s, v) => s.position.copy(v);
    lp(this.lbl.axis, axisW.clone().add(new THREE.Vector3(0, 22, 0)));
    lp(this.lbl.tx, txP.clone().add(new THREE.Vector3(0, -12, 18)));
    this.lbl.tx.userData.set(off ? `Transducer ${Math.abs(off)} cm ${off > 0 ? 'above' : 'below'}` : 'Transducer level', off ? '#ffb02e' : '#36e2b4');
    lp(this.lbl.bag, this.bag.position.clone().add(new THREE.Vector3(0, 24, 0)));
    this.lbl.bag.userData.set(`Bag ${Math.round(sys.bag)} mmHg`, sys.bag >= 250 ? '#e8eef6' : '#ff6b6b');
    lp(this.lbl.cock, txP.clone().add(new THREE.Vector3(-8, 13, 0)));
    this.lbl.cock.userData.set(`Stopcock: ${sys.stopcock === 'air' ? 'OPEN TO AIR' : 'to patient'}`, sys.stopcock === 'air' ? '#ffb02e' : '#e8eef6');
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
