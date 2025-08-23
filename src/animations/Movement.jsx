import { gsap } from "gsap";

export const animateScene = (sceneGroup, targetPos, duration = 2) => {
  return new Promise((resolve) => {
    gsap.to(sceneGroup.position, {
      x: -targetPos.x,
      y: -targetPos.y,
      z: -targetPos.z,
      duration: duration,
      ease: "linear",
      onComplete: resolve,
    });
  });
};
