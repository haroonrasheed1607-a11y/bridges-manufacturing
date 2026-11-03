// features/delivery/DeliveryPage.js
import { Badge } from "../../components/common/Badge.js";
import { FormField } from "../../components/common/FormField.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatTimestamp } from "../../utils/dates.js";
import { jsxRuntime } from "../../vendor/jsx-runtime.js";
import { ManufacturingDeliveryChallan } from "./DeliveryChallan.js";
import { SignaturePad } from "./SignaturePad.js";

function DeliveryPage() {
  let {
      order: order,
      change: change
    } = useManufacturing(),
    delivery = order.delivery || {};
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [(0, jsxRuntime.jsx)(ManufacturingDeliveryChallan, {}), (0, jsxRuntime.jsxs)(`div`, {
      className: `section-heading`,
      children: [(0, jsxRuntime.jsxs)(`div`, {
        children: [(0, jsxRuntime.jsx)(`h3`, {
          children: `Ready for the customer.`
        }), (0, jsxRuntime.jsx)(`p`, {
          className: `quiet`,
          children: `Approve delivery, record the handover, then collect the customer's signature.`
        })]
      }), (0, jsxRuntime.jsx)(Badge, {
        tone: delivery.dispatchedAt ? `green` : ``,
        children: delivery.dispatchedAt ? `Dispatched` : delivery.approved ? `Ok to Deliver` : `Awaiting approval`
      })]
    }), (0, jsxRuntime.jsxs)(`section`, {
      className: `panel`,
      children: [(0, jsxRuntime.jsx)(`h3`, {
        children: `Delivery authorization`
      }), delivery.dispatchedAt ? (0, jsxRuntime.jsxs)(`div`, {
        className: `work-stats`,
        children: [(0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsx)(`small`, {
            children: `Method`
          }), (0, jsxRuntime.jsx)(`strong`, {
            children: delivery.method
          })]
        }), (0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsx)(`small`, {
            children: `Destination / pickup details`
          }), (0, jsxRuntime.jsx)(`strong`, {
            children: delivery.details
          })]
        }), (0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsx)(`small`, {
            children: `Approved by`
          }), (0, jsxRuntime.jsx)(`strong`, {
            children: delivery.approver
          })]
        }), (0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsx)(`small`, {
            children: `Dispatched`
          }), (0, jsxRuntime.jsx)(`strong`, {
            children: formatTimestamp(delivery.dispatchedAt)
          })]
        })]
      }) : (0, jsxRuntime.jsxs)(`form`, {
        onSubmit: n => {
          n.preventDefault();
          let r = Object.fromEntries(new FormData(n.currentTarget));
          change(order.id, e => ({
            ...e,
            delivery: {
              ...e.delivery,
              ...r,
              approved: !0,
              approvedAt: new Date().toISOString()
            }
          }), `Delivery approved.`);
        },
        children: [(0, jsxRuntime.jsxs)(`div`, {
          className: `form-grid`,
          children: [(0, jsxRuntime.jsx)(FormField, {
            label: `Delivery method`,
            children: (0, jsxRuntime.jsxs)(`select`, {
              name: `method`,
              defaultValue: delivery.method || `Customer Pickup`,
              children: [(0, jsxRuntime.jsx)(`option`, {
                children: `Customer Pickup`
              }), (0, jsxRuntime.jsx)(`option`, {
                children: `Drop`
              })]
            })
          }), (0, jsxRuntime.jsx)(FormField, {
            label: `Approved by`,
            children: (0, jsxRuntime.jsx)(`input`, {
              name: `approver`,
              required: !0,
              defaultValue: delivery.approver || ``
            })
          }), (0, jsxRuntime.jsx)(FormField, {
            label: `Pickup or drop details`,
            children: (0, jsxRuntime.jsx)(`textarea`, {
              name: `details`,
              required: !0,
              defaultValue: delivery.details || ``,
              placeholder: `Pickup arrangements or delivery address`
            })
          })]
        }), (0, jsxRuntime.jsxs)(`label`, {
          className: `check-label`,
          children: [(0, jsxRuntime.jsx)(`input`, {
            name: `okToDeliver`,
            type: `checkbox`,
            required: !0
          }), ` Ok to Deliver`]
        }), (0, jsxRuntime.jsx)(`div`, {
          className: `form-actions`,
          children: (0, jsxRuntime.jsx)(`button`, {
            className: `primary`,
            children: `Save delivery approval`
          })
        })]
      }), delivery.approved && !delivery.dispatchedAt && (0, jsxRuntime.jsxs)(`div`, {
        className: `callout`,
        children: [(0, jsxRuntime.jsxs)(`p`, {
          children: [`Approved by `, delivery.approver, ` · `, delivery.method, `. Record dispatch when the goods actually leave the warehouse.`]
        }), (0, jsxRuntime.jsx)(`button`, {
          className: `primary`,
          onClick: () => change(order.id, e => ({
            ...e,
            delivery: {
              ...e.delivery,
              dispatchedAt: new Date().toISOString()
            }
          }), `Delivery dispatched; warehouse stock released.`),
          children: `Record pickup / dispatch`
        })]
      })]
    }), (0, jsxRuntime.jsxs)(`section`, {
      className: `panel`,
      children: [(0, jsxRuntime.jsx)(`h3`, {
        children: `Customer acceptance`
      }), (0, jsxRuntime.jsx)(`p`, {
        className: `quiet`,
        children: `The order stays open until the customer has signed.`
      }), delivery.dispatchedAt ? delivery.signature ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
        children: [(0, jsxRuntime.jsx)(Badge, {
          tone: `green`,
          children: `Customer signature saved`
        }), (0, jsxRuntime.jsx)(`img`, {
          className: `signature-image`,
          alt: `Customer signature of ` + delivery.signatory,
          src: delivery.signature
        }), (0, jsxRuntime.jsxs)(`p`, {
          children: [delivery.signatory, ` · `, formatTimestamp(delivery.signedAt)]
        })]
      }) : (0, jsxRuntime.jsx)(SignaturePad, {
        onSign: n => change(order.id, e => ({
          ...e,
          delivery: {
            ...e.delivery,
            ...n
          }
        }), `Customer signature recorded.`)
      }) : (0, jsxRuntime.jsx)(`div`, {
        className: `empty`,
        children: `Dispatch the order before collecting the signature.`
      })]
    })]
  });
}

export { DeliveryPage };
