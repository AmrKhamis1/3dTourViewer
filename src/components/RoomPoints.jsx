import React, { useRef, useState, useEffect } from "react";
import { useControls } from "leva";
import { useThree, useLoader } from "@react-three/fiber";
import * as THREE from "three";

function RoomPoints({ pos, onClick, isActive, isClicked, animteLoad }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const { gl } = useThree();

  // Load your PNG texture
  const texture = useLoader(THREE.TextureLoader, "/images/point.png");

  // controls for room markers
  const markerControls = useControls("Room Markers", {
    showMarkers: { value: true, label: "Show Markers" },
    markerSize: { value: 0.55, min: 0.05, max: 1, label: "Marker Size" },
    hoverScale: { value: 1.3, min: 1.0, max: 2.0, label: "Hover Scale" },
    activeScale: { value: 1.8, min: 1.0, max: 2.0, label: "Active Scale" },
    defaultOpacity: {
      value: 0.65,
      min: 0.1,
      max: 1.0,
      label: "Default Opacity",
    },
    hoverOpacity: { value: 1.0, min: 0.1, max: 1.0, label: "Hover Opacity" },
  });

  // scale + cursor animation
  useEffect(() => {
    const scale = hovered
      ? markerControls.hoverScale
      : isActive
      ? markerControls.activeScale
      : 1;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(scale);
    }

    gl.domElement.style.cursor = hovered ? "pointer" : "auto";
  }, [
    hovered,
    isActive,
    markerControls.hoverScale,
    markerControls.activeScale,
  ]);

  // click event
  const handleClick = (e) => {
    if (onClick) onClick(e);
  };

  if (!pos || !markerControls.showMarkers || isClicked) return null;

  // choose opacity based on state
  const markerOpacity = hovered
    ? markerControls.hoverOpacity
    : markerControls.defaultOpacity;

  return (
    <group position={[pos.x, pos.y - 1.5, pos.z]}>
      <mesh
        ref={meshRef}
        name="room-point"
        userData={{ isRoomPoint: true }}
        onClick={handleClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        rotation={[Math.PI / 2, 0, 0]} // flat facing up
      >
        {/* A simple square plane for the PNG */}
        <planeGeometry
          args={[markerControls.markerSize, markerControls.markerSize]}
        />
        <meshBasicMaterial
          map={texture}
          transparent={true}
          opacity={markerOpacity}
          depthWrite={false}
          alphaTest={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default RoomPoints;
