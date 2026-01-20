// Test script to invoke the create-razorpay-order function
// Run this with: node test-razorpay.js

const SUPABASE_URL = "https://fkmevgiulgxeafgmbtla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrbWV2Z2l1bGd4ZWFmZ21idGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NjMyMjIsImV4cCI6MjA3NjEzOTIyMn0.2cCPl8V2TVUs3btm16Xehs1QIDH68796YrwpWMYAqCA";

async function testRazorpayOrder() {
    const testData = {
        amount: 999,
        currency: 'INR',
        description: 'Test Course Enrollment',
        receipt: `rcpt_test_${Date.now()}`
    };

    console.log('Testing Razorpay order creation with:', testData);

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-razorpay-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(testData),
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log('Response body:', responseText);

        if (response.ok) {
            const data = JSON.parse(responseText);
            console.log('✅ Success! Order created:', data);
        } else {
            console.log('❌ Error response:', responseText);
            try {
                const errorData = JSON.parse(responseText);
                console.log('Parsed error:', errorData);
            } catch (e) {
                console.log('Could not parse error as JSON');
            }
        }
    } catch (error) {
        console.error('❌ Request failed:', error);
    }
}

testRazorpayOrder();
