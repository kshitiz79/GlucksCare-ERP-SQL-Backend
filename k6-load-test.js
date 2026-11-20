import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    controlled_load: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 30,
      stages: [
        { target: 5, duration: '30s' },
        { target: 10, duration: '30s' },
        { target: 20, duration: '30s' },
      ],
    },
  },
};

// Target URL can be overridden via CLI using -e TARGET_URL=...
// e.g.: k6 run -e TARGET_URL=https://api.gluckscare.com/health k6-load-test.js
const TARGET_URL = __ENV.TARGET_URL || 'https://test.gluckscare.com/health';

export default function () {
  const response = http.get(TARGET_URL);

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.1);
}
