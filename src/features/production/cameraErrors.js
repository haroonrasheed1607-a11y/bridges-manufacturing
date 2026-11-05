export function cameraErrorMessage(error,desktop=false){
 if(error.name==='NotAllowedError')return desktop
  ?'Camera access is blocked by Windows privacy settings, an organization policy, or a saved app permission. Close and reopen the app to update it, then check Windows Settings → Privacy & security → Camera: turn on Camera access and Let desktop apps access your camera.'
  :'Camera access was denied. Allow camera access for this website in your browser settings, or enter the code manually.';
 if(error.name==='NotFoundError')return 'No camera was found. Connect a webcam or enter the code manually.';
 if(error.name==='NotReadableError')return 'The camera is unavailable or in use. Close other camera apps and try again.';
 return error.message||'Could not open the camera.';
}
