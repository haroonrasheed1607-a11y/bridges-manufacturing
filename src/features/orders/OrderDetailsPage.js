// features/orders/OrderDetailsPage.js
import { manufacturingCanEditOrderRequest } from "../../domain/orders.js";
import { manufacturingOrderStep, manufacturingTransitionLabel, manufacturingWorkflowBlock } from "../../domain/workflow.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatTimestamp } from "../../utils/dates.js";
import { jsxRuntime } from "../../vendor/jsx-runtime.js";
import { React } from "../../vendor/react-runtime.js";
import { canUsePlan } from "../auth/permissions.js";
import { ManufacturingDeliveryChallan } from "../delivery/DeliveryChallan.js";
import { DeliveryPage } from "../delivery/DeliveryPage.js";
import { PackingPage } from "../packing/PackingPage.js";
import { QualityCheckPage } from "../quality/QualityCheckPage.js";
import { WarehousePage } from "../warehouse/WarehousePage.js";
import { ManufacturingAssignWorkOrder } from "../work-orders/AssignWorkOrder.js";
import { WorkOrdersPage } from "../work-orders/WorkOrdersPage.js";
import { CreateOrderPage } from "./CreateOrderPage.js";
import { OrderSummary } from "./OrderSummary.jsx";
import { ManufacturingOrderPictures } from "./OrderPictures.js";

function OrderDetailsPage() {
  let {
      order: order,
      setView: setView,
      advance: advance,
      notice: notice,
      workforce, manager,
      profile
    } = useManufacturing(),
    [activeTab, setActiveTab] = (0, React.useState)(`current`),
    [editingRequest, setEditingRequest] = (0, React.useState)(null),
    canEditRequest = manager && manufacturingCanEditOrderRequest(order),
    blocker = manufacturingWorkflowBlock(order, workforce),
    StageComponent = order.stage === 0 && order.workOrderApprovedAt ? ManufacturingAssignWorkOrder : [WorkOrdersPage, WorkOrdersPage, QualityCheckPage, PackingPage, WarehousePage, DeliveryPage][order.stage];
  if (editingRequest && canEditRequest) return (0, jsxRuntime.jsx)(CreateOrderPage, {
    existingOrder: editingRequest,
    onClose: () => setEditingRequest(null)
  });
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [editingRequest && !canEditRequest && (0, jsxRuntime.jsx)(`p`, {
      className: `alert`,
      role: `status`,
      children: `A work order has been created. The order request is now locked.`
    }), (0, jsxRuntime.jsx)(OrderSummary, { onEditRequest: canEditRequest ? () => setEditingRequest(order) : undefined }), (0, jsxRuntime.jsxs)(`div`, {
      className: `detail-layout`,
      children: [(0, jsxRuntime.jsxs)(`section`, {
        className: `panel stage-panel`,
        children: [(0, jsxRuntime.jsxs)(`div`, {
          className: `tabs`,
          role: `group`,
          "aria-label": `Order sections`,
          children: [(0, jsxRuntime.jsx)(`button`, {
            className: activeTab === `current` ? `selected` : ``,
            onClick: () => setActiveTab(`current`),
            children: manufacturingOrderStep(order)
          }), (order.stage > 1 || order.workOrderApprovedAt) && (0, jsxRuntime.jsx)(`button`, {
            className: activeTab === `work` ? `selected` : ``,
            onClick: () => setActiveTab(`work`),
            children: `Work orders`
          }), (0, jsxRuntime.jsx)(`button`, {
            className: activeTab === `history` ? `selected` : ``,
            onClick: () => setActiveTab(`history`),
            children: `Activity history`
          })]
        }), (0, jsxRuntime.jsx)(`div`, {
          className: `stage-content`,
          children: activeTab === `history` ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
            children: [(0, jsxRuntime.jsx)(`h3`, {
              children: `Activity history`
            }), order.history.length ? order.history.toReversed().map(e => (0, jsxRuntime.jsxs)(`div`, {
              className: `timeline-item`,
              children: [(0, jsxRuntime.jsx)(`span`, {
                className: `timeline-dot`
              }), (0, jsxRuntime.jsxs)(`div`, {
                children: [(0, jsxRuntime.jsx)(`strong`, {
                  children: e.message
                }), (0, jsxRuntime.jsx)(`small`, {
                  className: `block quiet`,
                  children: formatTimestamp(e.at)
                })]
              })]
            }, e.id)) : (0, jsxRuntime.jsx)(`p`, {
              className: `quiet`,
              children: `No activity recorded for this sample yet.`
            })]
          }) : activeTab === `work` ? (0, jsxRuntime.jsx)(WorkOrdersPage, {}) : order.stage === 6 ? (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
            children: [(0, jsxRuntime.jsx)(`div`, {
              className: `completion-mark`,
              children: `✓`
            }), (0, jsxRuntime.jsxs)(`div`, {
              className: `center`,
              children: [(0, jsxRuntime.jsx)(`div`, {
                className: `eyebrow`,
                children: `ORDER COMPLETION`
              }), (0, jsxRuntime.jsx)(`h2`, {
                children: `Signed. Delivered. Complete.`
              }), (0, jsxRuntime.jsxs)(`p`, {
                children: [order.customer, ` · System ID: `, order.id]
              })]
            }), (0, jsxRuntime.jsxs)(`div`, {
              className: `signed-summary`,
              children: [(0, jsxRuntime.jsx)(`h3`, {
                children: `Customer acceptance`
              }), (0, jsxRuntime.jsx)(`img`, {
                className: `signature-image`,
                src: order.delivery.signature,
                alt: `Signature of ` + order.delivery.signatory
              }), (0, jsxRuntime.jsxs)(`p`, {
                children: [(0, jsxRuntime.jsx)(`strong`, {
                  children: order.delivery.signatory
                }), ` · `, formatTimestamp(order.delivery.signedAt)]
              }), (0, jsxRuntime.jsxs)(`p`, {
                className: `quiet`,
                children: [order.delivery.method, ` · `, order.delivery.details]
              })]
            })]
          }) : (0, jsxRuntime.jsx)(StageComponent, {}, order.stage)
        })]
      }), (0, jsxRuntime.jsxs)(`aside`, {
        className: `order-sidebar`,
        children: [(0, jsxRuntime.jsx)(ManufacturingOrderPictures, {
          pictures: order.pictures
        }), order.stage === 6 && (0, jsxRuntime.jsx)(ManufacturingDeliveryChallan, {}), order.stage < 6 && (0, jsxRuntime.jsxs)(`section`, {
          className: `panel next-step`,
          children: [(0, jsxRuntime.jsx)(`h3`, {
            children: `Next action`
          }), (0, jsxRuntime.jsx)(`p`, {
            className: `quiet`,
            children: blocker || `All checks for this stage are ready.`
          }), (0, jsxRuntime.jsx)(`button`, {
            className: `primary`,
            disabled: !!blocker,
            onClick: () => {
              advance(), setActiveTab(`current`);
            },
            children: manufacturingTransitionLabel(order)
          }), order.stage === 1 && canUsePlan(profile?.role) && (0, jsxRuntime.jsx)(`button`, {
            type: `button`,
            onClick: () => setView(`plan`),
            children: `Open Plan`
          })]
        }), (0, jsxRuntime.jsx)(`p`, {
          className: `sidebar-note`,
          children: `Stage rules are draft defaults. Review them on the Workflow screen.`
        })]
      })]
    }), (0, jsxRuntime.jsx)(`div`, {
      className: `notice`,
      role: `status`,
      "aria-live": `polite`,
      children: notice
    })]
  });
}

export { OrderDetailsPage };
