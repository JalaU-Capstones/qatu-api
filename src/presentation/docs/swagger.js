import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import swaggerUi from 'swagger-ui-express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bundlePath = path.resolve(__dirname, '../../../dist/openapi.bundle.yaml');

function loadBundle() {
  if (fs.existsSync(bundlePath)) {
    return load(fs.readFileSync(bundlePath, 'utf8'));
  }
  try {
    execSync('npx @redocly/cli bundle qatu@v1 -o dist/openapi.bundle.yaml', {
      cwd: path.resolve(__dirname, '../../../'),
      stdio: 'ignore',
    });
    if (fs.existsSync(bundlePath)) {
      return load(fs.readFileSync(bundlePath, 'utf8'));
    }
  } catch {
    // Bundle generation failed or CLI not installed
  }
  return null;
}

export function registerApiDocs(app) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const activeSpec = loadBundle();
  if (!activeSpec) {
    return;
  }

  const options = {
    customSiteTitle: 'Qatu Marketplace API',
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.js',
    ],
    swaggerOptions: {
      url: '/api-docs/openapi.json',
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  };

  const swaggerUiHandler = swaggerUi.setup(null, options);

  app.get('/api-docs/openapi.json', (req, res) => res.json(activeSpec));

  app.use(
    '/api-docs',
    (req, res, next) => {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; style-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; img-src 'self' data: https:;"
      );
      next();
    },
    swaggerUi.serve,
    swaggerUiHandler
  );
}
