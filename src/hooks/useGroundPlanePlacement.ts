import * as THREE from 'three';

export function getGroundPlaneIntersection(
  event: { clientX: number; clientY: number },
  domElement: HTMLCanvasElement,
  camera: THREE.Camera,
  raycaster: THREE.Raycaster
): [number, number, number] | null {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersectionPoint = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
    return null;
  }

  return [intersectionPoint.x, intersectionPoint.y, intersectionPoint.z];
}
