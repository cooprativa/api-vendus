// app/utils/api.server.js
import axios from 'axios'; // You might need to install axios: npm install axios

export const api = axios.create({
  // You might want a base URL here if all your Gestão API calls go to one place
  // baseURL: 'https://your-gestao-api.com/api',
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    // Add any necessary authorization headers here (e.g., Bearer Token, API Key)
    // 'Authorization': `Bearer ${process.env.GESTÃO_API_TOKEN}`,
  },
});

// If you need specific error handling or interceptors, you can add them here
api.interceptors.response.use(
  response => response.data, // Automatically return data
  error => {
    console.error("API call error:", error.message);
    // You can customize error handling here, e.g., rethrow, return specific error object
    return Promise.reject(error);
  }
);
