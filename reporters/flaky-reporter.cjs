const fs = require('fs');
const path = require('path');

class FlakyReporter {
  onBegin() {
    this._events = [];
  }
  onTestEnd(test, result) {
    const isFlakyPass = result.status === 'passed' && (result.retry || 0) > 0;
    if (isFlakyPass) {
      const title = test.titlePath().join(' › ');
      const pathArr = test.titlePath();
      const projectName = Array.isArray(pathArr) && pathArr.length > 0 ? pathArr[0] : undefined;
      const evt = {
        ts: new Date().toISOString(),
        title,
        file: test.location?.file,
        project: projectName,
        retries: result.retry,
      };
      try {
        const dir = path.resolve('test-results');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'flaky.jsonl');
        fs.appendFileSync(file, JSON.stringify(evt) + '\n');
      } catch {}
      console.log(`[FLAKY] ${evt.title} (project=${evt.project}) passed on retry #${evt.retries}`);
    }
  }
}

module.exports = FlakyReporter;
