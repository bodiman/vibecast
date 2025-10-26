/**
 * Test Lava API Integration
 * This script tests the Lava forward API with OpenAI
 */

require('dotenv').config();

async function testLavaAPI() {
  console.log('🧪 Testing Lava API Integration\n');

  // 1. Build the URL - routes to OpenAI via Lava
  const targetUrl = 'https://api.openai.com/v1/chat/completions';
  const url = `${process.env.LAVA_BASE_URL}/forward?u=${encodeURIComponent(targetUrl)}`;

  console.log('📍 Target URL:', targetUrl);
  console.log('🔀 Forward URL:', url);
  console.log('🔑 Token configured:', !!process.env.LAVA_FORWARD_TOKEN);
  console.log('');

  // 2. Set up authentication
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.LAVA_FORWARD_TOKEN}`
  };

  // 3. Define the request body (standard OpenAI format)
  const requestBody = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Say hello in one sentence.' }
    ]
  };

  try {
    console.log('📤 Sending request to Lava...\n');

    // 4. Make the request
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    // 5. Parse and log the response
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error response:');
      console.error(JSON.stringify(data, null, 2));
      return;
    }

    console.log('✅ Response from OpenAI via Lava:');
    console.log(JSON.stringify(data, null, 2));

    // 6. Show the Lava request ID for tracking
    const requestId = response.headers.get('x-lava-request-id');
    console.log('\n🆔 Lava request ID:', requestId || 'Not provided');

    // 7. Extract and display the actual message
    if (data.choices && data.choices[0]) {
      console.log('\n💬 AI Response:');
      console.log(data.choices[0].message.content);
    }

    // 8. Show usage stats
    if (data.usage) {
      console.log('\n📊 Token Usage:');
      console.log(`   Prompt: ${data.usage.prompt_tokens}`);
      console.log(`   Completion: ${data.usage.completion_tokens}`);
      console.log(`   Total: ${data.usage.total_tokens}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testLavaAPI();
