// features/quality/QualityCheckPage.js
import { Badge } from "../../components/common/Badge.js";
import { FormField } from "../../components/common/FormField.js";
import { validateQualityCheck } from "../../domain/validation.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatTimestamp } from "../../utils/dates.js";
import { manufacturingFillFields } from "../../utils/forms.js";
import { createId } from "../../utils/ids.js";
import { jsxRuntime } from "../../vendor/jsx-runtime.js";
import { React } from "../../vendor/react-runtime.js";

function QualityCheckPage() {
  let {
      order: order,
      updateWork: updateWork
    } = useManufacturing(),
    [workId, setWorkId] = (0, React.useState)(order.workOrders[0]?.id),
    [mode, setMode] = (0, React.useState)(`Random Audit`),
    [error, setError] = (0, React.useState)(``),
    work = order.workOrders.find(e => e.id === workId);
  if (!work) return (0, jsxRuntime.jsx)(`p`, {
    children: `No work orders available.`
  });
  function submit(e) {
    e.preventDefault();
    let n = Object.fromEntries(new FormData(e.currentTarget)),
      r = {
        ...n,
        mode: mode,
        inspected: Number(n.inspected),
        failed: Number(n.failed),
        id: createId(`QC`),
        at: new Date().toISOString()
      },
      a = validateQualityCheck(r, work);
    a ? setError(a) : (updateWork(work.id, e => ({
      ...e,
      audits: [...e.audits, r]
    }), r.failed ? `Quality check recorded: hold for corrective work.` : `Passing quality check recorded.`), setError(``));
  }
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [(0, jsxRuntime.jsx)(`div`, {
      className: `section-heading`,
      children: (0, jsxRuntime.jsxs)(`div`, {
        children: [(0, jsxRuntime.jsx)(`h3`, {
          children: `Check the work.`
        }), (0, jsxRuntime.jsx)(`p`, {
          className: `quiet`,
          children: `Record a random audit or inspect every piece.`
        })]
      })
    }), (0, jsxRuntime.jsxs)(`form`, {
      className: `panel`,
      onSubmit: submit,
      children: [(0, jsxRuntime.jsxs)(`div`, {
        className: `form-grid`,
        children: [(0, jsxRuntime.jsx)(FormField, {
          label: `Work order`,
          children: (0, jsxRuntime.jsx)(`select`, {
            value: workId,
            onChange: e => setWorkId(e.target.value),
            children: order.workOrders.map(e => (0, jsxRuntime.jsxs)(`option`, {
              value: e.id,
              children: [e.id, ` · `, e.description]
            }, e.id))
          })
        }), (0, jsxRuntime.jsx)(FormField, {
          label: `Check method`,
          children: (0, jsxRuntime.jsxs)(`select`, {
            value: mode,
            onChange: e => setMode(e.target.value),
            children: [(0, jsxRuntime.jsx)(`option`, {
              children: `Random Audit`
            }), (0, jsxRuntime.jsx)(`option`, {
              children: `100% Check`
            })]
          })
        }), (0, jsxRuntime.jsx)(FormField, {
          label: `Pieces inspected`,
          hint: `${work.quantity} pieces in this work order`,
          children: (0, jsxRuntime.jsx)(`input`, {
            name: `inspected`,
            type: `number`,
            min: `1`,
            max: work.quantity,
            defaultValue: mode === `100% Check` ? work.quantity : ``,
            required: !0,
            readOnly: mode === `100% Check`
          }, workId + mode)
        }), (0, jsxRuntime.jsx)(FormField, {
          label: `Failed pieces`,
          children: (0, jsxRuntime.jsx)(`input`, {
            name: `failed`,
            type: `number`,
            min: `0`,
            max: work.quantity,
            required: !0,
            defaultValue: `0`
          })
        }), (0, jsxRuntime.jsx)(FormField, {
          label: `Inspector`,
          children: (0, jsxRuntime.jsx)(`input`, {
            name: `inspector`,
            required: !0
          })
        }), (0, jsxRuntime.jsx)(FormField, {
          label: `Findings / corrective work`,
          children: (0, jsxRuntime.jsx)(`textarea`, {
            name: `notes`
          })
        })]
      }), (0, jsxRuntime.jsx)(`p`, {
        className: `callout`,
        children: `Draft rule: any failed piece holds the work order. Record corrective work, then submit a fresh check. Previous checks stay in history.`
      }), error && (0, jsxRuntime.jsx)(`p`, {
        className: `alert`,
        role: `alert`,
        children: error
      }), (0, jsxRuntime.jsxs)(`div`, {
        className: `form-actions`,
        children: [(0, jsxRuntime.jsx)(`button`, {
          type: `button`,
          className: `sample-data-button`,
          onClick: event => {
            manufacturingFillFields(event.currentTarget.form, {
              inspected: mode === `100% Check` ? work.quantity : Math.min(20, work.quantity),
              failed: 0,
              inspector: `Demo inspector`,
              notes: `Demo audit: inspected pieces passed.`
            });
            setError(``);
          },
          children: `Fill sample data`
        }), (0, jsxRuntime.jsx)(`button`, {
          className: `primary`,
          children: `Record quality check`
        })]
      })]
    }), (0, jsxRuntime.jsx)(`h3`, {
      className: `sub-heading`,
      children: `Check history`
    }), order.workOrders.map(e => (0, jsxRuntime.jsxs)(`div`, {
      className: `check-history`,
      children: [(0, jsxRuntime.jsxs)(`h4`, {
        children: [e.id, ` · `, e.description]
      }), e.audits.length ? e.audits.toReversed().map(e => (0, jsxRuntime.jsxs)(`div`, {
        className: `history-item`,
        children: [(0, jsxRuntime.jsx)(Badge, {
          tone: e.failed ? `red` : `green`,
          children: e.failed ? `Hold` : `Pass`
        }), (0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsxs)(`strong`, {
            children: [e.mode, ` · `, e.inspected, ` inspected · `, e.failed, ` failed`]
          }), (0, jsxRuntime.jsxs)(`p`, {
            children: [e.inspector, ` · `, formatTimestamp(e.at)]
          }), e.notes && (0, jsxRuntime.jsx)(`p`, {
            children: e.notes
          })]
        })]
      }, e.id)) : (0, jsxRuntime.jsx)(`p`, {
        className: `quiet`,
        children: `Awaiting inspection`
      })]
    }, e.id))]
  });
}

export { QualityCheckPage };
