// assets.js — generic, fault-tolerant GLB/glTF loading.
//
// The whole point of this module: NOTHING in the game breaks if an asset is
// missing. Every call site keeps its procedural primitive as a visual
// fallback and only swaps to the loaded model if/when it successfully
// arrives. Drop a real .glb into /assets/models/ using the filenames below
// (see README "ترقية الواقعية") and the upgrade happens automatically on
// next reload — no other code changes needed.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const cache = new Map();

/**
 * Attempts to load a .glb/.gltf file. Resolves to `null` (never rejects)
 * if the file is missing or fails to parse, so callers can always fall
 * back to a procedural placeholder without a try/catch of their own.
 */
export async function tryLoadModel(url) {
  if (cache.has(url)) return cache.get(url);
  const promise = new Promise((resolve) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      () => resolve(null), // 404 or parse error — silently fall back
    );
  });
  cache.set(url, promise);
  return promise;
}

/**
 * Loads a character model expected to contain animation clips (e.g. exported
 * from Mixamo). Returns { scene, mixer, actions } or null on failure.
 * `actions` maps a lowercased clip name to a THREE.AnimationAction so
 * ai.js can do actions['idle']?.play() etc. regardless of exact naming,
 * as long as clips are named idle/walk/run/dance (case-insensitive).
 */
export async function tryLoadCharacter(url) {
  const gltf = await tryLoadModel(url);
  if (!gltf) return null;

  const scene = gltf.scene;
  scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const mixer = new THREE.AnimationMixer(scene);
  const actions = {};
  for (const clip of gltf.animations ?? []) {
    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
  }
  return { scene, mixer, actions };
}

/**
 * Loads a static decorative prop (chandelier, furniture...). Returns the
 * loaded THREE.Group, or null on failure — caller keeps its procedural
 * version in that case.
 */
export async function tryLoadProp(url) {
  const gltf = await tryLoadModel(url);
  if (!gltf) return null;
  gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return gltf.scene;
}
