export const config = {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
};

console.log('API Base URL:', config.apiBaseUrl);
