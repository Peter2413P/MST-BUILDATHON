async function pollJob(jobId) {
  console.log(`Polling job ${jobId}...`);
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
    const data = await res.json();
    console.log(`[Poll ${i+1}] Status: ${data.status} | Subtasks: ${data.subtasks?.length || 0} | Result len: ${data.result ? data.result.length : 0}`);
    if (data.status === 'completed' || data.status === 'failed') {
      console.log('Final Result preview:');
      if (data.result) {
        console.log(data.result.slice(0, 300) + '...');
      } else {
        console.log('Error:', data.error);
      }
      return data;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}
pollJob('eb7c7bcf-0bb4-41bb-8d7f-f0eea4fd84bd');
