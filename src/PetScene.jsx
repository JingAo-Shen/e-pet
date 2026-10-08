import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export default function PetScene({
  action,
  powered,
  coat,
  onTouch,
  resetView,
}) {
  const host = useRef(null),
    api = useRef(null),
    touchRef = useRef(onTouch);
  const [failed, setFailed] = useState(false);
  touchRef.current = onTouch;
  useEffect(() => {
    const el = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.93;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "可转动视角的三维小狗；点击小狗可摸头",
    );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#edf0e5");
    scene.fog = new THREE.Fog("#edf0e5", 12, 25);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    const defaultCamera = new THREE.Vector3(3.15, 2.65, 6.15);
    camera.position.copy(defaultCamera);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.35, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4.4;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 2.03;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.6;
    room.dispose();
    scene.add(new THREE.HemisphereLight("#ffffff", "#9caa7c", 1.2));
    const light = new THREE.DirectionalLight("#fff3dd", 2.5);
    light.position.set(-3, 7, 5);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -5;
    light.shadow.camera.right = 5;
    light.shadow.camera.top = 5;
    light.shadow.camera.bottom = -5;
    light.shadow.bias = -0.001;
    light.shadow.normalBias = 0.03;
    light.shadow.radius = 4;
    scene.add(light);
    const fill = new THREE.DirectionalLight("#eef4ff", 0.8);
    fill.position.set(4, 3, -4);
    scene.add(fill);
    const material = (color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.84 });
    const fur = material("#dfb678"),
      earMat = material("#c39862"),
      cream = material("#f8e4ba");
    const dark = new THREE.MeshStandardMaterial({
      color: "#30251f",
      roughness: 0.32,
    });
    const green = material("#526d44"),
      pink = material("#d8867b"),
      white = material("#ffffff");
    function ellipsoid(parent, mat, pos, scale) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 32), mat);
      mesh.position.set(...pos);
      mesh.scale.set(...scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      material("#edf0e5"),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.085;
    ground.receiveShadow = true;
    scene.add(ground);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.68, 1.73, 0.12, 96),
      material("#dfe4d4"),
    );
    base.receiveShadow = true;
    base.position.y = -0.015;
    scene.add(base);
    const dog = new THREE.Group();
    dog.position.y = 0.045;
    scene.add(dog);
    const body = new THREE.Group();
    dog.add(body);
    ellipsoid(body, fur, [0, 0.91, -0.12], [0.66, 0.88, 0.69]);
    ellipsoid(body, cream, [0, 1.06, 0.445], [0.4, 0.53, 0.21]);
    const hind = [];
    for (const side of [-1, 1]) {
      hind.push(
        ellipsoid(body, fur, [side * 0.55, 0.32, -0.27], [0.36, 0.39, 0.48]),
      );
      ellipsoid(body, fur, [side * 0.36, 0.57, 0.47], [0.195, 0.55, 0.21]);
      ellipsoid(body, cream, [side * 0.37, 0.16, 0.6], [0.255, 0.18, 0.32]);
      for (const x of [-0.075, 0.065])
        ellipsoid(
          body,
          earMat,
          [side * 0.37 + x, 0.165, 0.885],
          [0.014, 0.048, 0.018],
        );
    }
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.07, 14, 64),
      green,
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.46, 0.11);
    body.add(collar);
    const tag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.035, 32),
      material("#dac390"),
    );
    tag.rotation.x = Math.PI / 2;
    tag.position.set(0, 1.35, 0.66);
    body.add(tag);
    const head = new THREE.Group();
    head.position.set(0, 1.94, 0.16);
    body.add(head);
    ellipsoid(head, fur, [0, 0.03, 0], [0.77, 0.69, 0.65]);
    ellipsoid(head, cream, [0, -0.265, 0.45], [0.47, 0.31, 0.33]);
    const ears = [];
    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(side * 0.65, 0.22, -0.03);
      ear.rotation.z = side * 0.16;
      ellipsoid(ear, earMat, [side * 0.065, -0.36, -0.01], [0.28, 0.54, 0.24]);
      head.add(ear);
      ears.push(ear);
      ellipsoid(
        head,
        earMat,
        [side * 0.285, 0.235, 0.553],
        [0.16, 0.09, 0.065],
      );
    }
    const eyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.286, 0.12, 0.569);
      ellipsoid(eye, dark, [0, 0, 0], [0.092, 0.118, 0.065]);
      ellipsoid(eye, white, [-0.024, 0.037, 0.057], [0.023, 0.029, 0.012]);
      head.add(eye);
      eyes.push(eye);
    }
    ellipsoid(head, dark, [0, -0.16, 0.753], [0.145, 0.104, 0.104]);
    ellipsoid(
      head,
      material("#756258"),
      [-0.035, -0.13, 0.838],
      [0.038, 0.018, 0.009],
    );
    const mouth = ellipsoid(
      head,
      dark,
      [0, -0.355, 0.717],
      [0.15, 0.069, 0.047],
    );
    const tongue = ellipsoid(
      head,
      pink,
      [0, -0.401, 0.735],
      [0.087, 0.109, 0.027],
    );
    const tail = new THREE.Group();
    tail.position.set(0, 0.55, -0.63);
    body.add(tail);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.26, 0.1, -0.4),
      new THREE.Vector3(0.63, 0.43, -0.52),
      new THREE.Vector3(0.54, 0.7, -0.36),
    ]);
    const tailMesh = new THREE.Mesh(
      new THREE.TubeGeometry(tailCurve, 30, 0.135, 16, false),
      fur,
    );
    tailMesh.castShadow = true;
    tail.add(tailMesh);
    ellipsoid(tail, cream, [0.54, 0.7, -0.36], [0.14, 0.15, 0.14]);
    const ball = new THREE.Group();
    ellipsoid(ball, material("#c27a50"), [0, 0, 0], [0.2, 0.2, 0.2]);
    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.014, 8, 36),
      cream,
    );
    ball.add(stripe);
    scene.add(ball);
    ball.visible = false;
    const bowl = new THREE.Group();
    const bowlMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.24, 0.16, 40),
      green,
    );
    bowl.add(bowlMesh);
    for (let i = 0; i < 12; i++)
      ellipsoid(
        bowl,
        earMat,
        [Math.sin(i * 2.4) * 0.2, 0.09, Math.cos(i * 2.4) * 0.2],
        [0.06, 0.04, 0.06],
      );
    bowl.position.set(0, 0.15, 1.1);
    scene.add(bowl);
    bowl.visible = false;
    let current = "idle",
      start = performance.now(),
      power = true,
      frame,
      disposed = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    api.current = {
      action: (type) => {
        current = type;
        start = performance.now();
      },
      power: (value) => {
        power = value;
      },
      coat: (value) => {
        const colors = {
          honey: ["#dfb678", "#c39862", "#f8e4ba"],
          cream: ["#e5dfd0", "#bdb5a4", "#f6f0e4"],
          cocoa: ["#99704f", "#624931", "#d8ba94"],
        };
        const c = colors[value] || colors.honey;
        fur.color.set(c[0]);
        earMat.color.set(c[1]);
        cream.color.set(c[2]);
      },
      reset: () => {
        camera.position.copy(defaultCamera);
        controls.target.set(0, 1.35, 0);
      },
    };
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down;
    const pointerDown = (e) => {
      down = [e.clientX, e.clientY];
    };
    const pointerUp = (e) => {
      if (
        !down ||
        Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 ||
        !power
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.intersectObject(dog, true).length) touchRef.current();
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const resize = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(el);
    const lerp = THREE.MathUtils.lerp;
    function animate(now) {
      if (disposed) return;
      const t = now / 1000,
        elapsed = (now - start) / 1000;
      if (!["sleep", "sit", "idle"].includes(current) && elapsed > 3.8)
        current = "idle";
      const asleep = !power || current === "sleep";
      const active =
        ["pet", "wag", "bark", "play"].includes(current) && !asleep;
      const movement = reduced ? 0 : 1;
      body.rotation.x = lerp(
        body.rotation.x,
        asleep ? 0.38 : current === "feed" ? 0.28 : 0,
        0.065,
      );
      body.scale.y = lerp(
        body.scale.y,
        asleep ? 0.58 : current === "sit" ? 1.04 : 1,
        0.07,
      );
      dog.position.y =
        0.045 +
        (!asleep && current === "play"
          ? Math.abs(Math.sin(t * 6)) * 0.13 * movement
          : Math.sin(t * 2) * 0.012 * movement);
      head.rotation.z = lerp(
        head.rotation.z,
        (current === "pet"
          ? Math.sin(t * 4) * 0.16
          : Math.sin(t * 0.9) * 0.035) * movement,
        0.1,
      );
      head.rotation.x = lerp(
        head.rotation.x,
        current === "feed"
          ? 0.35
          : current === "bark"
            ? Math.sin(t * 15) * 0.06 * movement
            : -0.035,
        0.1,
      );
      const blink = asleep || t % 5.3 > 5.12;
      for (const eye of eyes)
        eye.scale.y = lerp(eye.scale.y, blink ? 0.1 : 1, 0.45);
      tail.rotation.z = asleep
        ? 0
        : Math.sin(t * (active ? 17 : 2)) * (active ? 0.6 : 0.08) * movement;
      ears.forEach((ear, i) => {
        ear.rotation.z =
          (i ? 1 : -1) * 0.16 +
          (active ? Math.sin(t * 8) * 0.08 : 0) * movement;
      });
      mouth.scale.y =
        current === "bark" ? 0.11 + Math.abs(Math.sin(t * 14)) * 0.1 : 0.069;
      tongue.visible = !asleep && current !== "feed";
      ball.visible = current === "play" && !asleep;
      ball.position.set(
        Math.sin(elapsed * 2.2) * 1.05,
        0.3 + Math.abs(Math.sin(elapsed * 5)) * 0.38,
        1.2,
      );
      ball.rotation.z = elapsed * 4;
      bowl.visible = current === "feed" && !asleep;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      const geometries = new Set(),
        materials = new Set();
      scene.traverse((obj) => {
        if (obj.geometry) geometries.add(obj.geometry);
        if (obj.material) materials.add(obj.material);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);
  useEffect(() => api.current?.action(action.type), [action]);
  useEffect(() => api.current?.power(powered), [powered]);
  useEffect(() => api.current?.coat(coat), [coat]);
  useEffect(() => api.current?.reset(), [resetView]);
  return (
    <div className="pet-canvas" ref={host}>
      {failed && (
        <div className="scene-error">
          <strong>当前浏览器无法启动三维画面</strong>
          <p>
            请开启硬件加速或使用 Chrome / Edge。下方动作按钮与聊天仍可使用。
          </p>
        </div>
      )}
    </div>
  );
}
