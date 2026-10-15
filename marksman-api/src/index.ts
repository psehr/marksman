import { app } from "./app";
import { config } from "./config";

app.listen(config.PORT, () => {
  console.log("Listening on http://localhost:" + config.PORT);
});
