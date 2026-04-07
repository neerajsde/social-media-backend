import type { Device } from "./auth.types.js";

export interface SendMailOptions {
  template: string;
  subject: string;
  email: string;
  data: Record<string, unknown>;
}

export interface SendOtpEmailProps {
  email: string;
  otp: string;
}

export interface SendWelcome {
  email: string;
  name: string;
  username: String;
  joinDate: String;
}

export interface enable2FA {
  email: string;
  device: string;
}

export interface DeleteAccount {
  email: string,
  device: Device;
  requestedAt: string;
}

export interface RecoverAccount {
  email: string,
  device: Device;
  recoveredAt: string;
}

export interface ResetPassword {
  email: string;
  otp: string;
  requestedAt: string;
  device: string;
}

export interface PostNotify {
  email: string,
  authorName: string,
  authorAvatarUrl: string | null,
  followerName: string,
  postUrl: string,
  postDate: string
}