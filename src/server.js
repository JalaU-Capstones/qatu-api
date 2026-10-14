import express from 'express';
import { registerApiDocs } from './presentation/docs/swagger.js';

const app = express();
const port = process.env.PORT || 3000;

registerApiDocs(app);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});
