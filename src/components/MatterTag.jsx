// MatterTag.jsx
import { Html } from "@react-three/drei";
import { useState } from "react";
import * as THREE from "three";

export default function MatterTag({
  position = [0, 1, 0],
  label,
  description,
  color = "#03687d",
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <group position={[position[0], position[1], position[2] - 0.01]}>
      {/* anchor dot */}
      <mesh
        onClick={() => setOpen((prev) => !prev)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        rotation={[0, Math.PI, 0]}
      >
        <circleGeometry args={[0.08, 32]} />
        <meshBasicMaterial
          color={color}
          opacity={hovered ? 1 : 0.8}
          transparent
        />
      </mesh>

      {/* stem (line from anchor to label box) */}
      {/* {open && (
        <line>
          <bufferGeometry
            attach="geometry"
            setFromPoints={[
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0, 0.3, 0),
            ]}
          />
          <lineBasicMaterial attach="material" color={color} />
        </line>
      )} */}

      {/* floating HTML label */}
      {(hovered || open) && (
        <Html position={[0, 0.35, 0]} center>
          <div
            style={{
              background: "white",
              padding: "8px 12px",
              borderRadius: "10px",
              boxShadow: "0px 2px 8px rgba(0,0,0,0.25)",
              border: `2px solid ${color}`,
              minWidth: "180px",
              maxWidth: "240px",
              fontFamily: "sans-serif",
              textAlign: "left",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
            onClick={() => setOpen((prev) => !prev)}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: color,
                marginBottom: "4px",
              }}
            >
              {label}
            </div>
            {open && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#333",
                  lineHeight: "1.4em",
                }}
              >
                {description}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
