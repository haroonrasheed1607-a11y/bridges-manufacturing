import {JobCompletion} from "../../components/common/JobCompletion.js";
// features/orders/OrderDetailsPage.js
import { Badge } from "../../components/common/Badge.js";
import { manufacturingFrequencyLabel, manufacturingOrderPlan } from "../../domain/orders.js";
import { getOrderPackRecords } from "../../domain/validation.js";
import { manufacturingBoardStage, manufacturingBoardStages, manufacturingTransitionLabel, manufacturingWorkflowBlock } from "../../domain/workflow.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, formatTimestamp } from "../../utils/dates.js";
import { jsxRuntime } from "../../vendor/jsx-runtime.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingDeliveryChallan } from "../delivery/DeliveryChallan.js";
import { DeliveryPage } from "../delivery/DeliveryPage.js";
import { PackingPage } from "../packing/PackingPage.js";
import { QualityCheckPage } from "../quality/QualityCheckPage.js";
import { WarehousePage } from "../warehouse/WarehousePage.js";
import { ManufacturingAssignWorkOrder } from "../work-orders/AssignWorkOrder.js";
import { WorkOrdersPage } from "../work-orders/WorkOrdersPage.js";
import { ManufacturingOrderPictures } from "./OrderPictures.js";

function OrderDetailsPage() {
  let {
      order: order,
      setView: setView,
      advance: advance,
      notice: notice,
      workforce
    } = useManufacturing(),
    [activeTab, setActiveTab] = (0, React.useState)(`current`),
    blocker = manufacturingWorkflowBlock(order, workforce),
    boardStage = manufacturingBoardStage(order),
    StageComponent = order.stage === 0 && order.workOrderApprovedAt ? ManufacturingAssignWorkOrder : [WorkOrdersPage, WorkOrdersPage, QualityCheckPage, PackingPage, WarehousePage, DeliveryPage][order.stage];
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [(0, jsxRuntime.jsx)(`button`, {
      className: `back`,
      onClick: () => setView(`orders`),
      children: `← All orders`
    }), (0, jsxRuntime.jsxs)(`div`, {
      className: `page-heading`,
      children: [(0, jsxRuntime.jsxs)(`div`, {
        children: [(0, jsxRuntime.jsxs)(`div`, {
          className: `eyebrow`,
          children: [order.id, ` / `, order.customer]
        }), (0, jsxRuntime.jsx)(`h2`, {
          children: order.title
        }), (0, jsxRuntime.jsxs)(`p`, {
          className: `quiet`,
          children: [`Expected `, formatDate(order.expected), ` `, (0, jsxRuntime.jsx)(`span`, {
            className: `separator`,
            children: `·`
          }), ` Required `, formatDate(order.required)]
        })]
      }), (0, jsxRuntime.jsx)(Badge, {
        tone: order.stage === 6 ? `green` : ``,
        children: manufacturingBoardStages[boardStage]
      })]
    }), (0, jsxRuntime.jsx)(JobCompletion, {order}), (0, jsxRuntime.jsx)(`ol`, {
      className: `stage-strip`,
      "aria-label": `Order progress`,
      children: manufacturingBoardStages.map((t, n) => (0, jsxRuntime.jsxs)(`li`, {
        className: n === boardStage ? `current` : n < boardStage ? `done` : ``,
        "aria-current": n === boardStage ? `step` : void 0,
        children: [(0, jsxRuntime.jsx)(`span`, {
          children: n < boardStage ? `✓` : String(n + 1).padStart(2, `0`)
        }), (0, jsxRuntime.jsx)(`strong`, {
          children: t
        })]
      }, t))
    }), (0, jsxRuntime.jsxs)(`div`, {
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
            children: order.stage === 6 ? `Completion` : manufacturingBoardStages[boardStage]
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
                children: [order.customer, ` · `, order.id]
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
        }), order.stage === 6 && (0, jsxRuntime.jsx)(ManufacturingDeliveryChallan, {}), (0, jsxRuntime.jsxs)(`section`, {
          className: `panel`,
          children: [(0, jsxRuntime.jsx)(`div`, {
            className: `eyebrow`,
            children: `ORDER AT A GLANCE`
          }), (0, jsxRuntime.jsxs)(`dl`, {
            children: [(0, jsxRuntime.jsx)(`dt`, {
              children: `Customer`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: order.customer
            }), (0, jsxRuntime.jsx)(`dt`, {
              children: `Total pieces required`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: manufacturingOrderPlan(order).quantity.toLocaleString()
            }), (0, jsxRuntime.jsx)(`dt`, {
              children: `Order frequency`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: manufacturingFrequencyLabel(order)
            }), (0, jsxRuntime.jsx)(`dt`, {
              children: `Pieces per pack`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: manufacturingOrderPlan(order).perPack
            }), (0, jsxRuntime.jsx)(`dt`, {
              children: `Packs required`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: manufacturingOrderPlan(order).packCount
            }), (0, jsxRuntime.jsx)(`dt`, {
              children: `Work orders`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: order.workOrders.length
            }), (0, jsxRuntime.jsx)(`dt`, {
              children: `Sub-jobs`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: order.workOrders.reduce((e, t) => e + t.jobs.length, 0)
            }), (0, jsxRuntime.jsx)(`dt`, {
              children: `Pack records`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: getOrderPackRecords(order).length
            }), (0, jsxRuntime.jsx)(`dt`, {
              children: `Forecast`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: order.expected ? formatDate(order.expected) : `Awaiting work order`
            }), (0, jsxRuntime.jsx)(`dt`, {
              children: `Customer deadline`
            }), (0, jsxRuntime.jsx)(`dd`, {
              children: formatDate(order.required)
            })]
          }), order.expected > order.required && (0, jsxRuntime.jsx)(`p`, {
            className: `alert`,
            children: `Forecast is later than the required date.`
          })]
        }), order.stage < 6 && (0, jsxRuntime.jsxs)(`section`, {
          className: `panel next-step`,
          children: [(0, jsxRuntime.jsx)(`div`, {
            className: `eyebrow`,
            children: `NEXT STEP`
          }), (0, jsxRuntime.jsx)(`h3`, {
            children: manufacturingBoardStages[boardStage + 1]
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
