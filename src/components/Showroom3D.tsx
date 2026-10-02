import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette, Noise } from "@react-three/postprocessing";
import { useRef, useMemo, Suspense } from "react";
import * as THREE from "three";

type ApplianceKind =
  | "logo"
  | "coffee"
  | "blender"
  | "kneader"
  | "cocotte"
  | "juicer"
  | "airfryer"
  | "vacuum"
  | "fan"
  | "panini"
  | "thermos"
  | "hob"
  | "processor";
const steel = "#a7a5a1",
  dark = "#202328",
  copper = "#c8873a",
  red = "#a64132",
  glass = "#748f8b";
const metal = { color: steel, metalness: 0.88, roughness: 0.23 };
const plastic = { color: dark, metalness: 0.2, roughness: 0.27 };
const enamel = { color: red, metalness: 0.48, roughness: 0.2 };
function Box({
  position,
  scale,
  color,
  material = "standard",
  radius = 0.08,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color?: string;
  material?: "standard" | "physical";
  radius?: number;
}) {
  return (
    <RoundedBox
      position={position}
      args={scale}
      radius={radius}
      smoothness={3}
      castShadow
      receiveShadow
    >
      {material === "physical" ? (
        <meshPhysicalMaterial
          color={color || glass}
          metalness={0.1}
          roughness={0.12}
          transmission={0.65}
          thickness={0.4}
        />
      ) : (
        <meshStandardMaterial {...(color ? { ...plastic, color } : plastic)} />
      )}
    </RoundedBox>
  );
}
function Cyl({
  position,
  args,
  color,
  rotation,
  metallic = false,
}: {
  position: [number, number, number];
  args: [number, number, number, number?];
  color: string;
  rotation?: [number, number, number];
  metallic?: boolean;
}) {
  return (
    <mesh position={position} {...(rotation ? { rotation } : {})} castShadow>
      <cylinderGeometry args={args} />
      <meshStandardMaterial
        color={color}
        metalness={metallic ? 0.85 : 0.25}
        roughness={metallic ? 0.25 : 0.32}
      />
    </mesh>
  );
}
function Ring({
  position,
  args,
  color,
}: {
  position: [number, number, number];
  args: [number, number, number, number?];
  color: string;
}) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <torusGeometry args={args} />
      <meshStandardMaterial color={color} metalness={0.82} roughness={0.23} />
    </mesh>
  );
}
function LogoDetails() {
  const texture = useTexture("/topchamal-logo.jpg");
  return (
    <group>
      <Box position={[0, 0, 0]} scale={[1.72, 1.72, 0.2]} color={copper} radius={0.18} />
      <Box position={[0, 0, 0.08]} scale={[1.58, 1.58, 0.16]} color="#1d1b19" radius={0.14} />
      <mesh position={[0, 0, 0.17]} castShadow>
        <planeGeometry args={[1.42, 1.42]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.18]}>
        <planeGeometry args={[1.42, 1.42]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.04}
          metalness={0.65}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}
