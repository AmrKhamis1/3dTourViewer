import protobuf from "protobufjs";
import * as THREE from "three";
import { GLTFExporter } from "three-stdlib";

async function fetchProtoRoot() {
  // Load proto as text then parse (prevents XML parsing error from incorrect MIME)
  const protoText = await fetch("/models/dam.proto").then((r) => {
    if (!r.ok) throw new Error(`Failed to fetch dam.proto: ${r.status}`);
    return r.text();
  });
  const parsed = protobuf.parse(protoText);
  return parsed.root;
}

function rotateXYZ(x, y, z) {
  // Match legacy OBJ conversion: y -> z, z -> -y
  return new THREE.Vector3(x, z, -y);
}

async function buildThreeGroupFromDAM(damMessage, textureBaseDir = "") {
  const group = new THREE.Group();
  const textureLoader = new THREE.TextureLoader();

  const baseDir = textureBaseDir ? textureBaseDir.replace(/\/$/, "") : "";

  const looksLikeImage = (name) => /\.(jpg|jpeg|png|webp)$/i.test(name || "");

  const chunkPromises = (damMessage.chunk || []).map(async (chunk, idx) => {
    const xyz = chunk?.vertices?.xyz;
    const uv = chunk?.vertices?.uv;
    const faces = chunk?.faces?.faces;

    if (!xyz || !faces || xyz.length === 0 || faces.length === 0) {
      return; // Skip empty chunks
    }

    const positions = new Float32Array((xyz.length / 3) * 3);
    for (let i = 0, p = 0; i < xyz.length; i += 3, p += 3) {
      const rotated = rotateXYZ(xyz[i], xyz[i + 1], xyz[i + 2]);
      positions[p] = rotated.x;
      positions[p + 1] = rotated.y;
      positions[p + 2] = rotated.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    if (uv && uv.length > 0) {
      const uvs = new Float32Array(uv.length);
      for (let i = 0; i < uv.length; i += 2) {
        const u = uv[i];
        const v = uv[i + 1];
        uvs[i] = u;
        uvs[i + 1] = v;
      }
      geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    }

    const indexArray = new Uint32Array(faces.length);
    for (let i = 0; i < faces.length; i++) {
      indexArray[i] = faces[i];
    }
    geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));

    geometry.computeVertexNormals();

    const materialName = chunk?.materialName || `material_${idx}`;
    let material;
    if (looksLikeImage(materialName)) {
      const texPath = baseDir ? `${baseDir}/${materialName}` : materialName;
      try {
        const texture = await textureLoader.loadAsync(texPath);
        // glTF expects textures with flipY = false
        texture.flipY = true;
        material = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide,
          metalness: 0.0,
          roughness: 1.0,
        });
      } catch (e) {
        console.warn("Failed to load texture:", texPath, e);
        material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          side: THREE.DoubleSide,
          metalness: 0.0,
          roughness: 1.0,
        });
      }
    } else {
      material = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        side: THREE.DoubleSide,
        metalness: 0.0,
        roughness: 1.0,
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = chunk?.chunkName || `chunk_${idx}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  });

  await Promise.all(chunkPromises);
  return group;
}

async function exportGroupToGLB(group) {
  const exporter = new GLTFExporter();
  const options = {
    binary: true,
    embedImages: true,
    includeCustomExtensions: true,
  };

  return await new Promise((resolve, reject) => {
    exporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else if (typeof result === "object") {
          // Fallback to JSON glTF if exporter didn't return binary
          const gltfJson = JSON.stringify(result);
          resolve(new TextEncoder().encode(gltfJson).buffer);
        } else {
          reject(new Error("Unexpected GLTFExporter result"));
        }
      },
      (error) => reject(error),
      options
    );
  });
}

export async function loadDAMasGLB(url, { textureBaseDir = "" } = {}) {
  try {
    const root = await fetchProtoRoot();
    const DAMFile = root.lookupType("DAMFile");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch DAM file: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const uint8array = new Uint8Array(buffer);

    const damMessage = DAMFile.decode(uint8array);

    if (!damMessage?.chunk || damMessage.chunk.length === 0) {
      console.warn("No chunks found in DAM file");
      // Export empty scene to valid GLB to keep contract
      const emptyGroup = new THREE.Group();
      return await exportGroupToGLB(emptyGroup);
    }

    // Debug summary similar to OBJ path
    try {
      let totalVerts = 0;
      let totalUVs = 0;
      let totalFaces = 0;
      const materialNames = new Set();
      const chunkSummaries = damMessage.chunk.map((chunk, idx) => {
        const verts = chunk?.vertices?.xyz ? chunk.vertices.xyz.length / 3 : 0;
        const uvs = chunk?.vertices?.uv ? chunk.vertices.uv.length / 2 : 0;
        const faces = chunk?.faces?.faces ? chunk.faces.faces.length / 3 : 0;
        totalVerts += verts;
        totalUVs += uvs;
        totalFaces += faces;
        if (chunk?.materialName) materialNames.add(chunk.materialName);
        return {
          chunk: idx,
          name: chunk?.chunkName || `chunk_${idx}`,
          material: chunk?.materialName || `material_${idx}`,
          vertices: verts,
          uvs,
          faces,
        };
      });
      console.groupCollapsed("DAM→GLB Debug: chunk summary");
      console.table(chunkSummaries);
      console.log("Totals:", {
        totalVerts,
        totalUVs,
        totalFaces,
        materials: Array.from(materialNames),
      });
      console.groupEnd();
    } catch (e) {
      console.warn("Debug summary failed:", e);
    }

    const group = await buildThreeGroupFromDAM(damMessage, textureBaseDir);
    const glbArrayBuffer = await exportGroupToGLB(group);
    return glbArrayBuffer;
  } catch (error) {
    console.error("Error loading DAM file:", error);
    throw error;
  }
}
