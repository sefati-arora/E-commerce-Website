require("dotenv").config();
const Models = require("../models/index");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const helper = require("../helper/validation");
const commonhelper = require("../helper/commonHelper");
const argon2 = require("argon2");
const stripe = require("stripe")(process.env.STRIPE_SK);
const { Op, literal } = require("sequelize");
const axios = require("axios");
// const PDFDocument = require("pdfkit");
const otpManager = require("node-twillo-otp-manager")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
  process.env.TWILIO_SERVICE_SID
);
Models.cartManageModel.hasMany(Models.cartModel, { foreignKey: "cartId" });
Models.cartModel.belongsTo(Models.cartManageModel, { foreignKey: "cartId" });
Models.cartModel.belongsTo(Models.productModel, { foreignKey: "productId" });
Models.productModel.hasMany(Models.cartModel, { foreignKey: "productId" });
Models.orderItemModel.belongsTo(Models.orderModel, { foreignKey: "orderId" });
Models.orderModel.hasMany(Models.orderItemModel, { foreignKey: "orderId" });
Models.productModel.hasMany(Models.storeModel, { foreignKey: "productId" });
Models.storeModel.belongsTo(Models.productModel, { foreignKey: "productId" });
Models.userModel.hasMany(Models.orderModel, { foreignKey: "userId" });
Models.orderModel.belongsTo(Models.userModel, { foreignKey: "userId" });
Models.productModel.hasMany(Models.orderItemModel, { foreignKey: "productId" });
Models.productModel.hasMany(Models.productImage, { foreignKey: "productId" });
Models.productImage.belongsTo(Models.productModel, { foreignKey: "productId" });
Models.orderItemModel.belongsTo(Models.productModel, {
  foreignKey: "productId",
});
Models.productReviewModel.hasMany(Models.likeModel, {
  foreignKey: "ReviewId",
});

Models.likeModel.belongsTo(Models.productReviewModel, {
  foreignKey: "ReviewId",
  as: "ReviewLikes",
});

