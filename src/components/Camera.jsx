import React, { useRef, useEffect } from "react";
import { OrbitControls } from "@react-three/drei";
import gsap from "gsap";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

function Camera({ animateTo, duration = 1 }) {
  const controlsRef = useRef();
  const sphericalRef = useRef(null);
  const tweenRef = useRef(null);
  const { camera, gl } = useThree(); // get camera + domElement

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });

  useEffect(() => {
    if (animateTo && controlsRef.current) {
      const controls = controlsRef.current;

      // compute current spherical offset (camera relative to target)
      const offset = new THREE.Vector3().subVectors(
        camera.position,
        controls.target
      );
      sphericalRef.current = new THREE.Spherical().setFromVector3(offset);

      if (tweenRef.current) tweenRef.current.kill();

      tweenRef.current = gsap.to(controls.target, {
        x: animateTo.x,
        y: animateTo.y + 0,
        z: animateTo.z + 0,
        duration,
        ease: "power1.inOut",
        onUpdate: () => {
          if (sphericalRef.current) {
            const newPos = new THREE.Vector3()
              .setFromSpherical(sphericalRef.current)
              .add(controls.target);
            camera.position.copy(newPos);
          }
          controls.update();
        },
        onComplete: () => {
          tweenRef.current = null;
        },
      });
    }
  }, [animateTo]);

  // track orbit changes
  useEffect(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;

    const handleInteraction = () => {
      const offset = new THREE.Vector3().subVectors(
        camera.position,
        controls.target
      );
      sphericalRef.current = new THREE.Spherical().setFromVector3(offset);
    };

    controls.addEventListener("change", handleInteraction);
    return () => {
      controls.removeEventListener("change", handleInteraction);
    };
  }, [camera]);

  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();

      const delta = e.deltaY > 0 ? 1 : -1;
      camera.fov = THREE.MathUtils.clamp(camera.fov + delta * 2, 45, 110);
      camera.updateProjectionMatrix();
    };

    gl.domElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => gl.domElement.removeEventListener("wheel", handleWheel);
  }, [camera, gl]);

  return (
    <OrbitControls
      makeDefault
      ref={controlsRef}
      reverseOrbit
      enablePan={true}
      minDistance={0}
      maxDistance={0.01}
      enableZoom={false}
      rotateSpeed={0.5}
    />
  );
}

export default Camera;
