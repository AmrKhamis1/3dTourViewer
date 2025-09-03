import protobuf from "protobufjs";
import * as THREE from "three";

function generateMTL(damFile, textureBaseDir = "") {
  let mtlContent = "# Generated MTL file\n\n";
  const base = textureBaseDir ? textureBaseDir.replace(/\/$/, "") : "";

  damFile.chunk.forEach((chunk, idx) => {
    const materialName = chunk.materialName || `material_${idx}`;

    mtlContent += `newmtl ${materialName}\n`;
    // Simple defaults
    mtlContent += `Kd 0.8 0.8 0.8\n`;
    mtlContent += `Ka 0.2 0.2 0.2\n`;

    // If materialName looks like an image filename, use it as diffuse map
    const looksLikeTexture = /\.(jpg|jpeg|png|webp)$/i.test(materialName);
    if (looksLikeTexture) {
      const texPath = base ? `${base}/${materialName}` : materialName;
      console.log("texPath", texPath);
      mtlContent += `map_Kd ${texPath}\n`;
    }

    mtlContent += "\n";
  });

  return mtlContent;
}

export async function loadDAMasOBJ(url, { textureBaseDir = "" } = {}) {
  try {
    // Load proto as text then parse (prevents XML parsing error from incorrect MIME)
    const protoText = await fetch("/models/dam.proto").then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch dam.proto: ${r.status}`);
      return r.text();
    });
    const parsed = protobuf.parse(protoText);
    const root = parsed.root;

    const DAMFile = root.lookupType("DAMFile");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch DAM file: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const uint8array = new Uint8Array(buffer);

    const damMessage = DAMFile.decode(uint8array);

    return damToOBJ(damMessage, { textureBaseDir });
  } catch (error) {
    console.error("Error loading DAM file:", error);
    throw error;
  }
}

function damToOBJ(damMessage, { textureBaseDir = "" } = {}) {
  if (!damMessage.chunk || damMessage.chunk.length === 0) {
    console.warn("No chunks found in DAM file");
    return { objContent: "# Empty DAM file\n", mtlContent: "" };
  }

  // Debug: per-chunk and totals summary
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
    console.groupCollapsed("DAM→OBJ Debug: chunk summary");
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

  let obj = "# Generated from DAM file\n";
  obj += "mtllib materials.mtl\n\n";

  const vertexResult = writeObjVertices(damMessage);
  const objVertices = vertexResult.objContent;
  const chunkVertSizes = vertexResult.chunkVertSizes;
  obj += objVertices;

  const objUV = writeObjUV(damMessage);
  obj += objUV;

  const objFaces = writeObjFaces(damMessage, chunkVertSizes);
  obj += objFaces;

  const mtlContent = generateMTL(damMessage, textureBaseDir);

  // Debug: sizes and head/tail snippets
  try {
    console.groupCollapsed("DAM→OBJ Debug: output sizes");
    console.log("OBJ length (chars):", obj.length);
    console.log("MTL length (chars):", mtlContent.length);
    console.log("Texture base dir:", textureBaseDir || "<none>");
    console.log("OBJ head:\n", obj.slice(0, 500));
    console.log("OBJ tail:\n", obj.slice(-500));
    console.groupEnd();
  } catch {}

  if (obj.includes("undefined")) {
    console.error("Found 'undefined' in OBJ string!");
  }

  return { objContent: obj, mtlContent };
}

function writeObjVertices(damFile) {
  let objContent = "";
  let chunkVertSizes = [];

  damFile.chunk.forEach((chunk, index) => {
    if (!chunk.vertices || !chunk.vertices.xyz) {
      chunkVertSizes.push(0);
      return;
    }

    const xyz = chunk.vertices.xyz;
    for (let i = 0; i < xyz.length; i += 3) {
      const x = xyz[i];
      const y = xyz[i + 1];
      const z = xyz[i + 2];

      if (
        x === undefined ||
        y === undefined ||
        z === undefined ||
        isNaN(x) ||
        isNaN(y) ||
        isNaN(z)
      ) {
        continue;
      }

      const rotatedY = z;
      const rotatedZ = -y;

      objContent += `v ${x} ${rotatedY} ${rotatedZ}\n`;
    }
    chunkVertSizes.push(xyz.length / 3);
  });

  objContent += "\n";
  return { objContent, chunkVertSizes };
}

function writeObjUV(damFile) {
  let objContent = "";

  damFile.chunk.forEach((chunk, index) => {
    if (!chunk.vertices || !chunk.vertices.uv) {
      return;
    }

    const uv = chunk.vertices.uv;
    for (let i = 0; i < uv.length; i += 2) {
      const u = uv[i];
      const v = uv[i + 1];

      if (u === undefined || v === undefined || isNaN(u) || isNaN(v)) {
        continue;
      }

      objContent += `vt ${u} ${v}\n`;
    }
  });

  objContent += "\n";
  return objContent;
}

function writeObjFaces(damFile, chunkVertSizes) {
  let objContent = "";
  let totalUVOffset = 0;

  damFile.chunk.forEach((chunk, chunkId) => {
    if (!chunk.faces || !chunk.faces.faces || chunk.faces.faces.length === 0) {
      return;
    }

    const chunkName = chunk.chunkName || `chunk_${chunkId}`;
    const materialName = chunk.materialName || `material_${chunkId}`;
    const faces = chunk.faces.faces;

    objContent += `usemtl ${materialName}\n`;
    objContent += `o ${chunkName}\n`;

    const vertexOffset = chunkVertSizes
      .slice(0, chunkId)
      .reduce((a, b) => a + b, 0);

    for (let i = 0; i < faces.length; i += 3) {
      const f1 = faces[i] + 1 + vertexOffset;
      const f2 = faces[i + 1] + 1 + vertexOffset;
      const f3 = faces[i + 2] + 1 + vertexOffset;

      const t1 = faces[i] + 1 + totalUVOffset;
      const t2 = faces[i + 1] + 1 + totalUVOffset;
      const t3 = faces[i + 2] + 1 + totalUVOffset;

      if (f1 > 0 && f2 > 0 && f3 > 0) {
        objContent += `f ${f1}/${t1} ${f2}/${t2} ${f3}/${t3}\n`;
      }
    }

    totalUVOffset += chunkVertSizes[chunkId];
    objContent += "\n";
  });

  return objContent;
}
