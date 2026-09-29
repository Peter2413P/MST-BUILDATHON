async function testPostJob() {
  try {
    const res = await fetch('http://localhost:3000/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Build a simple responsive e-commerce website for a sneaker store with a homepage, product listing, product details and cart.',
      })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
testPostJob();
