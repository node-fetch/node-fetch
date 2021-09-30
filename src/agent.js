import { createConnection } from 'happy-eyeballs';
import {Agent as HttpAgent} from 'http';
import {Agent as HttpsAgent} from 'https';

export class DefaultHttpAgent extends HttpAgent {
  createConnection = createConnection;
}

export class DefaultHttpsAgent extends HttpsAgent {
  createConnection = createConnection;
}

export const defaultHttpAgent = new DefaultHttpAgent();
export const defaultHttpsAgent = new DefaultHttpsAgent();