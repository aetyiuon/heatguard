import { hostedRequest } from '../backend/hosted';

export default {
  fetch(request: Request) {
    return hostedRequest(request);
  },
};
