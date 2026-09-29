import type { ApplianceKind } from '../components/Showroom3D';
export const categories: {id:string;label:string;fr:string;kind:ApplianceKind}[] = [
 {id:'cofee-machine',label:'آلات القهوة',fr:'MACHINES À CAFÉ',kind:'coffee'},
 {id:'blender',label:'الخلاطات',fr:'BLENDERS',kind:'blender'},
 {id:'robot-cuiseur',label:'العجانات',fr:'PÉTRINS',kind:'kneader'},
 {id:'cocotte',label:'طنجرات الضغط',fr:'COCOTTES',kind:'cocotte'},
 {id:'presse',label:'عصارات',fr:'PRESSE-AGRUMES',kind:'juicer'},
 {id:'air-fryer',label:'قلايات هوائية',fr:'AIR FRYERS',kind:'airfryer'},
 {id:'aspirateur',label:'مكانس كهربائية',fr:'ASPIRATEURS',kind:'vacuum'},
 {id:'ventilateur',label:'مراوح',fr:'VENTILATEURS',kind:'fan'},
 {id:'sandwich-makter-panini',label:'آلات البانيني',fr:'PANINI',kind:'panini'},
 {id:'thermos',label:'ترموسات',fr:'THERMOS',kind:'thermos'},
 {id:'plaque-de-cuisson',label:'صفائح الطبخ',fr:'PLAQUES',kind:'hob'},
 {id:'food-processors',label:'محضرات الطعام',fr:'ROBOTS DE CUISINE',kind:'processor'},
];
