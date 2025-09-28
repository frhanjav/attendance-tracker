import { config } from '../config';

export const handleGoogleLogin = () => {
    const googleAuthUrl = `${config.apiBaseUrl}/auth/google`;
    console.log('Redirecting to Google Auth:', googleAuthUrl);
    window.location.href = googleAuthUrl;
};