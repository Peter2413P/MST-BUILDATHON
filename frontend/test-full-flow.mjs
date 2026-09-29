async function fullTest() {
  console.log('1. Submitting sneaker store creation task...');
  const submitRes = await fetch('http://localhost:3000/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Build a simple responsive e-commerce website for a sneaker store with a homepage, product listing, product details and cart.',
    })
  });
  const submitData = await submitRes.json();
  console.log('Submit response:', submitData);

  const jobId = submitData.jobId;
  console.log(`2. Polling /api/jobs/${jobId} for completion...`);

  for (let i = 0; i < 30; i++) {
    const res = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
    const data = await res.json();
    console.log(`[Poll ${i+1}] Status: ${data.status} | Subtasks: ${data.subtasks?.length || 0}`);
    if (data.status === 'completed') {
      console.log('✓ SUCCESS: Job reached completed state!');
      console.log('Deliverable Name:', JSON.parse(data.result).name);
      console.log('Total Files Generated:', JSON.parse(data.result).files?.length);
      console.log('Build Status:', JSON.parse(data.result).buildStatus);
      return;
    } else if (data.status === 'failed') {
      throw new Error(`Job failed: ${data.error}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

fullTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
