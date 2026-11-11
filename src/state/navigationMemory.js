import {canUsePlan,canUseShopFloor} from '../features/auth/permissions.js';
const prefix='bridges-manufacturing-navigation-v1:';
function storage(){try{return globalThis.localStorage;}catch{return null;}}
export function readNavigation(profile){try{const v=JSON.parse(storage()?.getItem(prefix+profile?.id)||'null');return v&&typeof v==='object'?v:{};}catch{return {};}}
export function writeNavigation(profile,value){if(!profile?.id)return;try{storage()?.setItem(prefix+profile.id,JSON.stringify(value));}catch{}}
export function validView(role,view){if(['shopfloordashboard','shopfloorattendance'].includes(view)&&canUseShopFloor(role))return view;if(['plan','shopfloorprint'].includes(view)&&canUsePlan(role))return view;const allowed=['admin','manager'].includes(role)?['dashboard','orders','new','detail','workflow','productionline','individuals','board','customers','availability','attendance',...(role==='admin'?['users','configurations','barcodeapprovals']:[])]:['box_setup','box_scanner'].includes(role)?['productionline']:['productionline','board','detail',...(role==='coach'?['availability','attendance']:[])];return allowed.includes(view)?view:allowed[0];}
