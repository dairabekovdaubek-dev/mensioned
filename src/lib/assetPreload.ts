import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

const GLTF_ASSETS = [
  'models/outfits/fantasy/Male_Ranger.gltf',
  'models/outfits/fantasy/Female_Ranger.gltf',
  'models/outfits/fantasy/Male_Peasant.gltf',
  'models/outfits/fantasy/Female_Peasant.gltf',
  'models/animations/ual2-standard.glb',
  'models/medieval/Prop_Wagon.gltf',
  'models/medieval/Prop_Crate.gltf',
  'models/medieval/Prop_WoodenFence_Single.gltf',
  'models/medieval/Prop_MetalFence_Simple.gltf',
  'models/medieval/Door_1_Round.gltf',
  'models/medieval/Roof_2x4_RoundTile.gltf',
  'models/medieval/Prop_Vine1.gltf',
  'models/medieval/Prop_Chimney.gltf',
  'models/medieval-village/glTF/Wall_Plaster_WoodGrid.gltf',
  'models/medieval-village/glTF/Wall_UnevenBrick_Straight.gltf',
  'models/medieval-village/glTF/Wall_Plaster_Window_Wide_Round.gltf',
  'models/medieval-village/glTF/Roof_Dormer_RoundTile.gltf',
  'models/medieval-village/glTF/Roof_Tower_RoundTiles.gltf',
  'models/medieval-village/glTF/Roof_Wooden_2x1.gltf',
  'models/medieval-village/glTF/Floor_UnevenBrick.gltf',
  'models/medieval-village/glTF/Floor_WoodDark.gltf',
  'models/medieval-village/glTF/Stairs_Exterior_Straight.gltf',
  'models/medieval-village/glTF/DoorFrame_Round_Brick.gltf',
  'models/medieval-village/glTF/WindowShutters_Wide_Round_Open.gltf',
  'models/medieval-village/glTF/Prop_Brick4.gltf',
  'models/medieval-village/glTF/Prop_Vine2.gltf',
  'models/medieval-village/glTF/Prop_MetalFence_Ornament.gltf',
  'models/medieval-village/glTF/Prop_ExteriorBorder_Straight1.gltf',
  'models/medieval-village/glTF/Prop_Support.gltf',
];

const TEXTURE_ASSETS = [
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
  'models/outfits/fantasy/T_Peasant_Normal.png',
  'models/outfits/fantasy/T_Peasant_ORM.png',
  'models/outfits/fantasy/T_Ranger_BaseColor.png',
  'models/outfits/fantasy/T_Ranger_Normal.png',
  'models/outfits/fantasy/T_Ranger_ORM.png',
  'models/outfits/fantasy/T_Regular_Female_Dark_BaseColor.png',
  'models/outfits/fantasy/T_Regular_Female_Normal.png',
  'models/outfits/fantasy/T_Regular_Female_Roughness.png',
  'models/outfits/fantasy/T_Regular_Male_Dark_BaseColor.png',
  'models/outfits/fantasy/T_Regular_Male_Normal.png',
  'models/outfits/fantasy/T_Regular_Male_Roughness.png',
  'models/medieval/T_Brick_BaseColor.png',
  'models/medieval/T_Brick_Normal.png',
  'models/medieval/T_Brick_Roughness.png',
  'models/medieval/T_RockTrim_BaseColor.png',
  'models/medieval/T_RockTrim_Normal.png',
  'models/medieval/T_RockTrim_ORM.png',
  'models/medieval/T_RoundTiles_BaseColor.png',
  'models/medieval/T_RoundTiles_Normal.png',
  'models/medieval/T_RoundTiles_Roughness.png',
  'models/medieval/T_VineLeaf_png.png',
  'models/medieval/T_WoodTrim_BaseColor.png',
  'models/medieval/T_WoodTrim_Normal.png',
  'models/medieval/T_WoodTrim_Roughness.png',
  'models/medieval-village/glTF/T_Brick_BaseColor.png',
  'models/medieval-village/glTF/T_Brick_Normal.png',
  'models/medieval-village/glTF/T_Brick_Roughness.png',
  'models/medieval-village/glTF/T_BrushedNoise.png',
  'models/medieval-village/glTF/T_Noise_Terrain.png',
  'models/medieval-village/glTF/T_Plaster_BaseColor.png',
  'models/medieval-village/glTF/T_Plaster_Normal.png',
  'models/medieval-village/glTF/T_Plaster_ORM.png',
  'models/medieval-village/glTF/T_RedBrick_BaseColor.png',
  'models/medieval-village/glTF/T_RockTrim_BaseColor.png',
  'models/medieval-village/glTF/T_RockTrim_Normal.png',
  'models/medieval-village/glTF/T_RockTrim_ORM.png',
  'models/medieval-village/glTF/T_RoundTiles_BaseColor.png',
  'models/medieval-village/glTF/T_RoundTiles_Normal.png',
  'models/medieval-village/glTF/T_RoundTiles_Roughness.png',
  'models/medieval-village/glTF/T_UnevenBrick_BaseColor.png',
  'models/medieval-village/glTF/T_UnevenBrick_Normal.png',
  'models/medieval-village/glTF/T_UnevenBrick_Roughness.png',
  'models/medieval-village/glTF/T_VineLeaf.png',
  'models/medieval-village/glTF/T_VineLeaf_png.png',
  'models/medieval-village/glTF/T_WoodTrim_BaseColor.png',
  'models/medieval-village/glTF/T_WoodTrim_Normal.png',
  'models/medieval-village/glTF/T_WoodTrim_ORM.png',
  'models/medieval-village/glTF/T_WoodTrim_Roughness.png',
];

export function useGameAssetPreload() {
  const [loaded, setLoaded] = useState(0);
  const [started, setStarted] = useState(false);
  const total = useMemo(() => GLTF_ASSETS.length + TEXTURE_ASSETS.length, []);

  useEffect(() => {
    let cancelled = false;
    const gltfLoader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const mark = () => {
      if (!cancelled) setLoaded((value) => Math.min(total, value + 1));
    };

    setStarted(true);
    for (const path of GLTF_ASSETS) {
      gltfLoader.load(assetPath(path), mark, undefined, mark);
    }
    for (const path of TEXTURE_ASSETS) {
      textureLoader.load(assetPath(path), mark, undefined, mark);
    }

    return () => {
      cancelled = true;
    };
  }, [total]);

  return {
    loaded,
    total,
    started,
    progress: total === 0 ? 100 : Math.round((loaded / total) * 100),
    done: loaded >= total,
  };
}
