// features/packing/PackingPage.js
import { Badge } from "../../components/common/Badge.js";
import { FormField } from "../../components/common/FormField.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatTimestamp } from "../../utils/dates.js";
import { manufacturingFillFields } from "../../utils/forms.js";
import { createId } from "../../utils/ids.js";
import { jsxRuntime } from "../../vendor/jsx-runtime.js";

function PackingPage() {
  let {
    order: order,
    updateWork: updateWork
  } = useManufacturing();
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [(0, jsxRuntime.jsx)(`h3`, {
      children: `Is everything packed correctly?`
    }), (0, jsxRuntime.jsx)(`p`, {
      className: `quiet`,
      children: `Check quantities, box or packet condition, labels, and required inserts.`
    }), order.workOrders.map(e => (0, jsxRuntime.jsxs)(`section`, {
      className: `panel`,
      children: [(0, jsxRuntime.jsxs)(`div`, {
        className: `section-heading`,
        children: [(0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsx)(`div`, {
            className: `eyebrow`,
            children: e.id
          }), (0, jsxRuntime.jsx)(`h3`, {
            children: e.description
          })]
        }), (0, jsxRuntime.jsxs)(Badge, {
          children: [e.jobs.reduce((t, n) => t + Math.ceil(n.quantity / e.perPack), 0), ` packs`]
        })]
      }), (0, jsxRuntime.jsxs)(`form`, {
        onSubmit: n => {
          n.preventDefault();
          let r = Object.fromEntries(new FormData(n.currentTarget)),
            i = {
              ...r,
              id: createId(`PK`),
              correct: r.result === `correct`,
              at: new Date().toISOString()
            };
          updateWork(e.id, e => ({
            ...e,
            packing: [...e.packing, i]
          }), i.correct ? `Correct packing confirmed.` : `Packing held for correction.`);
        },
        children: [(0, jsxRuntime.jsxs)(`div`, {
          className: `form-grid`,
          children: [(0, jsxRuntime.jsx)(FormField, {
            label: `Packing result`,
            children: (0, jsxRuntime.jsxs)(`select`, {
              name: `result`,
              children: [(0, jsxRuntime.jsx)(`option`, {
                value: `correct`,
                children: `Packed correctly`
              }), (0, jsxRuntime.jsx)(`option`, {
                value: `incorrect`,
                children: `Not packed correctly`
              })]
            })
          }), (0, jsxRuntime.jsx)(FormField, {
            label: `Checked by`,
            children: (0, jsxRuntime.jsx)(`input`, {
              name: `checker`,
              required: !0
            })
          }), (0, jsxRuntime.jsx)(FormField, {
            label: `Notes / corrections`,
            children: (0, jsxRuntime.jsx)(`textarea`, {
              name: `notes`
            })
          })]
        }), (0, jsxRuntime.jsxs)(`div`, {
          className: `form-actions`,
          children: [(0, jsxRuntime.jsx)(`button`, {
            type: `button`,
            className: `sample-data-button`,
            onClick: event => manufacturingFillFields(event.currentTarget.form, {
              result: `correct`,
              checker: `Demo packer`,
              notes: `Demo packing check: quantity and labels verified.`
            }),
            children: `Fill sample data`
          }), (0, jsxRuntime.jsx)(`button`, {
            className: `primary`,
            children: `Save packing check`
          })]
        })]
      }), e.packing.toReversed().map(e => (0, jsxRuntime.jsxs)(`div`, {
        className: `history-item`,
        children: [(0, jsxRuntime.jsx)(Badge, {
          tone: e.correct ? `green` : `red`,
          children: e.correct ? `Correct` : `Hold`
        }), (0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsx)(`strong`, {
            children: e.checker
          }), (0, jsxRuntime.jsxs)(`p`, {
            children: [formatTimestamp(e.at), ` `, e.notes && `· ` + e.notes]
          })]
        })]
      }, e.id))]
    }, e.id))]
  });
}

export { PackingPage };
