import http from "node:http";
import { createApplication } from "./app.js";

const application = createApplication();

const server = http.createServer(application.handler);

server.listen(application.config.port, application.config.host, () => {
  application.logger.info("server.started", {
    host: application.config.host,
    port: application.config.port,
    mode: application.config.dataMode
  });
});
