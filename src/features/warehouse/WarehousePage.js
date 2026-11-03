// features/warehouse/WarehousePage.js
import { Badge } from "../../components/common/Badge.js";
import { FormField } from "../../components/common/FormField.js";
import { getOrderPackRecords } from "../../domain/validation.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatTimestamp } from "../../utils/dates.js";
import { jsxRuntime } from "../../vendor/jsx-runtime.js";

function WarehousePage() {
  let {
      order: order,
      change: change
    } = useManufacturing(),
    packs = getOrderPackRecords(order),
    warehouse = order.warehouse || {};
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [(0, jsxRuntime.jsxs)(`div`, {
      className: `section-heading`,
      children: [(0, jsxRuntime.jsxs)(`div`, {
        children: [(0, jsxRuntime.jsx)(`h3`, {
          children: `From packed goods to warehouse stock.`
        }), (0, jsxRuntime.jsx)(`p`, {
          className: `quiet`,
          children: `Send the packs, then confirm they have arrived.`
        })]
      }), (0, jsxRuntime.jsx)(Badge, {
        tone: warehouse.receivedAt ? `green` : warehouse.sentAt ? `amber` : ``,
        children: warehouse.receivedAt ? `In warehouse` : warehouse.sentAt ? `Sent to warehouse` : `Awaiting transfer`
      })]
    }), (0, jsxRuntime.jsxs)(`section`, {
      className: `panel`,
      children: [(0, jsxRuntime.jsxs)(`div`, {
        className: `transfer-step`,
        children: [(0, jsxRuntime.jsx)(`span`, {
          className: `step-number`,
          children: `1`
        }), (0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsx)(`h3`, {
            children: `Send to warehouse`
          }), (0, jsxRuntime.jsx)(`p`, {
            className: `quiet`,
            children: `All packs in this order move together in this draft.`
          }), warehouse.sentAt ? (0, jsxRuntime.jsxs)(`p`, {
            children: [`Sent `, formatTimestamp(warehouse.sentAt)]
          }) : (0, jsxRuntime.jsx)(`button`, {
            className: `primary`,
            onClick: () => change(order.id, e => ({
              ...e,
              warehouse: {
                ...e.warehouse,
                sentAt: new Date().toISOString()
              }
            }), `Packs sent to warehouse.`),
            children: `Mark sent to warehouse`
          })]
        })]
      }), (0, jsxRuntime.jsxs)(`div`, {
        className: `transfer-step`,
        children: [(0, jsxRuntime.jsx)(`span`, {
          className: `step-number`,
          children: `2`
        }), (0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsx)(`h3`, {
            children: `Confirm warehouse receipt`
          }), warehouse.receivedAt ? (0, jsxRuntime.jsxs)(`p`, {
            children: [(0, jsxRuntime.jsx)(`strong`, {
              children: warehouse.location
            }), ` · Received by `, warehouse.receiver, ` · `, formatTimestamp(warehouse.receivedAt)]
          }) : (0, jsxRuntime.jsx)(`form`, {
            onSubmit: n => {
              if (n.preventDefault(), !warehouse.sentAt) return;
              let i = Object.fromEntries(new FormData(n.currentTarget));
              change(order.id, e => ({
                ...e,
                warehouse: {
                  ...e.warehouse,
                  ...i,
                  receivedAt: new Date().toISOString()
                }
              }), `Warehouse receipt confirmed.`);
            },
            children: (0, jsxRuntime.jsxs)(`fieldset`, {
              disabled: !warehouse.sentAt,
              children: [(0, jsxRuntime.jsxs)(`div`, {
                className: `form-grid`,
                children: [(0, jsxRuntime.jsx)(FormField, {
                  label: `Warehouse / storage location`,
                  children: (0, jsxRuntime.jsx)(`input`, {
                    name: `location`,
                    required: !0,
                    placeholder: `e.g. Main warehouse · Rack A2`
                  })
                }), (0, jsxRuntime.jsx)(FormField, {
                  label: `Received by`,
                  children: (0, jsxRuntime.jsx)(`input`, {
                    name: `receiver`,
                    required: !0
                  })
                })]
              }), (0, jsxRuntime.jsx)(`button`, {
                className: `primary`,
                children: `Confirm received into warehouse`
              })]
            })
          })]
        })]
      })]
    }), (0, jsxRuntime.jsxs)(`div`, {
      className: `table-wrap panel`,
      children: [(0, jsxRuntime.jsxs)(`table`, {
        children: [(0, jsxRuntime.jsx)(`thead`, {
          children: (0, jsxRuntime.jsxs)(`tr`, {
            children: [(0, jsxRuntime.jsx)(`th`, {
              children: `Pack reference`
            }), (0, jsxRuntime.jsx)(`th`, {
              children: `Work order / sub-job`
            }), (0, jsxRuntime.jsx)(`th`, {
              children: `Type`
            }), (0, jsxRuntime.jsx)(`th`, {
              children: `Pieces`
            }), (0, jsxRuntime.jsx)(`th`, {
              children: `Stock status`
            })]
          })
        }), (0, jsxRuntime.jsx)(`tbody`, {
          children: packs.slice(0, 200).map(t => (0, jsxRuntime.jsxs)(`tr`, {
            children: [(0, jsxRuntime.jsx)(`td`, {
              children: t.id
            }), (0, jsxRuntime.jsxs)(`td`, {
              children: [t.workOrder, (0, jsxRuntime.jsx)(`small`, {
                className: `block quiet`,
                children: t.job
              })]
            }), (0, jsxRuntime.jsx)(`td`, {
              children: t.type
            }), (0, jsxRuntime.jsx)(`td`, {
              children: t.pieces
            }), (0, jsxRuntime.jsx)(`td`, {
              children: order.delivery?.dispatchedAt ? `Dispatched` : warehouse.receivedAt ? `In warehouse` : warehouse.sentAt ? `In transit to warehouse` : `Awaiting transfer`
            })]
          }, t.id))
        })]
      }), packs.length > 200 && (0, jsxRuntime.jsx)(`p`, {
        className: `quiet`,
        children: `Showing first 200 packs; export includes all sub-job quantities.`
      })]
    })]
  });
}

export { WarehousePage };
