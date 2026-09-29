import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette, Noise } from '@react-three/postprocessing';
import { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';

type ApplianceKind = 'coffee'|'blender'|'kneader'|'cocotte'|'juicer'|'airfryer'|'vacuum'|'fan'|'panini'|'thermos'|'hob'|'processor';
const steel = '#a7a5a1', dark = '#202328', copper = '#c8873a', red = '#a64132', glass = '#748f8b';
const metal = { color: steel, metalness: .88, roughness: .23 };
const plastic = { color: dark, metalness: .2, roughness: .27 };
const enamel = { color: red, metalness: .48, roughness: .2 };
function Box({position, scale, color, material='standard', radius=.08}: {position:[number,number,number],scale:[number,number,number],color?:string,material?:'standard'|'physical',radius?:number}) {
 return <RoundedBox position={position} args={scale} radius={radius} smoothness={3} castShadow receiveShadow>{material==='physical'?<meshPhysicalMaterial color={color||glass} metalness={.1} roughness={.12} transmission={.65} thickness={.4}/>:<meshStandardMaterial {...(color?{...plastic,color}:plastic)}/>}</RoundedBox>
}
function Cyl({position, args, color, rotation, metallic=false}: {position:[number,number,number],args:[number,number,number,number?],color:string,rotation?:[number,number,number],metallic?:boolean}) {return <mesh position={position} rotation={rotation} castShadow><cylinderGeometry args={args}/><meshStandardMaterial color={color} metalness={metallic?.85:.25} roughness={metallic?.25:.32}/></mesh>}
function Ring({position, args, color}: {position:[number,number,number],args:[number,number,number,number?],color:string}) {return <mesh position={position} rotation={[Math.PI/2,0,0]} castShadow><torusGeometry args={args}/><meshStandardMaterial color={color} metalness={.82} roughness={.23}/></mesh>}
function CoffeeDetails({active=true}: {active?:boolean}) {
 const steam=useRef<THREE.Group>(null); const pour=useRef<THREE.Mesh>(null);
 useFrame(({clock})=>{if(steam.current)steam.current.children.forEach((c,i)=>{c.position.y=.2+((clock.elapsedTime*.36+i*.31)%1.25); c.position.x=Math.sin(clock.elapsedTime*1.8+i)*.04; (c as THREE.Mesh).material instanceof THREE.Material && ((c as THREE.Mesh).material.opacity=.38*(1-((clock.elapsedTime*.36+i*.31)%1.25)/1.25))});if(pour.current)pour.current.scale.y=.75+Math.sin(clock.elapsedTime*8)*.1});
 return <>
  <Box position={[0,.1,0]} scale={[1.58,1.38,.92]} color={dark} radius={.21}/>
  <Box position={[0,.48,.47]} scale={[1.4,.51,.055]} color={steel} radius={.035}/>
  <Box position={[0,-.15,.48]} scale={[1.35,.07,.45]} color={steel} radius={.025}/>
  <Cyl position={[0,-.015,.51]} args={[.28,.31,.11,40]} color={dark}/>
  <Ring position={[0,-.015,.57]} args={[.23,.023,8,40]} color={copper}/>
  <Cyl position={[0,.35,.54]} args={[.045,.045,.035,24]} color={copper} metallic/>
  <Cyl position={[-.5,.35,.54]} args={[.03,.03,.035,24]} color={steel} metallic/>
  <Cyl position={[.5,.35,.54]} args={[.03,.03,.035,24]} color={steel} metallic/>
  <Cyl position={[.47,-.63,.38]} args={[.21,.16,.27,32]} color={steel} metallic/>
  <Ring position={[.47,-.52,.41]} args={[.16,.026,8,32]} color={copper}/>
  <Ring position={[.47,-.65,.59]} args={[.115,.025,8,32]} color={steel}/>
  {active && <><mesh ref={pour} position={[.47,-.39,.45]}><cylinderGeometry args={[.015,.013,.28,12]}/><meshStandardMaterial color="#8b4d27" metalness={.15} roughness={.17}/></mesh><group ref={steam}>{[0,1,2,3].map(i=><mesh key={i} position={[.47,.3+i*.18,.4]}><sphereGeometry args={[.025,8,8]}/><meshBasicMaterial color="#f5efe6" transparent opacity={.24} depthWrite={false}/></mesh>)}</group></>}
  <mesh position={[0,.795,0]} rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[.3,.3,.04,32]}/><meshStandardMaterial {...metal}/></mesh>
 </>
}
function Appliance({kind}: {kind:ApplianceKind}) {
 if(kind==='coffee') return <CoffeeDetails/>;
 if(kind==='blender'||kind==='juicer')return <><Cyl position={[0,-.57,0]} args={[.43,.46,.37,32]} color={dark}/><Cyl position={[0,-.32,.35]} args={[.055,.055,.04,20]} color={copper} metallic/><mesh position={[0,.16,0]} castShadow><cylinderGeometry args={[.36,.25,1.05,8]}/><meshPhysicalMaterial color={glass} metalness={.15} roughness={.1} transmission={.62} thickness={.4} transparent opacity={.75}/></mesh><Cyl position={[0,.71,0]} args={[.32,.32,.11,8]} color={dark}/><Box position={[.46,.18,0]} scale={[.2,.55,.16]} color={steel}/><Cyl position={[0,-.36,0]} args={[.22,.22,.08,24]} color={copper} metallic/></>;
 if(kind==='kneader'||kind==='processor')return <><Box position={[0,-.55,0]} scale={[1.32,.36,.82]} color={kind==='kneader'?red:dark}/><Cyl position={[0,-.27,.05]} args={[.43,.33,.49,32]} color={steel} metallic/><Box position={[-.3,.25,0]} scale={[.39,.8,.72]} color={kind==='kneader'?red:dark}/><Box position={[.05,.61,0]} scale={[1,.29,.74]} color={kind==='kneader'?red:dark}/><Cyl position={[.05,.46,0]} args={[.07,.07,.29,20]} color={steel} metallic/></>;
 if(kind==='cocotte')return <><Cyl position={[0,-.26,0]} args={[.59,.49,.77,40]} color={steel} metallic/><Cyl position={[0,.17,0]} args={[.62,.62,.11,40]} color={steel} metallic/><Cyl position={[0,.28,0]} args={[.09,.13,.13,24]} color={dark}/><Box position={[-.72,-.17,0]} scale={[.44,.09,.21]} color={dark}/><Box position={[.72,-.17,0]} scale={[.44,.09,.21]} color={dark}/></>;
 if(kind==='airfryer')return <><Box position={[0,0,0]} scale={[1.25,1.55,1.05]} color={dark} radius={.24}/><Box position={[0,.45,.53]} scale={[.86,.43,.045]} color={steel}/><Box position={[0,-.29,.54]} scale={[1,.65,.06]} color={dark}/><Box position={[0,-.31,.73]} scale={[.15,.36,.32]} color={steel}/><Ring position={[0,.43,.57]} args={[.12,.018,8,32]} color={copper}/></>;
 if(kind==='vacuum')return <><Cyl position={[0,.12,0]} args={[.12,.12,1.4,24]} color={steel} metallic/><Box position={[0,-.58,.08]} scale={[.76,.25,.48]} color={dark}/><Cyl position={[0,.82,0]} args={[.17,.17,.35,24]} color={dark}/><Ring position={[.24,-.55,.16]} args={[.09,.035,8,24]} color={copper}/></>;
 if(kind==='fan')return <><Cyl position={[0,-.7,0]} args={[.5,.5,.08,32]} color={dark}/><Cyl position={[0,-.04,0]} args={[.055,.055,1.2,16]} color={steel} metallic/><Ring position={[0,.56,.02]} args={[.53,.035,8,48]} color={steel}/>{[0,1,2].map(i=><mesh key={i} position={[0,.56,.02]} rotation={[0,0,i*Math.PI*2/3]}><boxGeometry args={[.18,.78,.035]}/><meshStandardMaterial {...metal}/></mesh>)}<Cyl position={[0,.56,.1]} args={[.11,.11,.11,24]} color={copper}/></>;
 if(kind==='panini')return <><Box position={[0,-.38,0]} scale={[1.47,.25,1]} color={dark}/><Box position={[0,.15,-.09]} scale={[1.42,.19,.95]} color={steel}/><Box position={[0,.43,.16]} scale={[.87,.1,.17]} color={dark}/><Cyl position={[.5,-.37,.5]} args={[.04,.04,.04,16]} color={copper}/></>;
 if(kind==='thermos')return <><Cyl position={[0,-.04,0]} args={[.34,.29,1.46,40]} color={steel} metallic/><Cyl position={[0,.78,0]} args={[.28,.32,.24,32]} color={dark}/><Ring position={[0,.64,.01]} args={[.29,.015,8,32]} color={copper}/></>;
 return <><Box position={[0,-.35,0]} scale={[1.5,.26,1.08]} color={dark}/>{[-.38,.38].map((x,i)=><Ring key={i} position={[x,-.19,.2]} args={[.23,.022,8,32]} color={copper}/>)}<Cyl position={[-.48,-.3,.52]} args={[.036,.036,.05,20]} color={steel}/><Cyl position={[.48,-.3,.52]} args={[.036,.036,.05,20]} color={steel}/></>;
}
function HeroScene({kind='coffee',interactive=true}: {kind?:ApplianceKind,interactive?:boolean}) {
 const group=useRef<THREE.Group>(null);const {camera,pointer}=useThree();
 useFrame(({clock},delta)=>{if(!group.current)return;group.current.rotation.y+=delta*(interactive?.15:.35);group.current.position.y=Math.sin(clock.elapsedTime*1.25)*.075;camera.position.x=THREE.MathUtils.lerp(camera.position.x,interactive?pointer.x*.35:0,.025);camera.position.y=THREE.MathUtils.lerp(camera.position.y,interactive?pointer.y*.15+.2:.2,.025);camera.lookAt(0,0,0)});
 return <><color attach="background" args={['#0e0e10']}/><ambientLight intensity={.8}/><spotLight position={[4,7,5]} intensity={95} angle={.55} penumbra={.8} color="#f9d8a7"/><spotLight position={[-4,2,-3]} intensity={75} angle={.75} color="#6ca3a0"/><Environment><Lightformer intensity={3} position={[0,5,2]} scale={[6,3,1]}/><Lightformer intensity={2} color="#e7b77e" position={[-4,1,1]} scale={[3,5,1]}/></Environment><group ref={group} scale={1.45} rotation={[0,-.35,0]}><Appliance kind={kind}/></group><mesh position={[0,-1.37,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[2.3,64]}/><meshStandardMaterial color="#222223" metalness={.55} roughness={.3}/></mesh><Ring position={[0,-1.35,0]} args={[1.85,.009,8,90]} color={copper}/></>;
}
export function Showroom3D({kind='coffee', interactive=true}: {kind?:ApplianceKind,interactive?:boolean}) {return <Canvas dpr={[1,2]} camera={{position:[0,.2,5.3],fov:38}} gl={{antialias:true,alpha:false}} shadows performance={{min:.5}}><Suspense fallback={null}><HeroScene kind={kind} interactive={interactive}/><EffectComposer multisampling={0}><Bloom luminanceThreshold={1.1} intensity={.35} mipmapBlur/><Noise opacity={.015}/><Vignette eskil={false} offset={.28} darkness={.35}/></EffectComposer></Suspense></Canvas>}
export type {ApplianceKind};
