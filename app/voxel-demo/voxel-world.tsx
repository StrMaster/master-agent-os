'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type BuildStage = 'frame' | 'drywall' | 'finished';

const STAGES: Array<{ id: BuildStage; label: string; detail: string }> = [
  { id: 'frame', label: 'Frame', detail: 'Timber structure' },
  { id: 'drywall', label: 'Drywall', detail: 'Board installation' },
  { id: 'finished', label: 'Finished', detail: 'Ready to sell' },
];

const COLORS = {
  sky: 0x9fc9df,
  grass: 0x5d7f50,
  concrete: 0x8d9193,
  timber: 0xc99052,
  timberDark: 0x8f5d31,
  drywall: 0xe5e1d6,
  drywallEdge: 0x9cb3bf,
  facade: 0xd8d1bf,
  roof: 0x414950,
  glass: 0x74b8cf,
  door: 0x6f4529,
  floor: 0xa97849,
  accent: 0x31c48d,
};

export default function VoxelWorld() {
  const hostRef = useRef<HTMLDivElement>(null);
  const rebuildRef = useRef<((stage: BuildStage) => void) | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [stage, setStage] = useState<BuildStage>('frame');
  const [removed, setRemoved] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [ready, setReady] = useState(false);

  const rebuild = useCallback((nextStage: BuildStage) => {
    setRemoved(0);
    rebuildRef.current?.(nextStage);
  }, []);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.sky, 22, 46);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(13, 9, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D voxel house construction scene');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 2.2, 0);
    controls.minDistance = 8;
    controls.maxDistance = 29;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.65;
    controlsRef.current = controls;

    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x43533d, 2.1);
    scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xfff1d6, 3.1);
    sun.position.set(9, 15, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    scene.add(sun);

    const groundMaterial = new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(36, 0.6, 36), groundMaterial);
    ground.position.y = -0.35;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(36, 36, 0xffffff, 0xffffff);
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.09;
    });
    scene.add(grid);

    const buildGroup = new THREE.Group();
    scene.add(buildGroup);

    const materials = new Map<number, THREE.MeshStandardMaterial>();
    const materialFor = (color: number, options?: { transparent?: boolean; opacity?: number }) => {
      const key = color + (options?.transparent ? 10_000_000 : 0);
      const existing = materials.get(key);
      if (existing) return existing;
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: options?.transparent ? 0.18 : 0.82,
        metalness: options?.transparent ? 0.08 : 0,
        transparent: options?.transparent,
        opacity: options?.opacity,
      });
      materials.set(key, material);
      return material;
    };

    const addBlock = (
      position: [number, number, number],
      size: [number, number, number],
      color: number,
      removable = true,
      transparent = false,
    ) => {
      const geometry = new THREE.BoxGeometry(...size);
      const mesh = new THREE.Mesh(
        geometry,
        materialFor(color, transparent ? { transparent: true, opacity: 0.58 } : undefined),
      );
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.removable = removable;
      buildGroup.add(mesh);
      return mesh;
    };

    const addStudWall = (z: number, startX: number, endX: number, opening?: [number, number]) => {
      addBlock([(startX + endX) / 2, 0.48, z], [endX - startX, 0.22, 0.22], COLORS.timberDark);
      addBlock([(startX + endX) / 2, 3.42, z], [endX - startX, 0.22, 0.22], COLORS.timberDark);
      for (let x = startX; x <= endX + 0.01; x += 0.72) {
        if (opening && x > opening[0] && x < opening[1]) continue;
        addBlock([x, 1.95, z], [0.2, 3.1, 0.2], COLORS.timber);
      }
      if (opening) {
        addBlock([(opening[0] + opening[1]) / 2, 2.72, z], [opening[1] - opening[0], 0.22, 0.22], COLORS.timberDark);
      }
    };

    const addSideStudWall = (x: number) => {
      addBlock([x, 0.48, 0], [0.22, 0.22, 7.4], COLORS.timberDark);
      addBlock([x, 3.42, 0], [0.22, 0.22, 7.4], COLORS.timberDark);
      for (let z = -3.7; z <= 3.71; z += 0.72) {
        const isWindow = z > -1.2 && z < 1.2;
        if (!isWindow) addBlock([x, 1.95, z], [0.2, 3.1, 0.2], COLORS.timber);
      }
      addBlock([x, 1.0, 0], [0.22, 0.2, 2.5], COLORS.timberDark);
      addBlock([x, 2.85, 0], [0.22, 0.2, 2.5], COLORS.timberDark);
      addBlock([x, 1.92, -1.22], [0.22, 1.65, 0.2], COLORS.timberDark);
      addBlock([x, 1.92, 1.22], [0.22, 1.65, 0.2], COLORS.timberDark);
    };

    const addPanelWall = (z: number, front = false, color = COLORS.drywall) => {
      for (let x = -4.5; x <= 4.5; x += 1.5) {
        const doorGap = front && x > -0.9 && x < 0.9;
        for (let y = 0.95; y <= 3.1; y += 1.08) {
          if (doorGap && y < 2.55) continue;
          addBlock([x, y, z], [1.42, 1, 0.16], color);
        }
      }
    };

    const addSidePanels = (x: number, color = COLORS.drywall) => {
      for (let z = -3.55; z <= 3.55; z += 1.42) {
        const windowGap = z > -1.4 && z < 1.4;
        for (let y = 0.95; y <= 3.1; y += 1.08) {
          if (windowGap && y > 1.05 && y < 2.95) continue;
          addBlock([x, y, z], [0.16, 1, 1.34], color);
        }
      }
    };

    const addRoof = () => {
      for (let row = 0; row < 5; row += 1) {
        const y = 3.68 + row * 0.34;
        const xOffset = row * 0.52;
        addBlock([-(2.3 + xOffset), y, 0], [0.54, 0.34, 8.4], COLORS.roof);
        addBlock([2.3 + xOffset, y, 0], [0.54, 0.34, 8.4], COLORS.roof);
      }
      addBlock([0, 5.12, 0], [4.8, 0.32, 8.4], COLORS.roof);
    };

    const addFurniture = () => {
      addBlock([-2.2, 0.72, -1.2], [2.7, 0.35, 1.1], COLORS.floor);
      addBlock([-3.35, 1.15, -1.2], [0.35, 1.2, 1.1], COLORS.floor);
      addBlock([2.65, 0.85, -2.35], [1.7, 0.15, 0.85], COLORS.drywallEdge);
      for (const x of [2.05, 3.25]) {
        for (const z of [-2.7, -2]) addBlock([x, 0.43, z], [0.16, 0.75, 0.16], COLORS.timberDark);
      }
      addBlock([0, 0.62, 1.6], [2.2, 0.18, 1.05], COLORS.timber);
      for (const x of [-0.85, 0.85]) {
        for (const z of [1.25, 1.95]) addBlock([x, 0.3, z], [0.16, 0.55, 0.16], COLORS.timberDark);
      }
    };

    const clearBuild = () => {
      for (const child of [...buildGroup.children]) {
        buildGroup.remove(child);
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      }
    };

    const build = (nextStage: BuildStage) => {
      clearBuild();
      addBlock([0, 0.2, 0], [10, 0.4, 8], COLORS.concrete, false);
      addBlock([0, 0.43, 0], [9.45, 0.08, 7.45], COLORS.floor, false);

      addStudWall(-3.7, -4.7, 4.7);
      addStudWall(3.7, -4.7, 4.7, [-0.82, 0.82]);
      addSideStudWall(-4.7);
      addSideStudWall(4.7);

      if (nextStage === 'drywall' || nextStage === 'finished') {
        const wallColor = nextStage === 'finished' ? COLORS.facade : COLORS.drywall;
        addPanelWall(-3.82, false, wallColor);
        addPanelWall(3.82, true, wallColor);
        addSidePanels(-4.82, wallColor);
        addSidePanels(4.82, wallColor);
        addBlock([0, 1.62, 3.78], [1.5, 2.35, 0.18], COLORS.door);
        addBlock([-4.86, 1.95, 0], [0.13, 1.65, 2.3], COLORS.glass, false, true);
        addBlock([4.86, 1.95, 0], [0.13, 1.65, 2.3], COLORS.glass, false, true);
      }

      if (nextStage === 'finished') {
        addRoof();
        addFurniture();
        addBlock([0, 0.82, 4.55], [2.7, 0.18, 1.2], COLORS.concrete, false);
        addBlock([0, 1.05, 4.55], [1.8, 0.22, 0.85], COLORS.accent, true);
      }
    };

    rebuildRef.current = build;
    build('frame');

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 7) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(buildGroup.children, false).find((item) => item.object.userData.removable);
      if (!hit) return;
      const mesh = hit.object as THREE.Mesh;
      buildGroup.remove(mesh);
      mesh.geometry.dispose();
      setRemoved((value) => value + 1);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let animationFrame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    setReady(true);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      clearBuild();
      ground.geometry.dispose();
      groundMaterial.dispose();
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      rebuildRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-neutral-950/85 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {STAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setStage(item.id);
                rebuild(item.id);
              }}
              className={`min-w-max rounded-xl border px-3 py-2 text-left transition ${
                stage === item.id
                  ? 'border-emerald-400/70 bg-emerald-400/15 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="block text-[11px] opacity-60">{item.detail}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setAutoRotate((value) => !value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            {autoRotate ? 'Pause rotation' : 'Auto rotate'}
          </button>
          <button
            type="button"
            onClick={() => rebuild(stage)}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-white/85"
          >
            Reset build
          </button>
        </div>
      </div>

      <div className="relative h-[62vh] min-h-[430px] max-h-[760px] bg-sky-300">
        <div ref={hostRef} className="absolute inset-0" />
        {!ready && (
          <div className="absolute inset-0 grid place-items-center bg-neutral-950 text-sm text-white/60">
            Building voxel world…
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-black/10 bg-black/55 px-3 py-2 text-xs text-white/90 backdrop-blur sm:left-4 sm:top-4">
          <p className="font-semibold">Drag to rotate · Pinch to zoom</p>
          <p className="mt-1 text-white/60">Tap a building piece to remove it</p>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-black/10 bg-black/55 px-3 py-2 text-xs text-white/90 backdrop-blur sm:bottom-4 sm:left-4">
          <span className="text-white/55">Removed pieces</span>
          <strong className="ml-2 text-emerald-300">{removed}</strong>
        </div>
      </div>
    </section>
  );
}
