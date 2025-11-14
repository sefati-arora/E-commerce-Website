const bcrypt=require("bcrypt");
const { v4: uuid } = require("uuid");
const path = require("path");
const otpManager = require("node-twillo-otp-manager")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
  process.env.TWILIO_SERVICE_SID
);
const nodemailer=require("nodemailer")
module.exports={
bcryptData: async (newPassword, salt) => {
    try {
      // Ensure `salt` is a number if passed as a string
      const saltRounds = typeof salt === "string" ? parseInt(salt, 10) : salt;
 
      // Hash the password using the salt rounds
      return await bcrypt.hash(newPassword, saltRounds);
    } catch (error) {
      console.log("bcrypt User error", error);
      throw error;
    }
  },
  comparePassword: async (password, hashedPassword) => {
    const bcrypt = require("bcrypt");
    return await bcrypt.compare(password, hashedPassword);
  },
  fileUpload: async (file, folder = "images") => {
    try {

      console.log("uvguvgyvgyvgyuv",file)
      if (!file || !file.name) {
        console.error("File is missing or invalid:", file);
        return null;
      }
 
      let fileExtension = file.name.split(".").pop();
      const name = uuid() + "." + fileExtension;
      const filePath = path.join(__dirname, "..", "public", folder, name);
 
      await file.mv(filePath); // .mv supports promises if you await it
 
      return `/images/${name}`;
    } catch (error) {
      console.error("Error during file upload:", error);
      return null;
    }
  },
 sidIDGeneratwTwilio: async(req ,res) =>
 {
  try{
  const serviceSID= await otpManager.createserviceSID("appCleaning","4");
  console.log("serviceSID created",serviceSID);
  return serviceSID;
  }
  catch(error)
  {
    console.log("error while generating serviceSID",error);
    throw new Error("failed to generate serviceSID");
  }
 },

otpSendLinkHTML : async (req, email, otp, subject = "Verify your account") => {
  try {
    // Email template merged here as an inner function
    const otpEmailTemplate = (req, otp) => `
      <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 25px; border-radius: 12px; font-family: 'Segoe UI', Tahoma, sans-serif; box-shadow: 0px 6px 18px rgba(0, 0, 0, 0.08); text-align: center; border: 1px solid #eee;">
        <!-- Header -->
        <h2 style="color: #2e2e2e; font-size: 24px; margin-bottom: 10px;">Verification Required</h2>
        <p style="font-size: 16px; color: #555; margin: 0 0 20px;">
          Use the one-time code below to continue.
        </p>
        <!-- OTP Card -->
        <div style="margin: 20px auto; padding: 20px; background: linear-gradient(135deg, #e6f9f0, #ffffff); border: 2px dashed #2ecc71; border-radius: 10px; display: inline-block; min-width: 220px;">
          <span style="font-size: 32px; font-weight: bold; color: #2ecc71; letter-spacing: 6px;">${otp}</span>
        </div>
        <!-- Info -->
        <p style="font-size: 14px; color: #666; margin-top: 20px;">
          Do not share it with anyone.
        </p>
        <p style="font-size: 13px; color: #999; margin: 5px 0;">
          If you didn’t request this code, you can ignore this email.
        </p>
        <!-- Divider -->
        <hr style="border: 0.5px solid #eee; margin: 25px 0;">
        <!-- Footer -->
        <p style="font-size: 12px; color: #aaa;">&copy; 2025 demo. All rights reserved.</p>
      </div>
    `;

    let transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: false,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    let mailOptions = {
      from: `"Sefati" <${process.env.MAIL_USERNAME}>`,
      to: email,
      subject: subject,
      html: otpEmailTemplate(req, otp),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ OTP Email sent:", info.messageId);

    return true;
  } catch (error) {
    console.log("otpSend error", error);
    throw error;
  }
},
 generateOTP: (length = 4) => 
 {  return Math.floor(1000 + Math.random() * 9000)
      .toString()
      .slice(0, length);
  },

    getHost: async (req, res) => {
    const host =
      req.headers.host || `${req.hostname}:${req.connection.localPort}`;
    return host;
  },
  sendMail:async(req,email,subject="notification",message="Just message for confirmation")=>
  {
    try
    {
       const htmlTemplate=`<div style="max-width: 600px; margin: auto; background: #ffffff; padding: 25px; border-radius: 10px; 
                  font-family: 'Segoe UI', Tahoma, sans-serif; box-shadow: 0px 4px 12px rgba(0,0,0,0.08);">
        <h2 style="color: #2e2e2e; text-align: center;">${subject}</h2>
        <p style="font-size: 16px; color: #555; text-align: center;">${message}</p>
        <hr style="border: 0.5px solid #eee; margin: 25px 0;">
        <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; 2025 Demo. All rights reserved.</p>
      </div>`
       let transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: false,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
       
    });
     let mailOptions = {
      from: `"Sefati" <${process.env.MAIL_USERNAME}>`,
      to: email,
      subject: subject,
      text:message,
      html: htmlTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅  Email sent:", info.messageId);

    return true;
    }
    catch(error)
    {
      console.log("EMAIIL NOT SEND",error)
    }
  }
 }
 
