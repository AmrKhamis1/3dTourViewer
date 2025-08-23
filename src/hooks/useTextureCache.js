import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const cache = new Map();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        cache.set(url, texture);
        resolve(texture);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

function loadGLB(url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        cache.set(url, gltf);
        resolve(gltf);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

function isImage(url) {
  return url.match(/\.(jpg|jpeg|png|webp|bmp)$/i);
}
function isGLB(url) {
  return url.match(/\.(glb|gltf)$/i);
}

export default function useTextureCache(assetList = []) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assets, setAssets] = useState({});
  const total = assetList.length;

  useEffect(() => {
    let cancelled = false;
    if (!assetList.length) {
      setIsLoading(false);
      setProgress(1);
      return;
    }
    setIsLoading(true);
    setProgress(0);
    setError(null);
    let loaded = 0;
    const results = {};
    Promise.all(
      assetList.map(async (url) => {
        if (cache.has(url)) {
          results[url] = cache.get(url);
          loaded++;
          setProgress(loaded / total);
          return cache.get(url);
        }
        try {
          let asset;
          if (isImage(url)) {
            asset = await loadImage(url);
          } else if (isGLB(url)) {
            asset = await loadGLB(url);
          } else {
            throw new Error("Unsupported asset type: " + url);
          }
          results[url] = asset;
          loaded++;
          setProgress(loaded / total);
          return asset;
        } catch (err) {
          setError(err);
          loaded++;
          setProgress(loaded / total);
        }
      })
    ).then(() => {
      if (!cancelled) {
        setAssets(results);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(assetList)]);

  const get = useCallback((url) => cache.get(url), []);

  return { isLoading, progress, error, assets, get };
}
