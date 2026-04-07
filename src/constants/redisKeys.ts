export const REDIS_KEYS = {
  blacklistToken: (token: string) => `users:blacklist:${token}`,
  userTemp: (hash: string) => `users:temp:${hash}`,
  registerOtp: (token: string) => `register:otp:${token}`,
  resendRegisterOTP: (token: string) => `register:resend:${token}`,
  
  loginOtp: (token: string) => `login:otp:${token}`,
  usernameTemp: (username: string) => `temp:username:${username}`,
  isotp: (token: string) =>  `otp:genarate:${token}`,
  otpVerify: (tokenHash: string) => `otp:verify:${tokenHash}`,
  identifier: (tokenHash: string) => `users:identifier:${tokenHash}`,
  identifierHash: (userHash: string) => `users:hash:${userHash}`,

  resetPassword: (token: string) => `reset:passsword:${token}`,
  changeEmail: (userId: string) => `change:email:${userId}`,
  changePassword: (userId: string) => `change:password:${userId}`,

  // user data cache
  userdata: (userId: string) => `user:profile:${userId}`,
  usernameAvailability: (username: string) => `username:availability:${username}`,


  // admin data cache
  adminData: (adminId: String) => `admin:${adminId}:data`,
};

export const REG_IP_KEY = (ip: string) => `register:ip:${ip}`;

export const SOCKET_KEYS = {
  saveSocketId: (userId: string, sessionId: string) => `socket-connection:${userId}:${sessionId}`,
}