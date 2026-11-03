// features/delivery/SignaturePad.js
import { FormField } from "../../components/common/FormField.js";
import { jsxRuntime } from "../../vendor/jsx-runtime.js";
import { React } from "../../vendor/react-runtime.js";

function SignaturePad({
  onSign: e
}) {
  let t = (0, React.useRef)(),
    n = (0, React.useRef)(!1),
    r = (0, React.useRef)(),
    [i, a] = (0, React.useState)(!1);
  (0, React.useEffect)(() => {
    let e = t.current.getContext(`2d`);
    e.lineWidth = 2.5, e.lineCap = `round`, e.strokeStyle = `#102960`;
  }, []);
  function o(e) {
    let n = t.current.getBoundingClientRect();
    return {
      x: (e.clientX - n.left) * t.current.width / n.width,
      y: (e.clientY - n.top) * t.current.height / n.height
    };
  }
  return (0, jsxRuntime.jsxs)(`form`, {
    onSubmit: n => {
      n.preventDefault(), i && e({
        ...Object.fromEntries(new FormData(n.currentTarget)),
        signature: t.current.toDataURL(`image/png`),
        signedAt: new Date().toISOString()
      });
    },
    children: [(0, jsxRuntime.jsx)(FormField, {
      label: `Customer signatory name`,
      children: (0, jsxRuntime.jsx)(`input`, {
        name: `signatory`,
        required: !0
      })
    }), (0, jsxRuntime.jsx)(`p`, {
      className: `quiet`,
      children: `Customer: sign below using a finger, stylus, or mouse.`
    }), (0, jsxRuntime.jsx)(`canvas`, {
      ref: t,
      width: `900`,
      height: `220`,
      className: `signature-canvas`,
      "aria-label": `Customer signature drawing area`,
      onPointerDown: e => {
        n.current = !0, r.current = o(e), t.current.setPointerCapture(e.pointerId);
      },
      onPointerMove: e => {
        if (!n.current) return;
        let i = o(e),
          s = t.current.getContext(`2d`);
        s.beginPath(), s.moveTo(r.current.x, r.current.y), s.lineTo(i.x, i.y), s.stroke(), r.current = i, a(!0);
      },
      onPointerUp: () => n.current = !1,
      onPointerCancel: () => n.current = !1
    }), (0, jsxRuntime.jsxs)(`div`, {
      className: `form-actions`,
      children: [(0, jsxRuntime.jsx)(`button`, {
        type: `button`,
        onClick: () => {
          t.current.getContext(`2d`).clearRect(0, 0, 900, 220), a(!1);
        },
        children: `Clear signature`
      }), (0, jsxRuntime.jsx)(`button`, {
        className: `primary`,
        disabled: !i,
        children: `Save customer signature`
      })]
    })]
  });
}

export { SignaturePad };
