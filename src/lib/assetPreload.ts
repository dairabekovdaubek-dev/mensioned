import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

THREE.Cache.enabled = true;

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

const characterModelFiles = [
  'models/outfits/fantasy/Male_Ranger.gltf',
  'models/outfits/fantasy/Female_Ranger.gltf',
  'models/outfits/fantasy/Male_Peasant.gltf',
  'models/outfits/fantasy/Female_Peasant.gltf',
  'models/animations/ual2-standard.glb',
];

const medievalFbxFiles = [
  'models/medieval-village/fbx/Prop_Wagon.fbx',
  'models/medieval-village/fbx/Prop_Crate.fbx',
  'models/medieval-village/fbx/Prop_WoodenFence_Single.fbx',
  'models/medieval-village/fbx/Prop_MetalFence_Simple.fbx',
  'models/medieval-village/fbx/Door_1_Round.fbx',
  'models/medieval-village/fbx/Roof_2x4_RoundTile.fbx',
  'models/medieval-village/fbx/Prop_Vine2.fbx',
  'models/medieval-village/fbx/Prop_Chimney.fbx',
  'models/medieval-village/fbx/Wall_Plaster_WoodGrid.fbx',
  'models/medieval-village/fbx/Wall_UnevenBrick_Straight.fbx',
  'models/medieval-village/fbx/Wall_Plaster_Window_Wide_Round.fbx',
  'models/medieval-village/fbx/Roof_Dormer_RoundTile.fbx',
  'models/medieval-village/fbx/Roof_Tower_RoundTiles.fbx',
  'models/medieval-village/fbx/Roof_Wooden_2x1.fbx',
  'models/medieval-village/fbx/Floor_UnevenBrick.fbx',
  'models/medieval-village/fbx/Floor_WoodDark.fbx',
  'models/medieval-village/fbx/Stairs_Exterior_Straight.fbx',
  'models/medieval-village/fbx/DoorFrame_Round_Brick.fbx',
  'models/medieval-village/fbx/WindowShutters_Wide_Round_Open.fbx',
  'models/medieval-village/fbx/Prop_Brick4.fbx',
  'models/medieval-village/fbx/Prop_MetalFence_Ornament.fbx',
  'models/medieval-village/fbx/Prop_ExteriorBorder_Straight1.fbx',
  'models/medieval-village/fbx/Prop_Support.fbx',
];

const textureFiles = [
  'textures/world-real/boulder_diff.jpg',
  'textures/world-real/covered_car_diff.jpg',
  'textures/world-real/fish_knife_diff.jpg',
  'textures/world-real/island_tree_bark_diff.jpg',
  'textures/world-real/island_tree_leaves_diff.png',
  'textures/world-real/medical_box_diff.jpg',
  'textures/world-real/rock_moss_diff.jpg',
  'textures/world-real/rocky_terrain_diff.jpg',
  'textures/world-real/service_pistol_diff.jpg',
  'textures/world-real/tree_stump_diff.jpg',
  'models/outfits/fantasy/T_Peasant_BaseColor.png',
  'models/outfits/fantasy/T_Ranger_BaseColor.png',
  'models/outfits/fantasy/T_Regular_Female_Dark_BaseColor.png',
  'models/outfits/fantasy/T_Regular_Male_Dark_BaseColor.png',
  'textures/world-real/medieval_plaster.png',
  'textures/world-real/medieval_rock_trim.png',
  'textures/world-real/medieval_roof_tiles.png',
  'textures/world-real/medieval_uneven_brick.png',
  'textures/world-real/medieval_wood_trim.png',
];

function disposeObject(object: THREE.Object3D) {
  object.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.geometry?.dispose();
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    for (const material of materials) material.dispose();
  });
}

export function useGameAssetPreload() {
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  const total = characterModelFiles.length + medievalFbxFiles.length + textureFiles.length;

  useEffect(() => {
    let cancelled = false;
    const gltfLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();
    const textureLoader = new THREE.TextureLoader();
    let completed = 0;
    let failures = 0;

    const finishOne = (ok: boolean) => {
      if (cancelled) return;
      completed += 1;
      if (!ok) failures += 1;
      setLoaded(completed);
      setFailed(failures);
      if (completed >= total) setDone(true);
    };

    setStarted(true);

    for (const file of characterModelFiles) {
      gltfLoader.load(
        assetPath(file),
        (gltf) => {
          disposeObject(gltf.scene);
          finishOne(true);
        },
        undefined,
        () => finishOne(false),
      );
    }

    for (const file of medievalFbxFiles) {
      fbxLoader.load(
        assetPath(file),
        (fbx) => {
          disposeObject(fbx);
          finishOne(true);
        },
        undefined,
        () => finishOne(false),
      );
    }

    for (const file of textureFiles) {
      textureLoader.load(
        assetPath(file),
        (texture) => {
          texture.dispose();
          finishOne(true);
        },
        undefined,
        () => finishOne(false),
      );
    }

    return () => {
      cancelled = true;
    };
  }, [total]);

  return useMemo(
    () => ({
      loaded,
      failed,
      total,
      started,
      progress: total > 0 ? Math.round((loaded / total) * 100) : 100,
      done,
    }),
    [done, failed, loaded, started, total],
  );
}
