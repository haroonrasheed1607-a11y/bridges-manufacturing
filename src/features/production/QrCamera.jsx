import {useEffect, useRef, useState} from 'react';

export function QrCamera({onScan,onClose}){
 const dialog=useRef(null),video=useRef(null),[error,setError]=useState(''),[ready,setReady]=useState(false);
 useEffect(()=>{
  let closed=false,stream,timer;
  dialog.current.showModal();
  const previous=document.activeElement;
  function stop(){closed=true;clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop());if(video.current)video.current.srcObject=null;}
  function hidden(){if(document.hidden){stop();onClose();}}
  document.addEventListener('visibilitychange',hidden);
  async function start(){try{
   const {default:jsQR}=await import('jsqr');if(closed)return;
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera scanning requires HTTPS and camera support. You can enter the box code manually.');
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
   if(closed){stream.getTracks().forEach(t=>t.stop());return;}
   video.current.srcObject=stream;await video.current.play();if(closed)return;setReady(true);
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
   function frame(){if(closed)return;try{const v=video.current;if(v?.readyState>=2&&v.videoWidth){const scale=Math.min(1,640/v.videoWidth);canvas.width=Math.round(v.videoWidth*scale);canvas.height=Math.round(v.videoHeight*scale);ctx.drawImage(v,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);const code=jsQR(pixels.data,pixels.width,pixels.height);if(code?.data){stop();onScan(code.data);return;}}timer=setTimeout(frame,160);}catch{stop();setError('Unable to read the camera. Close scanning and enter the box code manually.');}}
   frame();
  }catch(e){if(closed)return;stop();setError(e.name==='NotAllowedError'?'Camera access was denied. Allow camera access in your browser settings, or enter the box code manually.':e.name==='NotFoundError'?'No camera was found. Enter the box code manually.':e.message||'Could not open the camera.');}}
  start();
  return()=>{stop();document.removeEventListener('visibilitychange',hidden);previous?.focus?.();};
 },[]);
 return <dialog ref={dialog} className="qr-camera-dialog" aria-labelledby="qr-camera-title" onCancel={e=>{e.preventDefault();onClose();}}><div className="section-heading"><h2 id="qr-camera-title">Scan box QR code</h2><button type="button" onClick={onClose} aria-label="Close QR scanner">Close</button></div>{error?<p role="alert" className="alert">{error}</p>:<><p role="status">{ready?'Point the rear camera at the box QR label.':'Opening camera…'}</p><video ref={video} muted playsInline autoPlay aria-label="QR camera preview"/><p>After scanning, confirm the number of pieces and tap Mark box as completed.</p></>}<button type="button" onClick={onClose}>Enter box code manually</button></dialog>;
}
