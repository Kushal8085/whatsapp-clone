const otpGenerate = require('../utils/otpGenerater')
const User = require('../models/User')
const response = require('../utils/responseHandler');
const sendOtpToEmail = require('../services/emailService');
const twilioService = require('../services/twilioService')

//Step-1 Send OTP
const sendOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix, email } = req.body;
  const otp = otpGenerate();
  const expiry = new Date(Date.now() + 5 * 60 * 1000);
  let user;
  try {
    if (email) {
      user = await User.findOne({ email });

      if (!user) {
        user = new User({ email })
      }
      user.emailOtp = otp
      user.emailOtpExpiry = expiry
      await user.save()
      await sendOtpToEmail(email, otp)
      return response(res, 200, 'Otp send to your email', { email })
    }
    if (!phoneNumber || !phoneSuffix) {
      return response(res, 400, 'Phone number and phone suffix are required')
    }
    const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`
    user = await User.findOne({ phoneNumber })
    if (!user) {
      user = await new User({ phoneNumber, phoneSuffix })
    }

    await twilioService.sendOtpToPhoneNumber(fullPhoneNumber)
    await user.save()

    return response(res, 200, 'Otp send successfully', user)
  } catch (error) {
    console.error(error)
    return response(res, 500, 'Internal server error')
  }
}

//Step-2 Verify OTP
const verifyOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix, email, otp } = req.body

  try {
    let user
    if (email) {
      user = await User.findOne({ email })
      if (!user) {
        return response(res, 404, 'User not found')
      }

      const now = new Date()
      if (!user.emailOtp || String(user.emailOtp) !== String(otp) || now > new Date(user.emailOtpExpiry)) {
        return response(res, 400, 'Invalid or expired otp')
      }
      user.isVerified = true
      user.emailOtp = null
      user.emailOtpExpiry = null
      await user.save()
    } else {
      if (!phoneNumber || !phoneSuffix) {
        return response(res, 400, "Phone number and phone suffix are required")
      }
      const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`
      user = await User.findOne({ phoneNumber })
      if (!user) {
        return response(res, 404, "User not found")
      }
      const result = await twilioService.verifyOtp(fullPhoneNumber, otp)
      if (result.status !== "approved") {
        return response(res, 400, "Invalid Otp")
      }
      user.isVerified = true;
      await user.save()
    }

  } catch (error) {

  }
}