function CoffeeDetails({ active = true }: { active?: boolean }) {
  const steam = useRef<THREE.Group>(null);
  const pour = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (steam.current)
      steam.current.children.forEach((c, i) => {
        c.position.y = 0.2 + ((clock.elapsedTime * 0.36 + i * 0.31) % 1.25);
        c.position.x = Math.sin(clock.elapsedTime * 1.8 + i) * 0.04;
        const material = (c as THREE.Mesh).material;
        if (material instanceof THREE.MeshBasicMaterial)
          material.opacity = 0.38 * (1 - ((clock.elapsedTime * 0.36 + i * 0.31) % 1.25) / 1.25);
      });
    if (pour.current) pour.current.scale.y = 0.75 + Math.sin(clock.elapsedTime * 8) * 0.1;
  });
  return (
    <>
      <Box position={[0, 0.1, 0]} scale={[1.58, 1.38, 0.92]} color={dark} radius={0.21} />
      <Box position={[0, 0.48, 0.47]} scale={[1.4, 0.51, 0.055]} color={steel} radius={0.035} />
      <Box position={[0, -0.15, 0.48]} scale={[1.35, 0.07, 0.45]} color={steel} radius={0.025} />
      <Cyl position={[0, -0.015, 0.51]} args={[0.28, 0.31, 0.11, 40]} color={dark} />
      <Ring position={[0, -0.015, 0.57]} args={[0.23, 0.023, 8, 40]} color={copper} />
      <Cyl position={[0, 0.35, 0.54]} args={[0.045, 0.045, 0.035, 24]} color={copper} metallic />
      <Cyl position={[-0.5, 0.35, 0.54]} args={[0.03, 0.03, 0.035, 24]} color={steel} metallic />
      <Cyl position={[0.5, 0.35, 0.54]} args={[0.03, 0.03, 0.035, 24]} color={steel} metallic />
      <Cyl position={[0.47, -0.63, 0.38]} args={[0.21, 0.16, 0.27, 32]} color={steel} metallic />
      <Ring position={[0.47, -0.52, 0.41]} args={[0.16, 0.026, 8, 32]} color={copper} />
      <Ring position={[0.47, -0.65, 0.59]} args={[0.115, 0.025, 8, 32]} color={steel} />
      {active && (
        <>
          <mesh ref={pour} position={[0.47, -0.39, 0.45]}>
            <cylinderGeometry args={[0.015, 0.013, 0.28, 12]} />
            <meshStandardMaterial color="#8b4d27" metalness={0.15} roughness={0.17} />
          </mesh>
          <group ref={steam}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} position={[0.47, 0.3 + i * 0.18, 0.4]}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshBasicMaterial color="#f5efe6" transparent opacity={0.24} depthWrite={false} />
              </mesh>
            ))}
          </group>
        </>
      )}
      <mesh position={[0, 0.795, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 32]} />
        <meshStandardMaterial {...metal} />
      </mesh>
    </>
  );
}
function Appliance({ kind }: { kind: ApplianceKind }) {
  if (kind === "logo") return <LogoDetails />;
  if (kind === "coffee") return <CoffeeDetails />;
  if (kind === "blender" || kind === "juicer")
    return (
      <>
        <Cyl position={[0, -0.57, 0]} args={[0.43, 0.46, 0.37, 32]} color={dark} />
        <Cyl position={[0, -0.32, 0.35]} args={[0.055, 0.055, 0.04, 20]} color={copper} metallic />
        <mesh position={[0, 0.16, 0]} castShadow>
          <cylinderGeometry args={[0.36, 0.25, 1.05, 8]} />
          <meshPhysicalMaterial
            color={glass}
            metalness={0.15}
            roughness={0.1}
            transmission={0.62}
            thickness={0.4}
            transparent
            opacity={0.75}
          />
        </mesh>
        <Cyl position={[0, 0.71, 0]} args={[0.32, 0.32, 0.11, 8]} color={dark} />
        <Box position={[0.46, 0.18, 0]} scale={[0.2, 0.55, 0.16]} color={steel} />
        <Cyl position={[0, -0.36, 0]} args={[0.22, 0.22, 0.08, 24]} color={copper} metallic />
      </>
    );
  if (kind === "kneader" || kind === "processor")
    return (
      <>
        <Box
          position={[0, -0.55, 0]}
          scale={[1.32, 0.36, 0.82]}
          color={kind === "kneader" ? red : dark}
        />
        <Cyl position={[0, -0.27, 0.05]} args={[0.43, 0.33, 0.49, 32]} color={steel} metallic />
        <Box
          position={[-0.3, 0.25, 0]}
          scale={[0.39, 0.8, 0.72]}
          color={kind === "kneader" ? red : dark}
        />
        <Box
          position={[0.05, 0.61, 0]}
          scale={[1, 0.29, 0.74]}
          color={kind === "kneader" ? red : dark}
        />
        <Cyl position={[0.05, 0.46, 0]} args={[0.07, 0.07, 0.29, 20]} color={steel} metallic />
      </>
    );
  if (kind === "cocotte")
    return (
      <>
        <Cyl position={[0, -0.26, 0]} args={[0.59, 0.49, 0.77, 40]} color={steel} metallic />
        <Cyl position={[0, 0.17, 0]} args={[0.62, 0.62, 0.11, 40]} color={steel} metallic />
        <Cyl position={[0, 0.28, 0]} args={[0.09, 0.13, 0.13, 24]} color={dark} />
        <Box position={[-0.72, -0.17, 0]} scale={[0.44, 0.09, 0.21]} color={dark} />
        <Box position={[0.72, -0.17, 0]} scale={[0.44, 0.09, 0.21]} color={dark} />
      </>
    );
  if (kind === "airfryer")
    return (
      <>
        <Box position={[0, 0, 0]} scale={[1.25, 1.55, 1.05]} color={dark} radius={0.24} />
        <Box position={[0, 0.45, 0.53]} scale={[0.86, 0.43, 0.045]} color={steel} />
        <Box position={[0, -0.29, 0.54]} scale={[1, 0.65, 0.06]} color={dark} />
        <Box position={[0, -0.31, 0.73]} scale={[0.15, 0.36, 0.32]} color={steel} />
        <Ring position={[0, 0.43, 0.57]} args={[0.12, 0.018, 8, 32]} color={copper} />
      </>
    );
  if (kind === "vacuum")
    return (
      <>
        <Cyl position={[0, 0.12, 0]} args={[0.12, 0.12, 1.4, 24]} color={steel} metallic />
        <Box position={[0, -0.58, 0.08]} scale={[0.76, 0.25, 0.48]} color={dark} />
        <Cyl position={[0, 0.82, 0]} args={[0.17, 0.17, 0.35, 24]} color={dark} />
        <Ring position={[0.24, -0.55, 0.16]} args={[0.09, 0.035, 8, 24]} color={copper} />
      </>
    );
  if (kind === "fan")
    return (
      <>
        <Cyl position={[0, -0.7, 0]} args={[0.5, 0.5, 0.08, 32]} color={dark} />
        <Cyl position={[0, -0.04, 0]} args={[0.055, 0.055, 1.2, 16]} color={steel} metallic />
        <Ring position={[0, 0.56, 0.02]} args={[0.53, 0.035, 8, 48]} color={steel} />
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.56, 0.02]} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
            <boxGeometry args={[0.18, 0.78, 0.035]} />
            <meshStandardMaterial {...metal} />
          </mesh>
        ))}
        <Cyl position={[0, 0.56, 0.1]} args={[0.11, 0.11, 0.11, 24]} color={copper} />
      </>
    );
  if (kind === "panini")
    return (
      <>
        <Box position={[0, -0.38, 0]} scale={[1.47, 0.25, 1]} color={dark} />
        <Box position={[0, 0.15, -0.09]} scale={[1.42, 0.19, 0.95]} color={steel} />
        <Box position={[0, 0.43, 0.16]} scale={[0.87, 0.1, 0.17]} color={dark} />
        <Cyl position={[0.5, -0.37, 0.5]} args={[0.04, 0.04, 0.04, 16]} color={copper} />
      </>
    );
  if (kind === "thermos")
    return (
      <>
        <Cyl position={[0, -0.04, 0]} args={[0.34, 0.29, 1.46, 40]} color={steel} metallic />
        <Cyl position={[0, 0.78, 0]} args={[0.28, 0.32, 0.24, 32]} color={dark} />
        <Ring position={[0, 0.64, 0.01]} args={[0.29, 0.015, 8, 32]} color={copper} />
      </>
    );
  return (
    <>
      <Box position={[0, -0.35, 0]} scale={[1.5, 0.26, 1.08]} color={dark} />
      {[-0.38, 0.38].map((x, i) => (
        <Ring key={i} position={[x, -0.19, 0.2]} args={[0.23, 0.022, 8, 32]} color={copper} />
      ))}
      <Cyl position={[-0.48, -0.3, 0.52]} args={[0.036, 0.036, 0.05, 20]} color={steel} />
      <Cyl position={[0.48, -0.3, 0.52]} args={[0.036, 0.036, 0.05, 20]} color={steel} />
    </>
  );
}
function HeroScene({
  kind = "logo",
  interactive = true,
}: {
  kind?: ApplianceKind;
  interactive?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera, pointer } = useThree();
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y =
      -0.28 + Math.sin(clock.elapsedTime * (interactive ? 0.48 : 0.7)) * 0.26;
    group.current.position.y = Math.sin(clock.elapsedTime * 1.25) * 0.075;
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      interactive ? pointer.x * 0.35 : 0,
      0.025,
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      interactive ? pointer.y * 0.15 + 0.2 : 0.2,
      0.025,
    );
    camera.lookAt(0, 0, 0);
  });
  return (
    <>
      <color attach="background" args={["#0e0e10"]} />
      <ambientLight intensity={0.8} />
      <spotLight position={[4, 7, 5]} intensity={95} angle={0.55} penumbra={0.8} color="#f9d8a7" />
      <spotLight position={[-4, 2, -3]} intensity={75} angle={0.75} color="#6ca3a0" />
      <Environment>
        <Lightformer intensity={3} position={[0, 5, 2]} scale={[6, 3, 1]} />
        <Lightformer intensity={2} color="#e7b77e" position={[-4, 1, 1]} scale={[3, 5, 1]} />
      </Environment>
      <group ref={group} scale={1.45} rotation={[0, -0.35, 0]}>
        <Appliance kind={kind} />
      </group>
      <mesh position={[0, -1.37, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.3, 64]} />
        <meshStandardMaterial color="#222223" metalness={0.55} roughness={0.3} />
      </mesh>
      <Ring position={[0, -1.35, 0]} args={[1.85, 0.009, 8, 90]} color={copper} />
    </>
  );
}
export function Showroom3D({
  kind = "logo",
  interactive = true,
}: {
  kind?: ApplianceKind;
  interactive?: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.2, 5.3], fov: 38 }}
      gl={{ antialias: true, alpha: false }}
      shadows
      performance={{ min: 0.5 }}
    >
      <Suspense fallback={null}>
        <HeroScene kind={kind} interactive={interactive} />
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={1.1} intensity={0.35} mipmapBlur />
          <Noise opacity={0.015} />
          <Vignette eskil={false} offset={0.28} darkness={0.35} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
export type { ApplianceKind };