module.exports = {
  sidIdGenerateTwilio: async (req, res) => {
    try {
      const serviceSid = await otpManager.createServiceSID("Test", "4");
      console.log("Service SID created:", serviceSid);
      return serviceSid;
    } catch (error) {
      console.error("Error generating Service SID:", error);
      throw new Error("Failed to generate Service SID");
    }
  },
  signUp: async (req, res) => {
    try {
      const schema = Joi.object({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        phoneNumber: Joi.string().required(),
        countryCode: Joi.string().required(),
        email: Joi.string().required(),
        password: Joi.string().required(),
        devicetoken: Joi.string().required(),
        role: Joi.string().required(),
        isOnline: Joi.string().required(),
        location: Joi.string().required(),
        latitude: Joi.string().required(),
        longitude: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const {
        firstName,
        lastName,
        phoneNumber,
        countryCode,
        email,
        password,
        devicetoken,
        isOnline,
        role,
        locationFrom,
        latitude,
        longitude,
      } = payload;
      //    const users=await Models.userModel.findOne({where:{email:payload.email,phoneNumber:payload.phoneNumber}})
      // if(users)
      // {
      //   return res.status(404).json({message:"User already exist"})
      // };
      const hashpassword = await argon2.hash(password);
      const customer = await stripe.customers.create({
        description: "anything",
        email: payload.email,
      });
      const file = req.files?.profile;
      if (!file) {
        return res.status(400).json({ message: "Profile image is required" });
      }

      const path = await commonhelper.fileUpload(file);

      const user = await Models.userModel.create({
        firstName,
        lastName,
        phoneNumber,
        countryCode,
        email,
        password: hashpassword,
        devicetoken,
        profile: path,
        role,
        isOnline,
        locationFrom,
        latitude,
        longitude,
        customerId: customer.id,
      });
      if (user) {
        const phone = payload.countryCode + payload.phoneNumber;
        let response = await otpManager.sendOTP(phone);
        console.log(`✅ OTP sent successfully to ${payload.phoneNumber}`);
        console.log(response);
      }
      const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY);
      return res.status(200).json({ message: "USER CREATED!", user, token });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  login: async (req, res) => {
    try {
      const schema = Joi.object({
        email: Joi.string().required(),
        password: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const { email, password } = payload;
      const hashpassword = await argon2.hash(password);
      const customer = await stripe.customers.create({
        description: "anything",
        email: payload.email,
      });
      const user = await Models.userModel.create({
        email,
        password: hashpassword,
        customerId: customer.id,
      });
      const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY);
      return res.status(200).json({ message: "USER LOGIN", user, token });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  logOut: async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await Models.userModel.findOne({ where: { id: userId } });
      if (user) {
        await Models.userModel.update(
          { devicetoken: null },
          { where: { id: userId } }
        );
      }
      return res.status(200).json({ message: "USER LOGOUT!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  userDelete: async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await Models.userModel.destroy({ where: { id: userId } });
      return res.status(200).json({ message: "USER DELETED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERRROR", error });
    }
  },
  forgetpassword: async (req, res) => {
    try {
      const schema = Joi.object({
        email: Joi.string()
          .email({ tlds: { allow: ["com", "net", "org", "in", "us"] } })
          .required()
          .label("Email"),
        password: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const { email, password } = payload;
      const otp = Math.floor(1000 + Math.random() * 9000);
      const hashpassword = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
      const user = await Models.userModel.create({
        email,
        password: hashpassword,
      });
      try {
        await commonhelper.otpSendLinkHTML(req, email, otp);
        console.log(`OTP sent (${email}): ${otp}`);
      } catch (error) {
        await Models.userModel.destroy({ where: { id: user.id } });
        return res.status(400).json({ message: "Failed to send OTP" });
      }
      return res.status(200).json({ message: "NEW PASSWORD CREATED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  changePassword: async (req, res) => {
    try {
      const userId = req.user.id;
      console.log("userId:", userId);
      const schema = Joi.object({
        oldpassword: Joi.string().required(),
        newpassword: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref("newpassword")).required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const { oldpassword, newpassword } = payload;
      const user = await Models.userModel.findOne({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      console.log("userId:", userId);
      console.log("hash", user.password);
      console.log(">>>>", oldpassword);
      const validpassword = await argon2.verify(
        user.password,
        oldpassword.trim()
      );
      if (!validpassword) {
        return res.status(404).json({ message: "INVALID PASSWORD" });
      }
      const hashedPassword = await argon2.hash(newpassword, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
      const existuser = await Models.userModel.update(
        { password: hashedPassword },
        { where: { id: userId } }
      );
      return res.status(200).json({ message: "PASSWORD CHANGED!", existuser });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  editProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      console.log(">>>", userId);
      const {
        firstName,
        lastName,
        phoneNumber,
        countryCode,
        email,
        location,
        latitude,
        longitude,
      } = req.body;
      const user = await Models.userModel.findOne({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      let profilepath = user.profile;
      if (req.files?.profile) {
        const file = req.files.profile;
        profilepath = await commonhelper.fileUpload(file);
      }
      await Models.userModel.update(
        {
          firstName,
          lastName,
          phoneNumber,
          countryCode,
          email,
          profile: profilepath,
          role,
          isOnline,
          isorderassign,
          location,
          latitude,
          longitude,
        },
        { where: { id: userId } }
      );
      return res.status(200).json({ message: "USER DATA UPDATED", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  clearNotification: async (req, res) => {
    try {
      const { notificationId } = req.body;
      const notify = await Models.notificationModel.findOne({
        where: { notificationId },
      });
      if (notify) {
        await Models.notificationModel.destroy({ where: { notificationId } });
      }
      return res.status(200).json({ message: "NOTIFICATION CLEAR" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  address: async (req, res) => {
    try {
      const userId = req.user.id;
      console.log("userId", userId);
      const schema = Joi.object({
        country: Joi.string().required(),
        state: Joi.string().required(),
        city: Joi.string().required(),
        hnumber: Joi.string().required(),
        location: Joi.string().required(),
        latitude: Joi.string().required(),
        longitude: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const users = await Models.userModel.findOne({ where: { id: userId } });
      if (!users) {
        return res.status(404).json({ message: "USER NOT FOUND" });
      }
      console.log("userId", userId);
      const existingAddress = await Models.addressModel.findOne({
        where: { userId },
      });
      if (existingAddress) {
        return res
          .status(400)
          .json({ message: "Address already exists for this user" });
      }
      const user = await Models.addressModel.create({
        userId,
        country: payload.country,
        state: payload.state,
        city: payload.city,
        hnumber: payload.hnumber,
        location: payload.location,
        latitude: payload.latitude,
        longitude: payload.longitude,
      });
      return res.status(200).json({ message: "ADDRESS ADDED!", user, users });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  editAddress: async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId, country, state, city, hnumber, latitude, longitude } =
        req.body;
      const userexist = await Models.addressModel.findOne({
        where: { id: addressId, userId },
      });
      if (!userexist) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      await Models.addressModel.update(
        { country, state, city, hnumber, latitude, longitude },
        { where: { id: addressId, userId } }
      );
      return res.status(200).json({ message: "DATA UPDATED!" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  deleteAddress: async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.body;
      const user = await Models.addressModel.findOne({
        where: { id: addressId, userId },
      });
      if (!user) {
        return res.status(404).json({ message: "USER NOT FOUND" });
      }
      await Models.addressModel.destroy({ where: { id: addressId, userId } });
      return res.status(200).json({ message: "ADDRESS DELETED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  cartData: async (req, res) => {
    try {
      const userId = req.user.id;
      const schema = Joi.object({
        productId: Joi.string().required(),
        Quantity: Joi.number().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const { productId, Quantity } = payload;
      const product = await Models.productModel.findOne({
        where: { id: payload.productId },
      });
      if (!product) {
        return res.status(404).json({ message: "PRODUCT NOT FOUND!" });
      }
      const user = await Models.cartModel.create({
        productId,
        Quantity,
      });
      return res.status(200).json({ message: "YOU PRODUCT ADDED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  cartDataDeleted: async (req, res) => {
    try {
      const { cartId } = req.body;
      const cart = await Models.cartModel.findOne({ where: { id: cartId } });
      if (!cart) {
        return res.status(404).json({ message: "CART DATA NOT FOUND!" });
      }
      await Models.cartModel.destroy({ where: { id: cartId } });
      return res.status(200).json({ message: "CART DATA DELETED!", cart });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  getproduct: async (req, res) => {
    try {
      const { productId } = req.body;
      console.log(">>>>", req.body);

      if (!productId) {
        return res.status(404).json({ message: "ID NOT FOUND!" });
      }
      const product = await Models.productModel.findOne({
        where: { id: productId },
      });
      if (!product) {
        return res.status(404).json({ message: "PRODUCT NOT FOUND!" });
      }
      return res.status(200).json({ message: "PRODUCT DATA GET!", product });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  addressDefault: async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.body;
      const user = await Models.addressModel.findOne({
        where: { id: addressId, userId },
      });
      if (!user) {
        return res.status(404).json({ message: "USER ADDRESS NOT FOUND" });
      }
      await Models.addressModel.update(
        { isDefault: 1 },
        { where: { id: addressId } }
      );
      const update = await Models.addressModel.findOne({
        where: { id: addressId, userId },
      });
      return res.status(200).json({ message: "ADDRESS DEFAULT SET!", update });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  subscriptionBuy: async (req, res) => {
    try {
      const userId = req.user.id;
      const { subscriptionId, subscriptionType } = req.body;
      const subscriptionBuy = await Models.subscriptionModel.findOne({
        where: { id: subscriptionId },
      });
      if (!subscriptionBuy) {
        return res.status(404).json({ message: "SUBSCRIPTION NOT FOUND!" });
      }
      const startDate = new Date();
      const EndDate = new Date(startDate);
      if (subscriptionBuy.subscriptionType == 0) {
        EndDate.setMonth(EndDate.getMonth() + 1);
      } else if (subscriptionBuy.subscriptionType == 1) {
        EndDate.setFullYear(EndDate.getFullYear() + 1);
      } else {
        return res.status(404).json({ message: "ERROR INVALID SUBSCRIPTION!" });
      }
      const sub = await Models.subscriptionBuyModel.create({
        userId,
        subscriptionId,
        subscriptionType,
        startDate: startDate,
        EndDate: EndDate,
      });
      const Update=await Models.subscriptionBuyModel.update({status:1},{where:{subscriptionId}})
      return res.status(200).json({ message: "SUBSCRIPTION BUY", sub,Update });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  subscriptionCancel:async(req,res) =>
  {
      try
      {
        const userId=req.user.id;
        const {subscriptionId}=req.body;
        const subscription=await Models.subscriptionBuyModel.findOne({where:{id:subscriptionId,userId}})
        if(!subscription)
        {
           return res.status(404).json({message:"SUBSCRIPTION NOT FOUND!"})
        }
        else
        {
          await Models.subscriptionBuyModel.destroy({where:{id:subscriptionId}})
        }
      const Update= await Models.subscriptionModel.update({ status:1, DeleteAt: new Date() },{where:{id:subscriptionId}});
        return res.status(200).json({message:"SUBSCRIPTION CANCELED!",Update})
      }
      catch(error)
      {
        console.log(error );
        return res.status(500).json({message:"ERROR",error})
      }
  },
  AddCartItem: async (req, res) => {
    try {
      const userId = req.user.id;
      const { productId, Quantity } = req.body;
      if (!productId || !Quantity) {
        return res.status(400).json({
          message: "productId and quantity are required!",
        });
      }
      let cart = await Models.cartManageModel.findOne({ where: { userId } });
      if (!cart) {
        cart = await Models.cartManageModel.create({ userId });
      }
      let cartItem = await Models.cartModel.findOne({
        where: { cartId: cart.id, productId },
      });
      const productExists = await Models.productModel.findOne({
        where: { id: productId },
      });
      if (!productExists) {
        return res.status(404).json({ message: "Product not found" });
      }
      if (cartItem) {
        cartItem.Quantity += Number(Quantity);
        await cartItem.save();
      } else {
        cartItem = await Models.cartModel.create({
          cartId: cart.id,
          productId,
          Quantity,
        });

      }
      const cartData = await Models.cartManageModel.findOne({
        where: { id: cart.id },
        include: [
          {
            model: Models.cartModel,
            include: [
              {
                model: Models.productModel,
                include: {
                  model: Models.productImage,
                },
              },
            ],
          },
        ],
      });
      const countProduct=await Models.cartModel.findAndCountAll({where:{productId},
      include:[{
        model:Models.productModel
      }]})

      return res.status(200).json({
        message: "Cart updated successfully",
        countProduct,
        cartItem,
        cartData,
      });
    } catch (error) {
      console.error("AddCartItem Error:", error);
      return res.status(500).json({
        message: "Internal server error",
        error: error.message,
      });
    }
  },
  UpdateCart: async (req, res) => {
    try {
      const userId = req.user.id;
      const { cartId, Quantity } = req.body;

      // if (!cartItemId || !Quantity) {
      //   return res.status(400).json({
      //     message: "cartItemId and Quantity are required",
      //   });
      // }

      const userCart = await Models.cartManageModel.findOne({
        where: { userId },
      });

      if (!userCart) {
        return res.status(404).json({ message: "USER CART NOT FOUND!" });
      }
      const cartItem = await Models.cartModel.findOne({
        where: { id: cartId },
      });
      console.log("USER:", userId);
      console.log("USER CART ID:", userCart?.id);

      if (!cartItem) {
        return res.status(404).json({ message: "CART ITEM NOT FOUND!" });
      }
      cartItem.Quantity = Quantity;
      await cartItem.save();
      return res.status(200).json({
        message: "CART UPDATED!",
        updatedItem: cartItem,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "ERROR", error: error.message });
    }
  },
  DeleteCart: async (req, res) => {
    try {
      const { cartItemId } = req.body;
      let cart = await Models.cartModel.findOne({ where: { id: cartItemId } });
      if (cart) {
        cart = await Models.cartModel.destroy({ where: { id: cartItemId } });
      } else {
        return res.status(404).json({ message: "CART ITEM NOT FOUND!" });
      }
      return res.status(200).json({ message: "DATA DELETED!", cart });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  checkout: async (req, res) => {
    try {
      const userId = req.user.id;
      const userLatitude = req.user.latitude;
      const userLongitude = req.user.longitude;
      const { addressId, productId, storeId,assignDriverId} = req.body;
      if (!addressId)
        return res.status(404).json({ message: "ADDRESS REQUIRED!" });
      const address = await Models.addressModel.findOne({
        where: { id: addressId, userId, isDefault: 1 },
      });
      if (!address) {
        return res.status(404).json({ message: "Invalid data!" });
      }
      console.log("PRODUCT ID:", productId);

      //...........STOREID..........................
      const stored = await Models.storeModel.findOne({
        where: { id: storeId },
      });
      if (!stored) {
        console.log("storeId:", stored);
      }

      //...................SELLERID...................
      let seller = await Models.userModel.findOne({
        where: { id: userId, role: 3 },
      });
      if (!seller) {
        console.log("sellerId not found!");
      }

      //.........PRODUCT IN STORE............
      const product = await Models.storeModel.findAll({
        where: { productId },
        include: [
          {
            model: Models.productModel,
          },
        ],
      });
      console.log("STORE RESULT:", product);
      if (product.length === 0) {
        return res.status(404).json({ message: "PRODUCT OUT OF STOCK!" });
      }

      //........STORE NEARBY........
      const nearestStore = await Models.userModel.findOne({
        where: { id: userId, role: 3 },
        order: literal(`
        6371 * acos(
      cos(radians(${userLatitude})) *
      cos(radians(latitude)) *
      cos(radians(longitude) - radians(${userLongitude})) +
      sin(radians(${userLatitude})) *
      sin(radians(latitude))
    )
  `),
        limit: 1,
      });
      console.log("NEAR STORE:", nearestStore);
      console.log(">>>", userLatitude);
      console.log("<<<<<", userLongitude);
       //assignDriver
       const driver=await Models.userModel.findOne({where:{id:assignDriverId,role:2}})
       if(!driver)
       {
        return res.status(404).json({message:"DRIVER NOT FOUND!"})
       }
      //cart product
      const cart = await Models.cartManageModel.findOne({
        where: { userId },
        include: [
          {
            model: Models.cartModel,
            include: [Models.productModel],
          },
        ],
      });

      console.log("======", cart);
      if (!cart || cart.cartTables.length === 0)
        return res.status(404).json({ message: "Cart is empty" });
      // Calculate total
      let total = 0;
      cart.cartTables.forEach((item) => {
        let price = item.productTable.price;
        let offerPercentage = item.productTable.offer || 0;
        let discount = offerPercentage / 100;
        let finalPricePerItem = price * (1 - discount);
        total += finalPricePerItem * item.Quantity;
      });
      // Create order
      const order = await Models.orderModel.create({
        userId,
        addressId,
        storeId,
        assignDriverId,
        Amount: total,
        status: 0,
      });

      // Create order items
      for (let items of cart.cartTables) {
        await Models.orderItemModel.create({
          orderId: order.id,
          userId,
          addressId,
          productId: items.productId,
          Quantity: items.Quantity,
          price: items.productTable.price,
          title: items.productTable.title,
        });
      }

      //order history.........
      const orderhistory = await Models.userModel.findAll({
        where: { id: userId },
        include: [
          {
            model: Models.orderModel,
          },
        ],
      });
      console.log("order history:", orderhistory);

      //SEND MAIL AFTER PLACING ORDER!
      const secondAgo = new Date(Date.now() - 1000);
      const usermail = await Models.userModel.findOne({
        where: { id: userId },
        include: [
          {
            model: Models.orderModel,
            where: {
              createdAt: {
                [Op.gte]: secondAgo,
              },
            },
            include: [
              {
                model: Models.orderItemModel,
                include: [{ model: Models.productModel }],
              },
            ],
          },
        ],
      });

      // Check mail and order details
      if (usermail && usermail.email) {
        const latestOrder = usermail.orderTables?.[0];
        const productDetails = latestOrder.orderItemTables
          .map((item) => {
            const product = item.productTable;
            return `
Product: ${product?.title}
Price: ${item.price}
Quantity: ${item.Quantity}
    `;
          })
          .join("\n");
        const emailBody = `
Hello ${usermail.name || "User"},
Thank you for your purchase!

Here are your order details:
Order ID: ${latestOrder?.id}
Total Amount: ${latestOrder?.Amount}
Address: ${address.hnumber}, ${address.city}, ${address.state}, ${
          address.country
        }
Product Details:
${productDetails}
`;
        // Send the email
        await commonhelper.sendMail(
          req,
          usermail.email,
          "Your Order Details",
          emailBody
        );

        console.log(`ORDER EMAIL SENT TO: ${usermail.email}`);
      }
      //Clear cart items
       await Models.cartModel.destroy({ where: { cartId: cart.id } });
      return res.status(200).json({
        message: "Order placed successfully",
        orderId: order.id,
        totalAmount: total,
        cart,
        product,
        nearestStore,
        orderhistory,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  orderList: async (req, res) => {
    try {
      const order = await Models.orderModel.findAll({
        include: [
          {
            model: Models.orderItemModel,
          },
        ],
      });
      return res.status(200).json({ message: "ORDER GET!", order });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  orderDetails: async (req, res) => {
    try {
      const { orderId } = req.body;
      const order = await Models.orderModel.findOne({
        where: { id: orderId },
        include: [
          {
            model: Models.orderItemModel,
          },
        ],
      });

      return res.status(200).json({ message: "ORDER'S DETAILS GET!", order });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  driverlist: async (req, res) => {
    try {
      const userId = req.user.id;
      const drivers = await Models.userModel.findOne({
        where: {
          id: userId,
          isOnline: 1,
          isorderassign: 0,
        },
      });
      console.log(">>>>", drivers);
      return res
        .status(200)
        .json({ message: "DRIVER AVAILABLE ARE:", drivers });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  orderAssign: async (req, res) => {
    try {
      const userId = req.user.id;
      const { orderId } = req.body;

      // Find the driver
      const driver = await Models.userModel.findOne({
        where: { id: userId, role: 2 },
      });
      if (!driver) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      if (driver.isOnline === 0) {
        return res.status(404).json({ message: "DRIVER IS OFFLINE" });
      }
      // Find the order
      const order = await Models.orderModel.findOne({ where: { id: orderId } });
      if (!order) return res.status(404).json({ message: "ORDER NOT FOUND!" });

      //  Find the seller
      const seller = await Models.userModel.findOne({
        where: {  role: 3 },
      });
      if (!seller)
        return res.status(404).json({ message: "SELLER NOT FOUND!" });

      //  Assign driver
      await Models.userModel.update(
        { isorderassign:1,status:2},
        { where: { id: userId } }
      );

      // Notify driver
      const driverassign=await Models.notificationModel.create({
        senderId: seller.id,
        receiverId: userId,
        orderId: order.id,
        title: "YOU HAVE BEEN ASSIGNED TO AN ORDER",
        message: "Please prepare to deliver the order.",
      });
      console.log(">>>",driverassign)

      // Notify order owner
    const orderowner=   await Models.notificationModel.create({
        senderId: userId,
        receiverId: order.userId,
        orderId: order.id,
        title: "YOUR ORDER HAS BEEN ASSIGNED",
        message: "A driver is on the way to deliver your order.",
      });
      console.log(">>>>",orderowner)

      //Notify order placed
     const orderplaced= await Models.notificationModel.create({
        senderId: seller.id,
        receiverId: order.userId,
        orderId: order.id,
        title: "ORDER PLACED SUCCESSFULLY",
        message: "Your order has been placed and is being processed.",
      });
      console.log(">>>>",orderplaced)

      return res
        .status(200)
        .json({ message: "ORDER ASSIGNED SUCCESSFULLY", driver });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  createStore: async (req, res) => {
    try {
      const sellerId = req.user.id;
      const { productId } = req.body;
      if (!productId) {
        return res.status(404).json({ message: "PRODUCT NOT FOUND!" });
      }
      const seller = await Models.storeModel.create({ sellerId, productId });
      return res.status(200).json({ message: "STORE CREATED!", seller });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  StoreProduct: async (req, res) => {
    try {
      const sellerId = req.user.id;
      const store = await Models.storeModel.findOne({
        where: { sellerId },
        include: [
          {
            model: Models.productModel,
          },
        ],
      });
      return res.status(200).json({ message: "PRODUCT IN STORE!", store });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  productReview: async (req, res) => {
    try {
      const userId = req.user.id;
      const { productId } = req.body;
      const schema = Joi.object({
        productId: Joi.string().required(),
        message: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const file = req.files.file;
      const path = await commonhelper.fileUpload(file);
      const { message } = payload;
      const review = await Models.productReviewModel.create({
        userId,
        productId,
        message,
        image: path,
      });
      return res.status(200).json({ message: "REVIEW BY USER", review });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  createLike: async (req, res) => {
    try {
      const userId = req.user.id;
      const { ReviewId } = req.body;
      const existingLike = await Models.likeModel.findOne({
        where: { userId, ReviewId },
      });
      if (existingLike) {
        return res.status(400).json({ message: "Already liked" });
      }
      const like = await Models.likeModel.create({ userId, ReviewId });

      return res.status(200).json({ message: "LIKE CREATED", like });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  countLikes: async (req, res) => {
    try {
      const { ReviewId } = req.body;
      const likes = await Models.likeModel.findAndCountAll({
        where: { ReviewId },
        include: [
          {
            model: Models.productReviewModel,
            as: "ReviewLikes",
          },
        ],
      });
      return res.status(200).json({ message: "USER LIKES:", likes });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  productListing: async (req, res) => {
    try {
      const search = (req.query.search || "").trim();
      const categoryId = req.query.categoryId || null;

      let where = {};

      // Add search filter if search text exists
      if (search !== "") {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ];
      }
      if (categoryId) {
        where.categoryId = categoryId;
      }
      const products = await Models.productModel.findAll({ where });

      return res.status(200).json({
        message: "Product listing",
        products,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  productRange:async(req,res) =>
  {
    try
    {
      const {title,minPrice,maxPrice}=req.body;
      if (!minPrice || !maxPrice) {
      return res.status(400).json({ message: "Please provide minPrice & maxPrice" });
    }
      const products=await Models.productModel.findAll({where:{title,
        price: {
          [Op.between]: [minPrice, maxPrice]
        }
      }})
      if (products.length === 0) {
      return res.status(404).json({ message: "No products found in this price range" });
    }
       
      return res.status(200).json({message:"PRODUCT FILTER!",products})
    } 
    catch(error)
    {
      console.log(error)
      return res.status(500).json({message:"ERROR",error})
    }
  },
  paymentCreateCOD: async (req, res) => {
    try {
      const userId = req.user.id;
      const { productId, currency, Amount } = req.body;

      if (!productId || !Amount || !currency) {
        return res
          .status(400)
          .json({ message: "productId, Amount, and currency are required" });
      }

      const payment = await Models.transationModel.create({
        userId,
        productId,
        currency,
        Amount,
        paymentStatus: 0, // pending
        paymentMethod: 0, // COD
      });
      const notification = await Models.notificationModel.create({
        receiverId: userId,
        title: "pay your amount after order delievered!",
        description: "PAYEMENT MADE COD",
      });
      return res
        .status(200)
        .json({ message: "COD Order Created!", payment, notification });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  createstripe: async (req, res) => {
    try {
      let response = {
        SK: process.env.STRIPE_SK,
        PK: process.env.STRIPE_PK,
      };
      return res.status(200).json({ message: "STRIPE DATA", response });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  createCard: async (req, res) => {
    try {
      const response = await commonhelper.createcard(
        req.user.customerId,
        req.body.cardToken
      );
      if (!response) {
        return res.status(404).json({ message: "ERROR IN CREATION" });
      }
      return res.status(200).json({ message: "CREATE CARD", response });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR!" });
    }
  },
  getToken: async (req, res) => {
    try {
      const token = { id: "tok_visa" };
      console.log("TEST CARD", token.id);
      return res.status(200).json({ message: "TOKEN", token });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  cardList: async (req, res) => {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: req.user.customerId,
        type: "card",
      });
      const customer = await stripe.customers.retrieve(req.user.customerId);
      const defaultpaymentMethodId =
        customer.invoice_settings.default_payment_method;
      console.log("defaultpayment", defaultpaymentMethodId);
      const cardsWithDefaultFlag = paymentMethods.data.map((card) => {
        const isDefault = card.id === defaultpaymentMethodId;
        console.log(`Card ID: ${card.id}, Is Default: ${isDefault}`);
        return {
          ...card,
          isDefault,
        };
      });
      return res
        .status(200)
        .json({ message: "CARD LIST:", cardsWithDefaultFlag });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  createPayment: async (req, res) => {
    try {
      const { amount, cardId } = req.body;
      const response = await stripe.paymentIntents.create({
        amount: parseInt(amount * 100),
        currency: "usd",
        customer: req.user.customerId,
        payment_method: cardId,
        confirm: true,
        return_url: "http://localhost:3000/users/cmcUser",
      });
      return res.status("200").json({ message: "PAYMENT CREATE", response });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  stripeIntent: async (req, res) => {
    try {
      console.log(">>>", req.body);
      let userDetail = await Models.userModel.findOne({
        where: { id: req.user.id },
      });
      const stripeCustomerId = userDetail.customerId;
      const ephemeralKey = await stripe.ephemeralKeys.create(
        {
          customer: stripeCustomerId,
        },
        { apiVersion: "2023-10-16" }
      );
      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseInt(req.body.amount) * 100,
        currency: "usd",
        customer: stripeCustomerId,
        automatic_payment_methods: {
          enabled: true,
        },
      });
      let result = {
        paymentIntent: paymentIntent.client_secret,

        ephemeralKey: ephemeralKey.secret,

        customer: userDetail.customerId,

        publishableKey: process.env.STRIPE_PK,

        transactionId: paymentIntent.id,
      };
      const { orderId } = req.body;
      let orderDetails = await Models.orderModel.findOne(
        { id: orderId },
        { where: { id: orderId } }
      );
      let objectToSave = {
        userId: req.user.id,
        orderId: orderDetails,
        amount: req.body.amount,

        chargeAmount: req.body.chargeAmount,

        transactionId: paymentIntent.id,

        description: `You received ${parseInt(req.body.amount)} $`,
      };

      await Models.transationModel.create(objectToSave);
      return res.status(200).json({ message: "DATA INTENT", result });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR" });
    }
  },
  // generatePdfFromApi: async (req, res) => {
  //   try {
  //     // 1️⃣ Fetch data from 3rd-party API
  //     const apiResponse = await axios.get(
  //       "https://jsonplaceholder.typicode.com/users"
  //     );
  //     const users = apiResponse.data; // example data

  //     // 2️⃣ Create PDF
  //     const doc = new PDFDocument();

  //     // Set response headers
  //     res.setHeader("Content-Type", "application/pdf");
  //     res.setHeader("Content-Disposition", "attachment; filename=users.pdf");

  //     // Pipe PDF to response
  //     doc.pipe(res);

  //     // Add PDF content
  //     doc.fontSize(20).text("Users Report", { align: "center" });
  //     doc.moveDown();

  //     users.forEach((user, index) => {
  //       doc.fontSize(12).text(`${index + 1}. ${user.name} - ${user.email}`);
  //     });

  //     // Finalize PDF
  //     doc.end();
  //   } catch (error) {
  //     console.error(error);
  //     res.status(500).send("Failed to generate PDF");
  //   }
  // },
};
