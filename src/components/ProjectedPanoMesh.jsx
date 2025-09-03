import React, { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import gsap from "gsap";
import panoVertex from "../shaders/panoMesh/panoMeshVertex.glsl.js";
import panoFragment from "../shaders/panoMesh/panoMeshFragment.glsl.js";

export default function ProjectedPanoMesh({
  modelUrl = "./models/ss2.glb",
  cubeFaces,
  panoPosition = null,
  mpQuaternion = null,
  faceOrder = [2, 4, 0, 5, 1, 3],
  updateAnimation,
  onMeshClick, // new prop
  duration = 1,
}) {
  const groupRef = useRef();
  const { nodes, scene } = useGLTF(modelUrl);
  // store current uniforms outside useMemo
  const materialRef = useRef();
  // ordered faces
  const orderedFaces = useMemo(() => {
    return faceOrder.map((i) => cubeFaces[i]);
  }, [cubeFaces, faceOrder]);

  // init material with dummy textures
  const material = useMemo(() => {
    const dummy = new THREE.CubeTexture();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uEnvMapOld: { value: dummy },
        uEnvMapNew: { value: dummy },
        uMix: { value: 0 },
        uPanoPos: { value: new THREE.Vector3() },
        uPanoPos2: { value: new THREE.Vector3() },
        uPanoQuat: { value: new THREE.Quaternion() },
        uPanoQuat2: {
          value: new THREE.Quaternion(),
        },
      },
      vertexShader: panoVertex,
      fragmentShader: panoFragment,
      side: THREE.DoubleSide,
      wireframe: false,
    });
    materialRef.current = mat;
    return mat;
  }, []);

  // load the first pano on mount
  useEffect(() => {
    const loader = new THREE.CubeTextureLoader();
    loader.load(orderedFaces, (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      tex.mapping = THREE.CubeReflectionMapping;
      materialRef.current.uniforms.uEnvMapOld.value = tex;
    });
  }, []);

  // whenever cubeFaces changes → fade transition
  useEffect(() => {
    if (!materialRef.current) return;

    const loader = new THREE.CubeTextureLoader();
    loader.load(orderedFaces, (tex) => {
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipMapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.encoding = THREE.sRGBEncoding;
      tex.mapping = THREE.CubeReflectionMapping;

      const uniforms = materialRef.current.uniforms;

      // set new pano
      uniforms.uEnvMapNew.value = tex;
      uniforms.uPanoQuat2.value = mpQuaternion || new THREE.Quaternion();
      uniforms.uPanoPos2.value = panoPosition || new THREE.Vector3();
      gsap.killTweensOf(uniforms.uMix);

      gsap.to(uniforms.uMix, {
        value: 1,
        duration,
        ease: "power1.inOut",
        onInterrupt: () => {
          uniforms.uMix.value = 0; // reset for interruption transition
        },
        onComplete: () => {
          // commit new → old
          uniforms.uEnvMapOld.value = uniforms.uEnvMapNew.value;
          uniforms.uPanoPos.value = uniforms.uPanoPos2.value;
          uniforms.uPanoQuat.value.copy(uniforms.uPanoQuat2.value);
          uniforms.uMix.value = 0; // reset for next transition
          updateAnimation(false);
        },
      });
    });
  }, [orderedFaces, mpQuaternion, panoPosition]);

  return (
    <group
      ref={groupRef}
      scale={scene?.scale}
      position={scene?.position}
      rotation={scene?.rotation}
    >
      <mesh material={material} position={panoPosition}>
        <boxGeometry args={[55, 55, 55]}></boxGeometry>
      </mesh>
      {Object.entries(nodes).map(([key, node]) =>
        node?.isMesh ? (
          <mesh
            key={key}
            geometry={node.geometry}
            material={material}
            scale={node.scale}
            frustumCulled={false}
          />
        ) : null
      )}
    </group>
  );
}
