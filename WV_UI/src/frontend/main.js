import { ExcessLandApp } from "./app.js";

const root = document.getElementById("app");
const app = new ExcessLandApp(root);

void app.init();
