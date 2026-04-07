export type DeviceInfo = {
  deviceName: string;
  deviceType: string;
  os: string;
  browser: string;
};

export type LoginAttempts = DeviceInfo & {
  identifier: string;
  ipAddress: string;
  success: boolean;
  message: string;
};

export type AuthSession = {
  id: string,
  userId: string,
  deviceName: string | null,
  deviceType: string | null,
  os: string | null,
  browser: string | null,
  ipAddress: string | null,
  role: "user" | "admin" | "superadmin" | "moderator" | "support",
  token: string,
}

export type Device = {
  name: string
  type: string
  os: string
  browser: string
  ip?: string
}