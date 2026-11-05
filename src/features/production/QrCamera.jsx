import {cameraErrorMessage} from './cameraErrors.js';
import { useEffect, useRef, useState } from "react";

export function QrCamera({ onScan, onClose }) {
  const dialog = useRef(null),
    video = useRef(null),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [deviceId, setDeviceId] = useState(""),
    [cameras, setCameras] = useState([]);
  useEffect(() => {
    let closed = false,
      stream,
      timer;
    if (!dialog.current.open) dialog.current.showModal();
    setError("");
    setReady(false);
    const previous = document.activeElement;
    function stop() {
      closed = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (video.current) video.current.srcObject = null;
    }
    function hidden() {
      if (document.hidden) {
        stop();
        onClose();
      }
    }
    document.addEventListener("visibilitychange", hidden);
    async function start() {
      try {
        const { default: jsQR } = await import("jsqr");
        if (closed) return;
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera scanning requires HTTPS and camera support. You can enter the box code manually.",
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 } }
            : {
                facingMode: {
                  ideal: window.bridgesDesktop ? "user" : "environment",
                },
                width: { ideal: 1280 },
              },
          audio: false,
        });
        if (closed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setCameras(
          (await navigator.mediaDevices.enumerateDevices()).filter(
            (d) => d.kind === "videoinput",
          ),
        );
        if (closed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        if (closed) return;
        setReady(true);
        const canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d", { willReadFrequently: true });
        function frame() {
          if (closed) return;
          try {
            const v = video.current;
            if (v?.readyState >= 2 && v.videoWidth) {
              const scale = Math.min(1, 640 / v.videoWidth);
              canvas.width = Math.round(v.videoWidth * scale);
              canvas.height = Math.round(v.videoHeight * scale);
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const pixels = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const code = jsQR(pixels.data, pixels.width, pixels.height);
              if (code?.data) {
                stop();
                onScan(code.data);
                return;
              }
            }
            timer = setTimeout(frame, 160);
          } catch {
            stop();
            setError(
              "Unable to read the camera. Close scanning and enter the box code manually.",
            );
          }
        }
        frame();
      } catch (e) {
        if (closed) return;
        stop();
        setError(cameraErrorMessage(e,!!window.bridgesDesktop));
      }
    }
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", hidden);
      previous?.focus?.();
    };
  }, [deviceId]);
  return (
    <dialog
      ref={dialog}
      className="qr-camera-dialog"
      aria-labelledby="qr-camera-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="section-heading">
        <h2 id="qr-camera-title">Scan QR code</h2>
        <button type="button" onClick={onClose} aria-label="Close QR scanner">
          Close
        </button>
      </div>
      {error ? (
        <div><p role="alert" className="alert">{error}</p>{window.bridgesDesktop?.cameraSettings&&<button type="button" onClick={()=>window.chrome.webview.postMessage({type:'bridges.camera-settings'})}>Open Windows camera settings</button>}</div>
      ) : (
        <>
          <p role="status">
            {ready
              ? "Hold the box or reusable QR in front of the camera."
              : "Opening camera…"}
          </p>
          <label className="field">
            Camera
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              <option value="">Automatic camera</option>
              {cameras.map((camera, i) => (
                <option value={camera.deviceId} key={camera.deviceId}>
                  {camera.label || "Camera " + (i + 1)}
                </option>
              ))}
            </select>
          </label>
          <video
            ref={video}
            muted
            playsInline
            autoPlay
            aria-label="QR camera preview"
          />
          <p>
            Box scans open completion confirmation. Reusable dumping QR scans
            record the assigned batch automatically.
          </p>
        </>
      )}
      <button type="button" onClick={onClose}>
        Enter box code manually
      </button>
    </dialog>
  );
}
