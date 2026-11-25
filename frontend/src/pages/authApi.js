import axiosInstance from '@/services/axiosInstance';

const postData = async (url, body) => (await axiosInstance.post(url, body)).data;

/** Sign-in screens: login (with the e-mailed code from outside the office), forgot / reset password. */
export const authApi = {
  login: (credentials) => postData('/auth/login', credentials),
  loginWithCode: (otpId, code) => postData('/auth/login/otp', { otpId, code }),
  forgotPassword: (userId) => postData('/auth/forgot-password', { userId }),
  resetPassword: (token, newPassword) => postData('/auth/reset-password', { token, newPassword }),
};
