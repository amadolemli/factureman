# Validation Guide: Referral & Bonus System

This guide confirms the logic and provides steps to verify the system works as intended.

## ✅ Current Logic Confirmation
**"Is the referral code optional?"**
**YES.**
- If a user signs up **without** a code, they still get their **500 Welcome Credits** when they create their password.
- If a user signs up **with** a code, they get their **500 Welcome Credits**, AND the person who referred them gets **+500 Bonus Credits**.

## 🧪 How to Test

### Test 1: Signup WITHOUT Code (Standard Flow)
1.  **Start App**: Go to the signup page.
2.  **Enter Phone**: Use a new number (e.g., `90000001`).
3.  **Leave Code Empty**: Do not type anything in the referral box.
4.  **Verify OTP**: Complete the SMS step.
5.  **Check Credits**: *At this exact moment, credits should be **0** (Bonus is pending password).*
6.  **Create Password**: Enter a password.
7.  **Final Check**: The new user should now have **500 Credits**.

### Test 2: Signup WITH Code (Referral Flow)
1.  **Get a Code**: Login as an existing user, go to Profile, and copy the `Code Parrainage` (e.g., `A1B2C3D4`). Note their current credits.
2.  **Start App**: Signup with a different new number (e.g., `90000002`).
3.  **Enter Code**: Paste `A1B2C3D4` in the referral box.
4.  **Verify OTP**: Complete the SMS step.
5.  **Check Credits**: New user has **0**. Referrer credits are **unchanged**.
6.  **Create Password**: Enter a password for the new user.
7.  **Final Check**: 
    - New User: **500 Credits**.
    - Referrer: **Old Credits + 500**.

## 🔍 Troubleshooting
If anything behaves differently, check the **Browser Console** for the red `🚨 SERVER LOG` messages, which will explain exactly what the server did step-by-step.
