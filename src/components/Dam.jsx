import React, { useEffect, useState } from "react";
import { GLTFLoader } from "three-stdlib";
import * as THREE from "three";
import { loadDAMasGLB } from "../utils/DamToGlb.js";

export default function DamModel() {
  const [object, setObject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build GLB ArrayBuffer from DAM and load with GLTFLoader
        const glbArrayBuffer = await loadDAMasGLB("/models/space.dam", {
          textureBaseDir:
            "/assets/~/9f5b00307bb34df69166302bf1155987_50k_texture_jpg_low",
        });

        const gltfLoader = new GLTFLoader();
        await new Promise((resolve, reject) => {
          gltfLoader.parse(
            glbArrayBuffer,
            "",
            (gltf) => {
              const scene = gltf.scene || gltf.scenes?.[0];
              if (!scene) return reject(new Error("Empty GLB scene"));
              scene.traverse((child) => {
                if (child.isMesh) {
                  if (child.material) {
                    const materials = Array.isArray(child.material)
                      ? child.material
                      : [child.material];
                    materials.forEach((mat) => {
                      if (mat.map) {
                        // mat.map.flipZ = false;
                        mat.map.needsUpdate = true;
                      }
                      mat.side = THREE.DoubleSide;
                      mat.needsUpdate = true;
                    });
                  }
                  child.castShadow = false;
                  child.receiveShadow = false;
                }
              });
              setObject(scene);
              resolve();
            },
            (err) => reject(err)
          );
        });
      } catch (err) {
        console.error("Error loading DAM model:", err);
        setError(
          err?.message ||
            "Failed to load DAM model. Ensure /models/space.dam and /models/dam.proto exist in public/models."
        );
      } finally {
        setLoading(false);
      }
    };

    loadModel();
  }, []);

  if (loading) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="gray" />
      </mesh>
    );
  }

  if (error) {
    console.error("DAM loading error:", error);
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="red" />
      </mesh>
    );
  }

  if (!object) return null;

  return <primitive object={object} rotation={[0, 0, 0]} />;
}
