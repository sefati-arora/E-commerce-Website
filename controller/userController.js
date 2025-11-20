require("dotenv").config();
const Models = require("../models/index");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const helper = require("../helper/validation");
const commonhelper = require("../helper/commonHelper");
const argon2 = require("argon2");
const { Op, literal } = require("sequelize");
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
Models.orderItemModel.belongsTo(Models.productModel, {
  foreignKey: "productId",
});
Models.productReviewModel.hasMany(Models.likeModel, {
  foreignKey: "ReviewId"
});

Models.likeModel.belongsTo(Models.productReviewModel, {
  foreignKey: "ReviewId",as:"ReviewLikes"
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
        role,
        locationFrom,
        latitude,
        longitude,
      } = payload;
      const hashpassword = await argon2.hash(password);
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
        locationFrom,
        latitude,
        longitude,
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
      const user = await Models.userModel.create({
        email,
        password: hashpassword,
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
      const schema = Joi.object({
        oldpassword: Joi.string().required(),
        newpassword: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref("newpassword")).required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const { oldpassword, newpassword } = payload;
      const id = req.user.id;
      const user = await Models.userModel.findOne({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
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
        { where: { id: id } }
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
        profile,
        role,
        isOnline,
        isorderassign,
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
          profile,
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
      const userId = req.user.id.trim();
      const schema = Joi.object({
        country: Joi.string().required(),
        state: Joi.string().required(),
        city: Joi.string().required(),
        hnumber: Joi.string().required(),
        latitude: Joi.string().required(),
        longitude: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const users = await Models.userModel.findOne({ where: { id: userId } });
      if (!users) {
        return res.status(404).json({ message: "USER NOT FOUND" });
      }

      const user = await Models.addressModel.create({
        userId,
        country: payload.country,
        state: payload.state,
        city: payload.city,
        hnumber: payload.hnumber,
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
      const schema = Joi.object({
        productId: Joi.string().required(),
        Quantity: Joi.number().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const user = await Models.cartModel.create({
        productId: payload.productId,
        Quantity: payload.Quantity,
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
  subscriptionCreate: async (req, res) => {
    try {
      const schema = Joi.object({
        title: Joi.string().required(),
        subscriptionType: Joi.string().required(),
        Amount: Joi.string().required(),
        description: Joi.string().required(),
      });
      const payload = await helper.validationJoi(req.body, schema);
      const { title, subscriptionType, Amount, description } = payload;
      const user = await Models.subscriptionModel.create({
        title,
        subscriptionType,
        Amount,
        description,
      });
      return res.status(200).json({ message: "SUBSCRIPTION CREATED!", user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "error", error });
    }
  },
  subscriptionEdit: async (req, res) => {
    try {
      const { subscriptionId, title, subscriptionType, Amount, description } =
        req.body;
      const sub = await Models.subscriptionModel.findOne({
        where: { id: subscriptionId },
      });
      if (!sub) {
        return res.status(404).json({ message: "SUBSCRIPTION NOT FOUND!" });
      }
      await Models.subscriptionModel.update(
        { title, subscriptionType, Amount, description },
        { where: { id: subscriptionId } }
      );
      return res.status(200).json({ message: "SUBSCRIPTION UPDATED!" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  subscriptionDelete: async (req, res) => {
    try {
      const { subscriptionId } = req.body;
      const sub = await Models.subscriptionModel.findOne({
        where: { id: subscriptionId },
      });
      if (!sub) {
        return res.status(404).json({ message: "SUBSCRIPTION NOT FOUND!" });
      }
      await Models.subscriptionModel.destroy({ where: { id: subscriptionId } });
      return res.status(200).json({ message: "SUBSCRIPTION ID DELETED!" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  subscriptionBuy: async (req, res) => {
    try {
      const userId = req.user.id;
      const { subscriptionId } = req.body;
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
        startDate: startDate,
        EndDate: EndDate,
      });
      return res.status(200).json({ message: "SUBSCRIPTION BUY", sub });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  AddCartItem: async (req, res) => {
    try {
      const userId = req.user.id;
      const { productId, Quantity } = req.body;
      if (!productId || !Quantity) {
        return res
          .status(404)
          .json({ message: "prodctId and quantity not found!" });
      }
      let user = await Models.cartManageModel.findOne({ where: { userId } });
      if (!user) {
        user = await Models.cartManageModel.create({
          userId,
        });
      }
      const existuser = await Models.cartModel.findOne({
        where: { cartId: user.id, productId },
      });
      if (existuser) {
        existuser.Quantity += Number(Quantity);
        await existuser.save();
      } else {
        await Models.cartModel.create({
          cartId: user.id,
          productId,
          Quantity,
        });
      }
      const cartData = await Models.cartManageModel.findOne({
        where: { id: user.id },
        include: [
          {
            model: Models.cartModel,
            include: [
              {
                model: Models.productModel,
              },
            ],
          },
        ],
      });
      return res
        .status(200)
        .json({ message: "CART CREATED", existuser, cartData });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "ERROR", error });
    }
  },
  UpdateCart: async (req, res) => {
    try {
      const userId = req.user.id;
      const { cartItemId, Quantity } = req.body;
      const userCart = await Models.cartManageModel.findOne({
        where: { userId },
      });
      if (!userCart) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      const cartItem = await Models.cartModel.findOne({
        where: { cartId: userCart.id, id: cartItemId },
      });
      if (!cartItem) {
        return res.status(404).json({ message: "CART ITEM NOT FOUND!" });
      }
      const updatedRows = await Models.cartModel.update(
        { Quantity },
        { where: { cartId: userCart.id, id: cartItemId } }
      );
      return res.status(200).json({ message: "CART UPDATED!", updatedRows });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "ERROR", error });
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
      const {
        addressId,
        productId,
        storeId,
        assignDriverId,
      } = req.body;
      if (!addressId)
        return res.status(404).json({ message: "ADDRESS REQUIRED!" });
      const address = await Models.addressModel.findOne({
        where: { id: addressId, userId, isDefault: 1 },
      });
      if (!address) return res.status(404).json({ message: "Invalid data!" });
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
      const product = await Models.storeModel.findOne({
        where: { productId },
        include: [
          {
            model: Models.productModel,
          },
        ],
      });
      console.log("STORE RESULT:", product);
      if (!product) {
        return res.status(404).json({ message: "PRODUCT OUT OF STOCK!" });
      }

      //FIND STORE
      const store = await Models.productModel.findAll({
        where: { id: productId },
        include: [
          {
            model: Models.storeModel,
          },
        ],
      });
      console.log("PRODUCT IN STORE", store);

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
        Amount:total,
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
      //assign driver....
      const driver = await Models.userModel.findOne({
        where: { id: assignDriverId, role: 2 },
      });
      if (!driver) {
        console.log("driver not found!");
      }
      console.log("driver:", driver);
      //driver status...
      const driverstatus = await Models.userModel.findOne({
        where: { id: assignDriverId, role: 2 },
      });
      if (driverstatus) {
        await Models.userModel.update(
          { status: 1 },
          { where: { id: assignDriverId, role: 2 } }
        );
      }
      console.log("driver status:", driverstatus);
      // create notification after dispatch

      const dispatch = await Models.userModel.findOne({
        where: { id: assignDriverId, role: 2, status: 1 },
      });

      if (dispatch) {
        const existingNotification = await Models.notificationModel.findOne({
          where: {
            receiverId: userId,
            isnotification: 1,
          },
        });

        if (!existingNotification) {
          await Models.notificationModel.create({
            senderId: seller.id,
            receiverId: userId,
            orderId: order.id,
            title: "Order dispatched successfully",
            message: "ORDER DISPATCH!",
            isnotification: 1,
          });
        }
      }
      console.log("ORDER DISPATCHED:", dispatch);

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

      //NOTIFICATION FOR ORDER PLACING!
      const orderplace = await Models.orderModel.findOne({
        where: { id: order.id, userId },
      });
      if (orderplace) {
        await Models.notificationModel.create({
          senderId: userId,
          receiverId: userId,
          title: "CONGRATULATIONS,ORDER PLACED",
        });
      }

      //create notification
      const notified = await Models.notificationModel.create({
        senderId: userId,
        receiverId: assignDriverId,
        orderId: order.id,
        title: "NEW ORDER!",
        message: "NEW ORDER!",
      });
      console.log("new order notification", notified);

      // notification to user after assign driver
      const notification = await Models.notificationModel.create({
        senderId: seller.id,
        receiverId: userId,
        orderId: order.id,
        title: "YOUR DRIVER HAS BEEN ASSIGNED TO YOUR ORDER!",
        message: "DRIVER ASSIGN!",
      });
      console.log("driver assigned", notification);

      //order delivered notification....
      const delivered = await Models.userModel.findOne({
        where: { id: assignDriverId, role: 2 },
      });
      if (delivered) {
        await Models.userModel.update(
          { status: 2 },
          { where: { id: assignDriverId, role: 2 } }
        );
      }
      console.log("driver status:", delivered);
      const orderdelivered = await Models.userModel.findOne({
        where: { id: assignDriverId, role: 2, status: 2 },
      });
      if (orderdelivered) {
        await Models.notificationModel.create({
          senderId: seller.id,
          receiverId: userId,
          orderId: order.id,
          title: "ORDER DELIVERED",
          message: "ORDER DELIVERED SUCCESSFULLY!",
        });
      }
      console.log("ORDER DELIVERED NOTIFICATION", orderdelivered);
      //Clear cart items
      // await Models.cartModel.destroy({ where: { cartId: cart.id } });
      return res.status(200).json({
        message: "Order placed successfully",
        orderId: order.id,
        totalAmount:total,
        cart,
        product,
        nearestStore,
        notified,
        orderplace,
        orderhistory,
        notification,
        dispatch,
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
      const drivers = await Models.userModel.findAll({
        where: {
          isOnline: 1,
          isorderassign: 0,
        },
      });
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
      const driver = await Models.userModel.findOne({
        where: { id: userId, role: 2 },
      });
      if (!driver) {
        return res.status(404).json({ message: "USER NOT FOUND!" });
      }
      if (driver.isOnline === 0) {
        return res.status(404).json({ message: "DRIVER IS OFFLINE" });
      }
      if (driver.isorderassign === 1) {
        return res.status(404).json({ message: "DRIVER ALREADY ASSIGN" });
      }
      const order = await Models.orderModel.findOne({ where: { id: orderId } });
      if (!order) {
        return res.status(404).json({ message: "ORDER NOT FOUND!" });
      }
      await Models.userModel.update(
        { isOnline: 1, isorderassign: 1 },
        { where: { id: userId } }
      );
      return res.status(200).json({ message: "ORDER ASSIGN!", driver });
    } catch (error) {
      console.log(error);
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
  productReview:async(req,res) =>
  {
    try
    {
      const userId=req.user.id;
      const{productId}=req.body;
      const schema=Joi.object({
        productId:Joi.string().required(),
        message:Joi.string().required()
      });
      const payload=await helper.validationJoi(req.body,schema);
      const file = req.files.file;
      const path = await commonhelper.fileUpload(file);
      const{message}=payload;
      const review=await Models.productReviewModel.create({userId,productId,message,image:path});
      return res.status(200).json({message:"REVIEW BY USER",review})
    }
    catch(error)
    {
      console.log(error)
      return res.status(500).json({message:"ERROR",error})
    }
  },
 createLike: async (req, res) => {
  try {
    const userId = req.user.id;
    const { ReviewId } = req.body;
    const existingLike = await Models.likeModel.findOne({
      where: { userId, ReviewId }
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
countLikes:async(req,res)=>
{
  try
  {
    const{ReviewId}=req.body;
    const likes=await Models.likeModel.findAndCountAll({
      where:{ReviewId},
      include:
      [
        {
          model:Models.productReviewModel,
          as:"ReviewLikes"
        }
      ]
    })
    return res.status(200).json({message:"USER LIKES:",likes})
  }
  catch(error)
  {
    console.log(error)
    return res.status(500).json({message:"ERROR",error})
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
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    const products = await Models.productModel.findAll({ where });

    return res.status(200).json({
      message: "Product listing",
      products
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "ERROR", error });
  }
}
};
