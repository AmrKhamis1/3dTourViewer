import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useLoader, useThree } from "@react-three/fiber";

export default function HoverCursor({
  texturePath = "/images/point.png",
  size = 0.35,
  offset = 0.03,
  opacity = 1,
  exclude = (obj) =>
    obj?.name === "hover-cursor" || obj?.geometry?.type === "BoxGeometry",
  roomPoints = [], // [{ index, position: {x,y,z} }]
  onSelectRoom, // (index) => void
  clickToNearest = true,
  currentPosition = null, // {x,y,z}
  currentRoomIndex = null,
}) {
  const {
    camera,
    scene,
    pointer,
    raycaster,
    size: viewportSize,
    gl,
  } = useThree();
  const texture = useLoader(THREE.TextureLoader, texturePath);
  const meshRef = useRef();
  const [visible, setVisible] = useState(false);
  const lastHitRef = useRef({ point: null, object: null });
  const isDraggingRef = useRef(false);
  const downPosRef = useRef({ x: 0, y: 0 });

  const material = useMemo(() => {
    texture.anisotropy = 4;
    texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: true,
      opacity,
    });
  }, [texture, opacity]);

  useFrame(() => {
    // r3f keeps pointer in NDC already
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster
      .intersectObjects(scene.children, true)
      .filter((i) => i.object?.isMesh && !exclude(i.object));

    if (intersects.length === 0) {
      setVisible(false);
      lastHitRef.current = { point: null, object: null };
      return;
    }

    const hit = intersects[0];
    const point = hit.point;
    const normal = hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0);
    // transform normal to world space
    normal.transformDirection(hit.object.matrixWorld).normalize();

    // position slightly off the surface to avoid z-fighting
    const pos = new THREE.Vector3().copy(point).addScaledVector(normal, offset);

    // orient plane so that its +Z faces along the surface normal
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal
    );

    if (meshRef.current) {
      meshRef.current.position.copy(pos);
      meshRef.current.quaternion.copy(quat);
      setVisible(true);
    }

    lastHitRef.current = { point, object: hit.object };
  });

  useEffect(() => {
    if (!gl?.domElement) return;

    const handlePointerDown = (event) => {
      downPosRef.current = { x: event.clientX, y: event.clientY };
      isDraggingRef.current = false;
    };

    const handlePointerMove = (event) => {
      const dx = event.clientX - downPosRef.current.x;
      const dy = event.clientY - downPosRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        isDraggingRef.current = true;
      }
    };

    const handlePointerUp = (event) => {
      if (!clickToNearest) return;
      if (isDraggingRef.current) return;

      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      );
      raycaster.setFromCamera(ndc, camera);
      const intersects = raycaster
        .intersectObjects(scene.children, true)
        .filter((i) => i.object?.isMesh && !exclude(i.object));

      if (intersects.length === 0) return;

      const clickedObj = intersects[0].object;
      if (clickedObj?.userData?.isRoomPoint) return;

      if (!roomPoints || roomPoints.length === 0 || !onSelectRoom) return;

      // Choose in ray direction from the current room position
      const origin = currentPosition
        ? new THREE.Vector3(
            currentPosition.x,
            currentPosition.y,
            currentPosition.z
          )
        : raycaster.ray.origin.clone();
      const dir = raycaster.ray.direction.clone().normalize();

      let best = { index: null, perpSq: Infinity, t: Infinity };
      for (const rp of roomPoints) {
        if (!rp?.position) continue;
        if (currentRoomIndex !== null && rp.index === currentRoomIndex)
          continue;
        const p = new THREE.Vector3(
          rp.position.x,
          rp.position.y,
          rp.position.z
        );
        const v = p.clone().sub(origin);
        const t = v.dot(dir);
        if (t <= 0) continue; // behind
        const vLenSq = v.lengthSq();
        const perpSq = vLenSq - t * t; // squared perpendicular distance to ray
        if (perpSq < best.perpSq || (perpSq === best.perpSq && t < best.t)) {
          best = { index: rp.index, perpSq, t };
        }
      }

      if (best.index === null) {
        // Fallback to nearest to origin
        let nearestIndex = null;
        let nearestDistSq = Infinity;
        for (const rp of roomPoints) {
          if (!rp?.position) continue;
          if (currentRoomIndex !== null && rp.index === currentRoomIndex)
            continue;
          const dx = origin.x - rp.position.x;
          const dy = origin.y - rp.position.y;
          const dz = origin.z - rp.position.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < nearestDistSq) {
            nearestDistSq = d2;
            nearestIndex = rp.index;
          }
        }
        if (nearestIndex !== null && nearestIndex !== undefined) {
          onSelectRoom(nearestIndex);
        }
        return;
      }

      onSelectRoom(best.index);
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    gl.domElement.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    gl.domElement.addEventListener("pointerup", handlePointerUp, {
      passive: true,
    });

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    gl,
    scene,
    camera,
    raycaster,
    exclude,
    roomPoints,
    onSelectRoom,
    clickToNearest,
    currentPosition,
    currentRoomIndex,
  ]);

  return (
    <mesh
      ref={meshRef}
      name="hover-cursor"
      visible={visible}
      renderOrder={999}
      userData={{ ignoreHoverCursor: true }}
    >
      <planeGeometry args={[size, size]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
