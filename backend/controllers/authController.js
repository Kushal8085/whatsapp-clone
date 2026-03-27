const otpGenerate = require('../utils/otpGenerater')
const User = require('../models/User')
const response = require('../utils/responseHandler');
const sendOtpToEmail = require('../services/emailService');
const twilioService = require('../services/twilioService')
const generateToken = require('../utils/generateToken')
const { uploadFileToCloudinary } = require('../config/cloudinaryConfig')

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
    const token = generateToken(user?._id)
    res.cookie("auth_token", token, {
      httpOnly: true, //http true mtlb aap apne javascript m is token ko grab nhi kr skte
      maxAge: 1000 * 60 * 60 * 24 * 365 //maxAge mtlb kb tak apka ye token valid hona chaiye apki cookie m (itne din tk cookies m token store hoga)
    })
    return response(res, 200, 'Otp verified successfully', { token, user })
  } catch (error) {
    console.error(error)
    return response(res, 500, 'Internal server error')
  }
}

const updateProfile = async (req, res) => {
  const { username, agreed, about } = req.body
  const userId = req.user.UserId

  try {
    const user = await User.findById(userId)
    const file = req.file
    if (file) {
      const uploadResult = await uploadFileToCloudinary(file)
      console.log(uploadResult);
      user.profilePicture = uploadResult?.secure_url
    } else if (req.body.profilePicture) {
      user.profilePicture = req.body.profilePicture
    }

    if (username) user.username = username
    if (agreed) user.agreed = agreed
    if (about) user.about = about
    await user.save()

    return response(res, 200, 'user profile updated successfully', user)
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal Server Error")
  }
}

module.exports = {
  sendOtp,
  verifyOtp,
  updateProfile
}