import { createConnection } from 'happy-eyeballs';
import {Agent as HttpAgent} from 'http';
import {Agent as HttpsAgent} from 'https';

class HappyEyeballsHttpAgent extends HttpAgent {
  createConnection = createConnection;
}

class HappyEyeballsHttpsAgent extends HttpsAgent {
  createConnection = createConnection;
}

export const httpAgent = new HappyEyeballsHttpAgent();
export const httpsAgent = new HappyEyeballsHttpsAgent();