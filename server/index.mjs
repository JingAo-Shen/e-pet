import { createPlatform } from "./platform.mjs";
const platform = createPlatform();
const port = Number(process.env.PORT || 8787);
platform.server.listen(port, "127.0.0.1", () =>
  console.log(`Pet demo platform: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await platform.close();
    process.exit(0);
  });
