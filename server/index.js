import { openDatabase } from "./database.js";
import { createApp } from "./app.js";

const db = openDatabase(process.env.DATABASE_PATH || "./data/waldo.sqlite");
const server = createApp(db, {
  production: process.env.NODE_ENV === "production",
});
const port = Number(process.env.PORT || 3000);
server.listen(port, process.env.HOST || "0.0.0.0", () =>
  console.log(`Field Notes is ready at http://localhost:${port}`),
);
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
