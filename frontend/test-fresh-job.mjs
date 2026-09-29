async function freshTest() {
  const desc = `Build a high-end streetwear and sneaker storefront for Orbit Kicks with home, catalog, and checkout (${Date.now()})`;
  console.log('1. Submitting fresh task:', desc);
  const submitRes = await fetch('http://localhost:3000/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: desc })
  });
  const submitData = await submitRes.json();
  console.log('Submit response:', submitData);

  const jobId = submitData.jobId;
  console.log(`2. Polling /api/jobs/${jobId} for completion...`);

  for (let i = 0; i < 40; i++) {
    const res = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
    const data = await res.json();
    console.log(`[Poll ${i+1}] Status: ${data.status} | Subtasks: ${data.subtasks?.length || 0}`);
    if (data.status === 'completed') {
      console.log('✓ SUCCESS: Job reached completed state!');
      const resObj = JSON.parse(data.result);
      console.log('Deliverable Name:', resObj.name);
      console.log('Total Files Generated:', resObj.files?.length);
      console.log('Build Status:', resObj.buildStatus);
      return;
    } else if (data.status === 'failed') {
      throw new Error(`Job failed: ${data.error}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

freshTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
