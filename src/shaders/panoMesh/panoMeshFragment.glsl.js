export default /* glsl */ `
uniform samplerCube uEnvMapOld;
uniform samplerCube uEnvMapNew;
uniform float uMix;          // 0 = fully old, 1 = fully new

uniform vec3 uPanoPos;
uniform vec3 uPanoPos2;

uniform vec4 uPanoQuat;
uniform vec4 uPanoQuat2;

varying vec3 vWorldPos;

vec3 quatRotate(vec3 v, vec4 q) {
    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

void main() {
    vec3 dirOld = normalize(vWorldPos - uPanoPos );
    vec3 dirNew = normalize(vWorldPos - uPanoPos2);

    dirOld = quatRotate(dirOld, uPanoQuat);
    dirNew = quatRotate(dirNew, uPanoQuat2);

    dirOld.y = -dirOld.y;
    dirNew.y = -dirNew.y;

    vec3 colorOld = textureCube(uEnvMapOld, dirOld).rgb;
    vec3 colorNew = textureCube(uEnvMapNew, dirNew).rgb;

    // ✅ separate fade in/out, no mixed directions
    gl_FragColor = vec4(mix(colorOld, colorNew, uMix), 1.0);
}
`;
