import ejs from "ejs";
import path from "path";
import { fileURLToPath } from "url";
import { emailQueue } from "../queues/messaging.queue.js";
import { ENV } from "../config/env.js";
import type { DeleteAccount, enable2FA, PostNotify, RecoverAccount, ResetPassword, SendMailOptions, SendOtpEmailProps, SendWelcome } from "../types/mails.types.js";
import { cropText } from "../utils/core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FULL_YEAR = new Date().getFullYear();

async function sendMail({
  template,
  subject,
  email,
  data,
}: SendMailOptions): Promise<boolean> {
    try{
        const templatePath = path.join(__dirname, `./templates/${template}`);

        const html: string = await ejs.renderFile(templatePath, data);

        await emailQueue.add(subject, {
            email,
            subject,
            html,
        });
        
        return true;
    } catch(err){
        console.log(err);
        return false;
    }
}

export function sendLoginOtp({ email, otp }: SendOtpEmailProps) {
    return sendMail({
        template: "loginotp.ejs",
        subject: "Login OTP",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            otp,
            expiresIn: 5,
            year: FULL_YEAR,
        },
    });
}

export function sendRegisterOTP({ email, otp }: SendOtpEmailProps) {
    return sendMail({
        template: "signup.ejs",
        subject: "Verify Your socail-media Account",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            otp,
            expiresIn: 5,
            year: FULL_YEAR,
        },
    });
}

export function sendWelcomeEmail({ email, name, username, joinDate }: SendWelcome){
    return sendMail({
        template: "welcome.ejs",
        subject: `Welcome to ${ENV.APP_NAME}`,
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            name: name,
            username: username,
            appUrl: ENV.APP_URL,
            supportEmail: ENV.SUPPORT_EMAIL,
            year: FULL_YEAR,
            joinDate: joinDate
        },
    });
}

export function sendResendOTP({email, otp}: SendOtpEmailProps) {
    return sendMail({
        template: "resend-otp.ejs",
        subject: "Your New OTP Code",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            otp,
            expiresIn: 5,
            year: FULL_YEAR
        },
    });
}

export function sendDeleteAccount({email, device, requestedAt}: DeleteAccount) { 
    return sendMail({
        template: "account-deletion.ejs",
        subject: "Account Deletion Scheduled",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            requestedAt,
            device: device,
            year: FULL_YEAR
        },
    });
}

export function sendChangeEmailOtp({ email, otp }: SendOtpEmailProps) {
    return sendMail({
        template: "change-email.ejs",
        subject: "Verify Your New Email Address",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            otp,
            expiresIn: 5,
            year: FULL_YEAR,
        },
    });
}

export function sendChangePasswordOtp({ email, otp }: SendOtpEmailProps) {
    return sendMail({
        template: "change-password.ejs",
        subject: "Reset Your socail-media Password",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            otp,
            expiresIn: 5,
            year: FULL_YEAR,
        },
    });
}

export function sendAccountRecoveryEmail({email, device, recoveredAt}: RecoverAccount){
    return sendMail({
        template: "account-recovery.ejs",
        subject: "Account Successfully Recovered",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            recoveredAt,
            device,
            year: FULL_YEAR,
        },
    });
}

export function sendEnable2FAEmail({email, device}: enable2FA){
    const enabledAt = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
    }).format(new Date());

    return sendMail({
        template: "enable-2fa-mail.ejs",
        subject: "Enable Two-Factor Authentication",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            enabledAt,
            device,
            year: FULL_YEAR,
        },
    });
}

export function sendEnable2FAEmailOTP({email, otp}: SendOtpEmailProps){
    return sendMail({
        template: "enable-2fa-otp.ejs",
        subject: "Your OTP to Enable Two-Factor Authentication",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            otp,
            expiresIn: 5,
            year: FULL_YEAR,
        },
    });
}

export function resetPasswordOtp({email, otp, requestedAt, device}: ResetPassword){
    return sendMail({
        template: "reset-password-otp.ejs",
        subject: "Reset Password OTP",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            otp,
            expiresIn: 5,
            requestedAt: requestedAt,
            device: device,
            year: FULL_YEAR,
        },
    });
}

export function sendAdminLoginOtp({email, otp}: SendOtpEmailProps){
    return sendMail({
        template: "admin-login.ejs",
        subject: "Admin Login OTP",
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            otp,
            expiresIn: 5,
            year: FULL_YEAR,
        },
    });
}

export function sendPostNotify({email, authorName, authorAvatarUrl, followerName, postUrl, postDate}: PostNotify){
    return sendMail({
        template: "post-upload-notification.ejs",
        subject: `${ENV.APP_NAME} - New Post from ${authorName}`,
        email,
        data: {
            appName: ENV.APP_NAME,
            authorName,
            authorAvatarUrl: authorAvatarUrl || `${ENV.BACKEND_URL}/public/user_default.webp`,
            followerName,
            postUrl,
            postDate,
            year: FULL_YEAR,
        },
    });
}

export function sendContentReport({email, name, caption}:{
    email: string, name: string, caption: string
}){
    return sendMail({
        template: "content-report.ejs",
        subject: `Content Removal Notice - ${ENV.APP_NAME}`,
        email,
        data: {
            appName: ENV.APP_NAME,
            logoUrl: ENV.LOGO_URL,
            name,
            caption: cropText(caption, 500),
            guidelinesUrl: "https://yourapp.com/guidelines",
            supportEmail: ENV.SUPPORT_EMAIL,
            year: FULL_YEAR
        }
    })
}
