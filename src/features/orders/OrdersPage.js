// features/orders/OrdersPage.js
import { Badge } from "../../components/common/Badge.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { manufacturingBoardStage, manufacturingBoardStages } from "../../domain/workflow.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate } from "../../utils/dates.js";
import { jsxRuntime } from "../../vendor/jsx-runtime.js";
import { React } from "../../vendor/react-runtime.js";

function OrdersPage() {
  let {
      orders: e,
      open: t,
      setView: n
    } = useManufacturing(),
    [r, i] = (0, React.useState)(``),
    [a, o] = (0, React.useState)(`all`),
    s = e.filter(e => (a === `all` || manufacturingBoardStage(e) === Number(a)) && `${e.id} ${e.customer} ${e.title}`.toLowerCase().includes(r.toLowerCase()));
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [(0, jsxRuntime.jsxs)(`div`, {
      className: `page-heading`,
      children: [(0, jsxRuntime.jsxs)(`div`, {
        children: [(0, jsxRuntime.jsx)(`div`, {
          className: `eyebrow`,
          children: `OPERATIONS / ORDERS`
        }), (0, jsxRuntime.jsx)(`h2`, {
          children: `Every order. Every step.`
        }), (0, jsxRuntime.jsx)(`p`, {
          className: `quiet`,
          children: `Follow the work from a new request to a signed delivery.`
        })]
      }), (0, jsxRuntime.jsx)(`button`, {
        className: `primary`,
        onClick: () => n(`new`),
        children: `＋ New order request`
      })]
    }), (0, jsxRuntime.jsxs)(`section`, {
      className: `panel`,
      children: [(0, jsxRuntime.jsxs)(`div`, {
        className: `section-heading`,
        children: [(0, jsxRuntime.jsxs)(`div`, {
          children: [(0, jsxRuntime.jsx)(`h3`, {
            children: `Order register`
          }), (0, jsxRuntime.jsxs)(`p`, {
            className: `quiet`,
            children: [e.length, ` orders · select an order to manage its work`]
          })]
        }), (0, jsxRuntime.jsxs)(`label`, {
          className: `search`,
          children: [(0, jsxRuntime.jsx)(`span`, {
            className: `sr-only`,
            children: `Search orders`
          }), (0, jsxRuntime.jsx)(`input`, {
            placeholder: `Search order or customer…`,
            value: r,
            onChange: e => i(e.target.value)
          })]
        })]
      }), (0, jsxRuntime.jsxs)(`div`, {
        className: `filter-row`,
        children: [(0, jsxRuntime.jsxs)(`button`, {
          className: a === `all` ? `selected` : ``,
          onClick: () => o(`all`),
          children: [`All orders `, (0, jsxRuntime.jsx)(`span`, {
            children: e.length
          })]
        }), manufacturingBoardStages.map((t, n) => (0, jsxRuntime.jsxs)(`button`, {
          className: a === String(n) ? `selected` : ``,
          onClick: () => o(String(n)),
          children: [t, ` `, (0, jsxRuntime.jsx)(`span`, {
            children: e.filter(e => manufacturingBoardStage(e) === n).length
          })]
        }, t))]
      }), s.length ? (0, jsxRuntime.jsx)(`div`, {
        className: `table-wrap`,
        children: (0, jsxRuntime.jsxs)(`table`, {
          children: [(0, jsxRuntime.jsx)(`thead`, {
            children: (0, jsxRuntime.jsxs)(`tr`, {
              children: [(0, jsxRuntime.jsx)(`th`, {
                children: `Order / customer`
              }), (0, jsxRuntime.jsx)(`th`, {
                children: `Current stage`
              }), (0, jsxRuntime.jsx)(`th`, {
                children: `Work orders`
              }), (0, jsxRuntime.jsx)(`th`, {
                children: `Expected delivery`
              }), (0, jsxRuntime.jsx)(`th`, {
                children: `Required date`
              }), (0, jsxRuntime.jsx)(`th`, {
                children: (0, jsxRuntime.jsx)(`span`, {
                  className: `sr-only`,
                  children: `Open`
                })
              })]
            })
          }), (0, jsxRuntime.jsx)(`tbody`, {
            children: s.map(e => (0, jsxRuntime.jsxs)(`tr`, {
              children: [(0, jsxRuntime.jsxs)(`td`, {
                children: [(0, jsxRuntime.jsx)(`button`, {
                  className: `text-link`,
                  onClick: () => t(e.id),
                  children: e.title
                }), (0, jsxRuntime.jsxs)(`div`, {
                  className: `quiet`,
                  children: [e.id, ` · `, e.customer]
                })]
              }), (0, jsxRuntime.jsxs)(`td`, {
                children: [(0, jsxRuntime.jsx)(Badge, {
                  tone: e.stage === 6 ? `green` : e.stage === 2 ? `amber` : ``,
                  children: manufacturingBoardStages[manufacturingBoardStage(e)]
                }), (0, jsxRuntime.jsx)(`div`, {
                  className: `mini-progress`,
                  children: (0, jsxRuntime.jsx)(`span`, {
                    style: {
                      width: `${manufacturingBoardStage(e) / (manufacturingBoardStages.length - 1) * 100}%`
                    }
                  })
                })]
              }), (0, jsxRuntime.jsx)(`td`, {
                children: e.workOrders.length
              }), (0, jsxRuntime.jsx)(`td`, {
                children: e.expected ? formatDate(e.expected) : `Awaiting work order`
              }), (0, jsxRuntime.jsxs)(`td`, {
                children: [formatDate(e.required), e.expected > e.required && (0, jsxRuntime.jsx)(`div`, {
                  className: `late`,
                  children: `Forecast beyond deadline`
                })]
              }), (0, jsxRuntime.jsx)(`td`, {
                children: (0, jsxRuntime.jsx)(`button`, {
                  className: `icon-button`,
                  "aria-label": `Open ` + e.id,
                  onClick: () => t(e.id),
                  children: `↗`
                })
              })]
            }, e.id))
          })]
        })
      }) : (0, jsxRuntime.jsx)(EmptyState, {
        children: `No matching orders. Create an order or change the filters.`
      })]
    }), (0, jsxRuntime.jsxs)(`div`, {
      className: `overview-foot`,
      children: [(0, jsxRuntime.jsx)(`span`, {
        className: `quiet`,
        children: `Order → Work orders → Sub-jobs → Boxes or packets`
      }), (0, jsxRuntime.jsx)(`button`, {
        className: `text-link`,
        onClick: () => n(`workflow`),
        children: `View agreed workflow →`
      })]
    })]
  });
}

export { OrdersPage };
