
import dns from "node:dns";

if (process.env.NODE_ENV === "development") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
  dns.setDefaultResultOrder("ipv4first");
}

import { MongooseDb } from "./database/mongoose.db.js";
import { AppServer } from "./server/app.server.js";

const bootstrap = async () => {
  try {
    await MongooseDb.getInstance().getConnectionString();

    const appServer = new AppServer();
    appServer.start();

    console.log("🚀 Server running correctly");
  } catch (error) {
    console.error("❌ Error during bootstrap:", error);
    process.exit(1);
  }
};

bootstrap();