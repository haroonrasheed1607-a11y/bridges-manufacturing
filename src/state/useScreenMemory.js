import {React} from '../vendor/react-runtime.js';
import {useManufacturing} from './ManufacturingContext.jsx';
export function useScreenMemory(name,initial){const {profile}=useManufacturing();const key='bridges-manufacturing-screen-v1:'+profile?.id+':'+name;const [value,setValue]=React.useState(()=>{try{const saved=localStorage.getItem(key);if(saved!==null)return JSON.parse(saved);}catch{}return typeof initial==='function'?initial():initial;});React.useEffect(()=>{if(profile?.id)try{localStorage.setItem(key,JSON.stringify(value));}catch{}},[key,value]);return[value,setValue];}
