import { app } from './app.js';
import { env } from './infrastructure/config/env.js';

const port = env.PORT || 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});
