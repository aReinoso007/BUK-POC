import { app } from "./demo/app.js";

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Demo en http://localhost:${port}`);
});
