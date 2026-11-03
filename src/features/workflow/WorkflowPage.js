// features/workflow/WorkflowPage.js
import { workflowDescriptions } from "../../config/workflow.js";
import { manufacturingBoardStages } from "../../domain/workflow.js";
import { jsxRuntime } from "../../vendor/jsx-runtime.js";

function WorkflowPage() {
  return (0, jsxRuntime.jsxs)(jsxRuntime.Fragment, {
    children: [(0, jsxRuntime.jsx)(`div`, {
      className: `page-heading`,
      children: (0, jsxRuntime.jsxs)(`div`, {
        children: [(0, jsxRuntime.jsx)(`div`, {
          className: `eyebrow`,
          children: `PERFORM A JOB / WORKFLOW`
        }), (0, jsxRuntime.jsx)(`h2`, {
          children: `One order, all the way through.`
        }), (0, jsxRuntime.jsx)(`p`, {
          className: `quiet`,
          children: `Track preparation, assignment, production and delivery for every order.`
        })]
      })
    }), (0, jsxRuntime.jsxs)(`div`, {
      className: `workflow-grid`,
      children: [(0, jsxRuntime.jsx)(`section`, {
        className: `panel`,
        children: manufacturingBoardStages.map((e, t) => (0, jsxRuntime.jsxs)(`div`, {
          className: `workflow-step`,
          children: [(0, jsxRuntime.jsx)(`span`, {
            className: `step-number`,
            children: t + 1
          }), (0, jsxRuntime.jsxs)(`div`, {
            children: [(0, jsxRuntime.jsx)(`h3`, {
              children: e
            }), (0, jsxRuntime.jsx)(`p`, {
              className: `quiet`,
              children: workflowDescriptions[t]
            })]
          })]
        }, e))
      }), (0, jsxRuntime.jsxs)(`aside`, {
        children: [(0, jsxRuntime.jsxs)(`section`, {
          className: `panel`,
          children: [(0, jsxRuntime.jsx)(`div`, {
            className: `eyebrow`,
            children: `RECORD HIERARCHY`
          }), (0, jsxRuntime.jsx)(`h3`, {
            children: `Order → Work orders`
          }), (0, jsxRuntime.jsx)(`p`, {
            children: `Each work order can be split into sub-jobs. Sub-jobs contain boxes or packets.`
          }), (0, jsxRuntime.jsx)(`p`, {
            className: `callout`,
            children: `A Packing work order performs production work. The later Packing stage checks the packaging.`
          })]
        }), (0, jsxRuntime.jsxs)(`section`, {
          className: `panel`,
          children: [(0, jsxRuntime.jsx)(`div`, {
            className: `eyebrow`,
            children: `PROPOSED DRAFT RULES`
          }), (0, jsxRuntime.jsxs)(`ul`, {
            className: `rule-list`,
            children: [(0, jsxRuntime.jsx)(`li`, {
              children: `Sub-job quantities must balance with their work order.`
            }), (0, jsxRuntime.jsx)(`li`, {
              children: `Any quality failure holds that work order until a fresh check passes.`
            }), (0, jsxRuntime.jsx)(`li`, {
              children: `Every work order must pass quality and packing checks.`
            }), (0, jsxRuntime.jsx)(`li`, {
              children: `Warehouse receipt is separate from sending goods.`
            }), (0, jsxRuntime.jsx)(`li`, {
              children: `Whole-order transfers and deliveries in this draft.`
            }), (0, jsxRuntime.jsx)(`li`, {
              children: `Customer signature required for completion.`
            })]
          })]
        }), (0, jsxRuntime.jsxs)(`section`, {
          className: `panel`,
          children: [(0, jsxRuntime.jsx)(`h3`, {
            children: `For screen review`
          }), (0, jsxRuntime.jsx)(`p`, {
            children: `Fictional sample data stays in this browser. Shared data, authentication and production permissions are pending the independent backend setup.`
          }), (0, jsxRuntime.jsx)(`p`, {
            className: `quiet`,
            children: `Expected delivery is treated as a forecast. Required delivery date is treated as the customer's deadline.`
          })]
        })]
      })]
    })]
  });
}

export { WorkflowPage };
