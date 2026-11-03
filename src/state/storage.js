// state/storage.js
import { manufacturingInitialData } from "./demoData.js";

function manufacturingLoadWorkforce() {
  return manufacturingInitialData().workforce;
}

export { manufacturingLoadWorkforce };
